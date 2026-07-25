import { test, expect, request, type APIRequestContext } from '@playwright/test';

/**
 * Linking a repository to a project, through the real API (PRD #88, phase 2).
 *
 * GitHub is stubbed for the whole suite — `GITHUB_API_BASE` points the server's
 * outbound edge at e2e/fixtures/github-api.mjs — so `e2e-org/codecollab-web`
 * (id 9001) resolves, and anything else the fixture does not know 404s. That
 * makes the assertions below about *this app*: who may link, what it stores,
 * and what it refuses.
 *
 * These go through the API rather than the edit page on purpose: the rules are
 * the endpoint's, and asserting them here keeps the check independent of how
 * the form happens to be laid out.
 */

/**
 * Resolved the same way playwright.config.ts resolves it. Read here rather than
 * taken from the `baseURL` fixture because these tests share one signed-in
 * context across the file, and `beforeAll` only sees worker-scoped fixtures.
 */
const BASE_URL = process.env.E2E_BASE_URL || `http://localhost:${Number(process.env.E2E_PORT) || 3100}`;

const EMAIL = process.env.E2E_EMAIL || 'e2e@codecollab.test';
const PASSWORD = process.env.E2E_PASSWORD || 'e2e-password-123';
const EMAIL2 = process.env.E2E_EMAIL2 || 'e2e2@codecollab.test';
const PASSWORD2 = process.env.E2E_PASSWORD2 || 'e2e-password-123';

const REPO_URL = 'https://github.com/e2e-org/codecollab-web';
const REPO_ID = 9001;

/** A request context signed in as one of the seeded members. */
async function signedIn(email: string, password: string) {
  const context = await request.newContext({ baseURL: BASE_URL });
  const response = await context.post('/api/auth/sign-in/email', { data: { email, password } });
  expect(response.ok(), `sign-in for ${email} failed: ${response.status()}`).toBeTruthy();
  return context;
}

/** A project of the signed-in member's own, with no repositories yet. */
async function createProject(api: APIRequestContext): Promise<string> {
  const response = await api.post('/api/projects', {
    data: {
      title: `Repo linking ${Date.now()}`,
      description: 'A project created by the repo-linking end-to-end test.',
      status: 'ideation',
    },
  });
  expect(response.status(), await response.text()).toBe(201);
  const project = await response.json();
  return project._id as string;
}

// Serial: these share one project and tell a story about it — link it, fail to
// link it twice, unlink it — and the suite is otherwise fullyParallel.
test.describe.serial('linking repositories to a project', () => {
  let owner: APIRequestContext;
  let projectId: string;

  test.beforeAll(async () => {
    owner = await signedIn(EMAIL, PASSWORD);
    projectId = await createProject(owner);
  });

  test.afterAll(async () => {
    await owner.delete(`/api/projects/${projectId}`).catch(() => undefined);
    await owner.dispose();
  });

  test('the owner links a public repository, and GitHub’s id is what is stored', async () => {
    const response = await owner.post(`/api/projects/${projectId}/repos`, {
      data: { url: REPO_URL },
    });

    expect(response.status(), await response.text()).toBe(201);
    const body = await response.json();
    expect(body.repo).toMatchObject({ repoId: REPO_ID, owner: 'e2e-org', name: 'codecollab-web' });
    expect(body.linkedRepos).toHaveLength(1);

    // And it is on the project itself, not just in the answer.
    const project = await owner.get(`/api/projects/${projectId}`).then((r) => r.json());
    expect(project.linkedRepos.map((r: { repoId: number }) => r.repoId)).toContain(REPO_ID);
  });

  test('the same repository cannot be linked twice', async () => {
    const response = await owner.post(`/api/projects/${projectId}/repos`, {
      data: { url: REPO_URL },
    });
    expect(response.status()).toBe(409);
    expect((await response.json()).message).toMatch(/already linked/i);
  });

  test('a repository GitHub does not have is refused, with a reason', async () => {
    const response = await owner.post(`/api/projects/${projectId}/repos`, {
      data: { url: 'https://github.com/e2e-org/no-such-repository' },
    });
    expect(response.status()).toBe(404);
    expect((await response.json()).message).toMatch(/no public repository/i);
  });

  test('a link that is not a GitHub repository is refused', async () => {
    const response = await owner.post(`/api/projects/${projectId}/repos`, {
      data: { url: 'https://gitlab.com/e2e-org/codecollab-web' },
    });
    expect(response.status()).toBe(400);
    expect((await response.json()).message).toMatch(/github\.com/i);
  });

  test('a signed-out visitor cannot link anything', async () => {
    const anonymous = await request.newContext({ baseURL: BASE_URL });
    const response = await anonymous.post(`/api/projects/${projectId}/repos`, {
      data: { url: REPO_URL },
    });
    expect(response.status()).toBe(401);
    await anonymous.dispose();
  });

  test('another member cannot link to, or unlink from, someone else’s project', async () => {
    const other = await signedIn(EMAIL2, PASSWORD2);

    const link = await other.post(`/api/projects/${projectId}/repos`, { data: { url: REPO_URL } });
    expect(link.status()).toBe(403);

    const unlink = await other.delete(`/api/projects/${projectId}/repos/${REPO_ID}`);
    expect(unlink.status()).toBe(403);

    await other.dispose();
  });

  test('the owner unlinks it again', async () => {
    const response = await owner.delete(`/api/projects/${projectId}/repos/${REPO_ID}`);
    expect(response.status()).toBe(200);
    expect((await response.json()).linkedRepos).toHaveLength(0);

    // Unlinking something that is no longer there is a 404, not a silent 200.
    const again = await owner.delete(`/api/projects/${projectId}/repos/${REPO_ID}`);
    expect(again.status()).toBe(404);
  });
});

test.describe('the GitHub token stays on the server', () => {
  /**
   * The endpoints Better Auth mounts that would hand a browser the member's
   * decrypted OAuth token (PRD #88, story 24). They are disabled in
   * src/server/auth.ts; this is the same claim from outside, over HTTP, where a
   * script in a signed-in tab would be making the request.
   */
  test('the token endpoints are not there', async () => {
    const api = await signedIn(EMAIL, PASSWORD);

    for (const path of ['/get-access-token', '/refresh-token', '/account-info']) {
      const response = await api.post(`/api/auth${path}`, { data: { providerId: 'github' } });
      expect(response.status(), `POST /api/auth${path} must not exist`).toBe(404);
    }

    await api.dispose();
  });
});
