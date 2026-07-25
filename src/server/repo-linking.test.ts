import { describe, it, expect, vi } from 'vitest';
import { linkRepo, unlinkRepo, type LinkableProject, type RepoLinkDeps } from './repo-linking';
import { MAX_LINKED_REPOS, type FetchRepoResult, type GitHubRepoSummary } from './github';

/**
 * What the two repo endpoints answer, asked of the module the routes delegate
 * to. The route files hold nothing but `requireUser` + this call, so these are
 * the endpoints' own rules: who may link, in what order refusals are
 * considered, and what survives a race.
 *
 * The 401 half of "owner only" belongs to `requireUser` (src/server/http.ts,
 * covered in http.test.ts) and is asserted end to end in e2e/github-linking.spec.ts.
 */

const OWNER = 'owner-1';
const OTHER = 'someone-else';
const PROJECT = 'project-1';

const repoSummary = (over: Partial<GitHubRepoSummary> = {}): GitHubRepoSummary => ({
  repoId: 9001,
  owner: 'e2e-org',
  name: 'codecollab-web',
  fullName: 'e2e-org/codecollab-web',
  description: null,
  language: 'TypeScript',
  stars: 1,
  openIssues: 0,
  pushedAt: null,
  archived: false,
  htmlUrl: 'https://github.com/e2e-org/codecollab-web',
  ...over,
});

interface FakeOptions {
  project?: LinkableProject | null;
  describe?: FetchRepoResult;
  /** What a re-read returns after the guarded write refuses (the lost race). */
  afterRace?: LinkableProject | null;
}

/**
 * An in-memory stand-in for the Mongo dependencies, with the same guard the
 * real `attachRepo` states as query conditions: append only while the repo is
 * not already linked and the project is under the cap.
 */
function fakeDeps(options: FakeOptions = {}) {
  const project =
    options.project === undefined
      ? ({ _id: PROJECT, owner: OWNER, linkedRepos: [] } as LinkableProject)
      : options.project;
  let raced = false;

  const describeRepo = vi.fn(
    async (): Promise<FetchRepoResult> => options.describe ?? { ok: true, repo: repoSummary() },
  );

  const deps: RepoLinkDeps = {
    findProject: vi.fn(async (id: string) => {
      if (id !== PROJECT) return null;
      if (raced) return options.afterRace ?? null;
      return project;
    }),
    attachRepo: vi.fn(async (id: string, repo) => {
      if (id !== PROJECT || !project) return null;
      const linked = (project.linkedRepos as Array<{ repoId: number }>) ?? [];
      const guardFails =
        linked.some((r) => Number(r.repoId) === repo.repoId) || linked.length >= MAX_LINKED_REPOS;
      if (options.afterRace !== undefined || guardFails) {
        raced = true;
        return null;
      }
      linked.push(repo);
      return { ...project, linkedRepos: linked };
    }),
    detachRepo: vi.fn(async (id: string, repoId: number) => {
      if (id !== PROJECT || !project) return null;
      const linked = ((project.linkedRepos as Array<{ repoId: number }>) ?? []).filter(
        (r) => Number(r.repoId) !== repoId,
      );
      return { ...project, linkedRepos: linked };
    }),
    describeRepo,
  };

  return { deps, describeRepo, project };
}

const link = (deps: RepoLinkDeps, body: unknown, userId = OWNER, projectId = PROJECT) =>
  linkRepo(deps, { projectId, userId, body });

describe('POST /api/projects/:id/repos', () => {
  it('links a public repository and answers with the project’s repositories', async () => {
    const { deps } = fakeDeps();

    const answer = await link(deps, { url: 'https://github.com/e2e-org/codecollab-web' });

    expect(answer.status).toBe(201);
    expect(answer.body.message).toBe('Repository linked');
    expect(answer.body.repo).toMatchObject({ repoId: 9001, owner: 'e2e-org', name: 'codecollab-web' });
    expect(answer.body.linkedRepos).toHaveLength(1);
  });

  it('stores what GitHub says, not what was pasted, so a rename cannot orphan the link', async () => {
    const { deps } = fakeDeps({
      describe: { ok: true, repo: repoSummary({ owner: 'E2E-Org', name: 'renamed' }) },
    });

    const answer = await link(deps, { url: 'https://github.com/e2e-org/old-name' });

    expect(answer.body.repo).toMatchObject({ repoId: 9001, owner: 'E2E-Org', name: 'renamed' });
  });

  it('does not exist for anyone but the owner', async () => {
    const { deps, describeRepo } = fakeDeps();

    const answer = await link(deps, { url: 'https://github.com/e2e-org/codecollab-web' }, OTHER);

    expect(answer.status).toBe(403);
    expect(answer.body.message).toMatch(/owner/i);
    expect(describeRepo).not.toHaveBeenCalled();
  });

  it('answers 404 for a project that does not exist', async () => {
    const { deps } = fakeDeps({ project: null });
    const answer = await link(deps, { url: 'https://github.com/e2e-org/codecollab-web' });
    expect(answer.status).toBe(404);
  });

  it('refuses a link that is not a GitHub repository, without asking GitHub', async () => {
    const { deps, describeRepo } = fakeDeps();

    const answer = await link(deps, { url: 'https://gitlab.com/e2e-org/codecollab-web' });

    expect(answer.status).toBe(400);
    expect(answer.body.message).toMatch(/github\.com/i);
    expect(describeRepo).not.toHaveBeenCalled();
  });

  it('refuses a fourth repository, and does not spend a GitHub request finding out', async () => {
    const { deps, describeRepo } = fakeDeps({
      project: {
        _id: PROJECT,
        owner: OWNER,
        linkedRepos: [
          { repoId: 1, owner: 'o', name: 'a' },
          { repoId: 2, owner: 'o', name: 'b' },
          { repoId: 3, owner: 'o', name: 'c' },
        ],
      },
    });

    const answer = await link(deps, { url: 'https://github.com/e2e-org/codecollab-web' });

    expect(answer.status).toBe(409);
    expect(answer.body.message).toMatch(/at most 3/i);
    expect(describeRepo).not.toHaveBeenCalled();
  });

  it('says "already linked" about a repository that is, even when the project is full', async () => {
    const { deps } = fakeDeps({
      project: {
        _id: PROJECT,
        owner: OWNER,
        linkedRepos: [
          { repoId: 1, owner: 'E2E-Org', name: 'CodeCollab-Web' },
          { repoId: 2, owner: 'o', name: 'b' },
          { repoId: 3, owner: 'o', name: 'c' },
        ],
      },
    });

    // Pasted in a different case, on a project that is also at the cap: the
    // duplicate is the useful thing to say, not "remove one first".
    const answer = await link(deps, { url: 'https://github.com/e2e-org/codecollab-web' });

    expect(answer.status).toBe(409);
    expect(answer.body.message).toMatch(/already linked/i);
  });

  it('refuses a repository GitHub says is private, in GitHub’s words', async () => {
    const { deps } = fakeDeps({
      describe: {
        ok: false,
        reason: 'private',
        status: 400,
        message: 'e2e-org/secret is private. Only public repositories can be linked to a project.',
      },
    });

    const answer = await link(deps, { url: 'https://github.com/e2e-org/secret' });

    expect(answer.status).toBe(400);
    expect(answer.body.message).toMatch(/private/i);
  });

  it('passes a GitHub 404 straight through', async () => {
    const { deps } = fakeDeps({
      describe: { ok: false, reason: 'not-found', status: 404, message: 'GitHub has no public repository at a/b.' },
    });

    const answer = await link(deps, { url: 'https://github.com/a/b' });

    expect(answer.status).toBe(404);
    expect(answer.body.message).toMatch(/no public repository/i);
  });

  it('turns a lost race into the rule that beat it, not a 500', async () => {
    // The guarded write refuses because another request linked the same
    // repository a moment earlier.
    const { deps } = fakeDeps({
      afterRace: {
        _id: PROJECT,
        owner: OWNER,
        linkedRepos: [{ repoId: 9001, owner: 'e2e-org', name: 'codecollab-web' }],
      },
    });

    const answer = await link(deps, { url: 'https://github.com/e2e-org/codecollab-web' });

    expect(answer.status).toBe(409);
    expect(answer.body.message).toMatch(/already linked/i);
  });

  it('answers 404 when the project is deleted mid-flight', async () => {
    const { deps } = fakeDeps({ afterRace: null });

    const answer = await link(deps, { url: 'https://github.com/e2e-org/codecollab-web' });

    expect(answer.status).toBe(404);
  });
});

describe('DELETE /api/projects/:id/repos/:repoId', () => {
  const linked = {
    _id: PROJECT,
    owner: OWNER,
    linkedRepos: [
      { repoId: 9001, owner: 'e2e-org', name: 'codecollab-web' },
      { repoId: 9002, owner: 'e2e-org', name: 'other' },
    ],
  };

  it('removes the repository and answers with what is left', async () => {
    const { deps } = fakeDeps({ project: { ...linked, linkedRepos: [...linked.linkedRepos] } });

    const answer = await unlinkRepo(deps, { projectId: PROJECT, userId: OWNER, repoId: '9001' });

    expect(answer.status).toBe(200);
    expect(answer.body.linkedRepos).toHaveLength(1);
    expect((answer.body.linkedRepos as Array<{ repoId: number }>)[0].repoId).toBe(9002);
  });

  it('does not exist for anyone but the owner', async () => {
    const { deps } = fakeDeps({ project: linked });
    const answer = await unlinkRepo(deps, { projectId: PROJECT, userId: OTHER, repoId: '9001' });
    expect(answer.status).toBe(403);
  });

  it('answers 404 for a repository that is not linked to this project', async () => {
    const { deps } = fakeDeps({ project: linked });
    const answer = await unlinkRepo(deps, { projectId: PROJECT, userId: OWNER, repoId: '4242' });
    expect(answer.status).toBe(404);
    expect(answer.body.message).toMatch(/not linked/i);
  });

  it('refuses an id that is not a number', async () => {
    const { deps } = fakeDeps({ project: linked });
    const answer = await unlinkRepo(deps, { projectId: PROJECT, userId: OWNER, repoId: 'abc' });
    expect(answer.status).toBe(400);
  });

  it('answers 404 for a project that does not exist', async () => {
    const { deps } = fakeDeps({ project: null });
    const answer = await unlinkRepo(deps, { projectId: PROJECT, userId: OWNER, repoId: '9001' });
    expect(answer.status).toBe(404);
  });
});
