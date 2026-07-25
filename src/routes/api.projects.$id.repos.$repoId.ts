import { createFileRoute } from '@tanstack/react-router';
import mongoose from 'mongoose';
import { handler, json, error, requireUser } from '../server/http';
import { connectDB } from '../server/db';
import { Project } from '../server/models';
import { reposOf } from '../server/github';

/**
 * /api/projects/$id/repos/$repoId
 *   DELETE → unlink a repository from this project (owner only)
 *
 * `$repoId` is GitHub's numeric repository id, the same identity the link
 * endpoint stored — a repository renamed since it was linked still unlinks.
 */
export const Route = createFileRoute('/api/projects/$id/repos/$repoId')({
  server: {
    handlers: {
      DELETE: handler(async ({ request, params }) => {
        const user = await requireUser(request);
        await connectDB();

        if (!mongoose.Types.ObjectId.isValid(params.id)) return error(404, 'Project not found');
        const repoId = Number(params.repoId);
        if (!Number.isInteger(repoId)) return error(400, 'That is not a repository id');

        const project = await Project.findById(params.id).exec();
        if (!project) return error(404, 'Project not found');
        if (String(project.owner) !== String(user._id)) {
          return error(403, 'Only the project owner can unlink repositories');
        }
        if (!reposOf(project).some((repo) => Number(repo.repoId) === repoId)) {
          return error(404, 'That repository is not linked to this project');
        }

        const updated = await Project.findByIdAndUpdate(
          project._id,
          { $pull: { linkedRepos: { repoId } } },
          { new: true },
        ).exec();

        return json({ message: 'Repository unlinked', linkedRepos: reposOf(updated) });
      }),
    },
  },
});
