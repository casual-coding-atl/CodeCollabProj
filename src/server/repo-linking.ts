import mongoose from 'mongoose';
import { Project } from './models';
import {
  MAX_LINKED_REPOS,
  duplicateRefDenial,
  linkDenial,
  parseRepoRef,
  reposOf,
  resolveGitHubTokens,
  type LinkedRepo,
  type FetchRepoResult,
  type RepoRef,
} from './github';
import { LINK_VALIDATION_FRESHNESS_MS, fetchRepoCard } from './github-cache';

/**
 * Attaching and detaching a project's Linked Repositories (PRD #88).
 *
 * The two route files under src/routes are adapters: they authenticate, hand
 * the work here and turn the answer into a `Response`. Everything that decides
 * *what* happens — ownership, the order the refusals are considered in, what is
 * saved — lives in this module, against three injected dependencies, so it can
 * be tested without a database, a session or a GitHub account
 * (src/server/repo-linking.test.ts).
 *
 * The rules, in the order a member meets them:
 *
 *  1. the project must exist, and be theirs;
 *  2. the link must name a repository on github.com;
 *  3. a repository already linked is reported as such — *before* the cap, so a
 *     full project does not answer "remove one first" about a repository that
 *     is already on it;
 *  4. the cap (three) is checked before GitHub is asked anything;
 *  5. GitHub must have the repository, and it must be public;
 *  6. the write itself re-states 3 and 4 as query conditions, so two links
 *     racing cannot leave a project over the cap or holding a duplicate.
 */

/** Just enough of a project document for these decisions. */
export interface LinkableProject {
  _id: unknown;
  owner: unknown;
  linkedRepos?: unknown;
}

/** What a route turns into a JSON response. */
export interface ApiAnswer {
  status: number;
  body: Record<string, unknown>;
}

export interface RepoLinkDeps {
  /** The project, or null when the id is unknown or unusable. */
  findProject(projectId: string): Promise<LinkableProject | null>;
  /**
   * Append a repository, but only while it is not already linked and the
   * project is under the cap. Null means the guard refused — someone else got
   * there first.
   */
  attachRepo(projectId: string, repo: LinkedRepo): Promise<LinkableProject | null>;
  /** Remove a repository by GitHub id; null when the project vanished mid-flight. */
  detachRepo(projectId: string, repoId: number): Promise<LinkableProject | null>;
  /** Ask GitHub (through the cache) to describe a repository, as this member. */
  describeRepo(ref: RepoRef, userId: string): Promise<FetchRepoResult>;
}

const NOT_FOUND: ApiAnswer = { status: 404, body: { message: 'Project not found' } };

function owns(project: LinkableProject, userId: string): boolean {
  return String(project.owner) === String(userId);
}

/**
 * Link a repository to a project. `body` is whatever the request carried: a
 * `{ url }` in any common github.com form, or an explicit `{ owner, name }`.
 */
export async function linkRepo(
  deps: RepoLinkDeps,
  input: { projectId: string; userId: string; body: unknown },
): Promise<ApiAnswer> {
  const project = await deps.findProject(input.projectId);
  if (!project) return NOT_FOUND;
  if (!owns(project, input.userId)) {
    return { status: 403, body: { message: 'Only the project owner can link repositories' } };
  }

  const parsed = parseRepoRef((input.body ?? {}) as Record<string, unknown>);
  if (!parsed.ok) return { status: parsed.status, body: { message: parsed.message } };

  const existing = reposOf(project);
  // Duplicates first: on a full project the cap would otherwise answer, and
  // "remove one first" is the wrong thing to say about a repository already
  // linked. Names are all we can compare on until GitHub answers.
  const already = duplicateRefDenial(existing, parsed.ref);
  if (already) return { status: already.status, body: { message: already.message } };

  const capped = linkDenial(existing);
  if (capped) return { status: capped.status, body: { message: capped.message } };

  const result = await deps.describeRepo(parsed.ref, input.userId);
  if (!result.ok) return { status: result.status, body: { message: result.message } };
  const { repo } = result;

  const denial = linkDenial(existing, repo.repoId);
  if (denial) return { status: denial.status, body: { message: denial.message } };

  const updated = await deps.attachRepo(input.projectId, {
    repoId: repo.repoId,
    owner: repo.owner,
    name: repo.name,
    linkedAt: new Date(),
  });

  if (!updated) {
    // The guard refused, so something changed underneath us. Re-read and say
    // which rule it was; a project that disappeared is a 404.
    const fresh = await deps.findProject(input.projectId);
    if (!fresh) return NOT_FOUND;
    const lost = linkDenial(reposOf(fresh), repo.repoId);
    return {
      status: lost?.status ?? 409,
      body: { message: lost?.message ?? 'Could not link that repository.' },
    };
  }

  const linkedRepos = reposOf(updated);
  return {
    status: 201,
    body: {
      message: 'Repository linked',
      repo: linkedRepos.find((r) => Number(r.repoId) === repo.repoId),
      linkedRepos,
    },
  };
}

/** Unlink a repository, addressed by GitHub's numeric id. */
export async function unlinkRepo(
  deps: RepoLinkDeps,
  input: { projectId: string; userId: string; repoId: string | number },
): Promise<ApiAnswer> {
  const repoId = Number(input.repoId);
  if (!Number.isInteger(repoId)) {
    return { status: 400, body: { message: 'That is not a repository id' } };
  }

  const project = await deps.findProject(input.projectId);
  if (!project) return NOT_FOUND;
  if (!owns(project, input.userId)) {
    return { status: 403, body: { message: 'Only the project owner can unlink repositories' } };
  }
  if (!reposOf(project).some((repo) => Number(repo.repoId) === repoId)) {
    return { status: 404, body: { message: 'That repository is not linked to this project' } };
  }

  const updated = await deps.detachRepo(input.projectId, repoId);
  if (!updated) return NOT_FOUND;

  return {
    status: 200,
    body: { message: 'Repository unlinked', linkedRepos: reposOf(updated) },
  };
}

// ── the live dependencies ────────────────────────────────────────────────────

/**
 * The real thing: Mongo for the project, and the cached GitHub read path for
 * validation — so pasting the same nonexistent repository ten times costs one
 * GitHub request, not ten (404s are cacheable; see ./github-cache).
 */
export const mongoRepoLinkDeps: RepoLinkDeps = {
  async findProject(projectId) {
    if (!mongoose.Types.ObjectId.isValid(projectId)) return null;
    return (await Project.findById(projectId).exec()) as LinkableProject | null;
  },

  async attachRepo(projectId, repo) {
    return (await Project.findOneAndUpdate(
      {
        _id: projectId,
        'linkedRepos.repoId': { $ne: repo.repoId },
        [`linkedRepos.${MAX_LINKED_REPOS - 1}`]: { $exists: false },
      },
      { $push: { linkedRepos: repo } },
      { new: true },
    ).exec()) as LinkableProject | null;
  },

  async detachRepo(projectId, repoId) {
    return (await Project.findByIdAndUpdate(
      projectId,
      { $pull: { linkedRepos: { repoId } } },
      { new: true },
    ).exec()) as LinkableProject | null;
  },

  async describeRepo(ref, userId) {
    const tokens = await resolveGitHubTokens(userId);
    const { result } = await fetchRepoCard(ref, {
      tokens,
      freshnessMs: LINK_VALIDATION_FRESHNESS_MS,
    });
    return result;
  },
};
