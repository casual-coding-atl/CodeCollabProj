import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import api from '../utils/api';

type VerificationStatus = 'verifying' | 'success' | 'error';

interface VerifyResponse {
  message: string;
}

const EmailVerification: React.FC = () => {
  const { token: paramToken } = useParams<{ token?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<VerificationStatus>('verifying');
  const [message, setMessage] = useState('');

  // Get token from either URL params or query string
  const token = paramToken || searchParams.get('token');

  // The verify endpoint consumes the single-use token on first success. Cache the
  // in-flight request per token in a ref so React StrictMode's double-invoke (or any
  // re-mount for the same token) issues the request exactly ONCE and both invocations
  // subscribe to the same promise. The `ignore` flag then guards only stale state
  // writes after unmount / token change.
  const requestRef = useRef<{ token: string; promise: Promise<VerifyResponse> } | null>(null);

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('No verification token provided');
      return;
    }

    let ignore = false;

    if (!requestRef.current || requestRef.current.token !== token) {
      requestRef.current = {
        token,
        promise: api.get<VerifyResponse>(`/auth/verify-email/${token}`).then((res) => res.data),
      };
    }

    requestRef.current.promise.then(
      (data) => {
        if (!ignore) {
          setStatus('success');
          setMessage(data.message);
        }
      },
      (error) => {
        const axiosError = error as {
          response?: { data?: { message?: string } };
          message?: string;
        };
        if (!ignore) {
          setStatus('error');
          setMessage(axiosError.response?.data?.message || 'Verification failed');
        }
      }
    );

    return () => {
      ignore = true;
    };
  }, [token]);

  const getContent = (): React.ReactNode => {
    switch (status) {
      case 'verifying':
        return (
          <div className="flex flex-col items-center gap-3 text-center">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
            <p className="text-base font-medium">Verifying your email...</p>
          </div>
        );

      case 'success':
        return (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-primary"
          >
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
            <div>
              <p className="font-medium">Email Verified Successfully!</p>
              <p className="text-primary/90">{message}</p>
            </div>
          </div>
        );

      case 'error':
        return (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            <XCircle className="mt-0.5 size-4 shrink-0" />
            <div>
              <p className="font-medium">Verification Failed</p>
              <p className="text-destructive/90">{message}</p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="px-4 py-12">
      <Card className="mx-auto w-full max-w-md">
        <CardHeader className="text-center">
          <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            account activation
          </p>
          <CardTitle className="text-2xl">Email Verification</CardTitle>
        </CardHeader>
        <CardContent>
          {getContent()}

          {(status === 'success' || status === 'error') && (
            <Button onClick={() => navigate('/login')} className="mt-4 w-full" size="lg">
              Go to Login
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default EmailVerification;
