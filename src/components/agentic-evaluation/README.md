# Agentic Evaluation Framework

Discretionary, on-demand agentic evaluation of CodeCollab user projects. Users can request evaluations at any stage (ideation to production).

## Folder Structure

- **`components/agentic-evaluation/`** — React components
  - `EvaluationRequestForm.tsx` — form to initiate evaluation
  - `EvaluationResults.tsx` — display structured findings
  - `EvaluationCard.tsx` — summary card for evaluation results
  - etc.

- **`hooks/agentic-evaluation/`** — TanStack Query hooks
  - `useRequestEvaluation.ts` — mutate to create evaluation
  - `useEvaluations.ts` — query evaluations for a project
  - etc.

- **`services/agentic-evaluation/`** — API client
  - `evaluationService.ts` — axios calls to `/api/evaluations/*`

- **`types/agentic-evaluation/`** — TypeScript types
  - `evaluation.ts` — `Evaluation`, `EvaluationFinding`, etc.

- **`prompts/agentic-evaluation/`** — Claude evaluation prompts
  - `ideation-readme-template.md` — Phase 1 ideation evaluator prompt
  - (future prompts for code review, UX eval, security, etc.)

- **`routes/api.evaluations.*.ts`** — API endpoints (in `src/routes/`)
  - `POST /api/evaluations` — create evaluation request
  - `GET /api/evaluations/$id` — fetch evaluation
  - `GET /api/projects/$projectId/evaluations` — list by project
  - etc.

- **Server:** `src/server/`
  - `models.ts` — add `Evaluation` Mongoose model
  - (auth/access rules in `access.ts` if needed)

## Phase 1: Ideation Evaluation (MVP)

Evaluates project README covering problem, audience, features, tech, metrics, timeline, risks.

Output: structured findings on clarity, scope, feasibility, differentiation, next steps, readiness score (1–5).

See `src/server/auth-migration.ts` and related for auth pattern (if evaluation requires specific roles).
