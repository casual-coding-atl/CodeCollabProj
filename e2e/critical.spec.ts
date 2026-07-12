import { test, expect, type Page } from '@playwright/test';

/**
 * Critical-path E2E for the TanStack Start app. Runs against a running server
 * (see playwright.config.ts webServer) backed by a MongoDB seeded with the E2E
 * user + a sample project (scripts/seed-e2e.mjs).
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

test('home page renders the shell (SSR)', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/CodeCollabProj/i);
  // The Header/Footer logo is server-rendered.
  await expect(page.getByRole('img', { name: /logo/i }).first()).toBeVisible();
  // Anonymous nav offers a Login link.
  await expect(page.getByRole('link', { name: /login/i }).first()).toBeVisible();
});

test('a user can log in and reach the dashboard', async ({ page }) => {
  await login(page);
  await expect(page).toHaveURL(/\/dashboard/);
  // Signed-in: the anonymous "Login" nav link is gone.
  await expect(page.getByRole('link', { name: /^login$/i })).toHaveCount(0);
});

test('the projects list shows at least one project', async ({ page }) => {
  await login(page);
  await page.goto('/projects');
  const projectLinks = page.locator('a[href^="/projects/"]');
  await expect(projectLinks.first()).toBeVisible({ timeout: 15_000 });
  expect(await projectLinks.count()).toBeGreaterThan(0);
});

test('a user can open a project detail page', async ({ page }) => {
  await login(page);
  await page.goto('/projects');
  await page.getByTestId('project-list').waitFor({ timeout: 20000 });
  // Find a real project link (/projects/<24-hex-id>), not /projects/create.
  const hrefs = await page
    .locator('a[href^="/projects/"]')
    .evaluateAll((els) => els.map((e) => e.getAttribute('href')));
  const detail = hrefs.find((h) => h && /^\/projects\/[a-f0-9]{24}$/i.test(h));
  expect(detail, 'expected at least one project detail link').toBeTruthy();
  await page.goto(detail!);
  await expect(page).toHaveURL(/\/projects\/[a-f0-9]{24}/i);
  await expect(page.getByRole('heading').first()).toBeVisible();
});
