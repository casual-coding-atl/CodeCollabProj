import React, { useState, useEffect, ChangeEvent, FormEvent } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth, useRegister } from '../../hooks/auth';
import type { RegisterFormData } from '../../types/forms';

interface RegisterFormErrors {
  username?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
}

interface AxiosError {
  response?: {
    data?: {
      message?: string;
      errors?: { msg?: string; message?: string }[];
    };
  };
  message?: string;
}

interface RegisterResponse {
  token?: string;
  user?: {
    id: string;
    email: string;
    username: string;
  };
  message?: string;
}

const Register: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  // TanStack Query mutation
  const registerMutation = useRegister();

  const [formData, setFormData] = useState<RegisterFormData>({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const [formErrors, setFormErrors] = useState<RegisterFormErrors>({});
  const [registrationSuccess, setRegistrationSuccess] = useState<boolean>(false);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  const validateForm = (): boolean => {
    const errors: RegisterFormErrors = {};
    if (!formData.username) {
      errors.username = 'Username is required';
    } else if (formData.username.length < 3) {
      errors.username = 'Username must be at least 3 characters';
    }

    if (!formData.email) {
      errors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      errors.email = 'Email is invalid';
    }

    if (!formData.password) {
      errors.password = 'Password is required';
    } else if (
      // Match the server policy: 8+ chars with upper, lower, digit, and special.
      !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(formData.password)
    ) {
      errors.password =
        'Password must be at least 8 characters and include uppercase, lowercase, a number, and a special character';
    }

    if (!formData.confirmPassword) {
      errors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>): void => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (validateForm()) {
      const { confirmPassword: _, ...registerData } = formData;
      registerMutation.mutate(registerData, {
        onSuccess: (data: RegisterResponse) => {
          setRegistrationSuccess(true);
          // If auto-login in development mode, navigate to dashboard
          if (data.token && data.user) {
            navigate('/dashboard');
          }
        },
      });
    }
  };

  const getErrorMessage = (): string => {
    if (!registerMutation.error) return '';
    const axiosError = registerMutation.error as AxiosError;
    const data = axiosError?.response?.data;
    // Surface express-validator errors (returned as an `errors` array) so the user
    // sees why registration was rejected, not just a generic message.
    if (data?.errors?.length) {
      return data.errors
        .map((e) => e.msg || e.message)
        .filter(Boolean)
        .join(' ');
    }
    return data?.message || registerMutation.error.message || 'Registration failed';
  };

  if (registrationSuccess) {
    return (
      <div className="px-4 py-12">
        <Card className="mx-auto w-full max-w-md">
          <CardHeader className="text-center">
            <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
              welcome aboard
            </p>
            <CardTitle className="text-2xl">Registration Successful!</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              role="alert"
              className="mb-4 flex items-start gap-3 rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-primary"
            >
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
              <span>
                We&apos;ve sent a verification email to <strong>{formData.email}</strong>. Please
                check your inbox and click the verification link to activate your account.
              </span>
            </div>

            <p className="mb-4 text-sm text-muted-foreground">
              If you don&apos;t see the email, please check your spam folder. You can also request a
              new verification email from the login page.
            </p>

            <Button asChild className="w-full" size="lg">
              <RouterLink to="/login">Go to Login</RouterLink>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="px-4 py-12">
      <Card className="mx-auto w-full max-w-md">
        <CardHeader className="text-center">
          <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            create your account
          </p>
          <CardTitle className="text-2xl">Register</CardTitle>
        </CardHeader>
        <CardContent>
          {registerMutation.error && (
            <div
              role="alert"
              className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {getErrorMessage()}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                name="username"
                value={formData.username}
                onChange={handleChange}
                required
                aria-invalid={!!formErrors.username}
                className={cn(formErrors.username && 'border-destructive')}
              />
              {formErrors.username && (
                <p className="text-xs text-destructive">{formErrors.username}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                required
                aria-invalid={!!formErrors.email}
                className={cn(formErrors.email && 'border-destructive')}
              />
              {formErrors.email && <p className="text-xs text-destructive">{formErrors.email}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                value={formData.password}
                onChange={handleChange}
                required
                data-testid="password-input"
                aria-invalid={!!formErrors.password}
                className={cn(formErrors.password && 'border-destructive')}
              />
              {formErrors.password && (
                <p data-testid="password-error" className="text-xs text-destructive">
                  {formErrors.password}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
                aria-invalid={!!formErrors.confirmPassword}
                className={cn(formErrors.confirmPassword && 'border-destructive')}
              />
              {formErrors.confirmPassword && (
                <p className="text-xs text-destructive">{formErrors.confirmPassword}</p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={registerMutation.isPending}
            >
              {registerMutation.isPending ? 'Registering…' : 'Register'}
            </Button>
          </form>

          <p className="mt-5 text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <RouterLink
              to="/login"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Login here
            </RouterLink>
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Register;
