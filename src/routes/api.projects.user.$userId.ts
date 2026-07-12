import { createFileRoute } from '@tanstack/react-router';
import { handler, json } from '../server/http';
import { connectDB } from '../server/db';
import { Project } from '../server/models';

/**
 * GET /api/projects/user/$userId  →  projectsService.getUserProjects
 *
 * NOTE: there is NO matching Express route/controller for this — the legacy
 * server never implemented `/projects/user/:userId`, but the client service
 * calls it. Implemented here as "projects owned by this user", using the same
 * populate('owner','_id username') + sort({ createdAt: -1 }) + raw-doc shape as
 * the rest of the list endpoints. Public (project reads are public in Express).
 * STATIC `/user` takes precedence over `/$id` automatically.
 */
export const Route = createFileRoute('/api/projects/user/$userId')({
  server: {
    handlers: {
      GET: handler(async ({ params }) => {
        await connectDB();

        const projects = await Project.find({ owner: params.userId })
          .populate('owner', '_id username')
          .sort({ createdAt: -1 })
          .exec();

        return json(projects);
      }),
    },
  },
});
