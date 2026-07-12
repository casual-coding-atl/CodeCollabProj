import { createFileRoute } from '@tanstack/react-router';
import ResetPassword from '../components/auth/ResetPassword';

export const Route = createFileRoute('/_main/reset-password')({ component: ResetPassword });
