import { describe, it, expect } from 'vitest';
import { githubSignInFailureMessage } from './githubSignIn';

describe('githubSignInFailureMessage', () => {
  it('is null when there is no error code (the ordinary, happy load)', () => {
    expect(githubSignInFailureMessage(undefined)).toBeNull();
    expect(githubSignInFailureMessage('')).toBeNull();
  });

  it('names the anti-takeover case specifically, and points at Security', () => {
    // This is the message a member sees when their email already has a local
    // account and `disableImplicitLinking` refused to merge GitHub onto it.
    const msg = githubSignInFailureMessage('account_not_linked');
    expect(msg).toMatch(/already exists/i);
    expect(msg).toMatch(/security settings/i);
  });

  it('treats a cancelled authorization as the non-event it is', () => {
    expect(githubSignInFailureMessage('access_denied')).toMatch(/cancelled/i);
  });

  it('collapses the three real state codes onto one retry sentence', () => {
    for (const code of ['state_mismatch', 'state_not_found', 'state_invalid']) {
      expect(githubSignInFailureMessage(code)).toMatch(/expired or was started in another tab/i);
    }
  });

  it('surfaces our own session-mint refusal', () => {
    expect(githubSignInFailureMessage('ACCOUNT_SUSPENDED')).toMatch(/cannot sign in/i);
    expect(githubSignInFailureMessage('ACCOUNT_DEACTIVATED')).toMatch(/cannot sign in/i);
  });

  it('has a sentence for every code better-auth can actually redirect with', () => {
    // Read out of dist: callback.mjs, state.mjs, link-account.mjs. If better-auth
    // adds one, this list is where to notice. Each maps to a real, non-default
    // sentence — none should fall through to the generic catch-all.
    const real = [
      'access_denied',
      'account_not_linked',
      'account_already_linked_to_different_user',
      'email_not_found',
      'unable_to_create_user',
      'unable_to_link_account',
      'state_mismatch',
      'state_not_found',
      'state_invalid',
      'invalid_code',
      'unable_to_get_user_info',
      'oauth_provider_not_found',
      'ACCOUNT_SUSPENDED',
      'ACCOUNT_DEACTIVATED',
      'signup_disabled',
    ];
    const generic = githubSignInFailureMessage('some_code_we_do_not_map');
    for (const code of real) {
      const msg = githubSignInFailureMessage(code);
      expect(msg, `${code} should have a specific message`).toBeTruthy();
      expect(msg, `${code} fell through to the generic message`).not.toBe(generic);
    }
  });

  it('still says something useful for an unknown code', () => {
    expect(githubSignInFailureMessage('brand_new_code')).toMatch(/could not sign you in/i);
  });
});
