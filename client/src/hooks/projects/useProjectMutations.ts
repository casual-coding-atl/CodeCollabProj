import { useMutation, useQueryClient, UseMutationResult } from '@tanstack/react-query';
import {
  projectsService,
  ProjectUpdatePayload,
  DeleteProjectResponse,
} from '../../services/projectsService';
import { queryKeys, invalidateQueries } from '../../config/queryClient';
import type { Project } from '../../types';

// The API serializes projects with `_id` (no virtual `id`), so cache updates must
// match on whichever identifier is present — otherwise list edits/removals never
// match and lists go stale.
const projectId2 = (p?: Project | null): string | undefined =>
  p ? (p.id ?? (p as Project & { _id?: string })._id) : undefined;

/**
 * Context for optimistic update rollback
 */
interface UpdateMutationContext {
  previousProject: Project | undefined;
  projectId: string;
}

interface DeleteMutationContext {
  previousProject: Project | undefined;
  projectId: string;
}

/**
 * Hook for creating a new project
 */
export const useCreateProject = (): UseMutationResult<
  Project,
  Error,
  Partial<Project>,
  unknown
> => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: projectsService.create,
    onSuccess: (newProject: Project) => {
      // Add the new project to the projects list cache
      queryClient.setQueryData<Project[]>(queryKeys.projects.list(), (oldProjects) => {
        if (!oldProjects) return [newProject];
        return [newProject, ...oldProjects];
      });

      // Invalidate all project lists to ensure consistency
      invalidateQueries.projectLists();

      console.log('✅ Project created successfully:', newProject);
    },
    onError: (error: Error) => {
      console.error('❌ Failed to create project:', error);
    },
  });
};

/**
 * Hook for updating an existing project
 */
export const useUpdateProject = (): UseMutationResult<
  Project,
  Error,
  ProjectUpdatePayload,
  UpdateMutationContext
> => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: projectsService.update,
    onMutate: async ({
      projectId,
      projectData,
    }: ProjectUpdatePayload): Promise<UpdateMutationContext> => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.projects.detail(projectId) });

      // Snapshot the previous value
      const previousProject = queryClient.getQueryData<Project>(
        queryKeys.projects.detail(projectId)
      );

      // Optimistically update the project
      queryClient.setQueryData<Project>(queryKeys.projects.detail(projectId), (oldProject) => {
        if (!oldProject) return oldProject;
        return {
          ...oldProject,
          ...projectData,
        } as Project;
      });

      // Return a context object with the snapshotted value
      return { previousProject, projectId };
    },
    onError: (
      err: Error,
      _variables: ProjectUpdatePayload,
      context: UpdateMutationContext | undefined
    ) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousProject) {
        queryClient.setQueryData(
          queryKeys.projects.detail(context.projectId),
          context.previousProject
        );
      }
      console.error('❌ Failed to update project:', err);
    },
    onSuccess: (updatedProject: Project, { projectId }: ProjectUpdatePayload) => {
      // Update the project in the detail cache
      queryClient.setQueryData(queryKeys.projects.detail(projectId), updatedProject);

      // Update the project in any project lists
      queryClient.setQueriesData<Project[]>(
        { queryKey: queryKeys.projects.lists() },
        (oldProjects) => {
          if (!oldProjects) return oldProjects;
          return oldProjects.map((project) =>
            projectId2(project) === projectId ? updatedProject : project
          );
        }
      );

      console.log('✅ Project updated successfully:', updatedProject);
    },
    onSettled: (
      _data: Project | undefined,
      _error: Error | null,
      variables: ProjectUpdatePayload | undefined
    ) => {
      // Always refetch after error or success
      if (variables?.projectId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(variables.projectId) });
      }
    },
  });
};

/**
 * Hook for deleting a project
 */
export const useDeleteProject = (): UseMutationResult<
  DeleteProjectResponse,
  Error,
  string,
  DeleteMutationContext
> => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: projectsService.delete,
    onMutate: async (projectId: string): Promise<DeleteMutationContext> => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.projects.detail(projectId) });

      // Snapshot the previous value
      const previousProject = queryClient.getQueryData<Project>(
        queryKeys.projects.detail(projectId)
      );

      // Optimistically remove the project from all lists
      queryClient.setQueriesData<Project[]>(
        { queryKey: queryKeys.projects.lists() },
        (oldProjects) => {
          if (!oldProjects) return oldProjects;
          return oldProjects.filter((project) => projectId2(project) !== projectId);
        }
      );

      return { previousProject, projectId };
    },
    onError: (err: Error, _projectId: string, context: DeleteMutationContext | undefined) => {
      // If the mutation fails, add the project back to the lists — but only if it
      // isn't already present, so a rollback can't duplicate it in the list.
      if (context?.previousProject) {
        const restored = context.previousProject;
        queryClient.setQueriesData<Project[]>(
          { queryKey: queryKeys.projects.lists() },
          (oldProjects) => {
            if (!oldProjects) return [restored];
            if (oldProjects.some((p) => projectId2(p) === projectId2(restored))) {
              return oldProjects;
            }
            return [restored, ...oldProjects];
          }
        );
      }
      console.error('❌ Failed to delete project:', err);
    },
    onSuccess: (_data: DeleteProjectResponse, projectId: string) => {
      // Remove the project from the cache
      queryClient.removeQueries({ queryKey: queryKeys.projects.detail(projectId) });

      // Invalidate project lists to ensure consistency
      invalidateQueries.projectLists();

      console.log('✅ Project deleted successfully');
    },
  });
};

export default {
  useCreateProject,
  useUpdateProject,
  useDeleteProject,
};
