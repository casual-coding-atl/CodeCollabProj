import { createFileRoute } from '@tanstack/react-router';
import PrivateRoute from '../components/routing/PrivateRoute';
import MemberProfile from '../pages/MemberProfile';

export const Route = createFileRoute('/_main/members/$id')({
  component: () => (
    <PrivateRoute>
      <MemberProfile />
    </PrivateRoute>
  ),
});
