import { test, expect } from '@playwright/test';
import { loginAs, TEST_USERS } from './fixtures/auth.fixture';

/**
 * Authentication E2E tests
 * Tests for login, logout, and registration flows
 */
test.describe('Authentication', () => {
  test('login with valid credentials', async ({ page }) => {
    // Use the loginAs helper to login with valid credentials
    await loginAs(page, TEST_USERS.user1.email, TEST_USERS.user1.password);

    // Verify we're on the dashboard and see the Welcome message
    await expect(page).toHaveURL(/.*\/dashboard.*/);
    await expect(page.getByText(/Welcome back/i)).toBeVisible();
  });

  test('login with invalid credentials', async ({ page }) => {
    // Navigate to login page
    await page.goto('/login');

    // Fill the login form with invalid credentials
    await page.fill('input[name="email"]', TEST_USERS.user1.email);
    await page.fill('input[name="password"]', 'wrongpassword123');

    // Click the submit button
    await page.click('button[type="submit"]');

    // Verify error alert is shown (MUI Alert component with severity="error")
    await expect(page.locator('.MuiAlert-standardError')).toBeVisible();
  });

  test('logout', async ({ page }) => {
    // First login
    await loginAs(page, TEST_USERS.user1.email, TEST_USERS.user1.password);

    // Verify we're on the dashboard
    await expect(page).toHaveURL(/.*\/dashboard.*/);

    // Click on the account menu button (avatar icon button in the header)
    await page.click('button[aria-label^="Account menu"]');

    // Wait for the menu to appear and click Logout
    await page.click('text=Logout');

    // Verify redirected to login page
    await expect(page).toHaveURL(/.*\/login.*/);
  });

  test('register new user', async ({ page }) => {
    // Generate a unique email for this test run to avoid conflicts
    const timestamp = Date.now();
    const testUser = {
      username: `testuser${timestamp}`,
      email: `testuser${timestamp}@example.com`,
      password: 'TestPassword123!',
    };

    // Navigate to register page
    await page.goto('/register');

    // Fill the registration form
    await page.fill('input[name="username"]', testUser.username);
    await page.fill('input[name="email"]', testUser.email);
    await page.fill('input[name="password"]', testUser.password);
    await page.fill('input[name="confirmPassword"]', testUser.password);

    // Submit the form
    await page.click('button[type="submit"]');

    // Verify success message is shown (Registration Successful alert)
    await expect(page.getByText(/Registration Successful/i)).toBeVisible({ timeout: 10000 });
  });
});
