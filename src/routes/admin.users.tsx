import { createFileRoute } from '@tanstack/react-router';
import UserManagement from '../pages/admin/UserManagement';

export const Route = createFileRoute('/admin/users')({ component: UserManagement });
