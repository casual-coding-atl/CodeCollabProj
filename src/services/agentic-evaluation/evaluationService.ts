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

/** Create a new ideation evaluation for a project (owner only). */
async function createEvaluation(
  payload: CreateEvaluationPayload
): Promise<CreateEvaluationResponse> {
  const response = await api.post<CreateEvaluationResponse>('/evaluations', payload);
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
