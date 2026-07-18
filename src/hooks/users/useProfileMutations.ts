import { useMutation, useQueryClient, UseMutationResult } from '@tanstack/react-query';
import {
  usersService,
  ProfileUpdateResponse,
  AvatarUploadResponse,
  MessageResponse,
  FollowResponse,
} from '../../services/usersService';
import { queryKeys, invalidateQueries } from '../../config/queryClient';
import type { User } from '../../types';

/**
 * Update profile hook
 */
export const useUpdateProfile = (): UseMutationResult<
  ProfileUpdateResponse,
  Error,
  Partial<User>,
  unknown
> => {
  return useMutation({
    mutationFn: usersService.updateProfile,
    onSuccess: (data) => {
      console.log('✅ Profile updated successfully:', data);

      // Invalidate profile queries to refetch fresh data
      invalidateQueries.userProfile();

      // Also invalidate auth queries since profile data might be used there
      invalidateQueries.auth();
    },
    onError: (error) => {
      console.error('❌ Failed to update profile:', error);
    },
  });
};

/**
 * Upload profile image hook
 */
export const useUploadProfileImage = (): UseMutationResult<
  AvatarUploadResponse,
  Error,
  File,
  unknown
> => {
  return useMutation({
    mutationFn: usersService.uploadProfileImage,
    onSuccess: (data) => {
      console.log('✅ Profile image uploaded successfully:', data);

      // Invalidate profile queries
      invalidateQueries.userProfile();

      // Also invalidate auth queries since profile image might be used there
      invalidateQueries.auth();
    },
    onError: (error) => {
      console.error('❌ Failed to upload profile image:', error);
    },
  });
};

/**
 * Toggle follow user hook
 */
export const useToggleFollow = (): UseMutationResult<FollowResponse, Error, string, unknown> => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: usersService.toggleFollow,
    onSuccess: (data, userId) => {
      console.log('✅ Follow status toggled successfully:', data);

      // Invalidate the specific user's data
      queryClient.invalidateQueries({
        queryKey: queryKeys.users.detail(userId),
      });

      // Invalidate followers/following lists
      queryClient.invalidateQueries({
        queryKey: queryKeys.users.followers(userId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.users.following(userId),
      });

      // Invalidate current user's following list
      invalidateQueries.userProfile();
    },
    onError: (error) => {
      console.error('❌ Failed to toggle follow status:', error);
    },
  });
};

/**
 * Response type for avatar upload that includes the user object
 */
interface AvatarUploadWithUserResponse extends AvatarUploadResponse {
  user?: User;
}

/**
 * Upload avatar hook
 */
export const useUploadAvatar = (): UseMutationResult<
  AvatarUploadWithUserResponse,
  Error,
  FormData,
  unknown
> => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: usersService.uploadAvatar as (
      formData: FormData
    ) => Promise<AvatarUploadWithUserResponse>,
    onSuccess: async (data) => {
      // If response includes updated user, update BOTH caches immediately
      if (data.user) {
        // Update auth cache
        queryClient.setQueryData(queryKeys.auth.currentUser(), data.user);

        // CRITICAL: Also update the users.profile cache (used by Profile page!)
        queryClient.setQueryData(queryKeys.users.profile(), data.user);
      }

      // Invalidate queries to force refetch and re-render
      await queryClient.invalidateQueries({
        queryKey: queryKeys.users.profile(),
        refetchType: 'active',
      });

      await queryClient.invalidateQueries({
        queryKey: queryKeys.auth.currentUser(),
        refetchType: 'active',
      });
    },
  });
};

/**
 * Response type for avatar deletion that includes the user object
 */
interface AvatarDeleteResponse extends MessageResponse {
  user?: User;
}

/**
 * Delete avatar hook
 */
export const useDeleteAvatar = (): UseMutationResult<
  AvatarDeleteResponse,
  Error,
  void,
  unknown
> => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: usersService.deleteAvatar as () => Promise<AvatarDeleteResponse>,
    onSuccess: (data) => {
      console.log('✅ Avatar deleted successfully');

      // If response includes updated user, update both caches
      if (data && data.user) {
        queryClient.setQueryData(queryKeys.auth.currentUser(), data.user);
        queryClient.setQueryData(queryKeys.users.profile(), data.user);
        console.log('✅ Updated both caches after avatar deletion');
      }

      // Invalidate profile queries
      invalidateQueries.userProfile();

      // Also invalidate auth queries
      invalidateQueries.auth();
    },
  });
};
