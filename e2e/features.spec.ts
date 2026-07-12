import { test, expect, type Page } from '@playwright/test';

/**
 * E2E for the modern UX layer (PRD #84). Drives the running app and asserts
 * user-visible outcomes only. Reuses the webServer + seed from the config.
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

test.describe('dark mode', () => {
  test('toggles the app to dark and persists across reload', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('load');

    const html = page.locator('html');
    const toggle = page.getByTestId('theme-toggle');
    await expect(toggle).toBeVisible();

    const startedDark = await html.evaluate((el) => el.classList.contains('dark'));

    await toggle.click();
    // theme flipped
    await expect
      .poll(() => html.evaluate((el) => el.classList.contains('dark')))
      .toBe(!startedDark);

    // persists across a full reload (no flash back)
    await page.reload();
    await page.waitForLoadState('load');
    await expect
      .poll(() => page.locator('html').evaluate((el) => el.classList.contains('dark')))
      .toBe(!startedDark);
  });
});

test.describe('toasts', () => {
  test('posting a comment shows a success toast', async ({ page }) => {
    await login(page);
    await page.goto('/projects');
    await page.getByTestId('project-list').waitFor({ timeout: 20000 });
    const hrefs = await page
      .locator('a[href^="/projects/"]')
      .evaluateAll((els) => els.map((e) => e.getAttribute('href')));
    const detail = hrefs.find((h) => h && /^\/projects\/[a-f0-9]{24}$/i.test(h));
    test.skip(!detail, 'no project available to comment on');
    await page.goto(detail!);
    await page.waitForLoadState('load');
    // comments live under the Comments tab
    await page.getByRole('tab', { name: /comments/i }).click();

    const body = `e2e comment ${Date.now()}`;
    const textarea = page.getByPlaceholder(/write a comment/i);
    await expect(textarea).toBeVisible();
    await textarea.fill(body);
    await page.getByRole('button', { name: /post comment/i }).click();

    // sonner toast confirms the outcome, and the comment appears
    await expect(page.getByText('Comment posted')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(body)).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('confirm dialog', () => {
  test('deleting a message asks for confirmation naming the action', async ({ page }) => {
    await login(page);
    await page.goto('/messages');
    await page.waitForLoadState('load');
    const del = page.getByRole('button', { name: /delete message/i }).first();
    test.skip((await del.count()) === 0, 'no message to delete');
    await del.click();
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(/delete message\?/i);
    // cancel — non-destructive assertion of the confirm UX
    await page.getByRole('button', { name: /cancel/i }).click();
    await expect(dialog).toBeHidden();
  });
});

test.describe('project filters', () => {
  test('reflect in the URL and clear resets them', async ({ page }) => {
    await login(page);
    await page.goto('/projects');
    await page.getByTestId('project-list').waitFor({ timeout: 20000 });

    // typing a search reflects into the URL (shareable/bookmarkable)
    await page.getByTestId('project-search').fill('project');
    await expect
      .poll(() => new URL(page.url()).searchParams.get('q'))
      .toBe('project');

    // a match count is shown
    await expect(page.getByTestId('project-count')).toBeVisible();

    // clear resets the URL
    await page.getByTestId('clear-filters').click();
    await expect.poll(() => new URL(page.url()).searchParams.toString()).toBe('');

    // the Featured toggle writes a clean ?featured=true (no escaped quotes) and
    // the list still loads (regression guard for the search-serializer bug)
    await page.getByRole('button', { name: /featured/i }).click();
    await expect.poll(() => new URL(page.url()).searchParams.get('featured')).toBe('true');
    expect(page.url()).not.toMatch(/%5C|%22/);
    await expect(page.getByText(/network error/i)).toHaveCount(0);
  });
});

test.describe('command palette', () => {
  test('opens with Cmd/Ctrl+K and navigates', async ({ page }) => {
    await login(page);
    await page.goto('/dashboard');
    await page.getByRole('heading', { name: /welcome back/i }).waitFor({ timeout: 15_000 });
    await page.keyboard.press('ControlOrMeta+k');
    const input = page.getByTestId('command-menu-input');
    await expect(input).toBeVisible({ timeout: 10_000 });
    await input.fill('projects');
    await page.getByRole('option', { name: /projects/i }).first().click();
    await expect(page).toHaveURL(/\/projects/, { timeout: 10_000 });
  });
});

test.describe('mobile navigation', () => {
  test('hamburger opens a sheet with links', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await login(page);
    await page.goto('/dashboard');
    const trigger = page.getByTestId('mobile-nav-trigger');
    await expect(trigger).toBeVisible({ timeout: 15_000 });
    await trigger.click();
    const projectsLink = page.getByRole('link', { name: /^projects$/i }).first();
    await expect(projectsLink).toBeVisible();
    await projectsLink.click();
    await expect(page).toHaveURL(/\/projects/, { timeout: 10_000 });
  });
});

test.describe('members table', () => {
  test('renders a sortable, paginated table', async ({ page }) => {
    await login(page);
    await page.goto('/members');
    await expect(page.getByTestId('members-table')).toBeVisible({ timeout: 20_000 });
    const next = page.getByTestId('members-next-page');
    if ((await next.count()) > 0 && (await next.isEnabled())) {
      await next.click();
      await expect(page.getByText(/page 2 of/i)).toBeVisible();
    }
  });
});

test.describe('project detail tabs + breadcrumb', () => {
  test('switch to Comments tab and show a breadcrumb', async ({ page }) => {
    await login(page);
    await page.goto('/projects');
    await page.getByTestId('project-list').waitFor({ timeout: 20000 });
    const hrefs = await page
      .locator('a[href^="/projects/"]')
      .evaluateAll((els) => els.map((e) => e.getAttribute('href')));
    const detail = hrefs.find((h) => h && /^\/projects\/[a-f0-9]{24}$/i.test(h));
    test.skip(!detail, 'no project available');
    await page.goto(detail!);
    // breadcrumb back to projects
    await expect(page.getByRole('navigation', { name: /breadcrumb/i })).toBeVisible();
    // tabs: comment form hidden until Comments tab is active
    const overview = page.getByRole('tab', { name: /overview/i });
    await expect(overview).toBeVisible();
    await page.getByRole('tab', { name: /comments/i }).click();
    await expect(page.getByPlaceholder(/write a comment/i)).toBeVisible();
  });
});

test.describe('member profile', () => {
  test('a member name links to their profile page', async ({ page }) => {
    await login(page);
    await page.goto('/members');
    await expect(page.getByTestId('members-table')).toBeVisible({ timeout: 20000 });
    // click the first member link in the table
    await page.locator('a[href^="/members/"]').first().click();
    // the member name links to that member's profile page
    await expect(page).toHaveURL(/\/members\/[a-f0-9]{24}/i);
    // the profile page rendered (either the profile or a not-found for a private one)
    await expect(page.getByRole('link', { name: 'Members' }).first()).toBeVisible();
  });
});
