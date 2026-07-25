import { test, expect, type Page, type BrowserContext } from '@playwright/test';

/**
 * Auth E2E, against Better Auth (PRD #88 / ADR 0002).
 *
 * The members these tests sign in as were seeded in their PRE-migration shape
 * and migrated by the global setup, so "sign in with the existing password"
 * here really does exercise the legacy bcrypt hash through the migration — the
 * one user story the whole migration exists to keep true.
 */

const EMAIL = process.env.E2E_EMAIL || 'e2e@codecollab.test';
const PASSWORD = process.env.E2E_PASSWORD || 'e2e-password-123';
const EMAIL2 = process.env.E2E_EMAIL2 || 'e2e2@codecollab.test';
const PASSWORD2 = process.env.E2E_PASSWORD2 || 'e2e-password-123';
const USERNAME2 = process.env.E2E_USERNAME2 || 'e2e_user_two';
const EMAIL_SUSPENDED = process.env.E2E_EMAIL_SUSPENDED || 'e2e-suspended@codecollab.test';
const PASSWORD_SUSPENDED = process.env.E2E_PASSWORD_SUSPENDED || 'e2e-password-123';

/** Better Auth's session cookie — the only auth credential in the browser. */
const SESSION_COOKIE = 'better-auth.session_token';

/** Meets both Better Auth's 8-char minimum and the register form's strength rule. */
const NEW_PASSWORD = 'E2e-passw0rd!';

/** A throwaway member; the seed deletes anything matching `e2e-register-*`. */
function throwaway(tag: string): { email: string; username: string } {
  const id = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  return { email: `e2e-register-${tag}-${id}@codecollab.test`, username: `e2e_${tag}_${id}` };
}

/**
 * Load a page and wait until React owns the field we're about to type into.
 *
 * The markup arrives server-rendered, so a form is on screen and fillable well
 * before React attaches to it. Fill in that window and the value lands in the
 * DOM without react-hook-form ever seeing it: hydration then re-renders the
 * controlled input back to empty, and the submit that follows reports "Email is
 * required" for a form the test just filled in.
 *
 * The signal is React's own. Hydration tags every host node it takes over with
 * `__reactFiber$…` / `__reactProps$…` keys, so their presence on *this* element
 * means *this* element is live. Being a property of the page in front of us is
 * the whole point: an earlier version waited for the `GET
 * /api/auth/get-session` that `useAuth` fires from an effect, which a request
 * still in flight from the PREVIOUS page could satisfy — letting the test type
 * into a page that had not hydrated yet.
 */
async function gotoHydrated(page: Page, path: string, selector: string): Promise<void> {
  await page.goto(path);
  await page.waitForFunction(
    (sel) => {
      const el = document.querySelector(sel);
      return !!el && Object.keys(el).some((key) => key.startsWith('__react'));
    },
    selector,
    { timeout: 20_000 }
  );
}

async function signInThroughTheForm(page: Page, email: string, password: string): Promise<void> {
  await gotoHydrated(page, '/login', 'input[name="email"]');
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await Promise.all([
    page.waitForURL('**/dashboard', { timeout: 15_000 }),
    page.click('button[type="submit"]'),
  ]);
}

async function sessionCookie(context: BrowserContext): Promise<string | undefined> {
  const cookies = await context.cookies();
  return cookies.find((c) => c.name === SESSION_COOKIE)?.value;
}

/**
 * Register a member straight through the API, which shares the browser
 * context's cookie jar — so the page is signed in as a member no other test is
 * touching. Sign-up starts a session (autoSignIn).
 */
async function signUpInThisBrowser(page: Page): Promise<{ email: string; username: string }> {
  const who = throwaway('api');
  const res = await page.request.post('/api/auth/sign-up/email', {
    data: {
      email: who.email,
      password: NEW_PASSWORD,
      name: who.username,
      username: who.username,
    },
  });
  expect(res.ok(), `sign-up failed: ${res.status()} ${await res.text()}`).toBeTruthy();
  return who;
}

test.describe('sign in', () => {
  test('a member signs in with the password they had before the migration', async ({
    page,
    context,
  }) => {
    await signInThroughTheForm(page, EMAIL, PASSWORD);

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole('link', { name: /^login$/i })).toHaveCount(0);
    expect(await sessionCookie(context)).toBeTruthy();
  });

  test('a wrong password is refused, with a message and no session', async ({ page, context }) => {
    await gotoHydrated(page, '/login', 'input[name="email"]');
    await page.fill('input[name="email"]', EMAIL);
    await page.fill('input[name="password"]', 'definitely-not-the-password');
    await page.click('button[type="submit"]');

    // The member is told what went wrong, in Better Auth's words — asserting on
    // "some alert appeared" would pass just as happily on a 500.
    await expect(page.getByRole('alert')).toHaveText(/invalid email or password/i, {
      timeout: 10_000,
    });
    await expect(page).toHaveURL(/\/login/);
    expect(await sessionCookie(context)).toBeFalsy();
  });

  test('a suspended member is refused, with the right password', async ({ page, context }) => {
    // The seeded suspended member is migrated like everyone else, so their
    // password is genuinely correct — the only thing standing between them and
    // a session is the app's own suspension rule, enforced when Better Auth
    // tries to mint one. Moderation surviving the migration is a user story in
    // its own right (PRD #88, story 13).
    await gotoHydrated(page, '/login', 'input[name="email"]');
    await page.fill('input[name="email"]', EMAIL_SUSPENDED);
    await page.fill('input[name="password"]', PASSWORD_SUSPENDED);
    await page.click('button[type="submit"]');

    await expect(page.getByRole('alert')).toHaveText(/suspended/i, { timeout: 10_000 });
    await expect(page).toHaveURL(/\/login/);
    expect(await sessionCookie(context)).toBeFalsy();

    // And no back door: a guarded page still turns them away.
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });

  test('explains the one-time sign-out during the cutover, and lets it be dismissed', async ({
    page,
  }) => {
    // Built with VITE_AUTH_MIGRATION_NOTICE=1 (see playwright.config), which is
    // what an operator sets for the cutover release and unsets afterwards. A
    // build without it has no notice in it at all.
    await gotoHydrated(page, '/login', 'input[name="email"]');

    const notice = page.getByTestId('auth-migration-notice');
    await expect(notice).toBeVisible();
    await expect(notice).toContainText(/signed out/i);
    await expect(notice).toContainText(/password still works/i);

    await page.getByTestId('dismiss-auth-migration-notice').click();
    await expect(notice).toHaveCount(0);
  });

  test('the login page offers passkey sign-in', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByTestId('passkey-signin')).toBeVisible();
  });
});

test.describe('sign out', () => {
  test('ends the session and locks the guarded pages again', async ({ page, context }) => {
    await signInThroughTheForm(page, EMAIL, PASSWORD);

    await page.getByRole('button', { name: /account menu/i }).click();
    await Promise.all([
      page.waitForURL('**/login', { timeout: 15_000 }),
      page.getByTestId('logout-button').click(),
    ]);

    expect(await sessionCookie(context)).toBeFalsy();

    // A guarded page now bounces back to the login screen.
    await page.goto('/security');
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });

  test('leaves nothing of the departing member for the next one', async ({ page }) => {
    // The first member's inbox holds a seeded message. Read it, so it is
    // definitely in the query cache.
    await signInThroughTheForm(page, EMAIL, PASSWORD);
    await page.goto('/messages');
    await expect(page.getByText('E2E seeded message').first()).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: /account menu/i }).click();
    await Promise.all([
      page.waitForURL('**/login', { timeout: 15_000 }),
      page.getByTestId('logout-button').click(),
    ]);

    // Sign in as somebody else in the same tab. Their inbox is empty, and the
    // previous member's message must not be served to them out of a cache that
    // outlived the sign-out — which is exactly what happened while logout only
    // cleared the auth, projects and users query families.
    await signInThroughTheForm(page, EMAIL2, PASSWORD2);

    // Pin down who we are before asserting what we cannot see: "the message is
    // absent" would be just as true of a page that failed to load, or of still
    // being the first member on a screen that hadn't finished rendering.
    await expect(
      page.getByRole('button', { name: new RegExp(`account menu for ${USERNAME2}`, 'i') })
    ).toBeVisible({ timeout: 15_000 });

    await page.goto('/messages');
    await expect(page.getByRole('heading', { name: /messages/i }).first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText('E2E seeded message')).toHaveCount(0);
  });
});

test.describe('register', () => {
  test('a new member signs up and lands on their dashboard', async ({ page, context }) => {
    const who = throwaway('form');

    await gotoHydrated(page, '/register', 'input[name="username"]');

    await page.fill('input[name="username"]', who.username);
    await page.fill('input[name="email"]', who.email);
    await page.fill('input[name="password"]', NEW_PASSWORD);
    await page.fill('input[name="confirmPassword"]', NEW_PASSWORD);

    await Promise.all([
      page.waitForURL('**/dashboard', { timeout: 20_000 }),
      page.click('button[type="submit"]'),
    ]);

    expect(await sessionCookie(context)).toBeTruthy();
  });
});

test.describe('security page', () => {
  test('lists this device and revokes the others', async ({ page, playwright, baseURL }) => {
    const who = await signUpInThisBrowser(page);

    // Two more sessions for the same member, from other "devices".
    for (let i = 0; i < 2; i++) {
      const other = await playwright.request.newContext({ baseURL });
      const res = await other.post('/api/auth/sign-in/email', {
        data: { email: who.email, password: NEW_PASSWORD },
      });
      expect(res.ok()).toBeTruthy();
      await other.dispose();
    }

    await page.goto('/security');
    const rows = page.getByTestId('session-row');
    await expect(rows).toHaveCount(3, { timeout: 15_000 });
    // Exactly one row is this browser, and it has no revoke button.
    await expect(page.getByTestId('current-session')).toHaveCount(1);
    await expect(page.getByTestId('revoke-session')).toHaveCount(2);

    // Revoke one other device.
    await page.getByTestId('revoke-session').first().click();
    await expect(rows).toHaveCount(2, { timeout: 15_000 });

    // Then sign out of everything else at once.
    await page.getByTestId('revoke-other-sessions').click();
    await expect(rows).toHaveCount(1, { timeout: 15_000 });
    await expect(page.getByTestId('current-session')).toHaveCount(1);

    // This browser is still signed in — revoking others never revokes you.
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('changing the password keeps this device and works on next sign-in', async ({
    page,
    context,
  }) => {
    const who = await signUpInThisBrowser(page);
    const changed = `${NEW_PASSWORD}-2`;

    await page.goto('/security');
    const form = page.getByTestId('change-password');
    await expect(form).toBeVisible({ timeout: 15_000 });

    await form.locator('input[name="currentPassword"]').fill(NEW_PASSWORD);
    await form.locator('input[name="newPassword"]').fill(changed);
    await form.locator('input[name="confirmPassword"]').fill(changed);
    await form.getByRole('button', { name: /change password/i }).click();

    await expect(page.getByText(/other devices have been signed out/i)).toBeVisible({
      timeout: 15_000,
    });

    // Still signed in here…
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/dashboard/);

    // …and the new password is the one that works.
    await context.clearCookies();
    await signInThroughTheForm(page, who.email, changed);
    await expect(page).toHaveURL(/\/dashboard/);
  });
});

test.describe('passkeys', () => {
  test('a member registers a passkey and then signs in with it', async ({ page, context }) => {
    // A virtual authenticator stands in for Touch ID / a security key, so the
    // WebAuthn prompt resolves without a human.
    const cdp = await context.newCDPSession(page);
    await cdp.send('WebAuthn.enable');
    await cdp.send('WebAuthn.addVirtualAuthenticator', {
      options: {
        protocol: 'ctap2',
        transport: 'internal',
        hasResidentKey: true,
        hasUserVerification: true,
        isUserVerified: true,
        automaticPresenceSimulation: true,
      },
    });

    await signUpInThisBrowser(page);

    await page.goto('/security');
    await expect(page.getByTestId('passkey-manager')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('passkey-row')).toHaveCount(0);

    await page.getByTestId('passkey-name').fill('E2E authenticator');
    await page.getByTestId('add-passkey').click();

    await expect(page.getByTestId('passkey-row')).toHaveCount(1, { timeout: 20_000 });
    await expect(page.getByText('E2E authenticator')).toBeVisible();

    // Sign out, then back in with nothing but the passkey.
    await page.getByRole('button', { name: /account menu/i }).click();
    await Promise.all([
      page.waitForURL('**/login', { timeout: 15_000 }),
      page.getByTestId('logout-button').click(),
    ]);

    // The passkey button is rendered only after the WebAuthn-support effect has
    // run, so waiting for it to appear *is* waiting for the page to be
    // interactive — no sleep required.
    const passkeyButton = page.getByTestId('passkey-signin');
    await expect(passkeyButton).toBeVisible({ timeout: 15_000 });
    await Promise.all([
      page.waitForURL('**/dashboard', { timeout: 20_000 }),
      passkeyButton.click(),
    ]);
    expect(await sessionCookie(context)).toBeTruthy();

    // And it can be removed again.
    await page.goto('/security');
    await page.getByTestId('delete-passkey').first().click();
    await page.getByRole('button', { name: /^remove$/i }).click();
    await expect(page.getByTestId('passkey-row')).toHaveCount(0, { timeout: 15_000 });
  });
});
