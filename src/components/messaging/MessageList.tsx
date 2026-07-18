import React from 'react';
import { Mail, MailOpen, Trash2, Reply } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import type { UserSummary } from '../../types';

// Message type to handle API response with _id
interface MessageWithId {
  _id: string;
  id?: string;
  subject: string;
  content: string;
  isRead: boolean;
  readAt?: string;
  createdAt: string;
  sender?: UserSummary & { _id?: string };
  recipient?: UserSummary & { _id?: string };
}

interface MessageListProps {
  messages?: MessageWithId[];
  onMessageClick?: (message: MessageWithId) => void;
  onDeleteMessage?: (messageId: string) => void;
  onReplyMessage?: ((message: MessageWithId) => void) | null;
  loading?: boolean;
}

const MessageList: React.FC<MessageListProps> = ({
  messages = [],
  onMessageClick,
  onDeleteMessage,
  onReplyMessage,
  loading = false,
}) => {
  if (loading) {
    return (
      <div className="flex justify-center p-6">
        <p className="text-muted-foreground">Loading messages...</p>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <Card className="p-6 text-center">
        <Mail className="mx-auto mb-2 size-12 text-muted-foreground" />
        <p className="text-lg font-medium text-muted-foreground">No messages yet</p>
        <p className="text-sm text-muted-foreground">Your messages will appear here</p>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden py-0">
      <ul className="w-full">
        {messages.map((message, index) => (
          <React.Fragment key={message._id}>
            <li
              className={cn(
                'flex cursor-pointer items-start gap-3 p-4 transition-colors hover:bg-accent',
                !message.isRead && 'border-l-2 border-brand-amber bg-brand-amber/5'
              )}
              onClick={() => onMessageClick && onMessageClick(message)}
            >
              {/* Avatar / status icon */}
              <div
                className={cn(
                  'flex size-10 shrink-0 items-center justify-center rounded-full',
                  message.isRead
                    ? 'bg-muted text-muted-foreground'
                    : 'bg-brand-amber text-brand-amber-foreground'
                )}
              >
                {message.isRead ? <MailOpen className="size-5" /> : <Mail className="size-5" />}
              </div>

              {/* Content */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p
                    className={cn(
                      'flex-1 truncate',
                      message.isRead ? 'font-normal' : 'font-bold'
                    )}
                  >
                    {message.subject}
                  </p>
                  {!message.isRead && (
                    <Badge className="h-5 bg-brand-amber text-brand-amber-foreground hover:bg-brand-amber">
                      New
                    </Badge>
                  )}
                </div>

                <p
                  className={cn(
                    'text-sm text-foreground',
                    message.isRead ? 'font-normal' : 'font-medium'
                  )}
                >
                  From:{' '}
                  {(message.sender as UserSummary)?.username ||
                    (message.sender as UserSummary)?.firstName ||
                    'Unknown'}
                </p>
                <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                  {message.content}
                </p>
                <p className="mt-1 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                  {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}
                </p>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-1">
                {onReplyMessage && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={(e: React.MouseEvent) => {
                      e.stopPropagation();
                      onReplyMessage(message);
                    }}
                    title="Reply"
                    aria-label="Reply"
                  >
                    <Reply className="size-4" />
                  </Button>
                )}
                {onDeleteMessage && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-destructive hover:text-destructive"
                    onClick={(e: React.MouseEvent) => {
                      e.stopPropagation();
                      onDeleteMessage(message._id);
                    }}
                    title="Delete"
                    aria-label="Delete"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </div>
            </li>
            {index < messages.length - 1 && <Separator />}
          </React.Fragment>
        ))}
      </ul>
    </Card>
  );
};

export default MessageList;
