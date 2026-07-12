import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, useLogin } from '../../hooks/auth';
import LoginForm from './LoginForm';
import VerificationAlert from './VerificationAlert';
import type { LoginFormData } from '../../types/forms';

interface AxiosError {
  response?: {
    data?: {
      needsVerification?: boolean;
      message?: string;
    };
  };
  message?: string;
}

/**
 * Login Component
 * Main login page that handles authentication flow
 */
const Login: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  // TanStack Query mutations
  const loginMutation = useLogin();

  const [submittedEmail, setSubmittedEmail] = useState<string>('');
  const [needsVerification, setNeedsVerification] = useState<boolean>(false);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = (formData: LoginFormData): void => {
    setSubmittedEmail(formData.email);
    loginMutation.mutate(formData, {
      onSuccess: () => {
        navigate('/dashboard');
      },
      onError: (error) => {
        // Check if the error is due to unverified email
        const axiosError = error as AxiosError;
        if (axiosError?.response?.data?.needsVerification) {
          setNeedsVerification(true);
        }
      },
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
        error={loginMutation.error}
        onSubmit={handleSubmit}
      />
    </div>
  );
};

export default Login;
