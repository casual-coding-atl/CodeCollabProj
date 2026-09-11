import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import { evaluationService } from '../../services/agentic-evaluation/evaluationService';
import { queryKeys } from '../../config/queryClient';
import type {
  CreateEvaluationPayload,
  CreateEvaluationResponse,
} from '../../types/agentic-evaluation/evaluation';

/**
 * Mutation to request a new ideation evaluation.
 * On success, invalidates the project's evaluation list so the new result
 * appears immediately without a manual refetch.
 */
export const useRequestEvaluation = (): UseMutationResult<
  CreateEvaluationResponse,
  Error,
  CreateEvaluationPayload
> => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: evaluationService.createEvaluation,
    onSuccess: (data, variables) => {
      // Immediately prepend the new evaluation into the cached list so it
      // appears without waiting for the background refetch.
      queryClient.setQueryData<import('../../types/agentic-evaluation/evaluation').Evaluation[]>(
        queryKeys.evaluations.list(variables.projectId),
        (old) => [data.evaluation, ...(old ?? [])],
      );
      // Also invalidate so the list is kept consistent with the server.
      queryClient.invalidateQueries({
        queryKey: queryKeys.evaluations.list(variables.projectId),
      });
    },
  });
};

export default useRequestEvaluation;
