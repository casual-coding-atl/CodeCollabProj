import { createFileRoute } from '@tanstack/react-router';
import PrivateRoute from '../components/routing/PrivateRoute';
import ProjectForm from '../components/projects/ProjectForm';

export const Route = createFileRoute('/_main/projects/create')({
  component: () => (
    <PrivateRoute>
      <ProjectForm />
    </PrivateRoute>
  ),
});
