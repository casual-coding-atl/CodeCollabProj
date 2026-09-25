import { test, expect, type APIRequestContext } from '@playwright/test';
import { GITHUB_FIXTURE_URL } from '../playwright.config';

/**
 * E2E for the Agentic Evaluation Framework — Phase 1 + Evidence (Reality Check).
 *
 * Both the GitHub API and the Claude API are stubbed (see e2e/fixtures/). No
 * live network calls are made and no real API keys are needed.
 *
 * Two acceptance scenarios:
 *
 *  1. Project WITH a readable linked repository → evaluation contains a
 *     "Reality Check" finding and the GitHub fixture was asked for README + tree.
 *
 *  2. Project WITHOUT linked repositories → evaluation contains no
 *     "Reality Check" finding and the Claude fixture received no evidence section.
 */

const EMAIL = process.env.E2E_EMAIL || 'e2e@codecollab.test';
const PASSWORD = process.env.E2E_PASSWORD || 'e2e-password-123';

/** Sign in and return an authenticated request context (reuses the page cookie). */
async function signIn(api: APIRequestContext) {
  const res = await api.post('/api/auth/sign-in/email', {
    data: { email: EMAIL, password: PASSWORD },
  });
  // Better Auth sets the session cookie automatically on the context.
  expect(res.ok(), `sign-in failed: ${await res.text()}`).toBeTruthy();
}

/** Find a seeded project by title. */
async function projectByTitle(api: APIRequestContext, title: string) {
  const projects = await api.get('/api/projects').then((r) => r.json());
  const project = projects.find((p: { title: string }) => p.title === title);
  expect(project?._id, `expected seeded project "${title}"`).toBeTruthy();
  return project as { _id: string; title: string };
}

/** How many times the GitHub fixture has been asked for a path. */
async function githubHits(api: APIRequestContext, path: string): Promise<number> {
  const stats = await api.get(`${GITHUB_FIXTURE_URL}/__stats`).then((r) => r.json());
  return (stats.hits as Record<string, number>)[path] ?? 0;
}

/** Minimal valid evaluation input. */
const EVAL_INPUT = {
  problemStatement: 'Developers struggle to find collaborators for side projects.',
  targetAudience: 'Independent developers and open-source contributors.',
  coreFeatures: 'Project listings, collaboration requests, GitHub repo linking.',
  techApproach: 'TypeScript, React, MongoDB.',
  successMetrics: '100 active projects within 3 months.',
  timelineAndConstraints: '3 months, solo developer.',
  risksAndQuestions: 'User adoption is the main risk.',
};

test.describe('agentic evaluation — Reality Check evidence', () => {
  test('project with a linked repository produces a Reality Check finding', async ({ request }) => {
    await signIn(request);

    const project = await projectByTitle(request, 'E2E Sample Project');

    // Record baseline hit count before the evaluation so the assertion is not
    // sensitive to other tests that may have warmed the same paths.
    const readmePath = '/repos/e2e-org/codecollab-web/readme';
    const treePath = '/repos/e2e-org/codecollab-web/git/trees/HEAD';
    const readmeBefore = await githubHits(request, readmePath);
    const treeBefore = await githubHits(request, treePath);

    const res = await request.post('/api/evaluations', {
      data: { projectId: project._id, input: EVAL_INPUT },
    });
    expect(res.status(), `evaluation failed: ${await res.text()}`).toBe(201);

    const body = await res.json();
    const evaluation = body.evaluation;

    // ── Reality Check finding must be present ──────────────────────────────
    const findings: Array<{ dimension: string }> = evaluation.findings?.findings ?? [];
    const realityCheck = findings.find((f) => f.dimension === 'Reality Check');
    expect(realityCheck, 'expected a Reality Check finding').toBeTruthy();

    // ── GitHub fixture was asked for README and tree ────────────────────────
    expect(await githubHits(request, readmePath)).toBeGreaterThan(readmeBefore);
    expect(await githubHits(request, treePath)).toBeGreaterThan(treeBefore);

    // ── Six original dimensions still present and score is 1-5 ─────────────
    const dimensions = findings.map((f) => f.dimension);
    expect(dimensions).toContain('Clarity of Intent');
    expect(dimensions).toContain('Scope & Prioritisation Realism');
    expect(dimensions).toContain('User Need Validation');
    expect(dimensions).toContain('Feasibility Assessment');
    expect(dimensions).toContain('Completeness of Vision');
    expect(dimensions).toContain('Differentiation');

    const score = evaluation.findings?.readinessScore;
    expect(score).toBeGreaterThanOrEqual(1);
    expect(score).toBeLessThanOrEqual(5);

    // ── Evidence metadata stored (summary only, not contents) ──────────────
    const evidence: Array<{ owner: string; name: string; readable: boolean }> =
      evaluation.evidence ?? [];
    const repoEvidence = evidence.find(
      (e) => e.owner === 'e2e-org' && e.name === 'codecollab-web',
    );
    expect(repoEvidence?.readable).toBe(true);
  });

  test('project without linked repositories produces no Reality Check finding', async ({ request }) => {
    await signIn(request);

    const project = await projectByTitle(request, 'E2E No-Repos Project');

    const res = await request.post('/api/evaluations', {
      data: { projectId: project._id, input: EVAL_INPUT },
    });
    expect(res.status(), `evaluation failed: ${await res.text()}`).toBe(201);

    const body = await res.json();
    const evaluation = body.evaluation;

    // ── No Reality Check finding ────────────────────────────────────────────
    const findings: Array<{ dimension: string }> = evaluation.findings?.findings ?? [];
    const realityCheck = findings.find((f) => f.dimension === 'Reality Check');
    expect(realityCheck, 'Reality Check must not appear when no repos are linked').toBeUndefined();

    // ── Evidence metadata absent ────────────────────────────────────────────
    expect(evaluation.evidence).toBeFalsy();

    // ── Six original dimensions and score still present ─────────────────────
    expect(findings.length).toBe(6);
    const score = evaluation.findings?.readinessScore;
    expect(score).toBeGreaterThanOrEqual(1);
    expect(score).toBeLessThanOrEqual(5);
  });
});
