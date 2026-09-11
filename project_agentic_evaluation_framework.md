---
name: agentic-evaluation-framework
description: Agentic framework for evaluating CodeCollab user projects from ideation to production. Phase 1 focuses on README-based ideation evaluation.
metadata: 
  node_type: memory
  type: project
  originSessionId: 59b505d7-e5b4-45b5-befa-73dbfaa5d0c1
  modified: 2026-07-28T15:01:50.349Z
---

## Agentic Evaluation Framework for CodeCollab

**Status:** Architecture sketched (2026-07-28), Phase 1 design complete

**Goal:** Provide discretionary, on-demand agentic evaluation of user projects recorded in their portfolios. Agents give feedback across multiple evaluation types (code review, feature testing, UX eval, security scan, architecture review, performance audit).

**Why:** Facilitate project progress and collaboration through AI-driven feedback. Users can request evaluations at any stage (ideation to production). Privacy is user-controlled. Framework capacity augments over time.

**How to apply:** Start with Phase 1 (ideation evaluation via README). User fills structured README template → Claude API evaluates vision/scope/feasibility → structured findings stored in MongoDB `evaluations` collection. Discretionary sharing with collaborators.

## Phase 1: Ideation Evaluation (MVP)

**Input:** User-completed README covering:
- Problem statement & intent
- Target audience & use case
- Core features (MVP definition)
- Tech approach (if known)
- Success metrics
- Timeline & constraints
- Known risks & open questions

**Agent:** Ideation evaluator (Claude API prompt in `ideation-readme-template.md`)

**Output:** Structured evaluation covering:
- Clarity of intent
- Scope & prioritization realism
- User need validation
- Feasibility assessment
- Completeness of vision
- Differentiation/competitive advantage
- Actionable next steps (e.g., "talk to 5 users", "cut scope", "define metrics")
- Readiness score (1-5)

**Key principle:** Tone is encouraging but honest. Early-stage feedback, not criticism.

## Data Model

**Evaluation collection schema:**
- `projectId`, `userId` (who requested), `agentType`, `status`
- `scope` (files, repos, features, focus area)
- `findings` (summary, severity, structured findings per type, action items)
- `aiResponse`, `userNotes`, `reactions` (👍, etc)
- `requestedAt`, `completedAt`

## Privacy & Collaboration

- Evaluations are **private to project owner by default**
- User controls sharing with team members or public
- No automatic broadcast of evaluations

## Future Phases

Phase 2: Multi-agent expansion (feature-test, ux-eval, security-scan, architecture-review, performance-audit)
Phase 3: Team notifications, analytics, export, performance auditing
