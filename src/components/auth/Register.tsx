import React, { useState, useEffect } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
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
import { useAuth, useRegister } from '../../hooks/auth';

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

// Mirrors the previous inline validation and the server policy (8+ chars with
// upper, lower, digit, and special character).
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
    password: z
      .string()
      .min(1, 'Password is required')
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/,
        'Password must be at least 8 characters and include uppercase, lowercase, a number, and a special character'
      ),
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

  const [registrationSuccess, setRegistrationSuccess] = useState<boolean>(false);
  const [submittedEmail, setSubmittedEmail] = useState<string>('');

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = (values: RegisterSchema): void => {
    const { confirmPassword: _confirmPassword, ...registerData } = values;
    setSubmittedEmail(values.email);
    registerMutation.mutate(registerData, {
      onSuccess: (data: RegisterResponse) => {
        setRegistrationSuccess(true);
        // If auto-login in development mode, navigate to dashboard
        if (data.token && data.user) {
          navigate('/dashboard');
        }
      },
    });
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
                We&apos;ve sent a verification email to <strong>{submittedEmail}</strong>. Please
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

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username</FormLabel>
                    <FormControl>
                      <Input {...field} />
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
                      <Input type="email" {...field} />
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
                      <Input type="password" data-testid="password-input" {...field} />
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
                      <Input type="password" {...field} />
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
