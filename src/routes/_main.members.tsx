import { createFileRoute } from '@tanstack/react-router';
import PrivateRoute from '../components/routing/PrivateRoute';
import Members from '../pages/Members';

export const Route = createFileRoute('/_main/members')({
  component: () => (
    <PrivateRoute>
      <Members />
    </PrivateRoute>
  ),
});
