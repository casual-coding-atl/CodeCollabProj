import React, { useEffect } from 'react';
import { useNavigate, Link as RouterLink } from '@tanstack/react-router';
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
import { Loader2 } from 'lucide-react';
import {
  useAuth,
  useGithubSignInNotice,
  useRegister,
  useSignInWithGithub,
} from '../../hooks/auth';
import GithubMark from '@/components/icons/GithubMark';
import { passwordSchema } from '@/lib/passwordPolicy';

const registerSchema = z
  .object({
    username: z
      .string()
      .min(1, 'Username is required')
      .min(3, 'Username must be at least 3 characters'),
    email: z
      .string()
      .min(1, 'Email is required')
      .regex(/\S+@\S+\.\S+/, 'Email is invalid'),
    password: passwordSchema(),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => !data.confirmPassword || data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type RegisterSchema = z.infer<typeof registerSchema>;

const Register: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  // TanStack Query mutation
  const registerMutation = useRegister();

  // Joining with GitHub is the same endpoint as signing in with it: an identity
  // GitHub vouches for and this app has never seen becomes a member (the
  // username is derived from their GitHub login — see src/server/auth.ts). A
  // failed round trip comes back here, which is why the error path is this page.
  const githubMutation = useSignInWithGithub('/register');
  const github = useGithubSignInNotice('/register');

  const form = useForm<RegisterSchema>({
    resolver: zodResolver(registerSchema),
    mode: 'onTouched',
    defaultValues: {
      username: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  useEffect(() => {
    if (isAuthenticated) {
      navigate({ to: '/dashboard' });
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = (values: RegisterSchema): void => {
    const { confirmPassword: _confirmPassword, ...registerData } = values;
    // Sign-up starts a session (Better Auth's autoSignIn), so a new member lands
    // on their dashboard rather than on a "check your email" dead end.
    registerMutation.mutate(registerData, {
      onSuccess: () => navigate({ to: '/dashboard' }),
    });
  };

  const handleGithub = (): void => {
    github.clear();
    githubMutation.mutate();
  };

  // One error area for both ways of joining. The form's failure wins when both
  // are somehow set, because it is the one the member just caused.
  const errorMessage = registerMutation.error
    ? registerMutation.error.message || 'Registration failed'
    : (githubMutation.error?.message ?? github.notice);

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
          {errorMessage && (
            <div
              role="alert"
              className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {errorMessage}
            </div>
          )}

          {/* Above the form, like the login page's — nothing the form does
              underneath can move it out from under a pointer. */}
          <Button
            type="button"
            variant="outline"
            className="w-full"
            size="lg"
            data-testid="github-signin"
            aria-label="Join with GitHub"
            disabled={githubMutation.isPending}
            onClick={handleGithub}
          >
            {githubMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <GithubMark className="size-4" />
            )}
            Join with GitHub
          </Button>

          <div className="my-5 flex items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
              or sign up with email
            </span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username</FormLabel>
                    <FormControl>
                      {/* autoComplete tells the password manager which field is
                          which, so it offers to save the new credentials instead
                          of guessing or staying silent. */}
                      <Input autoComplete="username" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" autoComplete="email" {...field} />
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
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        autoComplete="new-password"
                        data-testid="password-input"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage data-testid="password-error" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm Password</FormLabel>
                    <FormControl>
                      <Input type="password" autoComplete="new-password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={registerMutation.isPending}
              >
                {registerMutation.isPending ? 'Registering…' : 'Register'}
              </Button>
            </form>
          </Form>

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
