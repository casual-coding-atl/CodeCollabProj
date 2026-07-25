import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  DEFAULT_GITHUB_API_BASE,
  MAX_LINKED_REPOS,
  duplicateRefDenial,
  fetchPublicRepo,
  githubApiBase,
  linkDenial,
  parseRepoRef,
  pickToken,
  reposOf,
  tokenTiers,
} from './github';

/**
 * The GitHub module's decisions, at the seam the routes call. Everything here is
 * either pure (URL parsing, the cap and duplicate rules, the token fallback
 * chain) or stubbed at the one outbound edge — `fetch` — so no test talks to
 * GitHub.
 *
 * What the endpoints *do* with these decisions is repo-linking.test.ts; the
 * whole path through a browser is e2e/github-linking.spec.ts and
 * e2e/github-repo-cards.spec.ts.
 */

// ── parsing ──────────────────────────────────────────────────────────────────

function ok(input: Parameters<typeof parseRepoRef>[0]) {
  const result = parseRepoRef(input);
  if (!result.ok) throw new Error(`expected a repo ref, got: ${result.message}`);
  return result.ref;
}

describe('parseRepoRef', () => {
  it('reads owner and name from a canonical repository URL', () => {
    expect(ok({ url: 'https://github.com/facebook/react' })).toEqual({
      owner: 'facebook',
      name: 'react',
    });
  });

  it.each([
    ['http, not https', 'http://github.com/facebook/react'],
    ['no scheme', 'github.com/facebook/react'],
    ['www host', 'https://www.github.com/facebook/react'],
    ['trailing slash', 'https://github.com/facebook/react/'],
    ['clone URL', 'https://github.com/facebook/react.git'],
    ['SSH remote', 'git@github.com:facebook/react.git'],
    ['deep link into the tree', 'https://github.com/facebook/react/tree/main/packages'],
    ['a query and a fragment', 'https://github.com/facebook/react?tab=readme#install'],
    ['surrounding whitespace', '  https://github.com/facebook/react  '],
  ])('accepts the same repository with %s', (_why, url) => {
    expect(ok({ url })).toEqual({ owner: 'facebook', name: 'react' });
  });

  it('accepts an explicit owner/name pair instead of a URL', () => {
    expect(ok({ owner: ' facebook ', name: 'react ' })).toEqual({
      owner: 'facebook',
      name: 'react',
    });
  });

  it.each([
    ['another forge', 'https://gitlab.com/facebook/react'],
    ['a lookalike host', 'https://github.com.evil.example/facebook/react'],
    ['github.com buried in the path', 'https://evil.example/github.com/facebook/react'],
    ['a subdomain that is not github.com', 'https://gist.github.com/facebook/react'],
  ])('rejects %s', (_why, url) => {
    const result = parseRepoRef({ url });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
      expect(result.message).toMatch(/github\.com/i);
    }
  });

  it.each([
    ['an owner with no repository', 'https://github.com/facebook'],
    ['the bare host', 'https://github.com/'],
    ['an illegal owner character', 'https://github.com/face book/react'],
    ['an illegal repository character', 'https://github.com/facebook/re$act'],
  ])('rejects %s', (_why, url) => {
    expect(parseRepoRef({ url }).ok).toBe(false);
  });

  it('rejects an empty or missing input with a message that says what to paste', () => {
    for (const input of [{}, { url: '' }, { url: '   ' }, { url: 42 }, { owner: 'facebook' }]) {
      const result = parseRepoRef(input as Parameters<typeof parseRepoRef>[0]);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.status).toBe(400);
    }
  });

  it('rejects a half-written escape sequence rather than throwing a URIError', () => {
    // decodeURIComponent throws on these; a typo in a pasted link must be a 400
    // from the parser, never a 500 out of the route.
    for (const url of ['https://github.com/%ZZ/react', 'https://github.com/facebook/re%act']) {
      const result = parseRepoRef({ url });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.status).toBe(400);
    }
  });

  it('rejects names longer than GitHub allows', () => {
    expect(parseRepoRef({ owner: 'a'.repeat(40), name: 'react' }).ok).toBe(false);
    expect(parseRepoRef({ owner: 'facebook', name: 'r'.repeat(101) }).ok).toBe(false);
  });
});

// ── the cap and duplicates ───────────────────────────────────────────────────

const linked = (repoId: number) => ({ repoId, owner: 'o', name: `n${repoId}` });

describe('linkDenial', () => {
  it('allows a repository when the project is under the cap and does not have it', () => {
    expect(linkDenial([linked(1), linked(2)], 3)).toBeNull();
  });

  it('allows the check to run before the repo id is known', () => {
    expect(linkDenial([linked(1)])).toBeNull();
  });

  it(`refuses a ${MAX_LINKED_REPOS + 1}th repository`, () => {
    const denial = linkDenial([linked(1), linked(2), linked(3)], 4);
    expect(denial?.status).toBe(409);
    expect(denial?.message).toMatch(/3/);
  });

  it('refuses a repository already linked to this project', () => {
    const denial = linkDenial([linked(1), linked(2)], 2);
    expect(denial?.status).toBe(409);
    expect(denial?.message).toMatch(/already linked/i);
  });

  it('reports the duplicate rather than the cap when both apply', () => {
    const denial = linkDenial([linked(1), linked(2), linked(3)], 3);
    expect(denial?.message).toMatch(/already linked/i);
  });

  it('compares repo ids across the string forms Mongo may hand back', () => {
    const denial = linkDenial([{ repoId: '7' as unknown as number, owner: 'o', name: 'n' }], 7);
    expect(denial?.message).toMatch(/already linked/i);
  });
});

describe('duplicateRefDenial', () => {
  it('recognises a repository already linked, whatever case it was pasted in', () => {
    const existing = [{ repoId: 1, owner: 'E2E-Org', name: 'CodeCollab-Web' }];
    const denial = duplicateRefDenial(existing, { owner: 'e2e-org', name: 'codecollab-web' });
    expect(denial?.status).toBe(409);
    expect(denial?.message).toMatch(/already linked/i);
  });

  it('lets a repository the project does not have through', () => {
    const existing = [{ repoId: 1, owner: 'e2e-org', name: 'other' }];
    expect(duplicateRefDenial(existing, { owner: 'e2e-org', name: 'codecollab-web' })).toBeNull();
  });
});

describe('reposOf', () => {
  it('reads the linked repositories off a project', () => {
    expect(reposOf({ linkedRepos: [linked(1)] })).toEqual([linked(1)]);
  });

  it('treats a project written before this feature as having none', () => {
    expect(reposOf({})).toEqual([]);
    expect(reposOf(null)).toEqual([]);
    expect(reposOf({ linkedRepos: 'nonsense' })).toEqual([]);
  });
});

// ── the token fallback chain ─────────────────────────────────────────────────

describe('pickToken', () => {
  it('prefers the linking member’s own GitHub token', () => {
    expect(pickToken('member-token', { GITHUB_TOKEN: 'server-token' })).toBe('member-token');
  });

  it('falls back to the server token when the member has not linked GitHub', () => {
    expect(pickToken(undefined, { GITHUB_TOKEN: 'server-token' })).toBe('server-token');
    expect(pickToken(null, { GITHUB_TOKEN: 'server-token' })).toBe('server-token');
    expect(pickToken('', { GITHUB_TOKEN: 'server-token' })).toBe('server-token');
  });

  it('ends up unauthenticated when neither exists', () => {
    expect(pickToken(undefined, {})).toBeUndefined();
    expect(pickToken(undefined, { GITHUB_TOKEN: '  ' })).toBeUndefined();
  });
});

describe('tokenTiers', () => {
  it('orders the chain member → server → anonymous', () => {
    expect(tokenTiers('member', { GITHUB_TOKEN: 'server' })).toEqual([
      'member',
      'server',
      undefined,
    ]);
  });

  it('always ends anonymous, because every read here is of public data', () => {
    expect(tokenTiers(undefined, {})).toEqual([undefined]);
    expect(tokenTiers('member', {})).toEqual(['member', undefined]);
    expect(tokenTiers(undefined, { GITHUB_TOKEN: 'server' })).toEqual(['server', undefined]);
  });

  it('does not try the same token twice', () => {
    expect(tokenTiers('same', { GITHUB_TOKEN: 'same' })).toEqual(['same', undefined]);
  });
});

// ── where the requests go ────────────────────────────────────────────────────

describe('githubApiBase', () => {
  it('is api.github.com unless an operator says otherwise', () => {
    expect(githubApiBase({})).toBe(DEFAULT_GITHUB_API_BASE);
    expect(githubApiBase({ GITHUB_API_BASE: '  ' })).toBe(DEFAULT_GITHUB_API_BASE);
  });

  it('can be pointed at a fixture server, which is how E2E stays hermetic', () => {
    expect(githubApiBase({ GITHUB_API_BASE: 'http://localhost:3199' })).toBe(
      'http://localhost:3199',
    );
  });

  it('does not double the slash when the override has a trailing one', () => {
    expect(githubApiBase({ GITHUB_API_BASE: 'http://localhost:3199/' })).toBe(
      'http://localhost:3199',
    );
  });
});

// ── validating against GitHub ────────────────────────────────────────────────

const publicRepoBody = {
  id: 10270250,
  name: 'react',
  full_name: 'facebook/react',
  private: false,
  html_url: 'https://github.com/facebook/react',
  description: 'The library for web and native user interfaces.',
  language: 'JavaScript',
  stargazers_count: 228000,
  open_issues_count: 700,
  pushed_at: '2026-07-20T10:00:00Z',
  archived: false,
  owner: { login: 'facebook' },
};

function stubFetch(impl: (url: string, init?: RequestInit) => Promise<Response> | Response) {
  const spy = vi.fn(impl as typeof fetch);
  vi.stubGlobal('fetch', spy);
  return spy;
}

function githubResponse(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchPublicRepo', () => {
  it('returns the card fields of a public repository', async () => {
    const spy = stubFetch(() => githubResponse(200, publicRepoBody));

    const result = await fetchPublicRepo({ owner: 'facebook', name: 'react' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.repo).toMatchObject({
      repoId: 10270250,
      owner: 'facebook',
      name: 'react',
      description: 'The library for web and native user interfaces.',
      language: 'JavaScript',
      stars: 228000,
      openIssues: 700,
      archived: false,
      htmlUrl: 'https://github.com/facebook/react',
    });
    expect(spy.mock.calls[0][0]).toBe('https://api.github.com/repos/facebook/react');
  });

  it('takes owner and name from GitHub, so a renamed repository lands under its current name', async () => {
    stubFetch(() =>
      githubResponse(200, {
        ...publicRepoBody,
        name: 'react-renamed',
        owner: { login: 'Facebook' },
        full_name: 'Facebook/react-renamed',
      }),
    );

    const result = await fetchPublicRepo({ owner: 'facebook', name: 'react' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.repo.owner).toBe('Facebook');
    expect(result.repo.name).toBe('react-renamed');
  });

  it('refuses a private repository', async () => {
    stubFetch(() => githubResponse(200, { ...publicRepoBody, private: true }));

    const result = await fetchPublicRepo({ owner: 'facebook', name: 'secret' });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('private');
    expect(result.status).toBe(400);
    expect(result.message).toMatch(/public/i);
  });

  it('reports a repository GitHub does not have (deleted, renamed or private)', async () => {
    stubFetch(() => githubResponse(404, { message: 'Not Found' }));

    const result = await fetchPublicRepo({ owner: 'nobody', name: 'nothing' });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('not-found');
    expect(result.status).toBe(404);
    expect(result.message).toContain('nobody/nothing');
  });

  it('reports a rate limit as a temporary failure, not a bad repository', async () => {
    stubFetch(() =>
      githubResponse(403, { message: 'API rate limit exceeded' }, { 'x-ratelimit-remaining': '0' }),
    );

    const result = await fetchPublicRepo({ owner: 'facebook', name: 'react' });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('rate-limited');
    expect(result.status).toBe(503);
  });

  it('reports an unreachable GitHub rather than throwing', async () => {
    stubFetch(() => Promise.reject(new Error('ECONNREFUSED')));

    const result = await fetchPublicRepo({ owner: 'facebook', name: 'react' });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('unavailable');
    expect(result.status).toBe(502);
  });

  it('authenticates with the token it is given, and stays anonymous without one', async () => {
    const spy = stubFetch(() => githubResponse(200, publicRepoBody));

    await fetchPublicRepo({ owner: 'facebook', name: 'react' }, { token: 'gho_secret' });
    const withToken = new Headers((spy.mock.calls[0][1] as RequestInit).headers);
    expect(withToken.get('authorization')).toBe('Bearer gho_secret');

    await fetchPublicRepo({ owner: 'facebook', name: 'react' });
    const without = new Headers((spy.mock.calls[1][1] as RequestInit).headers);
    expect(without.get('authorization')).toBeNull();
    expect(without.get('accept')).toBe('application/vnd.github+json');
  });

  it('reads through a requester it is given instead of calling GitHub itself', async () => {
    const spy = stubFetch(() => githubResponse(500, {}));
    const request = vi.fn(async () => githubResponse(200, publicRepoBody));

    const result = await fetchPublicRepo({ owner: 'facebook', name: 'react' }, { request });

    expect(result.ok).toBe(true);
    expect(request).toHaveBeenCalledWith('/repos/facebook/react', { token: undefined });
    expect(spy).not.toHaveBeenCalled();
  });

  it('falls through to the next token when the member’s has been revoked', async () => {
    // The failure that used to lose the read entirely: a member revokes this
    // app on GitHub, and their card 502s even though the server token — or
    // nobody's token at all — describes the repository perfectly well.
    const spy = stubFetch((_url, init) => {
      const auth = new Headers(init?.headers).get('authorization');
      if (auth === 'Bearer revoked') return githubResponse(401, { message: 'Bad credentials' });
      return githubResponse(200, publicRepoBody);
    });

    const result = await fetchPublicRepo(
      { owner: 'facebook', name: 'react' },
      { tokens: ['revoked', 'server-token', undefined] },
    );

    expect(result.ok).toBe(true);
    expect(spy).toHaveBeenCalledTimes(2);
    expect(new Headers(spy.mock.calls[1][1]?.headers).get('authorization')).toBe(
      'Bearer server-token',
    );
  });

  it('falls through when a token’s rate limit is spent, ending anonymous', async () => {
    const spy = stubFetch((_url, init) => {
      const auth = new Headers(init?.headers).get('authorization');
      if (auth) return githubResponse(403, { message: 'rate limit' }, { 'x-ratelimit-remaining': '0' });
      return githubResponse(200, publicRepoBody);
    });

    const result = await fetchPublicRepo(
      { owner: 'facebook', name: 'react' },
      { tokens: ['spent', undefined] },
    );

    expect(result.ok).toBe(true);
    expect(new Headers(spy.mock.calls[1][1]?.headers).get('authorization')).toBeNull();
  });

  it('does not spend another tier on an answer that would not change', async () => {
    // A 404 is about the repository, not the credentials. Retrying it down the
    // chain would triple the cost of every mistyped URL.
    const spy = stubFetch(() => githubResponse(404, { message: 'Not Found' }));

    const result = await fetchPublicRepo(
      { owner: 'nobody', name: 'nothing' },
      { tokens: ['member', 'server', undefined] },
    );

    expect(result.ok).toBe(false);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('reports the last tier’s failure when every tier fails', async () => {
    const spy = stubFetch(() => githubResponse(401, { message: 'Bad credentials' }));

    const result = await fetchPublicRepo(
      { owner: 'facebook', name: 'react' },
      { tokens: ['member', 'server', undefined] },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('unauthorized');
    expect(spy).toHaveBeenCalledTimes(3);
  });

  it('escapes the path segments it was given', async () => {
    const spy = stubFetch(() => githubResponse(404, { message: 'Not Found' }));

    await fetchPublicRepo({ owner: 'a b', name: 'c/d' });

    expect(spy.mock.calls[0][0]).toBe('https://api.github.com/repos/a%20b/c%2Fd');
  });
});
