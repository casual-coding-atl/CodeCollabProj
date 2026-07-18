import { createFileRoute } from '@tanstack/react-router';
import { handler, json, error, requireUser } from '../server/http';
import { connectDB } from '../server/db';
import { Project } from '../server/models';
import { createNotification } from '../server/notifications';

/**
 * POST /api/projects/$id/collaborate  →  projectController.requestCollaboration
 * Adds the caller to `collaborators` with status 'pending'. 400 if already
 * present, 404 if the project is missing. Returns only `{ message }` (no project),
 * matching Express exactly.
 */
export const Route = createFileRoute('/api/projects/$id/collaborate')({
  server: {
    handlers: {
      POST: handler(async ({ request, params }) => {
        const user = await requireUser(request);
        await connectDB();

        const project = await Project.findById(params.id).exec();
        if (!project) return error(404, 'Project not found');

        const isCollaborator = (project.collaborators ?? []).some(
          (c) => String(c.userId) === String(user._id),
        );
        if (isCollaborator) {
          return error(400, 'Already a collaborator or pending request');
        }

        project.collaborators.push({ userId: user._id, status: 'pending' });
        await project.save();

        // Notify the owner that someone wants to join.
        await createNotification({
          userId: String(project.owner),
          type: 'join_requested',
          actor: String(user._id),
          projectId: String(project._id),
        });

        return json({ message: 'Collaboration request sent successfully' });
      }),
    },
  },
});
