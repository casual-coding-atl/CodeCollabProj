import { useEffect } from 'react';
import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
  type UseQueryResult,
} from '@tanstack/react-query';
import { notificationsService, type MarkReadPayload } from '../services/notificationsService';
import type { NotificationView } from '../lib/notifications';

const KEYS = {
  all: ['notifications'] as const,
  list: (limit?: number): readonly unknown[] => ['notifications', 'list', limit ?? 0],
  unread: (): readonly string[] => ['notifications', 'unread'],
};

type FeedOptions = Omit<UseQueryOptions<NotificationView[], Error>, 'queryKey' | 'queryFn'>;
type CountOptions = Omit<UseQueryOptions<number, Error>, 'queryKey' | 'queryFn'>;

/**
 * The recipient's notification feed (newest first). Refetches on focus so a missed
 * push self-heals. Pass `limit` to fetch more (the /notifications page grows this
 * for "Load more"); the default (undefined) feed is what the SSE push prepends to.
 */
export function useNotifications(
  limit?: number,
  options: FeedOptions = {},
): UseQueryResult<NotificationView[], Error> {
  return useQuery({
    queryKey: KEYS.list(limit),
    queryFn: () => notificationsService.list(limit),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    ...options,
  });
}

/** Unread count for the navbar badge. */
export function useUnreadCount(options: CountOptions = {}): UseQueryResult<number, Error> {
  return useQuery({
    queryKey: KEYS.unread(),
    queryFn: notificationsService.unreadCount,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    ...options,
  });
}

/** Mark one/all notifications read; refreshes feed + count. */
export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: MarkReadPayload) => notificationsService.markRead(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all });
    },
  });
}

/**
 * Opens the SSE stream while authenticated and folds pushed notifications into
 * the query cache (prepend to feed, bump unread). On (re)connect it refetches so
 * anything missed while disconnected is reconciled — the DB is the source of truth.
 */
export function useNotificationStream(enabled: boolean): void {
  const qc = useQueryClient();
  useEffect(() => {
    if (!enabled || import.meta.env.SSR) return;
    const es = new EventSource('/api/notifications/stream', { withCredentials: true });

    es.onopen = () => {
      // Initial connect and every reconnect: pull the authoritative state.
      qc.invalidateQueries({ queryKey: KEYS.all });
    };
    es.onmessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data) as { type?: string; notification?: NotificationView };
        if (data.type !== 'notification' || !data.notification) return;
        const incoming = data.notification;
        qc.setQueryData<NotificationView[]>(KEYS.list(), (prev) =>
          prev ? [incoming, ...prev.filter((n) => n._id !== incoming._id)] : [incoming],
        );
        qc.setQueryData<number>(KEYS.unread(), (n) => (typeof n === 'number' ? n + 1 : 1));
      } catch {
        // ignore malformed frames
      }
    };

    return () => es.close();
  }, [enabled, qc]);
}
