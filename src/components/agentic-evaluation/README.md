# Agentic Evaluation Framework

Discretionary, on-demand agentic evaluation of CodeCollab user projects. Project owners can request an AI-powered evaluation at any stage (currently Phase 1: ideation). The evaluator is Claude (Anthropic) and requires `ANTHROPIC_API_KEY` to be configured in the server environment.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Folder Structure](#folder-structure)
- [Phase 1: Ideation Evaluation](#phase-1-ideation-evaluation)
- [API Endpoints](#api-endpoints)
- [Data Model](#data-model)
- [Components](#components)
- [Hooks](#hooks)
- [Service Layer](#service-layer)
- [Type Definitions](#type-definitions)
- [Configuration](#configuration)
- [Error Handling](#error-handling)
- [Rolling Cap](#rolling-cap)
- [Extending with Future Phases](#extending-with-future-phases)

---

## Architecture Overview

```
Browser (ProjectDetail → Evaluation tab)
  └─ EvaluationRequestForm        fills in README fields
  └─ useRequestEvaluation         POST /api/evaluations
       └─ evaluationService       axios wrapper
            └─ api.evaluations.ts route handler (TanStack Start)
                 ├─ validates input & ownership
                 ├─ blocks concurrent pending evaluations
                 ├─ enforces rolling 3-doc cap
                 ├─ calls claude.ts → Anthropic Messages API
                 └─ saves completed Evaluation doc → MongoDB
  └─ useProjectEvaluations        GET /api/projects/:id/evaluations
  └─ EvaluationCard               summary row (score, date, expand toggle)
  └─ EvaluationResults            full findings display
```

Access control is **owner-only**: the server checks `project.owner === user._id` on every evaluation endpoint. The Evaluation tab in the UI is also gated on `isOwner`.

---

## Folder Structure

```
src/
├── components/agentic-evaluation/
│   ├── EvaluationCard.tsx          Summary row: score badge, date, expand toggle
│   ├── EvaluationRequestForm.tsx   7-field README form; submits to useRequestEvaluation
│   ├── EvaluationResults.tsx       Full findings display: score bar, per-dimension findings,
│   │                               optional Reality Check section, action items
│   └── README.md                   This file
│
├── hooks/agentic-evaluation/
│   ├── index.ts                    Re-exports all hooks in this directory
│   ├── useEvaluations.ts           useProjectEvaluations(projectId) — GET list
│   └── useRequestEvaluation.ts     useRequestEvaluation() — POST mutation
│
├── services/agentic-evaluation/
│   └── evaluationService.ts        Axios calls to /api/evaluations/* and
│                                   /api/projects/:id/evaluations
│
├── types/agentic-evaluation/
│   └── evaluation.ts               IdeationReadmeInput, EvaluationFinding,
│                                   IdeationEvaluationFindings, Evaluation,
│                                   CreateEvaluationPayload, CreateEvaluationResponse,
│                                   EvaluationListResponse
│
├── routes/
│   ├── api.evaluations.ts          POST /api/evaluations
│   ├── api.evaluations.$id.ts      GET  /api/evaluations/:id
│   └── api.projects.$id.evaluations.ts  GET /api/projects/:id/evaluations
│
└── server/
    ├── claude.ts                   Thin fetch wrapper for Anthropic Messages API
    └── models.ts                   Evaluation, EvaluationDoc, MAX_EVALUATIONS_PER_TYPE
```

---

## Phase 1: Ideation Evaluation

The user fills in a structured README form with seven fields:

| Field | Required | Description |
|---|---|---|
| `problemStatement` | ✓ | What problem does this project solve? |
| `targetAudience` | ✓ | Who will use it and in what context? |
| `coreFeatures` | ✓ | Must-have features for the first working version |
| `techApproach` | | Tech stack or architecture in mind (optional) |
| `repositoryUrl` | | GitHub repository URL (optional — enables Reality Check) |
| `successMetrics` | ✓ | How will you know if the project succeeded? |
| `timelineAndConstraints` | ✓ | Timeline, team size, budget, or constraints |
| `risksAndQuestions` | ✓ | Known risks and open questions |

Claude evaluates the submission across **six core dimensions**:

1. **Clarity of Intent** — Is the problem and goal clearly articulated?
2. **Scope & Prioritisation Realism** — Is the MVP scope sensible and achievable?
3. **User Need Validation** — Is there evidence the target audience actually has this problem?
4. **Feasibility Assessment** — Is the technical approach and timeline realistic?
5. **Completeness of Vision** — Are success metrics, risks, and constraints well-considered?
6. **Differentiation** — Does this have a clear angle over existing solutions?

**Seventh dimension — Reality Check** (only when a repository URL is provided): the server fetches the linked GitHub repository's README and file tree via the GitHub API and injects them as evidence into the Claude prompt. Claude then compares the submitted README pitch against what actually exists in the codebase, calling out confirmations and gaps by repository name.

The response is a **readiness score 1–5** plus per-dimension findings and 3–5 action items. The score is based solely on the submitted README fields — repository evidence does not affect it.

---

## API Endpoints

### `POST /api/evaluations`
Create a new ideation evaluation. Owner-only.

**Request body:**
```json
{
  "projectId": "<ObjectId>",
  "input": {
    "problemStatement": "...",
    "targetAudience": "...",
    "coreFeatures": "...",
    "techApproach": "...",
    "repositoryUrl": "https://github.com/owner/repo",
    "successMetrics": "...",
    "timelineAndConstraints": "...",
    "risksAndQuestions": "..."
  }
}
```

**Responses:**
- `201` — `{ message, evaluation }` — evaluation completed synchronously
- `400` — missing or empty required field
- `403` — not the project owner
- `404` — project not found
- `409` — an evaluation is already pending
- `503` — `ANTHROPIC_API_KEY` not configured
- `502` — Claude call failed or returned unparseable JSON

### `GET /api/evaluations/:id`
Fetch a single evaluation by ID. Only the requesting user (userId match) may read it.

### `GET /api/projects/:id/evaluations`
List all evaluations for a project, newest-first. Owner-only.

---

## Data Model

Defined in [`src/server/models.ts`](../../server/models.ts):

```
Evaluation {
  _id:          ObjectId
  projectId:    ObjectId (ref: Project)
  userId:       ObjectId (ref: User)
  agentType:    'ideation'
  status:       'pending' | 'completed' | 'failed'
  input:        IdeationReadmeInput
  evidence?:    Array<{ owner, name, readable, readmeBytes, fileCount }>
                  (summary metadata for each linked repo; stored on creation)
  findings?:    IdeationEvaluationFindings   (present when status === 'completed')
  userNotes?:   string
  requestedAt:  Date
  completedAt?: Date
}
```

MongoDB indexes:
- `{ projectId, agentType, requestedAt: -1 }` — list query (newest-first)
- `{ projectId, agentType, requestedAt: 1 }` — rolling-cap trim (find oldest)

`MAX_EVALUATIONS_PER_TYPE = 3` — exported constant used by the route handler.

---

## Components

### `EvaluationRequestForm`
Renders the 8-field README form (including the optional `repositoryUrl`). Pre-fills `problemStatement` from the project description and pre-fills fields from the most recent evaluation's input when one exists. Accepts `isPending` and `error` props from the parent mutation.

### `EvaluationCard`
A compact summary row showing the readiness score (colour-coded), evaluation date, and an expand/collapse toggle. Renders a `'Pending…'` or `'Failed'` badge when `findings` is absent.

### `EvaluationResults`
Full findings display for a completed evaluation:
- Score bar (5 filled/empty segments) + score badge with label
- One-paragraph summary
- Per-dimension findings (assessment + optional suggestion), with the **Reality Check** finding rendered last with a distinct styled block when present
- Numbered action items

---

## Hooks

### `useProjectEvaluations(projectId)`
TanStack Query hook. Fetches the evaluation list from `GET /api/projects/:id/evaluations`. Returns `Evaluation[]`. Enabled only when `projectId` is truthy. `staleTime: 0` so a fresh list is always fetched on tab focus.

### `useRequestEvaluation()`
TanStack Query mutation. POSTs to `/api/evaluations`. On success, prepends the new evaluation into the cached list and then invalidates the query to keep it consistent. Claude calls typically complete in 10–30 s; the server-side fetch timeout is 60 seconds.

---

## Service Layer

`evaluationService` in [`src/services/agentic-evaluation/evaluationService.ts`](../../services/agentic-evaluation/evaluationService.ts):

| Method | HTTP | Path |
|---|---|---|
| `createEvaluation(payload, config?)` | POST | `/api/evaluations` |
| `getEvaluation(id)` | GET | `/api/evaluations/:id` |
| `getProjectEvaluations(projectId)` | GET | `/api/projects/:id/evaluations` |

---

## Type Definitions

All in [`src/types/agentic-evaluation/evaluation.ts`](../../types/agentic-evaluation/evaluation.ts):

- `IdeationReadmeInput` — the 8 form fields (including optional `repositoryUrl`)
- `EvaluationFinding` — `{ dimension, assessment, suggestion? }`
- `IdeationEvaluationFindings` — `{ summary, findings[], actionItems[], readinessScore }`
- `Evaluation` — full API response shape (client-side; not a Mongoose document)
- `CreateEvaluationPayload` / `CreateEvaluationResponse` / `EvaluationListResponse` — API contract types

---

## Configuration

Add to `.env`:

```env
# Required for AI evaluations. Get a key at https://console.anthropic.com.
# Without this the Evaluation tab is visible but "Run Evaluation" returns 503.
ANTHROPIC_API_KEY=sk-ant-...
```

The model is set in [`src/server/claude.ts`](../../server/claude.ts) as `DEFAULT_MODEL`. The per-request timeout is 60 seconds server-side (`AbortSignal.timeout`).

---

## Error Handling

| Condition | Server response | UI display |
|---|---|---|
| `ANTHROPIC_API_KEY` not set | 503 | Error alert in form |
| Concurrent pending evaluation | 409 | Error alert in form |
| Claude API error | 502 | Error alert in form |
| Unparseable Claude JSON | 502 | Error alert in form |
| Not project owner | 403 | Error alert in form |

The route is **synchronous** — the Claude call completes before the HTTP response. This keeps the implementation simple at the cost of a long-lived request (~10–30 s).

---

## Rolling Cap

At most `MAX_EVALUATIONS_PER_TYPE` (3) evaluations of the same `agentType` are kept per project. When the cap is reached, the oldest document is deleted **before** the new one is inserted, so the collection never exceeds 3 per (project, type) pair. This is enforced in the route handler, not in a Mongoose hook.

---

## Extending with Future Phases

To add a new evaluation type (e.g. `code-review`):

1. Add the type to `EVALUATION_AGENT_TYPES` in `models.ts` and to `EvaluationAgentType` in the types file.
2. Define a new input schema in `models.ts` alongside `ideationInputSchema`.
3. Add a new findings interface alongside `IdeationEvaluationFindings`.
4. Create a new route (e.g. `api.evaluations.code-review.ts`) with its own system prompt.
5. Add a corresponding form component and results component.
6. The rolling cap and ownership guard are reusable as-is.
