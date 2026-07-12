import React, { useState, ChangeEvent, FormEvent } from 'react';
import { Box, Typography, Button, TextField, Alert, AlertTitle, Paper } from '@mui/material';
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
    <Paper elevation={3} sx={{ p: 4 }}>
      <Alert severity="warning" sx={{ mb: 3 }}>
        <AlertTitle>Email Verification Required</AlertTitle>
        Please verify your email address before logging in. Check your inbox for a verification
        email.
      </Alert>

      {!showResendForm ? (
        <Box sx={{ textAlign: 'center' }}>
          <Button
            onClick={() => setShowResendForm(true)}
            variant="outlined"
            color="primary"
            sx={{ mr: 2 }}
            aria-label="Send verification email"
          >
            Send Verification Email
          </Button>
          {onBack && (
            <Button onClick={onBack} variant="text" color="primary" aria-label="Back to login">
              Back to Login
            </Button>
          )}
        </Box>
      ) : (
        <Box>
          <Typography variant="h6" gutterBottom>
            Send Verification Email
          </Typography>
          <form onSubmit={handleResendVerification}>
            <TextField
              fullWidth
              label="Email"
              type="email"
              value={resendEmail}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setResendEmail(e.target.value)}
              margin="normal"
              required
              autoFocus
              aria-label="Email address for verification"
            />
            <Box sx={{ mt: 2, textAlign: 'center' }}>
              <Button
                type="submit"
                variant="contained"
                color="primary"
                sx={{ mr: 2 }}
                disabled={resendVerificationMutation.isPending}
                aria-label="Submit verification email request"
              >
                {resendVerificationMutation.isPending ? 'Sending...' : 'Send Verification Email'}
              </Button>
              <Button
                onClick={() => setShowResendForm(false)}
                variant="text"
                color="primary"
                aria-label="Cancel verification email request"
              >
                Cancel
              </Button>
            </Box>
          </form>
        </Box>
      )}

      {resendVerificationMutation.isSuccess && (
        <Alert severity="success" sx={{ mt: 2 }}>
          Verification email sent successfully! Please check your inbox.
        </Alert>
      )}

      {resendVerificationMutation.error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {getErrorMessage()}
        </Alert>
      )}
    </Paper>
  );
};

export default VerificationAlert;
