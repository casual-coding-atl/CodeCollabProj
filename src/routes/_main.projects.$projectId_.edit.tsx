import { createFileRoute } from '@tanstack/react-router';
import PrivateRoute from '../components/routing/PrivateRoute';
import ProjectForm from '../components/projects/ProjectForm';

// The trailing `_` in `$projectId_` un-nests this route from the project
// detail route. ProjectDetail renders no <Outlet/>, so as a nested child this
// form never appeared — /edit just showed the detail page (broken since the
// TanStack migration).
export const Route = createFileRoute('/_main/projects/$projectId_/edit')({
  component: () => (
    <PrivateRoute>
      <ProjectForm />
    </PrivateRoute>
  ),
});
