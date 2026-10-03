import api from '../../utils/api';
import type {
  Evaluation,
  CreateEvaluationPayload,
  CreateEvaluationResponse,
  EvaluationListResponse,
} from '../../types/agentic-evaluation/evaluation';

/**
 * API client for the Agentic Evaluation Framework — Phase 1.
 * All calls map 1:1 to the server routes in src/routes/api.evaluations.*.ts
 * and src/routes/api.projects.$id.evaluations.ts.
 */

/** Create a new ideation evaluation for a project (owner only).
 *
 * Uses a 90 s timeout — the global axios default is 30 s, which is shorter
 * than the Claude API timeout (60 s). A slow but successful Claude call would
 * cause the browser to show an error even though the evaluation completed.
 * Only this mutation gets the extended timeout; all other API calls keep the
 * existing 30 s default (Issue #93).
 */
async function createEvaluation(
  payload: CreateEvaluationPayload
): Promise<CreateEvaluationResponse> {
  const response = await api.post<CreateEvaluationResponse>('/evaluations', payload, {
    timeout: 90_000,
  });
  return response.data;
}

/** Fetch a single evaluation by ID (owner only). */
async function getEvaluation(id: string): Promise<Evaluation> {
  const response = await api.get<Evaluation>(`/evaluations/${id}`);
  return response.data;
}

/** List all evaluations for a project, newest-first (owner only). */
async function getProjectEvaluations(projectId: string): Promise<EvaluationListResponse> {
  const response = await api.get<EvaluationListResponse>(
    `/projects/${projectId}/evaluations`
  );
  return response.data;
}

export const evaluationService = {
  createEvaluation,
  getEvaluation,
  getProjectEvaluations,
};

export default evaluationService;
