import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Container,
  Paper,
  Typography,
  Box,
  Alert,
  AlertTitle,
  Button,
  CircularProgress,
} from '@mui/material';
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
          <Box sx={{ textAlign: 'center' }}>
            <CircularProgress sx={{ mb: 2 }} />
            <Typography variant="h6">Verifying your email...</Typography>
          </Box>
        );

      case 'success':
        return (
          <Alert severity="success" sx={{ mb: 3 }}>
            <AlertTitle>Email Verified Successfully!</AlertTitle>
            {message}
          </Alert>
        );

      case 'error':
        return (
          <Alert severity="error" sx={{ mb: 3 }}>
            <AlertTitle>Verification Failed</AlertTitle>
            {message}
          </Alert>
        );

      default:
        return null;
    }
  };

  return (
    <Container maxWidth="sm">
      <Box sx={{ mt: 8, mb: 4 }}>
        <Paper elevation={3} sx={{ p: 4 }}>
          <Typography variant="h4" component="h1" align="center" gutterBottom>
            Email Verification
          </Typography>

          {getContent()}

          {(status === 'success' || status === 'error') && (
            <Box sx={{ textAlign: 'center' }}>
              <Button
                onClick={() => navigate('/login')}
                variant="contained"
                color="primary"
                size="large"
              >
                Go to Login
              </Button>
            </Box>
          )}
        </Paper>
      </Box>
    </Container>
  );
};

export default EmailVerification;
