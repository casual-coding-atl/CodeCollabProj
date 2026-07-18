import { createFileRoute } from '@tanstack/react-router';
import PrivateRoute from '../components/routing/PrivateRoute';
import Profile from '../pages/Profile';

export const Route = createFileRoute('/_main/profile')({
  component: () => (
    <PrivateRoute>
      <Profile />
    </PrivateRoute>
  ),
});
