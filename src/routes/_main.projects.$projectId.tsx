import { createFileRoute } from '@tanstack/react-router';
import PrivateRoute from '../components/routing/PrivateRoute';
import ProjectDetail from '../pages/ProjectDetail';

export const Route = createFileRoute('/_main/projects/$projectId')({
  component: () => (
    <PrivateRoute>
      <ProjectDetail />
    </PrivateRoute>
  ),
});
