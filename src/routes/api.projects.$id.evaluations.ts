import { createFileRoute } from '@tanstack/react-router';
import { handler, json, error, requireUser } from '../server/http';
import { connectDB } from '../server/db';
import { Evaluation, Project } from '../server/models';

/**
 * /api/projects/$id/evaluations
 *   GET → list all evaluations for a project, newest-first (owner only)
 */
export const Route = createFileRoute('/api/projects/$id/evaluations')({
  server: {
    handlers: {
      GET: handler(async ({ request, params }) => {
        const user = await requireUser(request);
        await connectDB();

        const project = await Project.findById(params.id).exec();
        if (!project) return error(404, 'Project not found');

        // Only the project owner may list evaluations.
        if (String(project.owner) !== String(user._id)) {
          return error(403, 'Only the project owner can view evaluations');
        }

        const evaluations = await Evaluation.find({ projectId: project._id })
          .sort({ requestedAt: -1 })
          .exec();

        return json({ evaluations });
      }),
    },
  },
});
