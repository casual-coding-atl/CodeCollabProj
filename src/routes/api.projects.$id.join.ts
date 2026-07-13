import { createFileRoute } from '@tanstack/react-router';
import { handler, json, error, requireUser } from '../server/http';
import { connectDB } from '../server/db';
import { Project } from '../server/models';
import { createNotification } from '../server/notifications';

/**
 * POST /api/projects/$id/join  →  projectsService.join
 *
 * NOTE: there is NO matching Express route/controller — the legacy server never
 * implemented `/join`, but the client service calls it and expects
 * `{ message, project? }` (JoinLeaveResponse). Implemented as a direct self-join:
 * adds the caller to `collaborators` with status 'accepted' (distinct from the
 * request/approve flow under `/collaborate`). Returns the populated project.
 */
export const Route = createFileRoute('/api/projects/$id/join')({
  server: {
    handlers: {
      POST: handler(async ({ request, params }) => {
        const user = await requireUser(request);
        await connectDB();

        const project = await Project.findById(params.id).exec();
        if (!project) return error(404, 'Project not found');

        const already = (project.collaborators ?? []).some(
          (c) => String(c.userId) === String(user._id),
        );
        if (already) return error(400, 'Already a collaborator or pending request');

        project.collaborators.push({ userId: user._id, status: 'accepted' });
        await project.save();

        // Notify the owner that a member joined (owner === joiner is a no-op).
        await createNotification({
          userId: String(project.owner),
          type: 'collaborator_added',
          actor: String(user._id),
          projectId: String(project._id),
        });

        await project.populate('owner', '_id username');
        await project.populate('collaborators.userId', '_id username');

        return json({ message: 'Joined project successfully', project });
      }),
    },
  },
});
