import React, { useState, useEffect, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, useLogin } from '../../hooks/auth';
import LoginForm from './LoginForm';
import VerificationAlert from './VerificationAlert';
import type { LoginFormData } from '../../types/forms';

interface LoginFormErrors {
  email?: string;
  password?: string;
}

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

  const [formData, setFormData] = useState<LoginFormData>({
    email: '',
    password: '',
  });

  const [formErrors, setFormErrors] = useState<LoginFormErrors>({});
  const [needsVerification, setNeedsVerification] = useState<boolean>(false);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  const validateForm = (): boolean => {
    const errors: LoginFormErrors = {};
    if (!formData.email) {
      errors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      errors.email = 'Email is invalid';
    }
    if (!formData.password) {
      errors.password = 'Password is required';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (validateForm()) {
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
    }
  };

  if (needsVerification) {
    return (
      <div className="px-4 py-12">
        <VerificationAlert email={formData.email} onBack={() => setNeedsVerification(false)} />
      </div>
    );
  }

  return (
    <div className="px-4 py-12">
      <LoginForm
        formData={formData}
        formErrors={formErrors}
        isLoading={loginMutation.isPending}
        error={loginMutation.error}
        onChange={setFormData}
        onSubmit={handleSubmit}
      />
    </div>
  );
};

export default Login;
