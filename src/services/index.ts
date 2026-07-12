// Central export for all services

// Named exports
export { authService } from './authService';
export { projectsService } from './projectsService';
export { commentsService } from './commentsService';
export { usersService } from './usersService';
export { adminService } from './adminService';

// Re-export default exports as well
export { default as authServiceDefault } from './authService';
export { default as projectsServiceDefault } from './projectsService';
export { default as commentsServiceDefault } from './commentsService';
export { default as usersServiceDefault } from './usersService';
export { default as adminServiceDefault } from './adminService';

// Re-export types from services
export type { AuthServiceInterface } from './authService';
export type {
  ProjectFilters,
  ProjectUpdatePayload,
  CollaborationRequestPayload,
  DeleteProjectResponse,
  JoinLeaveResponse,
  CollaborationResponse,
  ProjectsServiceInterface,
} from './projectsService';
export type {
  UserSearchParams,
  SendMessageData,
  UserStats,
  ProfileUpdateResponse,
  MessageResponse,
  AvatarUploadResponse,
  FollowResponse,
  UsersServiceInterface,
} from './usersService';
export type {
  CreateCommentData,
  UpdateCommentData,
  DeleteCommentResponse,
  CommentsServiceInterface,
} from './commentsService';
export type {
  DashboardStats,
  AdminUserQueryParams,
  PaginatedUsersResponse,
  RoleUpdateData,
  SuspensionData,
  SystemLogEntry,
  SystemLogsQueryParams,
  PaginatedLogsResponse,
  AdminOperationResponse,
  AdminServiceInterface,
} from './adminService';
