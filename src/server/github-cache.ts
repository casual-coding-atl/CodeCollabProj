import { connectDB } from './db';
import { GithubCache } from './models';
import { githubRequest, fetchPublicRepo, type FetchRepoResult, type RepoRef } from './github';
import { REPO_CARD_FRESHNESS_MS, type RepoCardResponse } from '../types/github';

/**
 * The cached read path in front of GitHub (PRD #88, design doc phase 2).
 *
 * `src/server/github.ts` owns the single outbound edge (`githubRequest`); this
 * module wraps it and nothing else calls out. What it adds is a shared,
 * server-side cache in the `github_cache` collection — the data is public, so
 * one entry serves every visitor, signed in or not, and a project page with
 * three repo cards costs at most three GitHub requests per ten minutes rather
 * than three per view.
 *
 * ## Two tiers of lifetime
 *
 * Every entry carries two timestamps, and they mean different things:
 *
 *  - `fetchedAt` — when GitHub last said this. **Freshness** is measured from
 *    here (ten minutes for a repo card). Past it, the entry is *stale*: still
 *    perfectly readable, just no longer trusted enough to serve on its own.
 *  - `expiresAt` — `fetchedAt` + `CACHE_RETENTION_MS` (a day), and the field a
 *    Mongo TTL index reaps on. **Readability** ends here.
 *
 * The gap between the two is the whole point. A single-TTL cache deletes the
 * entry the moment it goes stale, so the one time you most need old data — a
 * rate limit, a GitHub outage — is exactly when you have none. Keeping stale
 * documents readable for a day means an outage degrades a card to "slightly out
 * of date" instead of "unavailable".
 *
 * ## What gets stored
 *
 * Every answer is classified before it goes anywhere near the collection
 * (`classifyRepoAnswer`), because *status alone is not enough*:
 *
 *  - **store** — a 404, or a 2xx whose body is actually a usable repository.
 *  - **pass** — conclusive, but not ours to keep. A `private: true` body is the
 *    case: a `GITHUB_TOKEN` that can see private repositories must never leave
 *    one in a cache that serves every visitor. It is also not a reason to fall
 *    back to the stale entry, which would be the public snapshot the repository
 *    had before it was made private.
 *  - **retryable** — GitHub is busy (403/429/5xx) or sent something unusable (a
 *    truncated body, a 200 with no id). Neither may overwrite good data, and
 *    both prefer a stale entry over failing.
 *
 * Classifying the *body*, not just the status, is what stops a truncated 200
 * from replacing a good entry and then being served as fresh for ten minutes.
 *
 * ## Known limitation: no single flight
 *
 * Concurrent cold misses for the same path each make their own GitHub request;
 * the last writer wins and the rest are wasted. This is bounded — the proxy
 * only serves repositories a project actually links, so the herd is the number
 * of people looking at one project page in the same second — and the fix (a
 * distributed lease in Mongo, with the failure modes a lock brings) costs more
 * than the requests it would save. If this ever shows up in the rate-limit
 * budget, that is the change to make.
 *
 * The decisions (`normalizeCachePath`, `cacheState`, `classifyRepoAnswer`,
 * `cacheEntryFromDoc`, `readThrough`, `repoCardPayload`) are pure or
 * dependency-injected, and tested directly in `github-cache.test.ts` with a fake
 * store and a fake upstream.
 */

export { REPO_CARD_FRESHNESS_MS };

/** How long an entry stays *readable* after it stops being fresh. */
export const CACHE_RETENTION_MS = 24 * 60 * 60 * 1000;

/**
 * Freshness for the check the link endpoint runs before saving a repository.
 *
 * Deliberately much shorter than a card's ten minutes: a member who has just
 * made a repository public, or just created it, should not be told for another
 * ten minutes that it does not exist. A minute is still enough to stop somebody
 * from spending a GitHub request per submission by pasting the same wrong URL
 * over and over.
 */
export const LINK_VALIDATION_FRESHNESS_MS = 60 * 1000;

// ── types ────────────────────────────────────────────────────────────────────

/** One cached GitHub response, as stored in `github_cache`. */
export interface CachedResponse {
  /** The normalized GitHub API path — the cache key. */
  path: string;
  status: number;
  /** The response body, exactly as GitHub sent it. */
  body: string;
  /** When GitHub said this; freshness is measured from here. */
  fetchedAt: Date;
  /** When Mongo's TTL index may reap this document. */
  expiresAt: Date;
}

export type CacheState = 'fresh' | 'stale' | 'miss';
/** Where the answer actually came from. */
export type CacheSource = 'fresh' | 'stale' | 'network';

/** What to do with an answer from GitHub. See "What gets stored" above. */
export type AnswerDisposition = 'store' | 'pass' | 'retryable';

export interface CacheStore {
  read(key: string): Promise<CachedResponse | null>;
  write(entry: CachedResponse): Promise<void>;
}

/** One answer from the outbound edge, already read off the wire. */
export interface UpstreamAnswer {
  status: number;
  body: string;
  headers?: Record<string, string>;
}

export interface CacheRead {
  source: CacheSource;
  status: number;
  body: string;
  headers: Record<string, string>;
  /** When the served body was fetched — older than now for a stale read. */
  fetchedAt: Date;
}

export interface ReadThroughOptions {
  store: CacheStore;
  fetch: () => Promise<UpstreamAnswer>;
  now?: Date;
  freshnessMs?: number;
  retentionMs?: number;
  /** What this kind of answer is worth. Defaults to status alone. */
  classify?: (answer: UpstreamAnswer) => AnswerDisposition;
}

// ── the cache key ────────────────────────────────────────────────────────────

/**
 * One key for the many ways the same GitHub path can be written. Owner and
 * repository names are case-insensitive on GitHub, so `/repos/Facebook/React`
 * and `/repos/facebook/react` must not each pay for their own request; query
 * parameters are sorted so their order stops mattering too.
 */
export function normalizeCachePath(path: string): string {
  const [rawPath = '', rawQuery = ''] = path.trim().split('?', 2);

  const segments = rawPath.split('/').filter(Boolean);
  const normalized = `/${segments.join('/')}`.toLowerCase();

  if (!rawQuery) return normalized;
  const params = new URLSearchParams(rawQuery);
  params.sort();
  const query = params.toString();
  return query ? `${normalized}?${query}` : normalized;
}

// ── the two tiers ────────────────────────────────────────────────────────────

/** Whether an entry may be served on its own, only as a fallback, or not at all. */
export function cacheState(
  entry: CachedResponse | null | undefined,
  now: Date,
  freshnessMs: number,
): CacheState {
  if (!entry) return 'miss';
  const age = now.getTime() - new Date(entry.fetchedAt).getTime();
  return age < freshnessMs ? 'fresh' : 'stale';
}

/** Whether a status alone is conclusive enough to keep. */
export function isCacheable(status: number): boolean {
  return (status >= 200 && status < 300) || status === 404;
}

/** The default: judge an answer by its status. */
export function classifyByStatus(answer: UpstreamAnswer): AnswerDisposition {
  return isCacheable(answer.status) ? 'store' : 'retryable';
}

/**
 * What a `/repos/{owner}/{name}` answer is worth, judged on the body as well as
 * the status. See "What gets stored" above for why each case is what it is.
 */
export function classifyRepoAnswer(answer: UpstreamAnswer): AnswerDisposition {
  if (answer.status === 404) return 'store';
  if (answer.status < 200 || answer.status >= 300) return 'retryable';

  let body: unknown;
  try {
    body = JSON.parse(answer.body);
  } catch {
    return 'retryable';
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return 'retryable';

  const fields = body as Record<string, unknown>;
  // Never cached, never a reason to serve stale: see "pass" above.
  if (fields.private === true) return 'pass';

  // The fields a card cannot be built without. A 200 missing any of them is a
  // truncated or unexpected body, and must not replace a usable entry.
  const login = (fields.owner as { login?: unknown } | undefined)?.login;
  const usable =
    Number.isFinite(Number(fields.id)) &&
    typeof fields.name === 'string' &&
    fields.name !== '' &&
    typeof login === 'string' &&
    login !== '';
  return usable ? 'store' : 'retryable';
}

/**
 * A `github_cache` document as this module wants it, or null when the document
 * cannot be trusted. Anything unreadable — a body that is not text, a status
 * that is not a number, a timestamp that is not a date — is treated as a cache
 * miss rather than propagated as a `NaN` status into a response.
 */
export function cacheEntryFromDoc(key: string, doc: unknown): CachedResponse | null {
  if (!doc || typeof doc !== 'object') return null;
  const row = doc as Record<string, unknown>;

  if (typeof row.body !== 'string') return null;
  const status = Number(row.status);
  if (!Number.isFinite(status)) return null;

  const fetchedAt = new Date(row.fetchedAt as string | number | Date);
  if (Number.isNaN(fetchedAt.getTime())) return null;

  const expires = row.expiresAt ? new Date(row.expiresAt as string | number | Date) : null;
  const expiresAt =
    expires && !Number.isNaN(expires.getTime()) ? expires : retentionExpiry(fetchedAt);

  return { path: key, status, body: row.body, fetchedAt, expiresAt };
}

/** When Mongo may reap an entry fetched at `fetchedAt`. */
export function retentionExpiry(fetchedAt: Date, retentionMs = CACHE_RETENTION_MS): Date {
  return new Date(fetchedAt.getTime() + retentionMs);
}

const JSON_HEADERS = { 'content-type': 'application/json' };

/**
 * Read through the cache: serve a fresh entry, otherwise ask GitHub, and lean
 * on a stale entry whenever GitHub cannot give a straight answer.
 *
 * A broken cache is never allowed to break a read — a failing `read` degrades
 * to a miss and a failing `write` is swallowed — because the cache exists to
 * spend fewer GitHub requests, not to be load-bearing.
 *
 * Throws only in the one case where there is genuinely nothing to say: GitHub
 * unreachable *and* no stored entry at all.
 */
export async function readThrough(path: string, opts: ReadThroughOptions): Promise<CacheRead> {
  const key = normalizeCachePath(path);
  const now = opts.now ?? new Date();
  const freshnessMs = opts.freshnessMs ?? REPO_CARD_FRESHNESS_MS;

  const cached = await opts.store.read(key).catch(() => null);
  const served = (source: 'fresh' | 'stale', entry: CachedResponse): CacheRead => ({
    source,
    status: entry.status,
    body: entry.body,
    headers: JSON_HEADERS,
    fetchedAt: new Date(entry.fetchedAt),
  });

  if (cached && cacheState(cached, now, freshnessMs) === 'fresh') return served('fresh', cached);

  let answer: UpstreamAnswer;
  try {
    answer = await opts.fetch();
  } catch (cause) {
    // GitHub is unreachable. Old data beats no data.
    if (cached) return served('stale', cached);
    throw cause;
  }

  const fromNetwork: CacheRead = {
    source: 'network',
    status: answer.status,
    body: answer.body,
    headers: answer.headers ?? JSON_HEADERS,
    fetchedAt: now,
  };

  const disposition = (opts.classify ?? classifyByStatus)(answer);

  if (disposition === 'store') {
    await opts.store
      .write({
        path: key,
        status: answer.status,
        body: answer.body,
        fetchedAt: now,
        expiresAt: retentionExpiry(now, opts.retentionMs),
      })
      .catch(() => undefined);
    return fromNetwork;
  }

  // Conclusive, but not ours to keep — and not a reason to reach for the stale
  // entry either (a private repository's public past, for instance).
  if (disposition === 'pass') return fromNetwork;

  // Rate-limited, erroring or unusable: say nothing new, and prefer what we
  // already had.
  if (cached) return served('stale', cached);
  return fromNetwork;
}

// ── the Mongo-backed store ───────────────────────────────────────────────────

/** `github_cache`, keyed by normalized path, reaped by the TTL index on `expiresAt`. */
export const mongoCacheStore: CacheStore = {
  async read(key) {
    await connectDB();
    // `expiresAt` is enforced in the query, not left to the TTL index. The
    // index is a *reaper*, and it can be absent (a restored dump, a replica
    // built before the index existed) or lag behind by a minute; without this
    // condition a document from months ago would still come back and be served
    // as merely "stale".
    const doc = await GithubCache.findOne({ path: key, expiresAt: { $gt: new Date() } })
      .lean()
      .exec();
    return cacheEntryFromDoc(key, doc);
  },
  async write(entry) {
    await connectDB();
    await GithubCache.updateOne({ path: entry.path }, { $set: entry }, { upsert: true }).exec();
  },
};

// ── the cached outbound edge ─────────────────────────────────────────────────

/**
 * `githubRequest` with the cache in front of it. Answers with an ordinary
 * `Response` so the mapping in `src/server/github.ts` works unchanged, plus the
 * `x-ccp-cache` header naming where the body came from.
 */
export async function cachedGitHubRequest(
  path: string,
  opts: {
    token?: string;
    store?: CacheStore;
    freshnessMs?: number;
    now?: Date;
    classify?: (answer: UpstreamAnswer) => AnswerDisposition;
  } = {},
): Promise<{ response: Response; source: CacheSource; fetchedAt: Date }> {
  const read = await readThrough(path, {
    store: opts.store ?? mongoCacheStore,
    freshnessMs: opts.freshnessMs,
    now: opts.now,
    classify: opts.classify,
    fetch: async () => {
      const response = await githubRequest(path, { token: opts.token });
      const headers: Record<string, string> = {};
      response.headers.forEach((value, name) => {
        headers[name] = value;
      });
      return { status: response.status, body: await response.text(), headers };
    },
  });

  const response = new Response(read.body, {
    status: read.status,
    headers: { ...read.headers, 'x-ccp-cache': read.source },
  });
  return { response, source: read.source, fetchedAt: read.fetchedAt };
}

/** A repository read through the cache, with a note of where the answer came from. */
export interface CachedRepoRead {
  result: FetchRepoResult;
  source: CacheSource;
  fetchedAt: Date;
}

/**
 * The repo-card read the proxy route serves. `fetchPublicRepo` still owns what
 * a GitHub response *means*; all this does is hand it a cached requester.
 */
export async function fetchRepoCard(
  ref: RepoRef,
  opts: {
    token?: string;
    tokens?: Array<string | undefined>;
    store?: CacheStore;
    freshnessMs?: number;
  } = {},
): Promise<CachedRepoRead> {
  let source: CacheSource = 'network';
  let fetchedAt = new Date();

  const result = await fetchPublicRepo(ref, {
    token: opts.token,
    tokens: opts.tokens,
    request: async (path, requestOpts) => {
      const read = await cachedGitHubRequest(path, {
        token: requestOpts.token,
        store: opts.store,
        freshnessMs: opts.freshnessMs,
        // Judge the body, not just the status: a private repository is never
        // stored, and a truncated 200 never replaces a usable entry.
        classify: classifyRepoAnswer,
      });
      source = read.source;
      fetchedAt = read.fetchedAt;
      return read.response;
    },
  });

  return { result, source, fetchedAt };
}

// ── the answer the card is served ────────────────────────────────────────────

/**
 * The one thing the public card path ever says about a repository it will not
 * show: the same sentence whether the repository was deleted, was never linked
 * here, or is private. Deliberately identical, so nobody can walk owner/name
 * pairs against this endpoint and learn which private repositories exist —
 * enumeration the server's own `GITHUB_TOKEN` would be paying for.
 */
export function unavailableMessage(ref: RepoRef): string {
  return `GitHub has no public repository at ${ref.owner}/${ref.name}. It may be private, renamed or deleted.`;
}

/** The unavailable answer, for the route to reuse before it reads anything. */
export function unavailablePayload(ref: RepoRef): { status: number; body: RepoCardResponse } {
  return {
    status: 404,
    body: {
      owner: ref.owner,
      name: ref.name,
      state: 'unavailable',
      reason: 'not-found',
      message: unavailableMessage(ref),
    },
  };
}

/**
 * What the proxy route answers, as a status and a body: the same typed union in
 * every case (see `src/types/github.ts`), so the card component has one shape to
 * render and never has to interpret an HTTP error itself.
 *
 * A repository that is gone, private or never linked is a 404 — all three
 * spelled identically (see `unavailableMessage`). A repository GitHub has
 * blocked is its own reason, because that is public knowledge and tells nobody
 * anything they could not read on GitHub itself. Everything else is temporary:
 * 503 when GitHub is rate limiting (the status that means "come back later"),
 * 502 when it answered in a way this server could not use.
 *
 * `expected.repoId` is the numeric id the project linked. Owner/name is a label
 * GitHub lets go — delete a repository and the slug can be registered by
 * somebody else — so a card whose id is not the linked one is a *different*
 * repository, and is refused rather than rendered under this project.
 */
export function repoCardPayload(
  ref: RepoRef,
  result: FetchRepoResult,
  meta: { source: CacheSource; fetchedAt: Date },
  expected?: { repoId?: number },
): { status: number; body: RepoCardResponse } {
  if (result.ok) {
    const linkedId = Number(expected?.repoId);
    if (Number.isFinite(linkedId) && Number(result.repo.repoId) !== linkedId) {
      return unavailablePayload(ref);
    }
    return {
      status: 200,
      body: {
        state: 'ok',
        owner: result.repo.owner || ref.owner,
        name: result.repo.name || ref.name,
        repo: result.repo,
        fetchedAt: meta.fetchedAt.toISOString(),
        stale: meta.source === 'stale',
      },
    };
  }

  const identity = { owner: ref.owner, name: ref.name };

  if (result.reason === 'not-found' || result.reason === 'private') {
    return unavailablePayload(ref);
  }

  if (result.reason === 'blocked') {
    return {
      status: 404,
      body: { ...identity, state: 'unavailable', reason: 'blocked', message: result.message },
    };
  }

  return {
    status: result.reason === 'rate-limited' ? 503 : 502,
    body: {
      ...identity,
      state: 'temporarily-unavailable',
      reason: result.reason,
      message: result.message,
    },
  };
}
