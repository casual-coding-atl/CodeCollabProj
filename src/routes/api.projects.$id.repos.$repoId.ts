import { createFileRoute } from '@tanstack/react-router';
import { handler, json, requireUser } from '../server/http';
import { connectDB } from '../server/db';
import { mongoRepoLinkDeps, unlinkRepo } from '../server/repo-linking';

/**
 * /api/projects/$id/repos/$repoId
 *   DELETE → unlink a repository from this project (owner only)
 *
 * `$repoId` is GitHub's numeric repository id, the same identity the link
 * endpoint stored — a repository renamed since it was linked still unlinks.
 * The rules live in ../server/repo-linking; this authenticates and answers.
 */
export const Route = createFileRoute('/api/projects/$id/repos/$repoId')({
  server: {
    handlers: {
      DELETE: handler(async ({ request, params }) => {
        const user = await requireUser(request);
        await connectDB();

        const answer = await unlinkRepo(mongoRepoLinkDeps, {
          projectId: params.id,
          userId: String(user._id),
          repoId: params.repoId,
        });

        return json(answer.body, answer.status);
      }),
    },
  },
});
