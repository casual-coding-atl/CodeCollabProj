import { createFileRoute } from '@tanstack/react-router';
import EmailVerification from '../pages/EmailVerification';

export const Route = createFileRoute('/_main/verify-email/$token')({ component: EmailVerification });
