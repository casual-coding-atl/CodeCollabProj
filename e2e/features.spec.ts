import { test, expect } from '@playwright/test';

/**
 * E2E for the modern UX layer (PRD #84). Drives the running app and asserts
 * user-visible outcomes only. Reuses the webServer + seed from the config.
 */

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
