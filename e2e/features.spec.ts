import { test, expect, type Page } from '@playwright/test';

/**
 * E2E for the modern UX layer (PRD #84). Drives the running app and asserts
 * user-visible outcomes only. Reuses the webServer + seed from the config.
 */

const EMAIL = process.env.E2E_EMAIL || 'e2e@codecollab.test';
const PASSWORD = process.env.E2E_PASSWORD || 'e2e-password-123';

async function login(page: Page) {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
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
    await page.waitForLoadState('networkidle');

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
    await page.waitForLoadState('networkidle');
    await expect
      .poll(() => page.locator('html').evaluate((el) => el.classList.contains('dark')))
      .toBe(!startedDark);
  });
});

test.describe('toasts', () => {
  test('posting a comment shows a success toast', async ({ page }) => {
    await login(page);
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');
    const hrefs = await page
      .locator('a[href^="/projects/"]')
      .evaluateAll((els) => els.map((e) => e.getAttribute('href')));
    const detail = hrefs.find((h) => h && /^\/projects\/[a-f0-9]{24}$/i.test(h));
    test.skip(!detail, 'no project available to comment on');
    await page.goto(detail!);
    await page.waitForLoadState('networkidle');

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
    await page.waitForLoadState('networkidle');
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
