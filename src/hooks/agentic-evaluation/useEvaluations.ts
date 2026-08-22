import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { evaluationService } from '../../services/agentic-evaluation/evaluationService';
import { queryKeys } from '../../config/queryClient';
import type { Evaluation } from '../../types/agentic-evaluation/evaluation';

/**
 * Fetch all evaluations for a project, newest-first.
 * Only succeeds for the project owner (server enforces this).
 */
export const useProjectEvaluations = (
  projectId: string | undefined
): UseQueryResult<Evaluation[], Error> => {
  return useQuery({
    queryKey: queryKeys.evaluations.list(projectId ?? ''),
    queryFn: async () => {
      const res = await evaluationService.getProjectEvaluations(projectId as string);
      return res.evaluations;
    },
    enabled: !!projectId,
    staleTime: 0,
    gcTime: 10 * 60 * 1000,
  });
};

export default useProjectEvaluations;
