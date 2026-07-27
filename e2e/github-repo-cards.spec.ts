import { test, expect, type Page, type APIRequestContext } from '@playwright/test';
import { GITHUB_FIXTURE_URL } from '../playwright.config';

/**
 * Repo cards on a project page (PRD #88, phase 2).
 *
 * GitHub is stubbed for the whole suite: `GITHUB_API_BASE` points the server's
 * single outbound edge at e2e/fixtures/github-api.mjs (see playwright.config.ts),
 * and scripts/seed-e2e.mjs links the sample project to three of its
 * repositories — one that resolves, one GitHub answers 404 for, and one behind a
 * rate limit — plus a second project linking one that is private. So the
 * assertions below are about *this app's* behaviour end to end (proxy → gate →
 * cache → card), never about the network.
 *
 * Two claims are load-bearing:
 *
 *  - a project page survives its repositories being deleted, private or
 *    unreachable, for a signed-in member and a stranger alike;
 *  - the proxy is not an open GitHub relay. It answers for repositories this app
 *    links, and for nothing else — which the fixture's own request log proves,
 *    since the only way to see the absence of a request is to ask the thing that
 *    would have received it.
 */

const EMAIL = process.env.E2E_EMAIL || 'e2e@codecollab.test';
const PASSWORD = process.env.E2E_PASSWORD || 'e2e-password-123';

async function login(page: Page) {
  await page.goto('/login');
  await page.waitForLoadState('load');
  await page.locator('input[name="email"]').waitFor({ timeout: 15000 });
  await page.waitForTimeout(600); // allow hydration before interacting
  await page.fill('input[name="email"]', EMAIL);
  await page.fill('input[name="password"]', PASSWORD);
  await Promise.all([
    page.waitForURL('**/dashboard', { timeout: 15_000 }),
    page.click('button[type="submit"]'),
  ]);
}

/** A seeded project's id, by title. The list endpoint is public. */
async function projectIdByTitle(api: APIRequestContext, title: string): Promise<string> {
  const projects = await api.get('/api/projects').then((r) => r.json());
  const project = projects.find((p: { title: string }) => p.title === title);
  expect(project?._id, `expected the seeded project "${title}"`).toBeTruthy();
  return project._id as string;
}

/** The seeded project with three Linked Repositories. */
async function openSeededProject(page: Page) {
  await page.goto(`/projects/${await projectIdByTitle(page.request, 'E2E Sample Project')}`);
}

/** How many times the GitHub fixture has been asked for a repository. */
async function fixtureHits(api: APIRequestContext, path: string): Promise<number> {
  const stats = await api.get(`${GITHUB_FIXTURE_URL}/__stats`).then((r) => r.json());
  return stats.hits[path] ?? 0;
}

test.describe('linked repository cards', () => {
  test('renders a card per linked repository, live and unavailable alike', async ({ page }) => {
    const crashes: string[] = [];
    page.on('pageerror', (err) => crashes.push(err.message));

    await login(page);
    await openSeededProject(page);

    const section = page.getByTestId('linked-repos');
    await expect(section).toBeVisible({ timeout: 20_000 });

    // The repository the fixture serves: name, star count and open issues come
    // from the fixture, so this proves the whole path carried real values.
    const card = page.getByTestId('repo-card');
    await expect(card).toHaveCount(1, { timeout: 20_000 });
    await expect(card.getByRole('link', { name: 'codecollab-web' })).toHaveAttribute(
      'href',
      'https://github.com/e2e-org/codecollab-web',
    );
    await expect(card.getByTestId('repo-card-stars')).toHaveText(/128/);
    await expect(card).toContainText('TypeScript');
    await expect(card).toContainText('The web app seeded for end-to-end tests.');

    // The 404 repository and the rate-limited one each degrade to their own
    // card, saying which kind of unavailable they are.
    const unavailable = page.getByTestId('repo-card-unavailable');
    await expect(unavailable).toHaveCount(2);
    await expect(unavailable.filter({ hasText: 'gone-repo' })).toContainText(
      /deleted, renamed or made private/i,
    );
    await expect(unavailable.filter({ hasText: 'rate-limited-repo' })).toContainText(
      /temporarily unavailable/i,
    );

    // ...and the page itself is fine: the project still renders, no error state,
    // nothing thrown in the browser.
    await expect(page.getByRole('heading', { name: 'E2E Sample Project' }).first()).toBeVisible();
    await expect(page.getByText('Error Loading Project')).toHaveCount(0);
    expect(crashes, 'the page must not throw because of a repository').toEqual([]);
  });

  test('a signed-out visitor reads the project page, cards and all', async ({ page }) => {
    // A link to a project has to work for the person you sent it to (PRD #88,
    // story 21) — no session, no login redirect, and the same cards.
    const crashes: string[] = [];
    page.on('pageerror', (err) => crashes.push(err.message));

    await openSeededProject(page);

    await expect(page).toHaveURL(/\/projects\/[a-f0-9]{24}/i);
    await expect(page.getByRole('heading', { name: 'E2E Sample Project' }).first()).toBeVisible();

    const card = page.getByTestId('repo-card');
    await expect(card).toHaveCount(1, { timeout: 20_000 });
    await expect(card.getByTestId('repo-card-stars')).toHaveText(/128/);
    await expect(page.getByTestId('repo-card-unavailable')).toHaveCount(2);

    // Signed out means signed out: the page offers to sign in rather than to
    // collaborate, and there is no comment box.
    await expect(page.getByRole('button', { name: /login to collaborate/i })).toBeVisible();
    expect(crashes, 'the page must not throw for a stranger either').toEqual([]);
  });

  test('answers the proxy to anyone, signed in or not', async ({ page }) => {
    // No sign-in here on purpose: a project page is public, so the cards on it
    // must be too. The browser still never talks to GitHub — only to /api.
    const response = await page.request.get('/api/github/repos/e2e-org/codecollab-web');
    expect(response.status()).toBe(200);
    expect(await response.json()).toMatchObject({
      state: 'ok',
      owner: 'e2e-org',
      name: 'codecollab-web',
      stale: false,
      repo: { stars: 128, openIssues: 7, language: 'TypeScript' },
    });

    // A repository GitHub does not have is a state, with an honest status.
    const gone = await page.request.get('/api/github/repos/e2e-org/gone-repo');
    expect(gone.status()).toBe(404);
    expect(await gone.json()).toMatchObject({ state: 'unavailable', reason: 'not-found' });

    // A rate limit is temporary, and says so.
    const limited = await page.request.get('/api/github/repos/e2e-org/rate-limited-repo');
    expect(limited.status()).toBe(503);
    expect(await limited.json()).toMatchObject({
      state: 'temporarily-unavailable',
      reason: 'rate-limited',
    });
  });

  test('serves the second read out of the cache, without asking GitHub again', async ({ page }) => {
    // Warm it, then ask again: the same answer, and the fixture has not been
    // troubled a second time. `x-ccp-cache` says where the body came from.
    const path = '/repos/e2e-org/codecollab-web';
    await page.request.get('/api/github/repos/e2e-org/codecollab-web');
    const before = await fixtureHits(page.request, path);

    const second = await page.request.get('/api/github/repos/e2e-org/codecollab-web');

    expect(second.status()).toBe(200);
    expect(second.headers()['x-ccp-cache']).toBe('fresh');
    expect(await fixtureHits(page.request, path)).toBe(before);
  });

  test('will not describe a repository no project links', async ({ page }) => {
    // The endpoint is public, so without this it is a free GitHub proxy: anyone
    // could spend the server's token budget and mint a cache document per pair
    // they tried. Unlinked repositories are refused *before* GitHub is asked.
    const unlinked = ['e2e-org/never-linked', 'facebook/react', 'e2e-org/rate-limited-repo-x'];

    for (const slug of unlinked) {
      const response = await page.request.get(`/api/github/repos/${slug}`);
      expect(response.status(), `${slug} must not be described`).toBe(404);
      expect(await response.json()).toMatchObject({ state: 'unavailable', reason: 'not-found' });
      expect(await fixtureHits(page.request, `/repos/${slug}`), `${slug} must not reach GitHub`)
        .toBe(0);
    }

    // A name GitHub could not have is refused the same way — no 400, no
    // different message, nothing to tell one refusal from another.
    const nonsense = await page.request.get('/api/github/repos/not%20a%20login/re$act');
    expect(nonsense.status()).toBe(404);
    expect(await nonsense.json()).toMatchObject({ state: 'unavailable', reason: 'not-found' });
  });

  test('answers a private repository exactly as it answers a missing one, and caches neither', async ({
    page,
  }) => {
    // Linked, then made private. If this read differently from "no such
    // repository", the endpoint would be an enumeration oracle for whatever the
    // server's own token can see.
    const priv = await page.request.get('/api/github/repos/e2e-org/private-repo');
    const missing = await page.request.get('/api/github/repos/e2e-org/gone-repo');

    expect(priv.status()).toBe(missing.status());
    const privBody = await priv.json();
    const missingBody = await missing.json();
    expect(privBody.state).toBe(missingBody.state);
    expect(privBody.reason).toBe(missingBody.reason);
    // Same sentence, with only the repository's own name differing.
    expect(privBody.message.replace('private-repo', 'X')).toBe(
      missingBody.message.replace('gone-repo', 'X'),
    );
    expect(JSON.stringify(privBody)).not.toContain('Nobody should ever read this');

    // And it is never cached: every read goes to GitHub rather than being served
    // from a document that would hold a private repository's details.
    expect(priv.headers()['x-ccp-cache']).toBe('network');
    const again = await page.request.get('/api/github/repos/e2e-org/private-repo');
    expect(again.headers()['x-ccp-cache']).toBe('network');

    // The card page for it shows the ordinary unavailable state.
    const projectId = await projectIdByTitle(page.request, 'E2E Private Repo Project');
    await page.goto(`/projects/${projectId}`);
    await expect(page.getByTestId('repo-card-unavailable')).toHaveCount(1, { timeout: 20_000 });
    await expect(page.getByTestId('repo-card')).toHaveCount(0);
  });
});
