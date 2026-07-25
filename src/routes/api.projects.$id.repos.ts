import { createFileRoute } from '@tanstack/react-router';
import mongoose from 'mongoose';
import { handler, json, error, requireUser } from '../server/http';
import { connectDB } from '../server/db';
import { Project } from '../server/models';
import {
  MAX_LINKED_REPOS,
  fetchPublicRepo,
  linkDenial,
  parseRepoRef,
  reposOf,
  resolveGitHubToken,
} from '../server/github';

/**
 * /api/projects/$id/repos
 *   POST → link a public GitHub repository to this project (owner only)
 *
 * Body: `{ url }` — a github.com link in any common form — or `{ owner, name }`.
 *
 * The repository is validated against GitHub before anything is saved: it must
 * exist and be public. What gets stored is GitHub's numeric id plus the
 * owner/name *from that response*, so a repo linked under a stale name lands
 * under its current one.
 *
 * The read is made with the linking member's own GitHub token when they have a
 * Linked GitHub Account, falling back to the server's token and then to
 * unauthenticated (see src/server/github.ts).
 */

export const Route = createFileRoute('/api/projects/$id/repos')({
  server: {
    handlers: {
      POST: handler(async ({ request, params }) => {
        const user = await requireUser(request);
        await connectDB();

        if (!mongoose.Types.ObjectId.isValid(params.id)) return error(404, 'Project not found');
        const project = await Project.findById(params.id).exec();
        if (!project) return error(404, 'Project not found');
        if (String(project.owner) !== String(user._id)) {
          return error(403, 'Only the project owner can link repositories');
        }

        const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
        const parsed = parseRepoRef(body);
        if (!parsed.ok) return error(parsed.status, parsed.message);

        // The cap is checked before GitHub is asked anything — a full project
        // should not spend a request from anybody's rate limit.
        const capped = linkDenial(reposOf(project));
        if (capped) return error(capped.status, capped.message);

        const token = await resolveGitHubToken(user._id);
        const result = await fetchPublicRepo(parsed.ref, { token });
        if (!result.ok) return error(result.status, result.message);
        const { repo } = result;

        const denial = linkDenial(reposOf(project), repo.repoId);
        if (denial) return error(denial.status, denial.message);

        // Re-stated as query conditions so two simultaneous links cannot slip
        // past the checks above and leave a project over the cap.
        const updated = await Project.findOneAndUpdate(
          {
            _id: project._id,
            'linkedRepos.repoId': { $ne: repo.repoId },
            [`linkedRepos.${MAX_LINKED_REPOS - 1}`]: { $exists: false },
          },
          {
            $push: {
              linkedRepos: {
                repoId: repo.repoId,
                owner: repo.owner,
                name: repo.name,
                linkedAt: new Date(),
              },
            },
          },
          { new: true },
        ).exec();

        if (!updated) {
          const fresh = await Project.findById(project._id).exec();
          const lost = linkDenial(reposOf(fresh), repo.repoId);
          return error(lost?.status ?? 409, lost?.message ?? 'Could not link that repository.');
        }

        return json(
          {
            message: 'Repository linked',
            repo: reposOf(updated).find((r) => Number(r.repoId) === repo.repoId),
            linkedRepos: reposOf(updated),
          },
          201,
        );
      }),
    },
  },
});
