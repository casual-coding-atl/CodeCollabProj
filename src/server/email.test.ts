import { describe, it, expect, vi } from 'vitest';
import {
  DEFAULT_EMAIL_API_BASE,
  dispatchResetPasswordEmail,
  emailApiBase,
  emailSenderConfig,
  resetPasswordEmail,
  sendEmail,
} from './email';

/**
 * The email module's decisions, at the seam auth.ts calls. Config resolution
 * and the reset template are pure; `sendEmail` is stubbed at its one outbound
 * edge — `fetch` — so no test talks to Resend.
 */

// ── configuration ────────────────────────────────────────────────────────────

describe('emailSenderConfig', () => {
  it('returns the key and sender when both are set', () => {
    expect(
      emailSenderConfig({ RESEND_API_KEY: 're_123', EMAIL_FROM: 'CodeCollabProj <noreply@codecollabproj.com>' })
    ).toEqual({ apiKey: 're_123', from: 'CodeCollabProj <noreply@codecollabproj.com>' });
  });

  it.each([
    ['no key', { EMAIL_FROM: 'a@b.c' }],
    ['no sender', { RESEND_API_KEY: 're_123' }],
    ['neither', {}],
    ['blank key', { RESEND_API_KEY: '   ', EMAIL_FROM: 'a@b.c' }],
    ['blank sender', { RESEND_API_KEY: 're_123', EMAIL_FROM: '' }],
  ])('is null with %s — the sender stays unconfigured', (_label, env) => {
    expect(emailSenderConfig(env)).toBeNull();
  });
});

describe('emailApiBase', () => {
  it('defaults to the real Resend API', () => {
    expect(emailApiBase({})).toBe(DEFAULT_EMAIL_API_BASE);
  });

  it('honours the EMAIL_API_BASE override and strips a trailing slash', () => {
    expect(emailApiBase({ EMAIL_API_BASE: 'http://127.0.0.1:4010/' })).toBe('http://127.0.0.1:4010');
  });

  it('strips repeated trailing slashes, not just one', () => {
    expect(emailApiBase({ EMAIL_API_BASE: 'http://127.0.0.1:4010///' })).toBe('http://127.0.0.1:4010');
  });
});

// ── reset template ───────────────────────────────────────────────────────────

describe('resetPasswordEmail', () => {
  const url = 'https://codecollabproj.com/api/auth/reset-password/tok123?callbackURL=/reset-password';

  it('puts the reset link in both bodies and names the app in the subject', () => {
    const mail = resetPasswordEmail({ url, username: 'alex' });
    expect(mail.subject).toContain('CodeCollabProj');
    expect(mail.html).toContain(url);
    expect(mail.text).toContain(url);
    expect(mail.text).toContain('alex');
  });

  it('HTML-escapes the username so a stored name cannot inject markup', () => {
    const mail = resetPasswordEmail({ url, username: '<img src=x onerror=alert(1)>' });
    expect(mail.html).not.toContain('<img');
    expect(mail.html).toContain('&lt;img');
  });

  it('greets generically when there is no username', () => {
    const mail = resetPasswordEmail({ url });
    expect(mail.text).toMatch(/^Hi,/);
  });

  it('escapes URL metacharacters in the HTML body but not the text body', () => {
    const trickyUrl = 'https://x.test/reset?a=1&b="quoted"';
    const mail = resetPasswordEmail({ url: trickyUrl });
    expect(mail.html).toContain('https://x.test/reset?a=1&amp;b=&quot;quoted&quot;');
    expect(mail.html).not.toContain('b="quoted"');
    expect(mail.text).toContain(trickyUrl);
  });
});

// ── the outbound edge ────────────────────────────────────────────────────────

const config = { apiKey: 're_test', from: 'CodeCollabProj <noreply@codecollabproj.com>' };
const message = { to: 'member@example.com', subject: 'Hello', html: '<p>Hi</p>', text: 'Hi' };

describe('sendEmail', () => {
  it('POSTs the message to Resend with the bearer key', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('{"id":"1"}', { status: 200 }));
    const result = await sendEmail(message, { config, fetchImpl });

    expect(result).toEqual({ ok: true });
    expect(fetchImpl).toHaveBeenCalledOnce();
    const [target, init] = fetchImpl.mock.calls[0];
    expect(target).toBe(`${DEFAULT_EMAIL_API_BASE}/emails`);
    expect(init.method).toBe('POST');
    expect(init.headers.authorization).toBe('Bearer re_test');
    expect(init.headers['content-type']).toBe('application/json');
    expect(JSON.parse(init.body)).toEqual({
      from: config.from,
      to: ['member@example.com'],
      subject: 'Hello',
      html: '<p>Hi</p>',
      text: 'Hi',
    });
  });

  it('reports a non-2xx answer as a failure instead of throwing', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('{"message":"bad key"}', { status: 401 }));
    const result = await sendEmail(message, { config, fetchImpl });
    expect(result).toEqual({ ok: false, reason: 'resend answered 401' });
  });

  it('reports a network error as a failure instead of throwing', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('fetch failed'));
    const result = await sendEmail(message, { config, fetchImpl });
    expect(result).toEqual({ ok: false, reason: 'fetch failed' });
  });

  it('treats an explicit null config as unconfigured — it must NOT fall back to env', async () => {
    const fetchImpl = vi.fn();
    const result = await sendEmail(message, { config: null, fetchImpl });
    expect(result).toEqual({ ok: false, reason: 'no email sender configured' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

// ── the request-password-reset delivery policy ───────────────────────────────

describe('dispatchResetPasswordEmail', () => {
  const member = { email: 'member@example.com', username: 'alex' };
  const url = 'https://codecollabproj.com/api/auth/reset-password/tok123?callbackURL=/reset-password';

  it('unconfigured outside production: logs the link for the developer', () => {
    const warn = vi.fn();
    dispatchResetPasswordEmail(member, url, { config: null, nodeEnv: 'development', warn });
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0][0]).toContain(url);
  });

  it('unconfigured in production: warns without ever logging the link', () => {
    const warn = vi.fn();
    dispatchResetPasswordEmail(member, url, { config: null, nodeEnv: 'production', warn });
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0][0]).not.toContain('tok123');
  });

  it('configured: returns before delivery resolves — the request must not wait on Resend', async () => {
    let resolveSend!: (r: { ok: true }) => void;
    const send = vi.fn().mockReturnValue(new Promise((r) => { resolveSend = r; }));
    const error = vi.fn();

    dispatchResetPasswordEmail(member, url, { config, send, error });

    // Returned synchronously while the send is still in flight.
    expect(send).toHaveBeenCalledOnce();
    const [sentMessage] = send.mock.calls[0];
    expect(sentMessage.to).toBe(member.email);
    expect(sentMessage.html).toContain(url);

    resolveSend({ ok: true });
    await vi.waitFor(() => expect(error).not.toHaveBeenCalled());
  });

  it('configured but delivery fails: the failure is logged, never thrown', async () => {
    const send = vi.fn().mockResolvedValue({ ok: false, reason: 'resend answered 401' });
    const error = vi.fn();

    dispatchResetPasswordEmail(member, url, { config, send, error });

    await vi.waitFor(() => expect(error).toHaveBeenCalledOnce());
    expect(error.mock.calls[0][0]).toContain('resend answered 401');
    expect(error.mock.calls[0][0]).not.toContain('tok123');
  });
});
