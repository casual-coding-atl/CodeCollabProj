import React, { useState, useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import {
  useAuth,
  useGithubSignInNotice,
  useLogin,
  useLoginWithPasskey,
  useSignInWithGithub,
} from '../../hooks/auth';
import { AuthError, isPasskeyCancellation, supportsPasskeys } from '@/lib/auth-client';
import LoginForm from './LoginForm';
import VerificationAlert from './VerificationAlert';
import type { LoginFormData } from '../../types/forms';

/**
 * Login Component
 * Main login page that handles authentication flow
 */
const Login: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  // TanStack Query mutations
  const loginMutation = useLogin();
  const passkeyMutation = useLoginWithPasskey();
  // A GitHub round trip that fails comes back here, so this is where its
  // failures are reported too.
  const githubMutation = useSignInWithGithub('/login');
  const github = useGithubSignInNotice('/login');

  const [submittedEmail, setSubmittedEmail] = useState<string>('');
  const [needsVerification, setNeedsVerification] = useState<boolean>(false);

  // Decided after mount — see PasskeyManager. A browser without WebAuthn is
  // offered the password form and nothing it can't do.
  const [canUsePasskeys, setCanUsePasskeys] = useState(false);
  useEffect(() => setCanUsePasskeys(supportsPasskeys()), []);

  useEffect(() => {
    if (isAuthenticated) {
      navigate({ to: '/dashboard' });
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = (formData: LoginFormData): void => {
    setSubmittedEmail(formData.email);
    loginMutation.mutate(formData, {
      onSuccess: () => {
        navigate({ to: '/dashboard' });
      },
      onError: (error) => {
        // Better Auth names this failure rather than describing it.
        if (error.code === 'EMAIL_NOT_VERIFIED') {
          setNeedsVerification(true);
        }
      },
    });
  };

  const handlePasskey = (): void => {
    passkeyMutation.mutate(undefined, {
      onSuccess: () => navigate({ to: '/dashboard' }),
    });
  };

  const handleGithub = (): void => {
    // Clear the last round trip's verdict first: they are trying again, and
    // being told why the previous attempt failed while this one is in flight
    // reads as though it had already failed too.
    github.clear();
    githubMutation.mutate();
  };

  if (needsVerification) {
    return (
      <div className="px-4 py-12">
        <VerificationAlert email={submittedEmail} onBack={() => setNeedsVerification(false)} />
      </div>
    );
  }

  // A cancelled WebAuthn prompt isn't an error to report back to the member —
  // they closed it themselves and can see the form is still there.
  const passkeyError = isPasskeyCancellation(passkeyMutation.error)
    ? null
    : passkeyMutation.error;

  // One error area, three ways to fail into it. The GitHub round trip's verdict
  // is a message rather than a thrown failure, so it is wrapped to match.
  const githubError =
    githubMutation.error ?? (github.notice ? new AuthError(github.notice, 400) : null);

  return (
    <div className="px-4 py-12">
      <LoginForm
        isLoading={loginMutation.isPending}
        error={loginMutation.error ?? passkeyError ?? githubError}
        onSubmit={handleSubmit}
        onPasskeySignIn={canUsePasskeys ? handlePasskey : undefined}
        isPasskeyPending={passkeyMutation.isPending}
        onGithubSignIn={handleGithub}
        isGithubPending={githubMutation.isPending}
      />
    </div>
  );
};

export default Login;
