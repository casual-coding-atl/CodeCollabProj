import { type FC } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';
import { Check, X } from 'lucide-react';
import Avatar from '../common/Avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { describeNotification, type NotificationView } from '@/lib/notifications';
import { useMarkRead } from '../../hooks/notifications';
import { useHandleCollaborationRequest } from '../../hooks/projects';

/** Compact "2m", "3h", "5d" relative time. */
function timeAgo(iso?: string): string {
  if (!iso) return '';
  const secs = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (secs < 60) return 'now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return `${Math.floor(days / 7)}w`;
}

interface Props {
  notification: NotificationView;
  /** Called after opening or acting on the notification (e.g. to close the popover). */
  onAfterAction?: () => void;
}

export const NotificationRow: FC<Props> = ({ notification, onAfterAction }) => {
  const navigate = useNavigate();
  const markRead = useMarkRead();
  const collab = useHandleCollaborationRequest();
  const { text } = describeNotification(notification);
  const unread = !notification.readAt;
  const canDecide =
    notification.type === 'join_requested' && !!notification.projectId?._id && !!notification.actor?._id;

  const open = (): void => {
    if (unread) markRead.mutate({ ids: [notification._id] });
    if (notification.projectId?._id) {
      navigate({
        to: '/projects/$projectId',
        params: { projectId: notification.projectId._id },
        hash:
          notification.type === 'comment_posted' && notification.commentId
            ? notification.commentId
            : undefined,
      });
    } else {
      navigate({ to: '/notifications' });
    }
    onAfterAction?.();
  };

  const decide = (status: 'accepted' | 'rejected'): void => {
    if (!notification.projectId?._id || !notification.actor?._id) return;
    collab.mutate(
      { projectId: notification.projectId._id, userId: notification.actor._id, status },
      {
        onSuccess: () => markRead.mutate({ ids: [notification._id] }),
        onError: () => {
          // The request was likely already handled elsewhere — clear it and say so.
          toast.info('That request was already handled.');
          markRead.mutate({ ids: [notification._id] });
        },
      },
    );
  };

  return (
    <div className={cn('flex gap-3 px-3 py-2.5', unread && 'bg-muted/40')}>
      <Avatar user={notification.actor ?? undefined} size="sm" />
      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={open}
          className="block w-full text-left text-sm leading-snug hover:text-primary"
        >
          {text}
        </button>
        <p className="mt-0.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          {timeAgo(notification.createdAt)}
        </p>
        {canDecide && unread && (
          <div className="mt-2 flex gap-2">
            <Button size="sm" className="h-7 gap-1" disabled={collab.isPending} onClick={() => decide('accepted')}>
              <Check className="size-3.5" /> Accept
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1 text-destructive hover:text-destructive"
              disabled={collab.isPending}
              onClick={() => decide('rejected')}
            >
              <X className="size-3.5" /> Decline
            </Button>
          </div>
        )}
      </div>
      {unread && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-brand-amber" aria-label="unread" />}
    </div>
  );
};

export default NotificationRow;
