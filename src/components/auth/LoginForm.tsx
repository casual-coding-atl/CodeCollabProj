import { type FC, useState } from 'react';
import { Link as RouterLink } from '@tanstack/react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Info, KeyRound, Loader2, X } from 'lucide-react';
import { AUTH_MIGRATION_NOTICE, migrationNoticeEnabled } from '@/lib/authNotice';
import GithubMark from '@/components/icons/GithubMark';
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

interface LoginFormProps {
  isLoading: boolean;
  error: Error | null;
  onSubmit: (data: LoginFormData) => void;
  /** Start the WebAuthn prompt. Omitted, the passkey affordance is hidden. */
  onPasskeySignIn?: () => void;
  isPasskeyPending?: boolean;
  /** Start the GitHub round trip. Always offered — every browser can do it. */
  onGithubSignIn: () => void;
  isGithubPending?: boolean;
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

/**
 * Read once, at module scope: `import.meta.env` is substituted at build time, so
 * this is a constant the server and the browser agree on. That matters — a
 * notice that appeared or vanished at hydration would push the passkey button
 * out from under a pointer mid-click, which is a bug this form has had once
 * already.
 */
const SHOW_MIGRATION_NOTICE = migrationNoticeEnabled(
  import.meta.env.VITE_AUTH_MIGRATION_NOTICE
);

const LoginForm: FC<LoginFormProps> = ({
  isLoading,
  error,
  onSubmit,
  onPasskeySignIn,
  isPasskeyPending = false,
  onGithubSignIn,
  isGithubPending = false,
}) => {
  const form = useForm<LoginSchema>({
    resolver: zodResolver(loginSchema),
    mode: 'onTouched',
    defaultValues: { email: '', password: '' },
  });

  const errorMessage = error ? error.message || 'Login failed' : '';

  // Dismissal lasts for this page view and isn't persisted. Reading a stored
  // "already dismissed" flag would mean the notice rendered and then vanished
  // after mount, moving everything below it — and during a cutover window that
  // lasts days, seeing it again on a fresh visit is the lesser annoyance.
  const [noticeDismissed, setNoticeDismissed] = useState(false);

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader className="text-center">
        <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
          welcome back
        </p>
        <CardTitle className="text-2xl">Sign in</CardTitle>
      </CardHeader>
      <CardContent>
        {SHOW_MIGRATION_NOTICE && !noticeDismissed && (
          <div
            // `status`, not `alert`: this is news, not a problem, and an `alert`
            // here would also collide with the sign-in failure below it.
            role="status"
            data-testid="auth-migration-notice"
            className="mb-4 flex items-start gap-3 rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-primary"
          >
            <Info className="mt-0.5 size-4 shrink-0" />
            <span className="flex-1">{AUTH_MIGRATION_NOTICE}</span>
            <button
              type="button"
              aria-label="Dismiss notice"
              data-testid="dismiss-auth-migration-notice"
              className="-mr-1 rounded p-0.5 opacity-70 transition-opacity hover:opacity-100"
              onClick={() => setNoticeDismissed(true)}
            >
              <X className="size-4" />
            </button>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {errorMessage}
          </div>
        )}

        {/* The two ways in that aren't a password sit above the email form, and
            not only because they're faster. Below it, these buttons move: the
            email field is autofocused, so the first click anywhere else blurs
            it, react-hook-form renders "Email is required", and everything
            underneath jumps down — far enough that the click that caused the
            jump lands above the button and does nothing. Nothing above the form
            can shift under the pointer.

            The row is two fixed columns for the same reason. Whether this
            browser can do WebAuthn is only known after mount (see Login.tsx), so
            the passkey button arrives late; giving it a column of its own from
            the first render means it appears in an empty slot instead of
            halving the width of the GitHub button somebody is already reaching
            for. On a browser without WebAuthn that slot simply stays empty. */}
        <div className="grid grid-cols-2 gap-3">
          {onPasskeySignIn ? (
            <Button
              type="button"
              variant="outline"
              size="lg"
              data-testid="passkey-signin"
              aria-label="Sign in with a passkey"
              disabled={isPasskeyPending}
              onClick={onPasskeySignIn}
            >
              {isPasskeyPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <KeyRound className="size-4" />
              )}
              Passkey
            </Button>
          ) : (
            <span aria-hidden />
          )}

          <Button
            type="button"
            variant="outline"
            size="lg"
            data-testid="github-signin"
            aria-label="Sign in with GitHub"
            disabled={isGithubPending}
            onClick={onGithubSignIn}
          >
            {isGithubPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <GithubMark className="size-4" />
            )}
            GitHub
          </Button>
        </div>

        <div className="my-5 flex items-center gap-3">
          <span className="h-px flex-1 bg-border" />
          <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            or continue with email
          </span>
          <span className="h-px flex-1 bg-border" />
        </div>

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
