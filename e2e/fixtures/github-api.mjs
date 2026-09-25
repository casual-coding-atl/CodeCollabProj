// A stand-in for api.github.com, so the E2E suite never touches the real thing.
//
// The app's single outbound edge (`githubRequest` in src/server/github.ts)
// points at whatever `GITHUB_API_BASE` says; playwright.config.ts points it
// here. That keeps the suite hermetic — no network, no rate limit, no repository
// whose star count changes between runs — while still exercising the real
// server path: cache, proxy route, card component.
//
// It also *counts* what it is asked for, and serves that count at `/__stats`.
// That is how a test asserts something did NOT happen: a repository no project
// links must never reach GitHub at all, and the only way to see the absence of
// a request is to ask the thing that would have received it.
//
// The repositories below are the ones scripts/seed-e2e.mjs links to the seeded
// projects. Between them they cover every state a card can be in.
import { createServer } from 'node:http';

const PORT = Number(process.env.GITHUB_FIXTURE_PORT) || 3199;
// Loopback only: this answers for api.github.com, and nothing beyond this
// machine has any business reaching it.
const HOST = '127.0.0.1';

/** A public repository, exactly as GitHub's /repos/{owner}/{repo} describes one. */
const REPOS = {
  'e2e-org/codecollab-web': {
    id: 9001,
    name: 'codecollab-web',
    full_name: 'e2e-org/codecollab-web',
    private: false,
    html_url: 'https://github.com/e2e-org/codecollab-web',
    description: 'The web app seeded for end-to-end tests.',
    language: 'TypeScript',
    stargazers_count: 128,
    open_issues_count: 7,
    pushed_at: '2026-07-20T10:00:00Z',
    archived: false,
    owner: { login: 'e2e-org' },
  },
  // Linked, and private by the time anybody asks — the case the card path must
  // answer exactly as it answers a repository that does not exist, and must
  // never write to a cache that serves every visitor.
  'e2e-org/private-repo': {
    id: 9004,
    name: 'private-repo',
    full_name: 'e2e-org/private-repo',
    private: true,
    html_url: 'https://github.com/e2e-org/private-repo',
    description: 'Nobody should ever read this description off a card.',
    language: 'TypeScript',
    stargazers_count: 1,
    open_issues_count: 0,
    pushed_at: '2026-07-20T10:00:00Z',
    archived: false,
    owner: { login: 'e2e-org' },
  },
};

/**
 * README responses for the fixture repositories, keyed by slug.
 * The content field is a base64-encoded README — the server must return this
 * shape for the app's fetchRepoReadme() to decode it.
 */
const README_CONTENT = `# CodeCollab Web

A web application seeded for end-to-end tests of the CodeCollab platform.

## Problem

Developers need a place to find collaborators for side projects.

## Features

- Project listings with status and tech stack
- Collaboration requests and notifications
- GitHub repository linking
- AI-powered ideation evaluation

## Tech Stack

TypeScript, React, TanStack Router, MongoDB, Anthropic Claude API.
`;

const READMES = {
  'e2e-org/codecollab-web': {
    encoding: 'base64',
    content: Buffer.from(README_CONTENT).toString('base64'),
    name: 'README.md',
    path: 'README.md',
  },
};

/**
 * File tree responses for the fixture repositories.
 * Includes a mix of clean paths and noisy ones (node_modules, dist) so the
 * E2E suite exercises the pruning logic in production.
 */
const TREES = {
  'e2e-org/codecollab-web': {
    truncated: false,
    tree: [
      { type: 'blob', path: 'README.md' },
      { type: 'blob', path: 'package.json' },
      { type: 'blob', path: 'tsconfig.json' },
      { type: 'blob', path: 'src/index.ts' },
      { type: 'blob', path: 'src/routes/api.evaluations.ts' },
      { type: 'blob', path: 'src/components/EvaluationResults.tsx' },
      { type: 'blob', path: 'src/server/github.ts' },
      { type: 'blob', path: 'src/server/models.ts' },
      // Noisy paths that should be pruned by the evidence gatherer:
      { type: 'blob', path: 'node_modules/react/index.js' },
      { type: 'blob', path: 'dist/bundle.js' },
      { type: 'blob', path: 'package-lock.json' },
    ],
  },
};

/** Every repository path this server has been asked for, and how often. */
const hits = new Map();

const send = (res, status, body, headers = {}) => {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(payload),
    ...headers,
  });
  res.end(payload);
};

const server = createServer((req, res) => {
  const { pathname } = new URL(req.url ?? '/', 'http://localhost');

  // Playwright waits on this before letting the suite start.
  if (pathname === '/healthz') return send(res, 200, { ok: true });
  if (pathname === '/__stats') return send(res, 200, { hits: Object.fromEntries(hits) });

  hits.set(pathname, (hits.get(pathname) ?? 0) + 1);

  // ── /repos/{owner}/{name}/readme ────────────────────────────────────────────
  const readmeMatch = /^\/repos\/([^/]+)\/([^/]+)\/readme$/.exec(pathname);
  if (readmeMatch) {
    const slug = `${decodeURIComponent(readmeMatch[1])}/${decodeURIComponent(readmeMatch[2])}`;
    const readme = READMES[slug];
    if (!readme) return send(res, 404, { message: 'Not Found' });
    return send(res, 200, readme);
  }

  // ── /repos/{owner}/{name}/git/trees/HEAD ────────────────────────────────────
  const treeMatch = /^\/repos\/([^/]+)\/([^/]+)\/git\/trees\/HEAD$/.exec(pathname);
  if (treeMatch) {
    const slug = `${decodeURIComponent(treeMatch[1])}/${decodeURIComponent(treeMatch[2])}`;
    const tree = TREES[slug];
    if (!tree) return send(res, 404, { message: 'Not Found' });
    return send(res, 200, tree);
  }

  // ── /repos/{owner}/{name} ────────────────────────────────────────────────────
  const match = /^\/repos\/([^/]+)\/([^/]+)$/.exec(pathname);
  if (!match) return send(res, 404, { message: 'Not Found' });

  const slug = `${decodeURIComponent(match[1])}/${decodeURIComponent(match[2])}`;

  // A repository whose owner has run out of requests: GitHub's rate-limit
  // answer, which the app must turn into "temporarily unavailable" rather than
  // "this repository does not exist".
  if (slug === 'e2e-org/rate-limited-repo') {
    return send(res, 403, { message: 'API rate limit exceeded' }, { 'x-ratelimit-remaining': '0' });
  }

  const repo = REPOS[slug];
  if (!repo) return send(res, 404, { message: 'Not Found' });
  return send(res, 200, repo);
});

// Without this, a port already in use raises an unhandled 'error' event: the
// process dies on a stack trace that says nothing about what to do about it.
server.on('error', (err) => {
  const detail = err.code === 'EADDRINUSE' ? ` — ${HOST}:${PORT} is already in use` : '';
  // eslint-disable-next-line no-console
  console.error(`[e2e] the GitHub API fixture could not start${detail}: ${err.message}`);
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  // eslint-disable-next-line no-console
  console.log(`[e2e] GitHub API fixture listening on http://${HOST}:${PORT}`);
});
