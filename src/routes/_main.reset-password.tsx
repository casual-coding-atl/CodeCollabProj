import { createFileRoute } from '@tanstack/react-router';
import ResetPassword from '../components/auth/ResetPassword';

export const Route = createFileRoute('/_main/reset-password')({
  validateSearch: (s: Record<string, unknown>): { token?: string } => ({
    token: typeof s.token === 'string' ? s.token : undefined,
  }),
  component: ResetPassword,
});
