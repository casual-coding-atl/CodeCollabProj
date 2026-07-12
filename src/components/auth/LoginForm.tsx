import { type ChangeEvent, type FC, type FormEvent } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { LoginFormData } from '../../types/forms';

interface LoginFormErrors {
  email?: string;
  password?: string;
}
interface AxiosError {
  response?: { data?: { message?: string } };
  message?: string;
}
interface LoginFormProps {
  formData: LoginFormData;
  formErrors: LoginFormErrors;
  isLoading: boolean;
  error: AxiosError | Error | null;
  onChange: (data: LoginFormData) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
}

const LoginForm: FC<LoginFormProps> = ({
  formData,
  formErrors,
  isLoading,
  error,
  onChange,
  onSubmit,
}) => {
  const handleChange = (e: ChangeEvent<HTMLInputElement>): void => {
    onChange({ ...formData, [e.target.name]: e.target.value });
  };

  const errorMessage = error
    ? (error as AxiosError)?.response?.data?.message || error.message || 'Login failed'
    : '';

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader className="text-center">
        <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
          welcome back
        </p>
        <CardTitle className="text-2xl">Sign in</CardTitle>
      </CardHeader>
      <CardContent>
        {error && (
          <div
            role="alert"
            className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {errorMessage}
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              required
              autoComplete="email"
              autoFocus
              aria-label="Email address"
              aria-invalid={!!formErrors.email}
              className={cn(formErrors.email && 'border-destructive')}
            />
            {formErrors.email && <p className="text-xs text-destructive">{formErrors.email}</p>}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <RouterLink
                to="/forgot-password"
                className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                aria-label="Forgot password"
              >
                Forgot password?
              </RouterLink>
            </div>
            <Input
              id="password"
              name="password"
              type="password"
              value={formData.password}
              onChange={handleChange}
              required
              autoComplete="current-password"
              aria-label="Password"
              aria-invalid={!!formErrors.password}
              className={cn(formErrors.password && 'border-destructive')}
            />
            {formErrors.password && (
              <p className="text-xs text-destructive">{formErrors.password}</p>
            )}
          </div>

          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={isLoading}
            aria-label="Submit login form"
          >
            {isLoading ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{' '}
          <RouterLink
            to="/register"
            className="font-medium text-primary underline-offset-4 hover:underline"
            aria-label="Register new account"
          >
            Join the group
          </RouterLink>
        </p>
      </CardContent>
    </Card>
  );
};

export default LoginForm;
