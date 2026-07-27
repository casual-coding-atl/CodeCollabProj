import { describe, it, expect, vi } from 'vitest';
import {
  CACHE_RETENTION_MS,
  REPO_CARD_FRESHNESS_MS,
  cacheEntryFromDoc,
  cacheState,
  classifyRepoAnswer,
  isCacheable,
  normalizeCachePath,
  readThrough,
  repoCardPayload,
  unavailableMessage,
  type CacheStore,
  type CachedResponse,
} from './github-cache';
import type { GitHubRepoSummary } from './github';

/**
 * The cached read path's decisions, at the seam the proxy route calls.
 *
 * Everything here is pure or fed a fake store and a fake upstream: no Mongo, no
 * GitHub. The two-tier lifetime is the thing under test — an entry stops being
 * *fresh* after ten minutes but stays *readable* for a day, which is what makes
 * "serve stale when GitHub is having a bad day" possible at all.
 */

// ── the cache key ────────────────────────────────────────────────────────────

describe('normalizeCachePath', () => {
  it('leaves a canonical API path alone', () => {
    expect(normalizeCachePath('/repos/facebook/react')).toBe('/repos/facebook/react');
  });

  it.each([
    ['a missing leading slash', 'repos/facebook/react'],
    ['a trailing slash', '/repos/facebook/react/'],
    ['doubled slashes', '//repos//facebook/react'],
    ['surrounding whitespace', '  /repos/facebook/react  '],
    ['the owner in another case', '/repos/Facebook/React'],
  ])('keys the same entry despite %s', (_why, path) => {
    expect(normalizeCachePath(path)).toBe('/repos/facebook/react');
  });

  it('keeps a query string but not the order it was written in', () => {
    expect(normalizeCachePath('/repos/facebook/react/events?per_page=30&page=1')).toBe(
      normalizeCachePath('/repos/facebook/react/events?page=1&per_page=30'),
    );
    expect(normalizeCachePath('/repos/facebook/react/events?page=1')).not.toBe(
      normalizeCachePath('/repos/facebook/react/events?page=2'),
    );
  });

  it('does not fold two different repositories together', () => {
    expect(normalizeCachePath('/repos/facebook/react')).not.toBe(
      normalizeCachePath('/repos/facebook/react-native'),
    );
  });
});

// ── freshness vs readability ─────────────────────────────────────────────────

const now = new Date('2026-07-24T12:00:00Z');
const entryFetchedAt = (fetchedAt: Date): CachedResponse => ({
  path: '/repos/facebook/react',
  status: 200,
  body: '{"id":1}',
  fetchedAt,
  expiresAt: new Date(fetchedAt.getTime() + CACHE_RETENTION_MS),
});

describe('cacheState', () => {
  it('is a miss when nothing was ever stored', () => {
    expect(cacheState(null, now, REPO_CARD_FRESHNESS_MS)).toBe('miss');
  });

  it('is fresh inside the freshness window', () => {
    const entry = entryFetchedAt(new Date(now.getTime() - REPO_CARD_FRESHNESS_MS + 1000));
    expect(cacheState(entry, now, REPO_CARD_FRESHNESS_MS)).toBe('fresh');
  });

  it('is stale once the freshness window has passed, but still readable', () => {
    const entry = entryFetchedAt(new Date(now.getTime() - REPO_CARD_FRESHNESS_MS - 1000));
    expect(cacheState(entry, now, REPO_CARD_FRESHNESS_MS)).toBe('stale');
  });

  it('treats the exact edge of the window as stale', () => {
    const entry = entryFetchedAt(new Date(now.getTime() - REPO_CARD_FRESHNESS_MS));
    expect(cacheState(entry, now, REPO_CARD_FRESHNESS_MS)).toBe('stale');
  });

  it('keeps a repo card fresh for ten minutes', () => {
    expect(REPO_CARD_FRESHNESS_MS).toBe(10 * 60 * 1000);
  });

  it('keeps entries readable for far longer than they are fresh', () => {
    expect(CACHE_RETENTION_MS).toBeGreaterThan(REPO_CARD_FRESHNESS_MS);
  });
});

// ── what is worth storing ────────────────────────────────────────────────────

describe('isCacheable', () => {
  it('stores an answer GitHub is sure about', () => {
    expect(isCacheable(200)).toBe(true);
    expect(isCacheable(404)).toBe(true);
  });

  it('never stores an answer that only says GitHub is busy', () => {
    for (const status of [401, 403, 429, 500, 502, 503]) {
      expect(isCacheable(status)).toBe(false);
    }
  });
});

// ── what a repository answer is worth ────────────────────────────────────────

const repoBody = {
  id: 10270250,
  name: 'react',
  owner: { login: 'facebook' },
  private: false,
};
const answer = (status: number, body: unknown) => ({
  status,
  body: typeof body === 'string' ? body : JSON.stringify(body),
});

describe('classifyRepoAnswer', () => {
  it('stores a usable repository', () => {
    expect(classifyRepoAnswer(answer(200, repoBody))).toBe('store');
  });

  it('stores a 404, so a deleted repository is not re-asked on every view', () => {
    expect(classifyRepoAnswer(answer(404, { message: 'Not Found' }))).toBe('store');
  });

  it('never stores a private repository, and does not dress it up as an outage', () => {
    // A GITHUB_TOKEN that can see private repositories must not leave one in a
    // cache every visitor is served from — nor fall back to the public snapshot
    // this repository had before it was made private.
    expect(classifyRepoAnswer(answer(200, { ...repoBody, private: true }))).toBe('pass');
  });

  it.each([
    ['truncated JSON', '{"id":1027025'],
    ['an array', '[]'],
    ['null', 'null'],
    ['an empty body', ''],
    ['no id', JSON.stringify({ name: 'react', owner: { login: 'facebook' } })],
    ['an unusable id', JSON.stringify({ ...repoBody, id: 'not-a-number' })],
    ['no name', JSON.stringify({ id: 1, owner: { login: 'facebook' } })],
    ['no owner login', JSON.stringify({ id: 1, name: 'react', owner: {} })],
  ])('refuses to let a 200 with %s overwrite good data', (_why, body) => {
    expect(classifyRepoAnswer(answer(200, body))).toBe('retryable');
  });

  it.each([403, 429, 500, 502, 503])('treats %s as GitHub being busy', (status) => {
    expect(classifyRepoAnswer(answer(status, { message: 'nope' }))).toBe('retryable');
  });
});

// ── reading a document back out of Mongo ─────────────────────────────────────

describe('cacheEntryFromDoc', () => {
  const good = {
    status: 200,
    body: '{"id":1}',
    fetchedAt: new Date('2026-07-24T11:55:00Z'),
    expiresAt: new Date('2026-07-25T11:55:00Z'),
  };

  it('reads a well-formed document', () => {
    expect(cacheEntryFromDoc('/repos/facebook/react', good)).toMatchObject({
      path: '/repos/facebook/react',
      status: 200,
      body: '{"id":1}',
    });
  });

  it.each([
    ['nothing at all', null],
    ['a missing body', { ...good, body: undefined }],
    ['a body that is not text', { ...good, body: 42 }],
    ['a status that is not a number', { ...good, status: 'two hundred' }],
    ['a missing timestamp', { ...good, fetchedAt: undefined }],
    ['an unreadable timestamp', { ...good, fetchedAt: 'the other day' }],
  ])('answers null rather than throwing for %s', (_why, doc) => {
    expect(cacheEntryFromDoc('/repos/facebook/react', doc)).toBeNull();
  });

  it('falls back to the retention horizon when a document predates expiresAt', () => {
    const entry = cacheEntryFromDoc('/x', { ...good, expiresAt: undefined });
    expect(entry?.expiresAt.getTime()).toBe(good.fetchedAt.getTime() + CACHE_RETENTION_MS);
  });
});

// ── read-through ─────────────────────────────────────────────────────────────

function fakeStore(seed?: CachedResponse) {
  const rows = new Map<string, CachedResponse>();
  if (seed) rows.set(seed.path, seed);
  const store: CacheStore = {
    read: vi.fn(async (key: string) => rows.get(key) ?? null),
    write: vi.fn(async (entry: CachedResponse) => {
      rows.set(entry.path, entry);
    }),
  };
  return { store, rows };
}

const upstream = (status: number, body: string) =>
  vi.fn(async () => ({ status, body, headers: { 'content-type': 'application/json' } }));

describe('readThrough', () => {
  it('serves a fresh entry without asking GitHub anything', async () => {
    const { store } = fakeStore(entryFetchedAt(new Date(now.getTime() - 60_000)));
    const fetch = upstream(200, '{"id":2}');

    const read = await readThrough('/repos/Facebook/React', { store, fetch, now });

    expect(read).toMatchObject({ source: 'fresh', status: 200, body: '{"id":1}' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('fetches on a miss and stores the answer under the normalized key', async () => {
    const { store, rows } = fakeStore();
    const fetch = upstream(200, '{"id":2}');

    const read = await readThrough('repos/Facebook/React/', { store, fetch, now });

    expect(read).toMatchObject({ source: 'network', status: 200, body: '{"id":2}' });
    expect(fetch).toHaveBeenCalledTimes(1);
    const stored = rows.get('/repos/facebook/react');
    expect(stored).toMatchObject({ status: 200, body: '{"id":2}', fetchedAt: now });
    expect(stored?.expiresAt.getTime()).toBe(now.getTime() + CACHE_RETENTION_MS);
  });

  it('refreshes a stale entry when GitHub answers', async () => {
    const { store, rows } = fakeStore(entryFetchedAt(new Date(now.getTime() - 60 * 60_000)));
    const fetch = upstream(200, '{"id":2}');

    const read = await readThrough('/repos/facebook/react', { store, fetch, now });

    expect(read).toMatchObject({ source: 'network', body: '{"id":2}' });
    expect(rows.get('/repos/facebook/react')?.body).toBe('{"id":2}');
  });

  it('stores a 404 too, so a deleted repository is not re-asked on every view', async () => {
    const { store, rows } = fakeStore();
    const fetch = upstream(404, '{"message":"Not Found"}');

    const read = await readThrough('/repos/nobody/nothing', { store, fetch, now });

    expect(read.status).toBe(404);
    expect(rows.get('/repos/nobody/nothing')?.status).toBe(404);
  });

  it('serves the stale entry when GitHub is rate-limiting', async () => {
    const stale = entryFetchedAt(new Date(now.getTime() - 60 * 60_000));
    const { store, rows } = fakeStore(stale);
    const fetch = upstream(403, '{"message":"API rate limit exceeded"}');

    const read = await readThrough('/repos/facebook/react', { store, fetch, now });

    expect(read).toMatchObject({ source: 'stale', status: 200, body: '{"id":1}' });
    expect(read.fetchedAt).toEqual(stale.fetchedAt);
    // the rate-limit answer is not allowed to overwrite good data
    expect(rows.get('/repos/facebook/react')?.body).toBe('{"id":1}');
  });

  it('passes a rate limit through when there is nothing stale to fall back on', async () => {
    const { store, rows } = fakeStore();
    const fetch = upstream(429, '{"message":"Too Many Requests"}');

    const read = await readThrough('/repos/facebook/react', { store, fetch, now });

    expect(read).toMatchObject({ source: 'network', status: 429 });
    expect(rows.size).toBe(0);
  });

  it('serves the stale entry when GitHub cannot be reached at all', async () => {
    const { store } = fakeStore(entryFetchedAt(new Date(now.getTime() - 60 * 60_000)));
    const fetch = vi.fn(async () => {
      throw new Error('ECONNREFUSED');
    });

    const read = await readThrough('/repos/facebook/react', { store, fetch, now });

    expect(read).toMatchObject({ source: 'stale', status: 200, body: '{"id":1}' });
  });

  it('gives up when GitHub cannot be reached and nothing was ever stored', async () => {
    const { store } = fakeStore();
    const fetch = vi.fn(async () => {
      throw new Error('ECONNREFUSED');
    });

    await expect(readThrough('/repos/facebook/react', { store, fetch, now })).rejects.toThrow(
      /ECONNREFUSED/,
    );
  });

  it('still answers when the cache itself is broken', async () => {
    const store: CacheStore = {
      read: vi.fn(async () => {
        throw new Error('mongo is down');
      }),
      write: vi.fn(async () => {
        throw new Error('mongo is down');
      }),
    };
    const fetch = upstream(200, '{"id":2}');

    const read = await readThrough('/repos/facebook/react', { store, fetch, now });

    expect(read).toMatchObject({ source: 'network', body: '{"id":2}' });
  });

  it('keeps serving a stored 404 while GitHub is unreachable', async () => {
    // A repository that really is gone must keep saying so through an outage,
    // rather than flipping to "temporarily unavailable" and back.
    const gone: CachedResponse = {
      ...entryFetchedAt(new Date(now.getTime() - 60 * 60_000)),
      path: '/repos/nobody/nothing',
      status: 404,
      body: '{"message":"Not Found"}',
    };
    const { store } = fakeStore(gone);
    const fetch = vi.fn(async () => {
      throw new Error('ECONNREFUSED');
    });

    const read = await readThrough('/repos/nobody/nothing', { store, fetch, now });

    expect(read).toMatchObject({ source: 'stale', status: 404 });
  });

  it('lets the caller classify an answer it must not store', async () => {
    // 'pass': conclusive, but not ours to keep — and NOT a reason to serve the
    // stale entry, which would show the public snapshot of a now-private repo.
    const { store, rows } = fakeStore(entryFetchedAt(new Date(now.getTime() - 60 * 60_000)));
    const fetch = upstream(200, '{"private":true}');

    const read = await readThrough('/repos/facebook/react', {
      store,
      fetch,
      now,
      classify: () => 'pass',
    });

    expect(read).toMatchObject({ source: 'network', status: 200, body: '{"private":true}' });
    expect(rows.get('/repos/facebook/react')?.body).toBe('{"id":1}');
  });

  it('lets the caller reject a 200 that is not usable, keeping the good stale entry', async () => {
    const { store, rows } = fakeStore(entryFetchedAt(new Date(now.getTime() - 60 * 60_000)));
    const fetch = upstream(200, '{"id":tru');

    const read = await readThrough('/repos/facebook/react', {
      store,
      fetch,
      now,
      classify: () => 'retryable',
    });

    expect(read).toMatchObject({ source: 'stale', body: '{"id":1}' });
    expect(rows.get('/repos/facebook/react')?.body).toBe('{"id":1}');
  });

  it('honours a caller-chosen freshness window', async () => {
    const { store } = fakeStore(entryFetchedAt(new Date(now.getTime() - 30_000)));
    const fetch = upstream(200, '{"id":2}');

    const read = await readThrough('/repos/facebook/react', {
      store,
      fetch,
      now,
      freshnessMs: 10_000,
    });

    expect(read.source).toBe('network');
  });
});

// ── the answer the card is served ────────────────────────────────────────────

const ref = { owner: 'facebook', name: 'react' };
const summary: GitHubRepoSummary = {
  repoId: 10270250,
  owner: 'facebook',
  name: 'react',
  fullName: 'facebook/react',
  description: 'The library for web and native user interfaces.',
  language: 'JavaScript',
  stars: 228000,
  openIssues: 700,
  pushedAt: '2026-07-20T10:00:00Z',
  archived: false,
  htmlUrl: 'https://github.com/facebook/react',
};

describe('repoCardPayload', () => {
  it('answers 200 with the card fields', () => {
    const { status, body } = repoCardPayload(ref, { ok: true, repo: summary }, {
      source: 'network',
      fetchedAt: now,
    });

    expect(status).toBe(200);
    expect(body).toMatchObject({
      state: 'ok',
      owner: 'facebook',
      name: 'react',
      stale: false,
      repo: { stars: 228000, openIssues: 700, language: 'JavaScript' },
    });
  });

  it('says so when the card came out of a stale cache', () => {
    const { body } = repoCardPayload(ref, { ok: true, repo: summary }, {
      source: 'stale',
      fetchedAt: now,
    });

    expect(body).toMatchObject({ state: 'ok', stale: true, fetchedAt: now.toISOString() });
  });

  it('reports a repository GitHub does not have as unavailable', () => {
    const payload = repoCardPayload(
      ref,
      { ok: false, reason: 'not-found', status: 404, message: 'gone' },
      { source: 'network', fetchedAt: now },
    );

    expect(payload.status).toBe(404);
    expect(payload.body).toMatchObject({
      state: 'unavailable',
      reason: 'not-found',
      owner: 'facebook',
      name: 'react',
    });
  });

  it('answers a private repository exactly as it answers a missing one', () => {
    // The card path is public and unauthenticated. If "private" and "no such
    // repository" read differently on the wire, anyone can walk owner/name pairs
    // and learn which private repositories exist — an oracle the server token
    // would be paying for. Same reason, same message, byte for byte.
    const missing = repoCardPayload(
      ref,
      { ok: false, reason: 'not-found', status: 404, message: 'no such repository' },
      { source: 'network', fetchedAt: now },
    );
    const priv = repoCardPayload(
      ref,
      { ok: false, reason: 'private', status: 400, message: 'react is private.' },
      { source: 'network', fetchedAt: now },
    );

    expect(priv).toEqual(missing);
    expect(priv.body).toMatchObject({ state: 'unavailable', reason: 'not-found' });
    if (priv.body.state !== 'unavailable') throw new Error('expected an unavailable card');
    // The one sentence says "it may be private" about *every* refusal, which is
    // the opposite of an oracle: it is true of all of them and specific to none.
    expect(priv.body.message).toBe(unavailableMessage(ref));
  });

  it('reports a repository GitHub has blocked as its own kind of unavailable', () => {
    const payload = repoCardPayload(
      ref,
      { ok: false, reason: 'blocked', status: 451, message: 'blocked' },
      { source: 'network', fetchedAt: now },
    );

    expect(payload.status).toBe(404);
    expect(payload.body).toMatchObject({ state: 'unavailable', reason: 'blocked' });
  });

  it('refuses a repository whose id is not the one that was linked', () => {
    // Owner/name is a label GitHub lets go: delete `facebook/react` and someone
    // else may register the slug tomorrow. The project stored the numeric id, so
    // a card that does not match it is a different repository — not this one.
    const payload = repoCardPayload(ref, { ok: true, repo: summary }, {
      source: 'network',
      fetchedAt: now,
    }, { repoId: 999 });

    expect(payload.status).toBe(404);
    expect(payload.body).toMatchObject({ state: 'unavailable', reason: 'not-found' });
  });

  it('serves the card when the id is the linked one', () => {
    const payload = repoCardPayload(ref, { ok: true, repo: summary }, {
      source: 'network',
      fetchedAt: now,
    }, { repoId: summary.repoId });

    expect(payload.status).toBe(200);
    expect(payload.body.state).toBe('ok');
  });

  it('serves the card when no id was recorded to check against', () => {
    for (const expected of [undefined, { repoId: undefined }, { repoId: NaN }]) {
      const payload = repoCardPayload(
        ref,
        { ok: true, repo: summary },
        { source: 'network', fetchedAt: now },
        expected,
      );
      expect(payload.status).toBe(200);
    }
  });

  it.each([
    ['rate-limited' as const, 503],
    ['unauthorized' as const, 502],
    ['unavailable' as const, 502],
  ])('reports %s as temporarily unavailable', (reason, status) => {
    const payload = repoCardPayload(
      ref,
      { ok: false, reason, status: 502, message: 'busy' },
      { source: 'network', fetchedAt: now },
    );

    expect(payload.status).toBe(status);
    expect(payload.body).toMatchObject({ state: 'temporarily-unavailable', reason });
  });

  it('names the repository in every state, so a failed card still has a title', () => {
    for (const result of [
      { ok: true as const, repo: summary },
      { ok: false as const, reason: 'not-found' as const, status: 404, message: 'gone' },
      { ok: false as const, reason: 'rate-limited' as const, status: 503, message: 'busy' },
    ]) {
      const { body } = repoCardPayload(ref, result, { source: 'network', fetchedAt: now });
      expect(body.owner).toBe('facebook');
      expect(body.name).toBe('react');
    }
  });
});
