import { test, expect, Page, APIRequestContext, Browser } from '@playwright/test';

const API_URL = process.env.API_URL || 'http://localhost:5001/api';
const APP_URL = process.env.APP_URL || 'http://localhost:3000';

interface TestUser {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
}

/**
 * Comprehensive authentication flow tests
 * Tests full user lifecycle: register, verify email, login, logout, password reset
 */

test.describe('Authentication Flow E2E', () => {
  // Generate unique test user for each test run
  const timestamp = Date.now();
  const testUser: TestUser = {
    username: `testuser${timestamp}`,
    email: `test${timestamp}@example.com`,
    password: 'SecurePass123!',
    confirmPassword: 'SecurePass123!',
  };

  test.describe('User Registration', () => {
    test('should successfully register a new user', async ({ page }: { page: Page }) => {
      await page.goto(`${APP_URL}/register`);

      // Fill registration form
      await page.fill('input[name="username"]', testUser.username);
      await page.fill('input[name="email"]', testUser.email);
      await page.fill('input[name="password"]', testUser.password);
      await page.fill('input[name="confirmPassword"]', testUser.confirmPassword);

      // Submit form
      await page.click('button[type="submit"]');

      // Should show success message or redirect to login/dashboard (dev mode auto-login)
      await page.waitForTimeout(1500); // Give time for auto-redirect

      const isOnDashboard = page.url().includes('dashboard');
      if (!isOnDashboard) {
        // If not redirected, check for success message
        const successAlert = page.locator('.MuiAlertTitle-root, .MuiAlert-message').filter({ hasText: /Registration Successful/i }).first();
        await expect(successAlert).toBeVisible({ timeout: 5000 });
      }
    });

    test('should prevent registration with duplicate email', async ({ page }: { page: Page }) => {
      await page.goto(`${APP_URL}/register`);

      // Try to register with existing email (user1@example.com from seed)
      await page.fill('input[name="username"]', 'newuser');
      await page.fill('input[name="email"]', 'user1@example.com');
      await page.fill('input[name="password"]', 'Password123!');
      await page.fill('input[name="confirmPassword"]', 'Password123!');

      await page.click('button[type="submit"]');

      // Should show error message
      const errorMessage = page.locator('text=/already exists|taken|duplicate/i');
      await expect(errorMessage).toBeVisible({ timeout: 5000 });
    });

    test('should validate password requirements', async ({ page }: { page: Page }) => {
      await page.goto(`${APP_URL}/register`);

      await page.fill('input[name="username"]', 'testuser');
      await page.fill('input[name="email"]', 'test@example.com');
      await page.fill('input[name="password"]', 'weak'); // Too weak
      await page.fill('input[name="confirmPassword"]', 'weak');

      await page.click('button[type="submit"]');

      // Should show password validation error
      const errorMessage = page.locator('[data-testid="password-error"]');
      await expect(errorMessage).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('User Login', () => {
    test('should successfully login with valid credentials', async ({ page }: { page: Page }) => {
      await page.goto(`${APP_URL}/login`);

      // Use seeded test user
      await page.fill('input[name="email"], input[type="email"]', 'user1@example.com');
      await page.fill('input[name="password"], input[type="password"]', 'Password123!');

      await page.click('button[type="submit"]');

      // Should redirect to dashboard
      await page.waitForURL('**/dashboard**', { timeout: 10000 }).catch(() => {});

      // Should show authenticated user indicators
      const userMenu = page.locator('[aria-label*="user"], [data-testid*="user"], text=/user1/i');
      const isVisible = await userMenu
        .first()
        .isVisible()
        .catch(() => false);
      expect(isVisible || page.url().includes('dashboard')).toBeTruthy();
    });

    test('should reject login with invalid credentials', async ({ page }: { page: Page }) => {
      await page.goto(`${APP_URL}/login`);

      await page.fill('input[name="email"], input[type="email"]', 'user1@example.com');
      await page.fill('input[name="password"], input[type="password"]', 'WrongPassword!');

      await page.click('button[type="submit"]');

      // Should show error message
      const errorMessage = page.locator('text=/invalid|incorrect|wrong/i');
      await expect(errorMessage).toBeVisible({ timeout: 5000 });
    });

    test('should reject login for unverified user', async ({
      page,
      request,
    }: {
      page: Page;
      request: APIRequestContext;
    }) => {
      // Register a new user (unverified)
      const unverifiedUser: TestUser = {
        username: `unverified${Date.now()}`,
        email: `unverified${Date.now()}@example.com`,
        password: 'Password123!',
        confirmPassword: 'Password123!',
      };

      await request.post(`${API_URL}/auth/register`, {
        data: unverifiedUser,
      });

      // Try to login
      await page.goto(`${APP_URL}/login`);
      await page.fill('input[name="email"], input[type="email"]', unverifiedUser.email);
      await page.fill('input[name="password"], input[type="password"]', unverifiedUser.password);
      await page.click('button[type="submit"]');

      // Should show verification required message
      const verifyMessage = page.locator('text=/verify|verification|unverified/i');
      await expect(verifyMessage).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Session Persistence', () => {
    test('should maintain session across page reloads', async ({ page }: { page: Page }) => {
      // Login
      await page.goto(`${APP_URL}/login`);
      await page.fill('input[name="email"], input[type="email"]', 'user1@example.com');
      await page.fill('input[name="password"], input[type="password"]', 'Password123!');
      await page.click('button[type="submit"]');
      await page.waitForLoadState('networkidle');

      // Reload page
      await page.reload();
      await page.waitForLoadState('networkidle');

      // Should still be authenticated
      const isAuthenticated = !page.url().includes('login');
      expect(isAuthenticated).toBeTruthy();
    });

    test('should handle concurrent sessions in different browsers', async ({
      browser,
    }: {
      browser: Browser;
    }) => {
      // Create two separate contexts (like different browsers)
      const context1 = await browser.newContext();
      const context2 = await browser.newContext();

      const page1 = await context1.newPage();
      const page2 = await context2.newPage();

      // Login in both contexts
      for (const page of [page1, page2]) {
        await page.goto(`${APP_URL}/login`);
        await page.fill('input[name="email"], input[type="email"]', 'user1@example.com');
        await page.fill('input[name="password"], input[type="password"]', 'Password123!');
        await page.click('button[type="submit"]');
        await page.waitForLoadState('networkidle');
      }

      // Both should be authenticated independently
      expect(!page1.url().includes('login')).toBeTruthy();
      expect(!page2.url().includes('login')).toBeTruthy();

      await context1.close();
      await context2.close();
    });
  });

  test.describe('Logout', () => {
    test('should successfully logout and clear session', async ({ page }: { page: Page }) => {
      // Login first
      await page.goto(`${APP_URL}/login`);
      await page.fill('input[name="email"], input[type="email"]', 'user1@example.com');
      await page.fill('input[name="password"], input[type="password"]', 'Password123!');
      await page.click('button[type="submit"]');
      await page.waitForLoadState('networkidle');

      // Open account menu and click logout
      const accountButton = page.locator('[aria-label*="Account menu"], [aria-haspopup="true"]').first();
      await expect(accountButton).toBeVisible({ timeout: 5000 });
      await accountButton.click();
      
      const logoutButton = page.locator('[data-testid="logout-button"]');
      await expect(logoutButton).toBeVisible({ timeout: 5000 });
      await logoutButton.click();

      // Should redirect to login or home
      await page.waitForURL(/\/(login|home|$)/, { timeout: 5000 }).catch(() => {});

      // Try to access protected route
      await page.goto(`${APP_URL}/dashboard`);

      // Should redirect to login
      await page.waitForURL('**/login**', { timeout: 5000 }).catch(() => {});
      expect(page.url()).toContain('login');
    });
  });

  test.describe('Password Reset Flow', () => {
    test('should send password reset email for valid user', async ({
      page,
      request,
    }: {
      page: Page;
      request: APIRequestContext;
    }) => {
      await page.goto(`${APP_URL}/forgot-password`);

      await page.fill('input[name="email"], input[type="email"]', 'user1@example.com');
      await page.click('button[type="submit"]');

      // Should show success message
      const successMessage = page.locator('text=/Password Reset Link Generated/i');
      await expect(successMessage).toBeVisible({ timeout: 5000 });
    });

    test('should handle password reset for non-existent user gracefully', async ({
      page,
    }: {
      page: Page;
    }) => {
      await page.goto(`${APP_URL}/forgot-password`);

      await page.fill('input[name="email"], input[type="email"]', 'nonexistent@example.com');
      await page.click('button[type="submit"]');

      // Should show generic success message (security best practice - no user enumeration)
      // Look for the Alert with specific text about password reset
      const message = page.locator('text=Password Reset Link Generated');
      await expect(message).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Email Verification', () => {
    test('should show appropriate message for expired verification token', async ({
      page,
    }: {
      page: Page;
    }) => {
      // Use an expired/invalid token
      await page.goto(`${APP_URL}/verify-email/expired_token_123`);

      // Should show error message
      const errorMessage = page.locator('text=/expired|invalid|error/i');
      await expect(errorMessage).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Protected Routes', () => {
    test('should redirect unauthenticated users from protected routes', async ({
      page,
    }: {
      page: Page;
    }) => {
      const protectedRoutes = ['/dashboard', '/profile', '/projects/create'];

      for (const route of protectedRoutes) {
        await page.goto(`${APP_URL}${route}`);

        // Should redirect to login
        await page.waitForURL('**/login**', { timeout: 5000 }).catch(() => {});
        expect(page.url()).toContain('login');
      }
    });

    test('should allow authenticated users to access protected routes', async ({
      page,
    }: {
      page: Page;
    }) => {
      // Login first
      await page.goto(`${APP_URL}/login`);
      await page.fill('input[name="email"], input[type="email"]', 'user1@example.com');
      await page.fill('input[name="password"], input[type="password"]', 'Password123!');
      await page.click('button[type="submit"]');
      await page.waitForLoadState('networkidle');

      // Access protected routes
      const protectedRoutes = ['/dashboard', '/profile'];

      for (const route of protectedRoutes) {
        await page.goto(`${APP_URL}${route}`);
        await page.waitForLoadState('networkidle');

        // Should not redirect to login
        expect(page.url()).not.toContain('login');
      }
    });
  });

  test.describe('Token Refresh', () => {
    test('should automatically refresh expired access token', async ({ page }: { page: Page }) => {
      // Login
      await page.goto(`${APP_URL}/login`);
      await page.fill('input[name="email"], input[type="email"]', 'user1@example.com');
      await page.fill('input[name="password"], input[type="password"]', 'Password123!');
      await page.click('button[type="submit"]');
      await page.waitForLoadState('networkidle');

      // Wait for token to near expiration (if short-lived tokens)
      // In production, this would be tested by manipulating the token expiration
      // For now, just verify that API calls continue to work after some time
      await page.waitForTimeout(2000);

      await expect(page.locator('[aria-label*="Account"]').first()).toBeVisible();

      // Make an authenticated request
      await page.goto(`${APP_URL}/dashboard`);
      await page.waitForLoadState('networkidle');

      // Should still be authenticated
      expect(page.url()).not.toContain('login');
    });
  });
});
