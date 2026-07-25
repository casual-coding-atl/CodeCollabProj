import { test, expect, type Page } from '@playwright/test';

/**
 * Repo cards on a project page (PRD #88, phase 2).
 *
 * GitHub is stubbed for the whole suite: `GITHUB_API_BASE` points the server's
 * single outbound edge at e2e/fixtures/github-api.mjs (see playwright.config.ts),
 * and scripts/seed-e2e.mjs links the sample project to three of its
 * repositories — one that resolves, one GitHub answers 404 for, and one behind a
 * rate limit. So the assertions below are about *this app's* behaviour end to
 * end (proxy → cache → card), never about the network.
 *
 * The load-bearing claim is the last one: a project page must survive its
 * repositories being deleted, private or unreachable.
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

/** The seeded project, which is the one with Linked Repositories. */
async function openSeededProject(page: Page) {
  const projects = await page.request.get('/api/projects').then((r) => r.json());
  const project = projects.find((p: { title: string }) => p.title === 'E2E Sample Project');
  expect(project?._id, 'expected the seeded sample project').toBeTruthy();
  await page.goto(`/projects/${project._id}`);
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
});
