import { createFileRoute } from '@tanstack/react-router';
import PrivateRoute from '../components/routing/PrivateRoute';
import Messages from '../pages/Messages';

export const Route = createFileRoute('/_main/messages')({
  component: () => (
    <PrivateRoute>
      <Messages />
    </PrivateRoute>
  ),
});
