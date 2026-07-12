import { createFileRoute } from '@tanstack/react-router';
import ForgotPassword from '../components/auth/ForgotPassword';

export const Route = createFileRoute('/_main/forgot-password')({ component: ForgotPassword });
