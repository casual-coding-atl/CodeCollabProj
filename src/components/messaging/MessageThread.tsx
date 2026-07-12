import React, { useEffect } from 'react';
import { ArrowLeft, Reply, Trash2, MailOpen } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import Avatar from '../common/Avatar';
import { useMessage, useMarkMessageAsRead } from '../../hooks/users/useMessaging';
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

interface MessageThreadProps {
  messageId?: string;
  onBack?: () => void;
  onReply?: (message: MessageWithId) => void;
  onDelete?: (messageId: string) => void;
  message?: MessageWithId;
}

const MessageThread: React.FC<MessageThreadProps> = ({
  messageId,
  onBack,
  onReply,
  onDelete,
  message: propMessage,
}) => {
  // Fetch message if not provided as prop
  const { data: fetchedMessage, isLoading, error } = useMessage(messageId || '');

  const message = propMessage || (fetchedMessage as MessageWithId | undefined);

  // Mark as read mutation
  const markAsReadMutation = useMarkMessageAsRead();

  // Mark message as read when opened
  useEffect(() => {
    if (message && !message.isRead) {
      markAsReadMutation.mutate(message._id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message?._id, message?.isRead]);

  if (isLoading) {
    return (
      <div className="flex justify-center p-6">
        <p className="text-muted-foreground">Loading message...</p>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className="m-2">
        <AlertDescription>Failed to load message: {(error as Error).message}</AlertDescription>
      </Alert>
    );
  }

  if (!message) {
    return (
      <Alert className="m-2">
        <AlertDescription>Message not found</AlertDescription>
      </Alert>
    );
  }

  const sender = message.sender as UserSummary | undefined;

  return (
    <div>
      {/* Header */}
      <Card className="mb-4">
        <CardContent className="pt-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {onBack && (
                <Button variant="ghost" size="icon" className="size-8" onClick={onBack} aria-label="Back">
                  <ArrowLeft className="size-4" />
                </Button>
              )}
              <h2 className="text-lg font-semibold text-foreground">Message Details</h2>
            </div>

            <div className="flex items-center gap-2">
              {!message.isRead && (
                <Badge className="gap-1 bg-brand-amber text-brand-amber-foreground hover:bg-brand-amber">
                  <MailOpen className="size-3.5" />
                  Unread
                </Badge>
              )}
              {onReply && (
                <Button variant="outline" size="sm" onClick={() => onReply(message)}>
                  <Reply className="size-4" />
                  Reply
                </Button>
              )}
              {onDelete && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-destructive hover:text-destructive"
                  onClick={() => onDelete(message._id)}
                  aria-label="Delete"
                >
                  <Trash2 className="size-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Message metadata */}
          <div className="mb-4 flex items-center gap-3">
            <Avatar user={sender as unknown as UserSummary} size="md" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">
                From:{' '}
                {sender?.firstName && sender?.lastName
                  ? `${sender.firstName} ${sender.lastName}`
                  : sender?.username || 'Unknown User'}
              </p>
              <p className="text-sm text-muted-foreground">{sender?.email}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">
                {format(new Date(message.createdAt), 'PPP')}
              </p>
              <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}
              </p>
            </div>
          </div>

          <Separator />

          {/* Subject */}
          <h2 className="mt-4 text-lg font-semibold text-foreground">{message.subject}</h2>
        </CardContent>
      </Card>

      {/* Message content */}
      <Card>
        <CardContent className="pt-6">
          <p className="min-h-[200px] whitespace-pre-wrap leading-relaxed text-foreground">
            {message.content}
          </p>
        </CardContent>
      </Card>

      {/* Footer info */}
      <div className="mt-4 rounded-md bg-muted p-4">
        <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
          {message.isRead
            ? `Read ${message.readAt ? format(new Date(message.readAt), 'PPp') : 'recently'}`
            : 'Unread'}
        </p>
      </div>
    </div>
  );
};

export default MessageThread;
