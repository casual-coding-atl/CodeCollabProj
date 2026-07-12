import api from '../utils/api';
import type { NotificationView } from '../lib/notifications';

export interface MarkReadPayload {
  ids?: string[];
  all?: boolean;
}
export interface MarkReadResponse {
  updated: number;
  unread: number;
}

/** Same-origin `/api/notifications` client. */
export const notificationsService = {
  list: async (): Promise<NotificationView[]> => {
    const res = await api.get<NotificationView[]>('/notifications');
    return res.data;
  },
  unreadCount: async (): Promise<number> => {
    const res = await api.get<{ count: number }>('/notifications/unread-count');
    return res.data.count;
  },
  markRead: async (payload: MarkReadPayload): Promise<MarkReadResponse> => {
    const res = await api.post<MarkReadResponse>('/notifications/mark-read', payload);
    return res.data;
  },
};

export default notificationsService;
