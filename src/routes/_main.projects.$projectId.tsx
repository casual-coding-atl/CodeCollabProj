import { createFileRoute } from '@tanstack/react-router';
import ProjectDetail from '../pages/ProjectDetail';

/**
 * A project page is public (PRD #88, story 21): a link to a project has to work
 * for the person you sent it to, and its repo cards are visible to any viewer,
 * signed in or not. The API agrees — `GET /api/projects/$id` and the comments
 * list are both unauthenticated — and the page already knows how to be read by
 * a stranger: it offers "Login to Collaborate" instead of a request button, and
 * shows comments without the form to add one.
 *
 * Everything that acts on the project (collaborating, commenting, editing,
 * deleting) is still gated server-side by `requireUser` plus an ownership
 * check, which is where that gate belongs.
 */
export const Route = createFileRoute('/_main/projects/$projectId')({
  component: ProjectDetail,
});
