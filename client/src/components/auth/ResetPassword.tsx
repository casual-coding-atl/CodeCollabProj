import React, { useState, useEffect, ChangeEvent, FormEvent } from 'react';
import { useNavigate, useSearchParams, Link as RouterLink } from 'react-router-dom';
import {
  Container,
  Paper,
  Typography,
  TextField,
  Button,
  Link,
  Box,
  Alert,
  AlertTitle,
  CircularProgress,
} from '@mui/material';
import { usePasswordResetTokenQuery, useResetPassword } from '../../hooks/auth';

interface AxiosError {
  response?: {
    data?: {
      message?: string;
    };
  };
  message?: string;
}

const ResetPassword: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const resetPasswordMutation = useResetPassword();

  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [passwordError, setPasswordError] = useState<string>('');
  const [confirmPasswordError, setConfirmPasswordError] = useState<string>('');
  const [passwordResetSuccess, setPasswordResetSuccess] = useState<boolean>(false);

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

  const validateForm = (): boolean => {
    let isValid = true;

    if (!password) {
      setPasswordError('Password is required');
      isValid = false;
    } else if (password.length < 6) {
      setPasswordError('Password must be at least 6 characters long');
      isValid = false;
    } else {
      setPasswordError('');
    }

    if (!confirmPassword) {
      setConfirmPasswordError('Please confirm your password');
      isValid = false;
    } else if (password !== confirmPassword) {
      setConfirmPasswordError('Passwords do not match');
      isValid = false;
    } else {
      setConfirmPasswordError('');
    }

    return isValid;
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (validateForm()) {
      resetPasswordMutation.mutate(
        { token, password },
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
    }
  };

  const handlePasswordChange = (e: ChangeEvent<HTMLInputElement>): void => {
    setPassword(e.target.value);
    if (passwordError) {
      setPasswordError('');
    }
  };

  const handleConfirmPasswordChange = (e: ChangeEvent<HTMLInputElement>): void => {
    setConfirmPassword(e.target.value);
    if (confirmPasswordError) {
      setConfirmPasswordError('');
    }
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
      <Container maxWidth="sm">
        <Box sx={{ mt: 8, mb: 4 }}>
          <Paper elevation={3} sx={{ p: 4 }}>
            <Alert severity="success" sx={{ mb: 3 }}>
              <AlertTitle>Password Reset Successful</AlertTitle>
              Your password has been reset successfully. You can now log in with your new password.
            </Alert>

            <Box sx={{ textAlign: 'center' }}>
              <Button component={RouterLink} to="/login" variant="contained" color="primary">
                Go to Login
              </Button>
            </Box>
          </Paper>
        </Box>
      </Container>
    );
  }

  if (!token) {
    return (
      <Container maxWidth="sm">
        <Box sx={{ mt: 8, mb: 4 }}>
          <Paper elevation={3} sx={{ p: 4 }}>
            <Alert severity="error" sx={{ mb: 3 }}>
              <AlertTitle>Invalid Reset Link</AlertTitle>
              This password reset link is invalid. Please request a new password reset.
            </Alert>

            <Box sx={{ textAlign: 'center' }}>
              <Button
                component={RouterLink}
                to="/forgot-password"
                variant="contained"
                color="primary"
              >
                Request Password Reset
              </Button>
            </Box>
          </Paper>
        </Box>
      </Container>
    );
  }

  if (isVerifyingToken) {
    return (
      <Container maxWidth="sm">
        <Box sx={{ mt: 8, mb: 4, textAlign: 'center' }}>
          <CircularProgress />
          <Typography variant="body1" sx={{ mt: 2 }}>
            Verifying reset link...
          </Typography>
        </Box>
      </Container>
    );
  }

  if (tokenError || !tokenValidationData) {
    return (
      <Container maxWidth="sm">
        <Box sx={{ mt: 8, mb: 4 }}>
          <Paper elevation={3} sx={{ p: 4 }}>
            <Alert severity="error" sx={{ mb: 3 }}>
              <AlertTitle>Invalid or Expired Reset Link</AlertTitle>
              This password reset link is invalid or has expired. Please request a new password
              reset.
            </Alert>

            <Box sx={{ textAlign: 'center' }}>
              <Button
                component={RouterLink}
                to="/forgot-password"
                variant="contained"
                color="primary"
              >
                Request New Reset Link
              </Button>
            </Box>
          </Paper>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="sm">
      <Box sx={{ mt: 8, mb: 4 }}>
        <Paper elevation={3} sx={{ p: 4 }}>
          <Typography component="h1" variant="h4" align="center" gutterBottom>
            Reset Password
          </Typography>

          <Typography variant="body1" align="center" sx={{ mb: 3 }}>
            Enter your new password below.
          </Typography>

          {resetPasswordMutation.error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {getErrorMessage()}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit} noValidate>
            <TextField
              margin="normal"
              required
              fullWidth
              id="password"
              label="New Password"
              name="password"
              type="password"
              autoComplete="new-password"
              autoFocus
              value={password}
              onChange={handlePasswordChange}
              error={!!passwordError}
              helperText={passwordError}
              disabled={resetPasswordMutation.isPending}
            />

            <TextField
              margin="normal"
              required
              fullWidth
              id="confirmPassword"
              label="Confirm New Password"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={handleConfirmPasswordChange}
              error={!!confirmPasswordError}
              helperText={confirmPasswordError}
              disabled={resetPasswordMutation.isPending}
            />

            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 3, mb: 2 }}
              disabled={resetPasswordMutation.isPending}
            >
              {resetPasswordMutation.isPending ? 'Resetting...' : 'Reset Password'}
            </Button>

            <Box sx={{ textAlign: 'center' }}>
              <Link component={RouterLink} to="/login" variant="body2">
                Back to Login
              </Link>
            </Box>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
};

export default ResetPassword;
