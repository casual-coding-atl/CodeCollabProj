import { createFileRoute } from '@tanstack/react-router';
import PrivateRoute from '../components/routing/PrivateRoute';
import Security from '../pages/Security';

export const Route = createFileRoute('/_main/security')({
  component: () => (
    <PrivateRoute>
      <Security />
    </PrivateRoute>
  ),
});
