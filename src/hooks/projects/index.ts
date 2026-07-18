// Central export for all project hooks
export {
  useProjects,
  useProjectSearch,
  useUserProjects,
  useProjectsByStatus,
  useFeaturedProjects,
} from './useProjects';

export { useProject } from './useProject';

export { useCreateProject, useUpdateProject, useDeleteProject } from './useProjectMutations';

export {
  useJoinProject,
  useLeaveProject,
  useRequestCollaboration,
  useHandleCollaborationRequest,
} from './useCollaborationMutations';

// Re-export defaults
export { default as useProjectsDefault } from './useProjects';
export { default as useProjectDefault } from './useProject';
export { default as projectMutations } from './useProjectMutations';
export { default as collaborationMutations } from './useCollaborationMutations';
