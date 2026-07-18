import {
  useQuery,
  useMutation,
  useQueryClient,
  UseQueryOptions,
  UseQueryResult,
  UseMutationResult,
} from '@tanstack/react-query';
import { usersService, SendMessageData, MessageResponse } from '../../services/usersService';
import { queryKeys, invalidateQueries } from '../../config/queryClient';
import type { Message } from '../../types';

/**
 * Message type (inbox or sent)
 */
type MessageType = 'inbox' | 'sent' | string;

/**
 * Query options type for messages hook
 */
type MessagesQueryOptions = Omit<UseQueryOptions<Message[], Error>, 'queryKey' | 'queryFn'>;

/**
 * Query options type for single message hook
 */
type MessageQueryOptions = Omit<
  UseQueryOptions<Message, Error>,
  'queryKey' | 'queryFn' | 'enabled'
>;

/**
 * Mutation options for send message hook
 */
interface SendMessageOptions {
  onSuccess?: (data: MessageResponse) => void;
  onError?: (error: Error) => void;
}

/**
 * Mutation options for delete message hook
 */
interface DeleteMessageOptions {
  onSuccess?: (data: MessageResponse, messageId: string) => void;
  onError?: (error: Error) => void;
}

/**
 * Get messages hook
 * @param type - Message type ('inbox' or 'sent')
 * @param options - Additional query options
 */
export const useMessages = (
  type: MessageType = 'inbox',
  options: MessagesQueryOptions = {}
): UseQueryResult<Message[], Error> => {
  return useQuery({
    queryKey: queryKeys.users.messages(type),
    queryFn: () => usersService.getMessages(type),
    staleTime: 1 * 60 * 1000, // Consider fresh for 1 minute (messages should be fairly real-time)
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
    ...options,
  });
};

/**
 * Get message by ID hook
 * @param messageId - The message ID to fetch
 * @param options - Additional query options
 */
export const useMessage = (
  messageId: string | undefined,
  options: MessageQueryOptions = {}
): UseQueryResult<Message, Error> => {
  return useQuery({
    queryKey: queryKeys.users.messageDetail(messageId ?? ''),
    queryFn: () => usersService.getMessageById(messageId as string),
    enabled: !!messageId, // Only run if messageId exists
    staleTime: 5 * 60 * 1000, // Consider fresh for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    ...options,
  });
};

/**
 * Send message hook
 * @param options - Custom success/error handlers
 */
export const useSendMessage = (
  options: SendMessageOptions = {}
): UseMutationResult<MessageResponse, Error, SendMessageData, unknown> => {
  return useMutation({
    mutationFn: usersService.sendMessage,
    onSuccess: (data) => {
      console.log('✅ Message sent successfully:', data);

      // Invalidate messages to show the new sent message
      invalidateQueries.userMessages();

      // Call custom onSuccess if provided
      if (options.onSuccess) {
        options.onSuccess(data);
      }
    },
    onError: (error) => {
      console.error('❌ Failed to send message:', error);

      // Call custom onError if provided
      if (options.onError) {
        options.onError(error);
      }
    },
  });
};

/**
 * Mark message as read hook
 */
export const useMarkMessageAsRead = (): UseMutationResult<
  MessageResponse,
  Error,
  string,
  unknown
> => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: usersService.markMessageAsRead,
    onSuccess: (data, messageId) => {
      console.log('✅ Message marked as read:', data);

      // Invalidate the specific message
      queryClient.invalidateQueries({
        queryKey: queryKeys.users.messageDetail(messageId),
      });

      // Invalidate messages list to update read status
      invalidateQueries.userMessages();
    },
    onError: (error) => {
      console.error('❌ Failed to mark message as read:', error);
    },
  });
};

/**
 * Delete message hook
 * @param options - Custom success/error handlers
 */
export const useDeleteMessage = (
  options: DeleteMessageOptions = {}
): UseMutationResult<MessageResponse, Error, string, unknown> => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: usersService.deleteMessage,
    onSuccess: (data, messageId) => {
      console.log('✅ Message deleted successfully:', messageId);

      // Remove the message from cache
      queryClient.removeQueries({
        queryKey: queryKeys.users.messageDetail(messageId),
      });

      // Invalidate messages list to remove the deleted message
      invalidateQueries.userMessages();

      // Call custom onSuccess if provided
      if (options.onSuccess) {
        options.onSuccess(data, messageId);
      }
    },
    onError: (error) => {
      console.error('❌ Failed to delete message:', error);

      // Call custom onError if provided
      if (options.onError) {
        options.onError(error);
      }
    },
  });
};
