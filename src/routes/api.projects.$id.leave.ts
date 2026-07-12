import { createFileRoute } from '@tanstack/react-router';
import { handler, json, error, requireUser } from '../server/http';
import { connectDB } from '../server/db';
import { Project } from '../server/models';

/**
 * POST /api/projects/$id/leave  →  projectsService.leave
 *
 * NOTE: there is NO matching Express route/controller — the legacy server never
 * implemented `/leave`, but the client service calls it and expects
 * `{ message, project? }` (JoinLeaveResponse). Implemented as the inverse of
 * `/join`: removes the caller from `collaborators`. 400 if not a collaborator.
 * Returns the populated project.
 */
export const Route = createFileRoute('/api/projects/$id/leave')({
  server: {
    handlers: {
      POST: handler(async ({ request, params }) => {
        const user = await requireUser(request);
        await connectDB();

        const project = await Project.findById(params.id).exec();
        if (!project) return error(404, 'Project not found');

        const index = (project.collaborators ?? []).findIndex(
          (c) => String(c.userId) === String(user._id),
        );
        if (index === -1) return error(400, 'Not a collaborator on this project');

        project.collaborators.splice(index, 1);
        await project.save();

        await project.populate('owner', '_id username');
        await project.populate('collaborators.userId', '_id username');

        return json({ message: 'Left project successfully', project });
      }),
    },
  },
});
