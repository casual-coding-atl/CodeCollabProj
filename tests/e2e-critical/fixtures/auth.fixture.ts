import { Page } from '@playwright/test';

/**
 * Test user credentials for E2E tests
 * These correspond to seeded users in the development database
 */
export const TEST_USERS = {
  user1: {
    email: 'user1@example.com',
    password: 'Password123!',
  },
  user2: {
    email: 'user2@example.com',
    password: 'Password123!',
  },
  admin: {
    email: 'admin@codecollabproj.com',
    password: 'Admin123!',
  },
  moderator: {
    email: 'moderator@codecollabproj.com',
    password: 'Moderator123!',
  },
} as const;

export type TestUserRole = keyof typeof TEST_USERS;

/**
 * Login helper function for E2E tests
 * Navigates to the login page, fills credentials, submits the form,
 * and waits for redirect to dashboard
 *
 * @param page - Playwright Page object
 * @param email - User email address
 * @param password - User password
 */
export async function loginAs(page: Page, email: string, password: string): Promise<void> {
  // Navigate to login page and wait for it to be fully loaded
  await page.goto('/login', { waitUntil: 'networkidle' });

  // Wait for the login form to be visible
  await page.waitForSelector('input[name="email"]', { state: 'visible', timeout: 10000 });

  // Fill the login form using input name attributes
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);

  // Click the submit button and wait for navigation
  await Promise.all([
    page.waitForURL('**/dashboard**', { timeout: 15000 }),
    page.click('button[type="submit"]'),
  ]);
}

/**
 * Login helper that uses a predefined test user role
 *
 * @param page - Playwright Page object
 * @param role - Test user role (user1, user2, admin, moderator)
 */
export async function loginAsRole(page: Page, role: TestUserRole): Promise<void> {
  const user = TEST_USERS[role];
  await loginAs(page, user.email, user.password);
}
