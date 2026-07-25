import React, { useState } from 'react';
import { Link as RouterLink } from '@tanstack/react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { CheckCircle2 } from 'lucide-react';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useRequestPasswordReset } from '../../hooks/auth';

// Mirrors the previous inline validation: email required + valid.
const forgotPasswordSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .regex(/\S+@\S+\.\S+/, 'Email is invalid'),
});

type ForgotPasswordSchema = z.infer<typeof forgotPasswordSchema>;

const ForgotPassword: React.FC = () => {
  const requestPasswordResetMutation = useRequestPasswordReset();

  const form = useForm<ForgotPasswordSchema>({
    resolver: zodResolver(forgotPasswordSchema),
    mode: 'onTouched',
    defaultValues: { email: '' },
  });

  // Better Auth answers the same way whether or not the address exists, and it
  // never hands the reset token to the browser — the link only arrives by email.
  const [requestSent, setRequestSent] = useState<boolean>(false);

  const handleSubmit = (values: ForgotPasswordSchema): void => {
    requestPasswordResetMutation.mutate(values.email, {
      onSuccess: () => setRequestSent(true),
    });
  };

  const getErrorMessage = (): string =>
    requestPasswordResetMutation.error?.message || 'Failed to send password reset email';

  if (requestSent) {
    return (
      <div className="px-4 py-12">
        <Card className="mx-auto w-full max-w-md">
          <CardHeader className="text-center">
            <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
              check your inbox
            </p>
            <CardTitle className="text-2xl">Check Your Email</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              role="alert"
              className="mb-4 flex items-start gap-3 rounded-md border border-primary/30 bg-primary/10 px-3 py-3 text-sm text-primary"
            >
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
              <span>
                If an account with that email exists, a password reset link has been sent to your
                email address. Please check your inbox and follow the instructions to reset your
                password.
              </span>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button asChild className="w-full">
                <RouterLink to="/login">Back to Login</RouterLink>
              </Button>
              <Button
                onClick={() => {
                  setRequestSent(false);
                  form.reset({ email: '' });
                }}
                variant="outline"
                className="w-full"
              >
                Send Another Email
              </Button>
            </div>
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
            reset your password
          </p>
          <CardTitle className="text-2xl">Forgot Password</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-center text-sm text-muted-foreground">
            Enter your email address and we&apos;ll send you a link to reset your password.
          </p>

          {requestPasswordResetMutation.error && (
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
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        autoComplete="email"
                        autoFocus
                        disabled={requestPasswordResetMutation.isPending}
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
                disabled={requestPasswordResetMutation.isPending}
              >
                {requestPasswordResetMutation.isPending ? 'Sending…' : 'Send Reset Link'}
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

export default ForgotPassword;
