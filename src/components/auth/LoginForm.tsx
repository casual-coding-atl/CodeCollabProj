import { type FC } from 'react';
import { Link as RouterLink } from '@tanstack/react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import type { LoginFormData } from '../../types/forms';

interface AxiosError {
  response?: { data?: { message?: string } };
  message?: string;
}

interface LoginFormProps {
  isLoading: boolean;
  error: AxiosError | Error | null;
  onSubmit: (data: LoginFormData) => void;
}

// Mirrors the previous inline validation: email required + valid, password required.
const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .regex(/\S+@\S+\.\S+/, 'Email is invalid'),
  password: z.string().min(1, 'Password is required'),
});

type LoginSchema = z.infer<typeof loginSchema>;

const LoginForm: FC<LoginFormProps> = ({ isLoading, error, onSubmit }) => {
  const form = useForm<LoginSchema>({
    resolver: zodResolver(loginSchema),
    mode: 'onTouched',
    defaultValues: { email: '', password: '' },
  });

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

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      autoComplete="email"
                      autoFocus
                      aria-label="Email address"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel>Password</FormLabel>
                    <RouterLink
                      to="/forgot-password"
                      className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                      aria-label="Forgot password"
                    >
                      Forgot password?
                    </RouterLink>
                  </div>
                  <FormControl>
                    <Input
                      type="password"
                      autoComplete="current-password"
                      aria-label="Password"
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
              disabled={isLoading}
              aria-label="Submit login form"
            >
              {isLoading ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </Form>

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
