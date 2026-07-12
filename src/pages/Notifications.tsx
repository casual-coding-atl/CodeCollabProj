import { type FC } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useNotifications, useUnreadCount, useMarkRead } from '../hooks/notifications';
import { NotificationRow } from '../components/notifications/NotificationRow';

const metaLabel = 'font-mono text-[11px] uppercase tracking-widest text-muted-foreground';

const Notifications: FC = () => {
  const { data: notifications = [], isLoading } = useNotifications();
  const { data: unread = 0 } = useUnreadCount();
  const markRead = useMarkRead();

  return (
    <div className="mx-auto max-w-2xl">
      <p className={metaLabel}>activity</p>
      <div className="mb-6 flex items-center justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
          {unread > 0 && <span className="font-mono text-xs text-brand-amber">{unread} unread</span>}
        </div>
        {unread > 0 && (
          <Button variant="outline" size="sm" onClick={() => markRead.mutate({ all: true })}>
            Mark all read
          </Button>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border">
        {isLoading ? (
          <div className="space-y-2 p-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-md" />
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-4 py-16 text-center">
            <Bell className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No notifications yet. Collaboration activity will show up here.
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {notifications.map((n) => (
              <NotificationRow key={n._id} notification={n} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Notifications;
