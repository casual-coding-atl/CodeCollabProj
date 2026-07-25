import React, { useState, useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useAuth, useLogin, useLoginWithPasskey } from '../../hooks/auth';
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

  const [submittedEmail, setSubmittedEmail] = useState<string>('');
  const [needsVerification, setNeedsVerification] = useState<boolean>(false);

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

  if (needsVerification) {
    return (
      <div className="px-4 py-12">
        <VerificationAlert email={submittedEmail} onBack={() => setNeedsVerification(false)} />
      </div>
    );
  }

  return (
    <div className="px-4 py-12">
      <LoginForm
        isLoading={loginMutation.isPending}
        error={loginMutation.error ?? passkeyMutation.error}
        onSubmit={handleSubmit}
        onPasskeySignIn={handlePasskey}
        isPasskeyPending={passkeyMutation.isPending}
      />
    </div>
  );
};

export default Login;
