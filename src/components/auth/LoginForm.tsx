import React, { ChangeEvent, FormEvent } from 'react';
import { Paper, Typography, TextField, Button, Link, Box, Alert } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import type { LoginFormData } from '../../types/forms';

interface LoginFormErrors {
  email?: string;
  password?: string;
}

interface AxiosError {
  response?: {
    data?: {
      message?: string;
    };
  };
  message?: string;
}

interface LoginFormProps {
  formData: LoginFormData;
  formErrors: LoginFormErrors;
  isLoading: boolean;
  error: AxiosError | Error | null;
  onChange: (data: LoginFormData) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
}

/**
 * Login Form Component
 * Handles the login form UI and validation
 */
const LoginForm: React.FC<LoginFormProps> = ({
  formData,
  formErrors,
  isLoading,
  error,
  onChange,
  onSubmit,
}) => {
  const handleChange = (e: ChangeEvent<HTMLInputElement>): void => {
    onChange({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const getErrorMessage = (): string => {
    if (!error) return '';
    const axiosError = error as AxiosError;
    return axiosError?.response?.data?.message || error.message || 'Login failed';
  };

  return (
    <Paper elevation={3} sx={{ p: 4 }}>
      <Typography variant="h4" component="h1" align="center" gutterBottom>
        Login
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {getErrorMessage()}
        </Alert>
      )}

      <form onSubmit={onSubmit}>
        <TextField
          fullWidth
          label="Email"
          name="email"
          type="email"
          value={formData.email}
          onChange={handleChange}
          error={!!formErrors.email}
          helperText={formErrors.email}
          margin="normal"
          required
          autoComplete="email"
          autoFocus
          aria-label="Email address"
        />

        <TextField
          fullWidth
          label="Password"
          name="password"
          type="password"
          value={formData.password}
          onChange={handleChange}
          error={!!formErrors.password}
          helperText={formErrors.password}
          margin="normal"
          required
          autoComplete="current-password"
          aria-label="Password"
        />

        <Button
          type="submit"
          fullWidth
          variant="contained"
          color="primary"
          size="large"
          disabled={isLoading}
          sx={{ mt: 3 }}
          aria-label="Submit login form"
        >
          {isLoading ? 'Logging in...' : 'Login'}
        </Button>
      </form>

      <Box sx={{ mt: 2, textAlign: 'center' }}>
        <Typography variant="body2" sx={{ mb: 1 }}>
          <Link
            component={RouterLink}
            to="/forgot-password"
            variant="body2"
            aria-label="Forgot password"
          >
            Forgot your password?
          </Link>
        </Typography>
        <Typography variant="body2">
          Don&apos;t have an account?{' '}
          <Link component={RouterLink} to="/register" aria-label="Register new account">
            Register here
          </Link>
        </Typography>
      </Box>
    </Paper>
  );
};

export default LoginForm;
