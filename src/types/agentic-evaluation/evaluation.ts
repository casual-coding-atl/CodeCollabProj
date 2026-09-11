/**
 * TypeScript types for the Agentic Evaluation Framework — Phase 1 (Ideation).
 * These represent API response shapes (client-side), not Mongoose documents.
 */

// ── Enums ────────────────────────────────────────────────────────────────────

export type EvaluationStatus = 'pending' | 'completed' | 'failed';

export type EvaluationAgentType = 'ideation';
// Future: 'code-review' | 'ux-eval' | 'security-scan' | 'architecture-review' | 'performance-audit'

// ── Ideation README input ─────────────────────────────────────────────────────

/**
 * The structured README fields the user fills in before requesting a Phase 1
 * ideation evaluation. Every field maps to a section of the evaluation prompt.
 */
export interface IdeationReadmeInput {
  /** What problem does this project solve and why does it matter? */
  problemStatement: string;
  /** Who will use this and in what context? */
  targetAudience: string;
  /** What are the core MVP features? */
  coreFeatures: string;
  /** Tech stack or approach, if known. Optional. */
  techApproach?: string;
  /** How will success be measured? */
  successMetrics: string;
  /** Timeline, resources, known constraints. */
  timelineAndConstraints: string;
  /** Known risks and open questions. */
  risksAndQuestions: string;
}

// ── Evaluation output ─────────────────────────────────────────────────────────

/**
 * A single structured finding returned by the agent.
 */
export interface EvaluationFinding {
  /** Short label, e.g. "Clarity of Intent" */
  dimension: string;
  /** The agent's assessment for this dimension. */
  assessment: string;
  /** Optional concrete suggestion or action item. */
  suggestion?: string;
}

/**
 * The structured output of a completed ideation evaluation.
 */
export interface IdeationEvaluationFindings {
  /** One-paragraph executive summary. */
  summary: string;
  /** Per-dimension findings (clarity, scope, feasibility, etc.) */
  findings: EvaluationFinding[];
  /** Concrete next steps the owner should take. */
  actionItems: string[];
  /**
   * Readiness score 1–5.
   * 1 = very early / unclear  …  5 = well-defined, ready to build.
   */
  readinessScore: 1 | 2 | 3 | 4 | 5;
}

// ── Main entity ───────────────────────────────────────────────────────────────

/**
 * An Evaluation as returned from the API.
 * Up to 3 evaluations of the same agentType are retained per project;
 * the oldest is deleted when a 4th is created (rolling window).
 */
export interface Evaluation {
  id: string;
  projectId: string;
  /** The user who requested this evaluation. */
  userId: string;
  agentType: EvaluationAgentType;
  status: EvaluationStatus;
  /** The README input submitted by the user. */
  input: IdeationReadmeInput;
  /**
   * Structured findings — present only when status === 'completed'.
   * Null/undefined while pending or if the agent call failed.
   */
  findings?: IdeationEvaluationFindings;
  /** Free-form notes the owner can add after reading the evaluation. */
  userNotes?: string;
  requestedAt: string;
  completedAt?: string;
}

// ── API payload types ─────────────────────────────────────────────────────────

export interface CreateEvaluationPayload {
  projectId: string;
  input: IdeationReadmeInput;
}

export interface CreateEvaluationResponse {
  message: string;
  evaluation: Evaluation;
}

export interface EvaluationListResponse {
  evaluations: Evaluation[];
}
