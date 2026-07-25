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
 * Only answers GitHub is *sure about*: a 2xx, or a 404 (the repository really
 * is gone, so re-asking on every page view helps nobody). A 403/429/5xx says
 * only that GitHub is busy — storing it would poison the cache with an outage,
 * so those fall back to the stale entry instead.
 *
 * The decisions (`normalizeCachePath`, `cacheState`, `isCacheable`,
 * `readThrough`, `repoCardPayload`) are pure or dependency-injected, and tested
 * directly in `github-cache.test.ts` with a fake store and a fake upstream.
 */

export { REPO_CARD_FRESHNESS_MS };

/** How long an entry stays *readable* after it stops being fresh. */
export const CACHE_RETENTION_MS = 24 * 60 * 60 * 1000;

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

/** Whether an answer is conclusive enough to keep. See "What gets stored" above. */
export function isCacheable(status: number): boolean {
  return (status >= 200 && status < 300) || status === 404;
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

  if (isCacheable(answer.status)) {
    const entry: CachedResponse = {
      path: key,
      status: answer.status,
      body: answer.body,
      fetchedAt: now,
      expiresAt: retentionExpiry(now, opts.retentionMs),
    };
    await opts.store.write(entry).catch(() => undefined);
    return { source: 'network', status: answer.status, body: answer.body, headers: answer.headers ?? JSON_HEADERS, fetchedAt: now };
  }

  // Rate-limited or erroring: say nothing new, and prefer what we already had.
  if (cached) return served('stale', cached);
  return {
    source: 'network',
    status: answer.status,
    body: answer.body,
    headers: answer.headers ?? JSON_HEADERS,
    fetchedAt: now,
  };
}

// ── the Mongo-backed store ───────────────────────────────────────────────────

/** `github_cache`, keyed by normalized path, reaped by the TTL index on `expiresAt`. */
export const mongoCacheStore: CacheStore = {
  async read(key) {
    await connectDB();
    const doc = await GithubCache.findOne({ path: key }).lean().exec();
    if (!doc || typeof doc.body !== 'string' || !doc.fetchedAt) return null;
    return {
      path: key,
      status: Number(doc.status),
      body: doc.body,
      fetchedAt: new Date(doc.fetchedAt),
      expiresAt: new Date(doc.expiresAt ?? retentionExpiry(new Date(doc.fetchedAt))),
    };
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
  opts: { token?: string; store?: CacheStore; freshnessMs?: number; now?: Date } = {},
): Promise<{ response: Response; source: CacheSource; fetchedAt: Date }> {
  const read = await readThrough(path, {
    store: opts.store ?? mongoCacheStore,
    freshnessMs: opts.freshnessMs,
    now: opts.now,
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
  opts: { token?: string; store?: CacheStore; freshnessMs?: number } = {},
): Promise<CachedRepoRead> {
  let source: CacheSource = 'network';
  let fetchedAt = new Date();

  const result = await fetchPublicRepo(ref, {
    token: opts.token,
    request: async (path, requestOpts) => {
      const read = await cachedGitHubRequest(path, {
        token: requestOpts.token,
        store: opts.store,
        freshnessMs: opts.freshnessMs,
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
 * What the proxy route answers, as a status and a body: the same typed union in
 * every case (see `src/types/github.ts`), so the card component has one shape to
 * render and never has to interpret an HTTP error itself.
 *
 * A repository that is gone or private is a 404 — permanently unavailable, and
 * the card says so. Everything else is temporary: 503 when GitHub is rate
 * limiting (the status that means "come back later"), 502 when it answered in a
 * way this server could not use.
 */
export function repoCardPayload(
  ref: RepoRef,
  result: FetchRepoResult,
  meta: { source: CacheSource; fetchedAt: Date },
): { status: number; body: RepoCardResponse } {
  if (result.ok) {
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
    return {
      status: 404,
      body: { ...identity, state: 'unavailable', reason: result.reason, message: result.message },
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
