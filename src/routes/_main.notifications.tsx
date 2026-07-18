import { createFileRoute } from '@tanstack/react-router';
import PrivateRoute from '../components/routing/PrivateRoute';
import Notifications from '../pages/Notifications';

export const Route = createFileRoute('/_main/notifications')({
  component: () => (
    <PrivateRoute>
      <Notifications />
    </PrivateRoute>
  ),
});
