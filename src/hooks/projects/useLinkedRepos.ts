import {
  useMutation,
  useQuery,
  useQueryClient,
  UseMutationResult,
  UseQueryResult,
} from '@tanstack/react-query';
import { projectsService, type LinkedReposResponse } from '../../services/projectsService';
import { queryKeys } from '../../config/queryClient';
import type { LinkedRepo, Project } from '../../types';

/**
 * A project's Linked Repositories.
 *
 * They live on the project document, so these read from the same cache entry as
 * `useProject` — one fetch feeds both — and the mutations simply invalidate it.
 * The server owns every rule (owner-only, three at most, public repositories
 * only) and answers a rejection with a message written for the member, which is
 * what `repoErrorMessage` surfaces.
 */

/** The message the server sent, or the closest thing to it. */
export function repoErrorMessage(error: unknown, fallback = 'Something went wrong'): string {
  const withResponse = error as { response?: { data?: { message?: string } }; message?: string };
  return withResponse?.response?.data?.message || withResponse?.message || fallback;
}

export const useLinkedRepos = (projectId?: string): UseQueryResult<LinkedRepo[], Error> =>
  useQuery<Project, Error, LinkedRepo[]>({
    queryKey: queryKeys.projects.detail(projectId ?? ''),
    queryFn: () => projectsService.getById(projectId as string),
    enabled: !!projectId,
    select: (project) => project?.linkedRepos ?? [],
  });

/** Link a repository by pasting its GitHub URL. */
export const useLinkRepo = (
  projectId: string
): UseMutationResult<LinkedReposResponse, Error, string> => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (url: string) => projectsService.linkRepo({ projectId, url }),
    // A rejected link (private repo, cap reached) is an answer, not a blip —
    // retrying it just makes the member wait for the same message.
    retry: 0,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(projectId) });
    },
  });
};

/** Unlink a repository by GitHub's numeric repo id. */
export const useUnlinkRepo = (
  projectId: string
): UseMutationResult<LinkedReposResponse, Error, number> => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (repoId: number) => projectsService.unlinkRepo({ projectId, repoId }),
    retry: 0,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(projectId) });
    },
  });
};

export default { useLinkedRepos, useLinkRepo, useUnlinkRepo };
