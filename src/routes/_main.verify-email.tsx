import { createFileRoute } from '@tanstack/react-router';
import EmailVerification from '../pages/EmailVerification';

export const Route = createFileRoute('/_main/verify-email')({
  validateSearch: (s: Record<string, unknown>): { token?: string } => ({
    token: typeof s.token === 'string' ? s.token : undefined,
  }),
  component: EmailVerification,
});
