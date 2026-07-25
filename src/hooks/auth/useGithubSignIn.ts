import { useEffect, useState } from 'react';
import { useMutation, type UseMutationResult } from '@tanstack/react-query';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { authService, githubSignInFailureMessage } from '../../services/authService';
import { AuthError } from '../../lib/auth-client';
import logger from '../../utils/logger';

/**
 * Signing in — and signing up — with GitHub, from the login and register pages.
 *
 * The two halves of one round trip: starting it, and reading what came back.
 */

/**
 * Send the member to GitHub (`POST /api/auth/sign-in/social`).
 *
 * There is no `onSuccess`, because success is leaving the page. The only thing
 * that can resolve here is the redirect never starting — in practice a server
 * with no GitHub OAuth app configured — which is why the mutation's error is
 * worth rendering rather than swallowing.
 *
 * `errorPath` is where GitHub sends the member back to when the round trip
 * fails, so it should be the page they pressed the button on.
 */
export const useSignInWithGithub = (errorPath?: string): UseMutationResult<void, AuthError, void> =>
  useMutation<void, AuthError, void>({
    mutationFn: () => authService.signInWithGithub(errorPath),
    // Never retry: the first attempt may already be navigating away.
    retry: 0,
    onError: (error) => {
      logger.warn('GitHub sign-in failed:', error.message);
    },
  });

/**
 * What a GitHub round trip that came back unhappy has to say, as a sentence.
 *
 * The notice is *seeded* from `?error=` on the first render rather than derived
 * from it, so it survives the parameter being stripped — and so a later attempt
 * can clear it for good. It is stripped because a reload, or a link somebody
 * shared, should not resurrect a failure from ten minutes ago; the same
 * reasoning (and the same shape) as GithubAccountCard's copy of this.
 *
 * @param path the route to rewrite the search params of — this page's own.
 */
export function useGithubSignInNotice(path: '/login' | '/register'): {
  notice: string | null;
  clear: () => void;
} {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { error?: string };
  const [notice, setNotice] = useState<string | null>(() =>
    githubSignInFailureMessage(search?.error)
  );

  useEffect(() => {
    if (!search?.error) return;
    void navigate({ to: path, search: {}, replace: true });
  }, [search?.error, navigate, path]);

  return { notice, clear: () => setNotice(null) };
}
