import 'dotenv/config';
import { connectDB } from './db';
import { Account, ownedBy } from './models';

/**
 * Everything the app knows about talking to GitHub (PRD #88, design doc phase 2).
 *
 * Two kinds of thing live here, deliberately together but kept separable:
 *
 *  - **Decisions** — parsing what a member pasted, the three-repo cap, the
 *    duplicate rule, which token to use. Pure, no I/O, so they are tested
 *    directly (src/server/github.test.ts) without any route plumbing.
 *  - **Reads** — `githubRequest` is the single outbound edge to api.github.com;
 *    every GitHub read in the app goes through it, so tests substitute one
 *    `fetch` and the caching proxy has one place to hook into.
 *
 * Nothing here writes to the database except to *look up* a member's linked
 * GitHub token, which never leaves the server.
 */

// ── types ────────────────────────────────────────────────────────────────────

/** A repository as the app addresses it before GitHub has confirmed anything. */
export interface RepoRef {
  owner: string;
  name: string;
}

/** A Linked Repository as stored on a Project (see CONTEXT.md). */
export interface LinkedRepo {
  repoId: number;
  owner: string;
  name: string;
  linkedAt?: Date;
}

/** The card fields of a repository, mapped out of GitHub's JSON. */
export interface GitHubRepoSummary {
  repoId: number;
  owner: string;
  name: string;
  fullName: string;
  description: string | null;
  language: string | null;
  stars: number;
  openIssues: number;
  pushedAt: string | null;
  archived: boolean;
  htmlUrl: string;
}

/**
 * Why a GitHub read could not be used. Callers map this onto their own
 * behaviour: linking turns it into a 4xx with a message, while the repo-card
 * proxy uses it to decide between "unavailable" and "serve the stale cache".
 */
export type GitHubFailureReason =
  | 'not-found'
  | 'private'
  | 'rate-limited'
  | 'unauthorized'
  | 'unavailable';

export interface GitHubFailure {
  ok: false;
  reason: GitHubFailureReason;
  /** The HTTP status this app should answer with (not GitHub's). */
  status: number;
  message: string;
}

export type ParseResult = { ok: true; ref: RepoRef } | { ok: false; status: number; message: string };
export type FetchRepoResult = { ok: true; repo: GitHubRepoSummary } | GitHubFailure;

/** A project may link at most this many repositories (PRD #88). */
export const MAX_LINKED_REPOS = 3;

export const DEFAULT_GITHUB_API_BASE = 'https://api.github.com';

/**
 * Where `githubRequest` points. Always api.github.com in real life; the
 * `GITHUB_API_BASE` override exists so the E2E suite can point the server at a
 * local fixture server and stay hermetic (no live GitHub calls, no rate limit,
 * deterministic repositories).
 */
export function githubApiBase(env: { GITHUB_API_BASE?: string } = process.env): string {
  const base = env.GITHUB_API_BASE?.trim().replace(/\/+$/, '');
  return base || DEFAULT_GITHUB_API_BASE;
}

const PASTE_HINT = 'Paste a repository link, for example https://github.com/owner/repo.';

// ── parsing what the member pasted ───────────────────────────────────────────

/** GitHub logins: alphanumerics and dashes, 39 characters at most. */
const OWNER_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
/** Repository names: alphanumerics, dot, dash, underscore, 100 characters at most. */
const NAME_RE = /^[A-Za-z0-9._-]{1,100}$/;

const GITHUB_HOSTS = new Set(['github.com', 'www.github.com']);

/**
 * Turn the many shapes of a GitHub URL into one. Members paste browser URLs,
 * clone URLs and SSH remotes; deep links into a file or branch are common too.
 * Anything that is not a repository *on github.com* returns null — including
 * lookalike hosts, which is the point of comparing the parsed host rather than
 * searching the string for "github.com".
 */
export function parseRepoUrl(input: string): RepoRef | null {
  let value = input.trim();
  if (!value) return null;

  // scp-style remote: git@github.com:owner/name.git
  const scp = /^(?:[\w.-]+)@([^:/]+):(.+)$/.exec(value);
  if (scp) value = `https://${scp[1]}/${scp[2]}`;
  else if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(value)) value = `https://${value}`;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (!['http:', 'https:', 'ssh:', 'git:'].includes(url.protocol)) return null;
  if (!GITHUB_HOSTS.has(url.hostname.toLowerCase())) return null;

  const segments = url.pathname.split('/').filter(Boolean);
  if (segments.length < 2) return null;

  const owner = decodeURIComponent(segments[0]);
  const name = decodeURIComponent(segments[1]).replace(/\.git$/i, '');
  return { owner, name };
}

/**
 * The repository a link request means: a `url` in any common form, or an
 * explicit `owner`/`name` pair. Rejections carry the message the member sees,
 * so the edit UI never has to invent one.
 */
export function parseRepoRef(input: {
  url?: unknown;
  owner?: unknown;
  name?: unknown;
}): ParseResult {
  const reject = (message: string): ParseResult => ({ ok: false, status: 400, message });

  let ref: RepoRef | null = null;

  if (typeof input?.url === 'string' && input.url.trim() !== '') {
    ref = parseRepoUrl(input.url);
    if (!ref) {
      return reject(
        `That does not look like a GitHub repository. Only repositories on github.com can be linked. ${PASTE_HINT}`,
      );
    }
  } else if (typeof input?.owner === 'string' && typeof input?.name === 'string') {
    ref = { owner: input.owner.trim(), name: input.name.trim().replace(/\.git$/i, '') };
  }

  if (!ref) return reject(`A GitHub repository is required. ${PASTE_HINT}`);
  if (!OWNER_RE.test(ref.owner) || !NAME_RE.test(ref.name) || ref.name === '.' || ref.name === '..') {
    return reject(`That is not a valid GitHub owner and repository name. ${PASTE_HINT}`);
  }
  return { ok: true, ref };
}

// ── the cap and duplicates ───────────────────────────────────────────────────

/**
 * Why this repository may not be linked, or null if it may. Callable twice:
 * once before asking GitHub anything (cap only — no point spending a request on
 * a project that is already full) and again once GitHub has told us the repo's
 * numeric id, which is the identity duplicates are judged on.
 */
export function linkDenial(
  existing: ReadonlyArray<LinkedRepo>,
  repoId?: number,
): { status: number; message: string } | null {
  if (repoId !== undefined && existing.some((repo) => Number(repo.repoId) === Number(repoId))) {
    return { status: 409, message: 'That repository is already linked to this project.' };
  }
  if (existing.length >= MAX_LINKED_REPOS) {
    return {
      status: 409,
      message: `A project can have at most ${MAX_LINKED_REPOS} linked repositories. Remove one first.`,
    };
  }
  return null;
}

/**
 * The Linked Repositories on a project document, as plain objects. The Project
 * schema is `strict: false`, so a project written before this feature existed
 * simply has no array — hence the shrug rather than a throw.
 */
export function reposOf(project: { linkedRepos?: unknown } | null | undefined): LinkedRepo[] {
  const repos = project?.linkedRepos;
  return Array.isArray(repos) ? (repos as LinkedRepo[]) : [];
}

// ── which token to read with ─────────────────────────────────────────────────

/**
 * The fallback chain, as a decision: the requesting member's own GitHub token
 * (5,000 requests/hour, and theirs to spend) → the server's `GITHUB_TOKEN` if
 * the operator set one → nothing, which GitHub serves at 60 requests/hour.
 */
export function pickToken(
  memberToken?: string | null,
  env: { GITHUB_TOKEN?: string } = process.env,
): string | undefined {
  const member = memberToken?.trim();
  if (member) return member;
  const server = env.GITHUB_TOKEN?.trim();
  return server || undefined;
}

/**
 * The access token from a member's Linked GitHub Account, if they have one.
 * Better Auth stores it on the `account` row it wrote during linking; it is
 * read here and never sent to the browser.
 */
export async function memberGitHubToken(
  userId: string | { toString(): string } | undefined | null,
): Promise<string | undefined> {
  if (!userId) return undefined;
  await connectDB();
  const account = await Account.findOne({
    ...ownedBy(String(userId)),
    providerId: 'github',
  })
    .lean()
    .exec();
  const token = (account as { accessToken?: unknown } | null)?.accessToken;
  return typeof token === 'string' && token.trim() !== '' ? token : undefined;
}

/** The token a read on behalf of `userId` should use, per the fallback chain. */
export async function resolveGitHubToken(
  userId?: string | { toString(): string } | null,
): Promise<string | undefined> {
  return pickToken(await memberGitHubToken(userId));
}

// ── the outbound edge ────────────────────────────────────────────────────────

/**
 * One request to GitHub's REST API. Every GitHub read in the app goes through
 * here: it is the single place tests stub, the caching proxy wraps, and the
 * required headers live.
 *
 * @param path an API path such as `/repos/owner/name` — already escaped.
 */
export function githubRequest(path: string, opts: { token?: string } = {}): Promise<Response> {
  const headers: Record<string, string> = {
    accept: 'application/vnd.github+json',
    'x-github-api-version': '2022-11-28',
    'user-agent': 'CodeCollabProj',
  };
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;
  return fetch(`${githubApiBase()}${path}`, { headers });
}

/**
 * A stand-in for `githubRequest`. The cached read path (./github-cache) passes
 * one in so every read still goes through the same mapping below without this
 * module having to know the cache exists.
 */
export type GitHubRequester = (path: string, opts: { token?: string }) => Promise<Response>;

function summarize(body: Record<string, unknown>): GitHubRepoSummary {
  const owner = (body.owner as { login?: unknown } | undefined)?.login;
  return {
    repoId: Number(body.id),
    owner: typeof owner === 'string' ? owner : '',
    name: String(body.name ?? ''),
    fullName: String(body.full_name ?? ''),
    description: typeof body.description === 'string' ? body.description : null,
    language: typeof body.language === 'string' ? body.language : null,
    stars: Number(body.stargazers_count ?? 0),
    openIssues: Number(body.open_issues_count ?? 0),
    pushedAt: typeof body.pushed_at === 'string' ? body.pushed_at : null,
    archived: body.archived === true,
    htmlUrl: typeof body.html_url === 'string' ? body.html_url : '',
  };
}

/**
 * The repository behind a ref, as long as it exists and is public — the check
 * linking runs before it saves anything.
 *
 * Owner and name come back from GitHub rather than from the ref, so a repo
 * linked under an old name (or the wrong case) is stored under its current one;
 * `repoId` is what survives the next rename.
 */
export async function fetchPublicRepo(
  ref: RepoRef,
  opts: { token?: string; request?: GitHubRequester } = {},
): Promise<FetchRepoResult> {
  const slug = `${ref.owner}/${ref.name}`;
  const path = `/repos/${encodeURIComponent(ref.owner)}/${encodeURIComponent(ref.name)}`;

  let response: Response;
  try {
    response = await (opts.request ?? githubRequest)(path, { token: opts.token });
  } catch {
    return {
      ok: false,
      reason: 'unavailable',
      status: 502,
      message: 'Could not reach GitHub just now. Please try again in a moment.',
    };
  }

  if (response.status === 404) {
    return {
      ok: false,
      reason: 'not-found',
      status: 404,
      message: `GitHub has no public repository at ${slug}. It may be private, renamed or deleted.`,
    };
  }

  if (response.status === 403 || response.status === 429) {
    const exhausted =
      response.headers.get('x-ratelimit-remaining') === '0' || response.status === 429;
    if (exhausted) {
      return {
        ok: false,
        reason: 'rate-limited',
        status: 503,
        message: 'GitHub is rate-limiting this server right now. Please try again in a few minutes.',
      };
    }
    return {
      ok: false,
      reason: 'unauthorized',
      status: 502,
      message: `GitHub refused to describe ${slug}.`,
    };
  }

  if (response.status === 401) {
    return {
      ok: false,
      reason: 'unauthorized',
      status: 502,
      message: 'GitHub rejected this server’s credentials.',
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      reason: 'unavailable',
      status: 502,
      message: `GitHub could not describe ${slug} just now. Please try again in a moment.`,
    };
  }

  let body: Record<string, unknown>;
  try {
    body = (await response.json()) as Record<string, unknown>;
  } catch {
    return {
      ok: false,
      reason: 'unavailable',
      status: 502,
      message: 'GitHub sent back something this server could not read.',
    };
  }

  if (body.private === true) {
    return {
      ok: false,
      reason: 'private',
      status: 400,
      message: `${slug} is private. Only public repositories can be linked to a project.`,
    };
  }

  const repo = summarize(body);
  if (!Number.isFinite(repo.repoId) || !repo.owner || !repo.name) {
    return {
      ok: false,
      reason: 'unavailable',
      status: 502,
      message: `GitHub could not describe ${slug} just now. Please try again in a moment.`,
    };
  }

  return { ok: true, repo };
}
