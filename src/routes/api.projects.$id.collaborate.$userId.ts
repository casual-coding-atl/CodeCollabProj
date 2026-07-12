import { createFileRoute } from '@tanstack/react-router';
import { handler, json, error, requireUser } from '../server/http';
import { connectDB } from '../server/db';
import { Project } from '../server/models';

/**
 * PUT /api/projects/$id/collaborate/$userId  →  projectController.handleCollaborationRequest
 * Owner-only. Accepts/rejects a pending collaboration request:
 *   - 'rejected' removes the collaborator entry
 *   - 'accepted' sets its status
 * (The legacy route param was `:projectId`; here the shared first dynamic
 * segment is `$id`, so params.id is the project id.)
 */
export const Route = createFileRoute('/api/projects/$id/collaborate/$userId')({
  server: {
    handlers: {
      PUT: handler(async ({ request, params }) => {
        const user = await requireUser(request);
        await connectDB();

        const body = (await request.json().catch(() => ({}))) as { status?: string };
        const { status } = body;

        // Only a valid decision may be written to the subdoc (enum-guarded).
        if (!status || !['accepted', 'rejected'].includes(status)) {
          return error(400, "Status must be 'accepted' or 'rejected'");
        }

        const project = await Project.findById(params.id).exec();
        if (!project) return error(404, 'Project not found');

        // Owner-only.
        if (String(project.owner) !== String(user._id)) {
          return error(403, 'Not authorized to handle collaboration requests');
        }

        const collaboratorIndex = (project.collaborators ?? []).findIndex(
          (c) => String(c.userId) === params.userId,
        );
        if (collaboratorIndex === -1) {
          return error(404, 'Collaboration request not found');
        }

        if (status === 'rejected') {
          project.collaborators.splice(collaboratorIndex, 1);
        } else {
          project.collaborators[collaboratorIndex].status = 'accepted';
        }

        await project.save();

        return json({ message: `Collaboration request ${status} successfully` });
      }),
    },
  },
});
