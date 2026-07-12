import React, { useState } from 'react';
import { Plus, Inbox, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useMessages, useDeleteMessage } from '../hooks/users/useMessaging';
import MessageList from '../components/messaging/MessageList';
import MessageForm from '../components/messaging/MessageForm';
import MessageThread from '../components/messaging/MessageThread';
import type { UserSummary, Message, User } from '../types';

// Extended Message type to handle API response with _id
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

const Messages: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [selectedMessage, setSelectedMessage] = useState<MessageWithId | null>(null);
  const [showCompose, setShowCompose] = useState(false);
  const [showReply, setShowReply] = useState(false);
  const [replyToMessage, setReplyToMessage] = useState<MessageWithId | null>(null);

  // Fetch messages
  const {
    data: inboxMessages = [],
    isLoading: loadingInbox,
    error: inboxError,
    refetch: refetchInbox,
  } = useMessages('inbox');

  const {
    data: sentMessages = [],
    isLoading: loadingSent,
    error: sentError,
    refetch: refetchSent,
  } = useMessages('sent');

  // Delete message mutation
  const deleteMessageMutation = useDeleteMessage({
    onSuccess: () => {
      refetchInbox();
      refetchSent();
      if (selectedMessage) {
        setSelectedMessage(null);
      }
    },
  });

  const handleTabChange = (value: string): void => {
    setActiveTab(value === 'inbox' ? 0 : 1);
    setSelectedMessage(null);
  };

  const handleMessageClick = (message: MessageWithId): void => {
    setSelectedMessage(message);
  };

  const handleBackToList = (): void => {
    setSelectedMessage(null);
  };

  const handleComposeMessage = (): void => {
    setShowCompose(true);
  };

  const handleCloseCompose = (): void => {
    setShowCompose(false);
  };

  const handleComposeSuccess = (): void => {
    setShowCompose(false);
    refetchSent();
  };

  const handleReplyMessage = (message: MessageWithId): void => {
    setReplyToMessage(message);
    setShowReply(true);
  };

  const handleCloseReply = (): void => {
    setShowReply(false);
    setReplyToMessage(null);
  };

  const handleReplySuccess = (): void => {
    setShowReply(false);
    setReplyToMessage(null);
    refetchSent();
  };

  const handleDeleteMessage = (messageId: string): void => {
    if (window.confirm('Are you sure you want to delete this message?')) {
      deleteMessageMutation.mutate(messageId);
    }
  };

  const getCurrentMessages = (): MessageWithId[] => {
    return (activeTab === 0 ? inboxMessages : sentMessages) as MessageWithId[];
  };

  const getCurrentLoading = (): boolean => {
    return activeTab === 0 ? loadingInbox : loadingSent;
  };

  const getCurrentError = (): Error | null => {
    return (activeTab === 0 ? inboxError : sentError) as Error | null;
  };

  const getUnreadCount = (): number => {
    return (inboxMessages as MessageWithId[]).filter((msg) => !msg.isRead).length;
  };

  if (selectedMessage) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6">
        <MessageThread
          message={selectedMessage}
          onBack={handleBackToList}
          onReply={handleReplyMessage}
          onDelete={handleDeleteMessage}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            your inbox
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Messages</h1>
        </div>
        <Button onClick={handleComposeMessage}>
          <Plus className="size-4" />
          Compose Message
        </Button>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab === 0 ? 'inbox' : 'sent'}
        onValueChange={handleTabChange}
        className="mb-6"
      >
        <TabsList>
          <TabsTrigger value="inbox">
            <Inbox className="size-4" />
            Inbox
            {getUnreadCount() > 0 && (
              <Badge className="ml-1 h-5 min-w-5 justify-center bg-brand-amber px-1 text-brand-amber-foreground hover:bg-brand-amber">
                {getUnreadCount()}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="sent">
            <Send className="size-4" />
            Sent
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Error handling */}
      {getCurrentError() && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>Failed to load messages: {getCurrentError()?.message}</AlertDescription>
        </Alert>
      )}

      {/* Message list */}
      <MessageList
        messages={getCurrentMessages()}
        loading={getCurrentLoading()}
        onMessageClick={handleMessageClick}
        onDeleteMessage={handleDeleteMessage}
        onReplyMessage={activeTab === 0 ? handleReplyMessage : null}
      />

      {/* Compose Message Dialog */}
      <Dialog
        open={showCompose}
        onOpenChange={(open) => {
          if (!open) handleCloseCompose();
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Compose New Message</DialogTitle>
          </DialogHeader>
          <MessageForm onSuccess={handleComposeSuccess} onCancel={handleCloseCompose} />
        </DialogContent>
      </Dialog>

      {/* Reply Message Dialog */}
      <Dialog
        open={showReply}
        onOpenChange={(open) => {
          if (!open) handleCloseReply();
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Reply to Message</DialogTitle>
          </DialogHeader>
          <MessageForm
            replyToMessage={replyToMessage as unknown as Message}
            recipientId={replyToMessage?.sender?._id}
            recipientUser={replyToMessage?.sender as unknown as User}
            onSuccess={handleReplySuccess}
            onCancel={handleCloseReply}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Messages;
