import 'dotenv/config';

/**
 * Outbound email (issue #90). Modeled on ./github.ts: the decisions
 * (is a sender configured, what does the reset email say) are pure and tested
 * directly, and `sendEmail` is the single outbound edge — a plain HTTP POST to
 * Resend, no SDK — so tests substitute one `fetch` and nothing here ever
 * talks to the real service.
 *
 * The sender is env-gated the same way the GitHub OAuth provider is: it exists
 * only when both `RESEND_API_KEY` and `EMAIL_FROM` are set, and every caller
 * must decide what "unconfigured" means for its flow (auth.ts keeps the old
 * log-the-link-in-dev behaviour).
 */

export interface EmailSenderConfig {
  apiKey: string;
  from: string;
}

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export type SendEmailResult = { ok: true } | { ok: false; reason: string };

export const DEFAULT_EMAIL_API_BASE = 'https://api.resend.com';

const SEND_TIMEOUT_MS = 10_000;

/** `EMAIL_API_BASE` exists for tests and fixtures, like `GITHUB_API_BASE`. */
export function emailApiBase(env: { EMAIL_API_BASE?: string } = process.env): string {
  const base = env.EMAIL_API_BASE?.trim().replace(/\/+$/, '');
  return base || DEFAULT_EMAIL_API_BASE;
}

/** Null unless both vars are set — an unconfigured sender, not an error. */
export function emailSenderConfig(
  env: { RESEND_API_KEY?: string; EMAIL_FROM?: string } = process.env
): EmailSenderConfig | null {
  const apiKey = env.RESEND_API_KEY?.trim();
  const from = env.EMAIL_FROM?.trim();
  if (!apiKey || !from) return null;
  return { apiKey, from };
}

/** Usernames are member-typed; they must never reach an HTML body unescaped. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * The password-reset email. `url` is Better Auth's verification URL — it
 * validates the token server-side and forwards to /reset-password, and it is
 * only ever built by our own server, but it goes through `escapeHtml` anyway
 * so this template has no unescaped interpolation at all.
 */
export function resetPasswordEmail(opts: { url: string; username?: string }): {
  subject: string;
  html: string;
  text: string;
} {
  const greeting = opts.username ? `Hi ${opts.username},` : 'Hi,';
  const safeGreeting = escapeHtml(greeting);
  const safeUrl = escapeHtml(opts.url);

  const subject = 'Reset your CodeCollabProj password';

  const text = [
    greeting,
    '',
    'Someone asked to reset the password for your CodeCollabProj account.',
    'If that was you, open this link to choose a new password:',
    '',
    opts.url,
    '',
    'The link expires in one hour. If you did not ask for this, ignore this',
    'email — your password is unchanged.',
  ].join('\n');

  const html = `
    <div style="font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #1a1a1a;">
      <p style="font-size: 12px; letter-spacing: 2px; text-transform: uppercase; color: #888; margin: 0 0 4px;">CodeCollabProj</p>
      <h1 style="font-size: 20px; margin: 0 0 16px;">Reset your password</h1>
      <p>${safeGreeting}</p>
      <p>Someone asked to reset the password for your CodeCollabProj account. If that was you, choose a new password here:</p>
      <p style="margin: 24px 0;">
        <a href="${safeUrl}" style="background: #2563eb; color: #fff; text-decoration: none; padding: 10px 18px; border-radius: 6px; display: inline-block;">Reset password</a>
      </p>
      <p style="font-size: 13px; color: #555;">Or paste this link into your browser:<br />
        <a href="${safeUrl}" style="color: #2563eb; word-break: break-all;">${safeUrl}</a>
      </p>
      <p style="font-size: 13px; color: #555;">The link expires in one hour. If you did not ask for this, ignore this email — your password is unchanged.</p>
    </div>`;

  return { subject, html, text };
}

/**
 * Deliver one message via Resend. Never throws: callers on the auth path must
 * not turn a provider outage into a response-shape difference (a 500 on
 * request-password-reset only for addresses that *exist* would re-open the
 * user-enumeration hole the non-enumerating answer closes). The failure is
 * reported in the result for the caller to log.
 */
export async function sendEmail(
  message: EmailMessage,
  opts: { config?: EmailSenderConfig | null; fetchImpl?: typeof fetch } = {}
): Promise<SendEmailResult> {
  // `undefined` means "look at the env"; an explicit `null` means the caller
  // already decided the sender is unconfigured and must stay that way — `??`
  // here would silently un-make that decision and send real mail.
  const config = opts.config === undefined ? emailSenderConfig() : opts.config;
  if (!config) return { ok: false, reason: 'no email sender configured' };
  const fetchImpl = opts.fetchImpl ?? fetch;

  try {
    const response = await fetchImpl(`${emailApiBase()}/emails`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${config.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from: config.from,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });
    if (!response.ok) return { ok: false, reason: `resend answered ${response.status}` };
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Everything Better Auth's `sendResetPassword` hook does, as a tested seam
 * (auth.ts stays one delegating line). Two properties here are load-bearing:
 *
 *  - **It never awaits delivery.** Better Auth awaits the hook inside
 *    POST /request-password-reset (`runInBackgroundOrAwait` awaits unless a
 *    background-task handler is configured), and the hook only runs for
 *    addresses that exist — so time spent talking to Resend (up to the 10s
 *    timeout) would be a timing oracle over the non-enumerating answer. The
 *    send is fired and forgotten; this server is a long-lived Node process and
 *    `sendEmail` never rejects, so the promise cannot be lost or go unhandled.
 *  - **Unconfigured behaviour depends on NODE_ENV.** Outside production the
 *    link is logged so development stays usable; in production it never is —
 *    a live reset token must not sit in the log drain.
 */
export function dispatchResetPasswordEmail(
  member: { email: string; username?: string },
  url: string,
  deps: {
    config?: EmailSenderConfig | null;
    nodeEnv?: string;
    send?: typeof sendEmail;
    warn?: (message: string) => void;
    error?: (message: string) => void;
  } = {}
): void {
  const config = deps.config === undefined ? emailSenderConfig() : deps.config;
  const warn = deps.warn ?? console.warn;

  if (!config) {
    const nodeEnv = deps.nodeEnv ?? process.env.NODE_ENV;
    if (nodeEnv === 'production') {
      warn(
        `[auth] password reset requested for ${member.email} but no email sender is configured — the member will never receive it.`
      );
    } else {
      warn(`[auth] password reset for ${member.email} (no email sender wired): ${url}`);
    }
    return;
  }

  const send = deps.send ?? sendEmail;
  const error = deps.error ?? console.error;
  void send(
    { to: member.email, ...resetPasswordEmail({ url, username: member.username }) },
    { config }
  ).then((result) => {
    if (!result.ok) {
      error(`[auth] password reset email to ${member.email} failed: ${result.reason}`);
    }
  });
}
