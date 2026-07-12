import { createFileRoute } from '@tanstack/react-router';
import PrivateRoute from '../components/routing/PrivateRoute';
import Dashboard from '../pages/Dashboard';

export const Route = createFileRoute('/_main/dashboard')({
  component: () => (
    <PrivateRoute>
      <Dashboard />
    </PrivateRoute>
  ),
});
