/**
 * What a "Sign in with GitHub" round trip that came back unhappy means, as a
 * sentence the member can act on.
 *
 * Better Auth does not fail a social sign-in with a *response* — the browser is
 * away at github.com when it goes wrong — it redirects to
 * `${errorCallbackURL}?error=<code>`. The codes below are the ones this app's
 * sign-in/up flow can actually produce, read straight out of Better Auth's
 * source (dist/api/routes/callback.mjs, dist/oauth2/state.mjs,
 * dist/oauth2/link-account.mjs) rather than guessed, so a code that better-auth
 * never emits (there is no `invalid_state`, for one) is not mapped and a real
 * one is not missed.
 *
 * Pure and framework-free, so it lives in `src/lib` next to the other pure auth
 * helpers (authNotice, passwordPolicy) with a unit test, per repo convention.
 */
export function githubSignInFailureMessage(code: string | undefined): string | null {
  if (!code) return null;
  switch (code) {
    // The member clicked "cancel" on GitHub's authorization screen. Not really
    // a failure — say so plainly rather than alarmingly.
    case 'access_denied':
      return 'GitHub sign-in was cancelled.';

    // `disableImplicitLinking` refused to merge a GitHub identity onto an
    // existing account found by email (link-account.mjs → "account not linked").
    // This is the deliberate anti-takeover path: the member has (or someone has)
    // a local account for this address, and merging GitHub onto it is only
    // allowed from Security, while already signed in.
    case 'account_not_linked':
      return (
        'An account already exists for the email on your GitHub profile. Sign in with your ' +
        'email and password, then connect GitHub from your security settings.'
      );

    // The GitHub identity is already attached to a *different* member.
    case 'account_already_linked_to_different_user':
      return 'That GitHub account is already connected to a different member.';

    // GitHub returned no usable email (no `user:email` grant, or no verified
    // address), so there is nothing to key an account on.
    case 'email_not_found':
      return (
        'GitHub did not share an email address, so no account could be created. Make sure your ' +
        'GitHub email is verified and that you granted email access.'
      );

    // The account could not be written. `unable_to_create_user` is better-auth's;
    // a duplicate-username race surfaces here too (the create fails after the
    // uniqueness pre-check). Retrying re-derives a fresh name, so it is worth
    // suggesting.
    case 'unable_to_create_user':
      return 'Your account could not be created from GitHub. Please try again.';

    // The link half of a round trip failed to write — rare on the sign-in flow,
    // but better-auth can emit it.
    case 'unable_to_link_account':
      return 'GitHub could not be connected. Please try again.';

    // The OAuth `state` did not survive the round trip: the cookie was missing
    // or expired (10-minute window), or the flow was finished in a different
    // browser/tab than it started in. state.mjs collapses several internal
    // conditions onto these three surfaced codes.
    case 'state_mismatch':
    case 'state_not_found':
    case 'state_invalid':
      return 'The GitHub sign-in expired or was started in another tab. Please try again.';

    // GitHub handed back a code we could not exchange, or its user endpoint did
    // not answer — transient on GitHub's side far more often than not.
    case 'invalid_code':
    case 'unable_to_get_user_info':
      return 'GitHub could not complete the sign-in. Please try again in a moment.';

    // The provider was not configured on the server that started the flow. The
    // button normally guards this before navigating (see authService), but a
    // stale tab or a server reconfigured mid-flow can still land here.
    case 'oauth_provider_not_found':
      return 'GitHub sign-in is not configured on this server.';

    // Our own session guard (src/server/auth.ts) refusing to mint a session,
    // surfaced through the same redirect as a Better Auth APIError code.
    case 'ACCOUNT_SUSPENDED':
    case 'ACCOUNT_DEACTIVATED':
      return 'This account cannot sign in. Please contact an administrator.';

    // Only reachable if a provider is reconfigured to refuse sign-ups.
    case 'signup_disabled':
      return 'This server does not create accounts from GitHub. Sign in with your email and password instead.';

    default:
      return 'GitHub could not sign you in. Please try again.';
  }
}
