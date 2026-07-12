import React, { useEffect } from 'react';
import { useNavigate, useSearchParams, Link as RouterLink } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Loader2 } from 'lucide-react';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { usePasswordResetTokenQuery, useResetPassword } from '../../hooks/auth';

interface AxiosError {
  response?: {
    data?: {
      message?: string;
    };
  };
  message?: string;
}

// Mirrors the previous inline validation: password required + min 6, confirm matches.
const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(1, 'Password is required')
      .min(6, 'Password must be at least 6 characters long'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => !data.confirmPassword || data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type ResetPasswordSchema = z.infer<typeof resetPasswordSchema>;

const ResetPassword: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const resetPasswordMutation = useResetPassword();

  const form = useForm<ResetPasswordSchema>({
    resolver: zodResolver(resetPasswordSchema),
    mode: 'onTouched',
    defaultValues: { password: '', confirmPassword: '' },
  });

  const [passwordResetSuccess, setPasswordResetSuccess] = React.useState<boolean>(false);

  // Token is available during render from the URL — derive it instead of
  // mirroring it into state via an effect.
  const token = searchParams.get('token') ?? '';

  // Query to verify the password reset token
  const {
    data: tokenValidationData,
    isLoading: isVerifyingToken,
    error: tokenError,
  } = usePasswordResetTokenQuery(token);

  // No token in URL — redirect to forgot password. Isolated in a tiny effect
  // gated on the derived value.
  useEffect(() => {
    if (!token) {
      navigate('/forgot-password');
    }
  }, [token, navigate]);

  const handleSubmit = (values: ResetPasswordSchema): void => {
    resetPasswordMutation.mutate(
      { token, password: values.password },
      {
        onSuccess: (data) => {
          console.log('Password reset successful:', data);
          setPasswordResetSuccess(true);
        },
        onError: (error) => {
          console.error('Password reset failed:', error);
        },
      }
    );
  };

  const getErrorMessage = (): string => {
    if (!resetPasswordMutation.error) return '';
    const axiosError = resetPasswordMutation.error as AxiosError;
    return (
      axiosError?.response?.data?.message ||
      resetPasswordMutation.error?.message ||
      'Failed to reset password'
    );
  };

  if (passwordResetSuccess) {
    return (
      <div className="px-4 py-12">
        <Card className="mx-auto w-full max-w-md">
          <CardHeader className="text-center">
            <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
              all set
            </p>
            <CardTitle className="text-2xl">Password Reset Successful</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              role="alert"
              className="mb-4 flex items-start gap-3 rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-primary"
            >
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
              <span>
                Your password has been reset successfully. You can now log in with your new
                password.
              </span>
            </div>

            <Button asChild className="w-full" size="lg">
              <RouterLink to="/login">Go to Login</RouterLink>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="px-4 py-12">
        <Card className="mx-auto w-full max-w-md">
          <CardHeader className="text-center">
            <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
              something went wrong
            </p>
            <CardTitle className="text-2xl">Invalid Reset Link</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              role="alert"
              className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              This password reset link is invalid. Please request a new password reset.
            </div>

            <Button asChild className="w-full" size="lg">
              <RouterLink to="/forgot-password">Request Password Reset</RouterLink>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isVerifyingToken) {
    return (
      <div className="px-4 py-12">
        <div className="flex flex-col items-center justify-center gap-3 text-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Verifying reset link...</p>
        </div>
      </div>
    );
  }

  if (tokenError || !tokenValidationData) {
    return (
      <div className="px-4 py-12">
        <Card className="mx-auto w-full max-w-md">
          <CardHeader className="text-center">
            <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
              something went wrong
            </p>
            <CardTitle className="text-2xl">Invalid or Expired Reset Link</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              role="alert"
              className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              This password reset link is invalid or has expired. Please request a new password
              reset.
            </div>

            <Button asChild className="w-full" size="lg">
              <RouterLink to="/forgot-password">Request New Reset Link</RouterLink>
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
            choose a new password
          </p>
          <CardTitle className="text-2xl">Reset Password</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-center text-sm text-muted-foreground">
            Enter your new password below.
          </p>

          {resetPasswordMutation.error && (
            <div
              role="alert"
              className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {getErrorMessage()}
            </div>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} noValidate className="space-y-4">
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New Password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        autoComplete="new-password"
                        autoFocus
                        disabled={resetPasswordMutation.isPending}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm New Password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        autoComplete="new-password"
                        disabled={resetPasswordMutation.isPending}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={resetPasswordMutation.isPending}
              >
                {resetPasswordMutation.isPending ? 'Resetting…' : 'Reset Password'}
              </Button>

              <p className="text-center text-sm">
                <RouterLink
                  to="/login"
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  Back to Login
                </RouterLink>
              </p>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ResetPassword;
