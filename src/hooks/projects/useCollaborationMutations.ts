import { useMutation, useQueryClient, UseMutationResult } from '@tanstack/react-query';
import {
  projectsService,
  CollaborationRequestPayload,
  JoinLeaveResponse,
  CollaborationResponse,
} from '../../services/projectsService';
import { queryKeys } from '../../config/queryClient';
import type { Project } from '../../types';

/**
 * Hook for joining a project
 */
export const useJoinProject = (): UseMutationResult<JoinLeaveResponse, Error, string, unknown> => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: projectsService.join,
    onSuccess: (response: JoinLeaveResponse, projectId: string) => {
      const updatedProject = response.project;
      if (!updatedProject) return;

      // Update the project in the detail cache
      queryClient.setQueryData(queryKeys.projects.detail(projectId), updatedProject);

      // Update the project in any project lists
      queryClient.setQueriesData<Project[]>(
        { queryKey: queryKeys.projects.lists() },
        (oldProjects) => {
          if (!oldProjects) return oldProjects;
          return oldProjects.map((project) =>
            project.id === projectId ? updatedProject : project
          );
        }
      );

      console.log('✅ Successfully joined project:', updatedProject);
    },
    onError: (error: Error) => {
      console.error('❌ Failed to join project:', error);
    },
  });
};

/**
 * Hook for leaving a project
 */
export const useLeaveProject = (): UseMutationResult<JoinLeaveResponse, Error, string, unknown> => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: projectsService.leave,
    onSuccess: (response: JoinLeaveResponse, projectId: string) => {
      const updatedProject = response.project;
      if (!updatedProject) return;

      // Update the project in the detail cache
      queryClient.setQueryData(queryKeys.projects.detail(projectId), updatedProject);

      // Update the project in any project lists
      queryClient.setQueriesData<Project[]>(
        { queryKey: queryKeys.projects.lists() },
        (oldProjects) => {
          if (!oldProjects) return oldProjects;
          return oldProjects.map((project) =>
            project.id === projectId ? updatedProject : project
          );
        }
      );

      console.log('✅ Successfully left project:', updatedProject);
    },
    onError: (error: Error) => {
      console.error('❌ Failed to leave project:', error);
    },
  });
};

/**
 * Hook for requesting collaboration on a project
 */
export const useRequestCollaboration = (): UseMutationResult<
  CollaborationResponse,
  Error,
  string,
  unknown
> => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: projectsService.requestCollaboration,
    onSuccess: (data: CollaborationResponse, projectId: string) => {
      // Invalidate the project detail to refresh collaboration requests
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(projectId) });

      console.log('✅ Collaboration request sent successfully:', data);
    },
    onError: (error: Error) => {
      console.error('❌ Failed to send collaboration request:', error);
    },
  });
};

/**
 * Hook for handling collaboration requests (approve/reject)
 */
export const useHandleCollaborationRequest = (): UseMutationResult<
  CollaborationResponse,
  Error,
  CollaborationRequestPayload,
  unknown
> => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: projectsService.handleCollaborationRequest,
    onSuccess: (data: CollaborationResponse, { projectId }: CollaborationRequestPayload) => {
      // Invalidate the project detail to refresh collaboration requests
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(projectId) });

      // Update the project in any project lists
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.lists() });

      console.log('✅ Collaboration request handled successfully:', data);
    },
    onError: (error: Error) => {
      console.error('❌ Failed to handle collaboration request:', error);
    },
  });
};

export default {
  useJoinProject,
  useLeaveProject,
  useRequestCollaboration,
  useHandleCollaborationRequest,
};
