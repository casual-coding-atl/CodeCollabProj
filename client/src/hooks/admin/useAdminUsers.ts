import {
  useQuery,
  useMutation,
  useQueryClient,
  UseQueryResult,
  UseMutationResult,
  QueryClient,
} from '@tanstack/react-query';
import {
  adminService,
  AdminUserQueryParams,
  PaginatedUsersResponse,
  RoleUpdateData,
  SuspensionData,
  AdminOperationResponse,
  UserDetailsResponse,
} from '../../services/adminService';
import type { User } from '../../types';

/**
 * Hook for fetching all users with filtering for admin purposes
 * @param params - Query parameters for filtering users
 * @returns UseQueryResult containing paginated users data
 */
export const useAdminUsers = (
  params: AdminUserQueryParams = {}
): UseQueryResult<PaginatedUsersResponse, Error> => {
  return useQuery({
    queryKey: ['admin', 'users', params],
    queryFn: () => adminService.getAllUsers(params),
    placeholderData: (previousData) => previousData,
    staleTime: 30 * 1000, // 30 seconds
  });
};

/**
 * Hook for fetching specific user details for admin purposes
 * @param userId - The ID of the user to fetch
 * @returns UseQueryResult containing user details
 */
export const useAdminUserDetails = (
  userId: string | undefined
): UseQueryResult<UserDetailsResponse, Error> => {
  return useQuery({
    queryKey: ['admin', 'users', userId],
    queryFn: () => adminService.getUserDetails(userId as string),
    enabled: !!userId,
    staleTime: 60 * 1000, // 1 minute
  });
};

/**
 * Mutation variables for updating user role
 */
interface UpdateUserRoleVariables {
  userId: string;
  roleData: RoleUpdateData;
}

/**
 * Mutation variables for suspending a user
 */
interface SuspendUserVariables {
  userId: string;
  suspensionData?: Partial<SuspensionData>;
}

/**
 * Mutation variables for deleting a user
 */
interface DeleteUserVariables {
  userId: string;
  permanent?: boolean;
}

/**
 * Return type for useAdminUserMutations hook
 */
interface AdminUserMutationsReturn {
  updateUserRole: UseMutationResult<AdminOperationResponse, Error, UpdateUserRoleVariables>;
  suspendUser: UseMutationResult<AdminOperationResponse, Error, SuspendUserVariables>;
  unsuspendUser: UseMutationResult<AdminOperationResponse, Error, string>;
  deleteUser: UseMutationResult<AdminOperationResponse, Error, DeleteUserVariables>;
}

/**
 * Helper function to invalidate admin queries after mutations
 */
const invalidateAdminQueries = (queryClient: QueryClient, userId?: string): void => {
  queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
  if (userId) {
    queryClient.invalidateQueries({ queryKey: ['admin', 'users', userId] });
  }
  queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
};

/**
 * Hook for user management mutations (update role, suspend, unsuspend, delete)
 * @returns Object containing mutation functions for user management
 */
export const useAdminUserMutations = (): AdminUserMutationsReturn => {
  const queryClient = useQueryClient();

  const updateUserRole = useMutation<AdminOperationResponse, Error, UpdateUserRoleVariables>({
    mutationFn: ({ userId, roleData }) => adminService.updateUserRole(userId, roleData),
    onSuccess: (_data, variables) => {
      invalidateAdminQueries(queryClient, variables.userId);
    },
  });

  const suspendUser = useMutation<AdminOperationResponse, Error, SuspendUserVariables>({
    mutationFn: ({ userId, suspensionData }) => adminService.suspendUser(userId, suspensionData),
    onSuccess: (_data, variables) => {
      invalidateAdminQueries(queryClient, variables.userId);
    },
  });

  const unsuspendUser = useMutation<AdminOperationResponse, Error, string>({
    mutationFn: (userId) => adminService.unsuspendUser(userId),
    onSuccess: (_data, userId) => {
      invalidateAdminQueries(queryClient, userId);
    },
  });

  const deleteUser = useMutation<AdminOperationResponse, Error, DeleteUserVariables>({
    mutationFn: ({ userId, permanent }) => adminService.deleteUser(userId, permanent),
    onSuccess: () => {
      invalidateAdminQueries(queryClient);
    },
  });

  return {
    updateUserRole,
    suspendUser,
    unsuspendUser,
    deleteUser,
  };
};

export default useAdminUsers;
