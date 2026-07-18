import React, { useState, ChangeEvent, FormEvent } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { CheckCircle2, MailWarning } from 'lucide-react';
import { useResendVerificationEmail } from '../../hooks/auth';

interface VerificationAlertProps {
  email?: string;
  onBack?: () => void;
}

interface AxiosError {
  response?: {
    data?: {
      message?: string;
    };
  };
  message?: string;
}

/**
 * Verification Alert Component
 * Displays when user needs to verify their email
 */
const VerificationAlert: React.FC<VerificationAlertProps> = ({ email, onBack }) => {
  const [showResendForm, setShowResendForm] = useState<boolean>(false);
  const [resendEmail, setResendEmail] = useState<string>(email || '');
  const resendVerificationMutation = useResendVerificationEmail();

  const handleResendVerification = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (resendEmail) {
      resendVerificationMutation.mutate(resendEmail, {
        onSuccess: () => {
          setShowResendForm(false);
        },
      });
    }
  };

  const getErrorMessage = (): string => {
    if (!resendVerificationMutation.error) return '';
    const axiosError = resendVerificationMutation.error as AxiosError;
    return axiosError?.response?.data?.message || 'Failed to send verification email';
  };

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader className="text-center">
        <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
          action required
        </p>
        <CardTitle className="text-2xl">Verify your email</CardTitle>
      </CardHeader>
      <CardContent>
        <div
          role="alert"
          className="mb-4 flex items-start gap-3 rounded-md border border-brand-amber/30 bg-brand-amber/10 px-3 py-2 text-sm text-brand-amber"
        >
          <MailWarning className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-medium">Email Verification Required</p>
            <p className="text-brand-amber/90">
              Please verify your email address before logging in. Check your inbox for a
              verification email.
            </p>
          </div>
        </div>

        {!showResendForm ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              onClick={() => setShowResendForm(true)}
              variant="outline"
              className="w-full"
              aria-label="Send verification email"
            >
              Send Verification Email
            </Button>
            {onBack && (
              <Button
                onClick={onBack}
                variant="ghost"
                className="w-full"
                aria-label="Back to login"
              >
                Back to Login
              </Button>
            )}
          </div>
        ) : (
          <div>
            <p className="mb-3 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
              Send Verification Email
            </p>
            <form onSubmit={handleResendVerification} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="resend-email">Email</Label>
                <Input
                  id="resend-email"
                  type="email"
                  value={resendEmail}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setResendEmail(e.target.value)}
                  required
                  autoFocus
                  aria-label="Email address for verification"
                />
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  type="submit"
                  className="w-full"
                  disabled={resendVerificationMutation.isPending}
                  aria-label="Submit verification email request"
                >
                  {resendVerificationMutation.isPending ? 'Sending…' : 'Send Verification Email'}
                </Button>
                <Button
                  onClick={() => setShowResendForm(false)}
                  variant="ghost"
                  className="w-full"
                  aria-label="Cancel verification email request"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        )}

        {resendVerificationMutation.isSuccess && (
          <div
            role="alert"
            className="mt-4 flex items-start gap-3 rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-primary"
          >
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
            <span>Verification email sent successfully! Please check your inbox.</span>
          </div>
        )}

        {resendVerificationMutation.error && (
          <div
            role="alert"
            className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {getErrorMessage()}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default VerificationAlert;
