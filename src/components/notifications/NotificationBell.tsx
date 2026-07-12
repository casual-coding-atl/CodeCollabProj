import { useState, type FC } from 'react';
import { Link } from '@tanstack/react-router';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useAuth } from '../../hooks/auth';
import {
  useNotifications,
  useUnreadCount,
  useMarkRead,
  useNotificationStream,
} from '../../hooks/notifications';
import { NotificationRow } from './NotificationRow';

const FEED_PREVIEW = 10;

export const NotificationBell: FC = () => {
  const { isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);

  // Live push while signed in; feed/count load on demand.
  useNotificationStream(isAuthenticated);
  const { data: unread = 0 } = useUnreadCount({ enabled: isAuthenticated });
  const { data: notifications = [], isLoading } = useNotifications(undefined, {
    enabled: isAuthenticated && open,
  });
  const markRead = useMarkRead();

  if (!isAuthenticated) return null;

  const recent = notifications.slice(0, FEED_PREVIEW);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={`Notifications${unread > 0 ? `, ${unread} unread` : ''}`}
          data-testid="notification-bell"
        >
          <Bell className="size-5" />
          {unread > 0 && (
            <span
              data-testid="notification-badge"
              className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-brand-amber px-1 font-mono text-[10px] font-semibold leading-4 text-brand-amber-foreground"
            >
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0" data-testid="notification-feed">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            Notifications
          </span>
          {unread > 0 && (
            <button
              type="button"
              className="text-xs text-primary hover:underline"
              onClick={() => markRead.mutate({ all: true })}
            >
              Mark all read
            </button>
          )}
        </div>

        <div className="max-h-96 divide-y overflow-y-auto">
          {isLoading && recent.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">Loading…</p>
          ) : recent.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              You're all caught up.
            </p>
          ) : (
            recent.map((n) => (
              <NotificationRow key={n._id} notification={n} onAfterAction={() => setOpen(false)} />
            ))
          )}
        </div>

        <div className="border-t px-3 py-2 text-center">
          <Link
            to="/notifications"
            className="text-xs font-medium text-primary hover:underline"
            onClick={() => setOpen(false)}
          >
            See all →
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationBell;
