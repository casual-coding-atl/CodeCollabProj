import React, { useState } from 'react';
import {
  Box,
  Container,
  Typography,
  Tabs,
  Tab,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Alert,
  Badge,
} from '@mui/material';
import {
  Add as AddIcon,
  Close as CloseIcon,
  Inbox as InboxIcon,
  Send as SendIcon,
} from '@mui/icons-material';
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

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number): void => {
    setActiveTab(newValue);
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
      <Container maxWidth="md" sx={{ py: 3 }}>
        <MessageThread
          message={selectedMessage}
          onBack={handleBackToList}
          onReply={handleReplyMessage}
          onDelete={handleDeleteMessage}
        />
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Messages
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleComposeMessage}>
          Compose Message
        </Button>
      </Box>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={activeTab} onChange={handleTabChange}>
          <Tab
            icon={
              <Badge badgeContent={getUnreadCount()} color="primary">
                <InboxIcon />
              </Badge>
            }
            label="Inbox"
            iconPosition="start"
          />
          <Tab icon={<SendIcon />} label="Sent" iconPosition="start" />
        </Tabs>
      </Box>

      {/* Error handling */}
      {getCurrentError() && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Failed to load messages: {getCurrentError()?.message}
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
      <Dialog open={showCompose} onClose={handleCloseCompose} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box display="flex" justifyContent="between" alignItems="center">
            Compose New Message
            <IconButton onClick={handleCloseCompose} sx={{ ml: 'auto' }}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <MessageForm onSuccess={handleComposeSuccess} onCancel={handleCloseCompose} />
        </DialogContent>
      </Dialog>

      {/* Reply Message Dialog */}
      <Dialog open={showReply} onClose={handleCloseReply} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box display="flex" justifyContent="between" alignItems="center">
            Reply to Message
            <IconButton onClick={handleCloseReply} sx={{ ml: 'auto' }}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <MessageForm
            replyToMessage={replyToMessage as unknown as Message}
            recipientId={replyToMessage?.sender?._id}
            recipientUser={replyToMessage?.sender as unknown as User}
            onSuccess={handleReplySuccess}
            onCancel={handleCloseReply}
          />
        </DialogContent>
      </Dialog>
    </Container>
  );
};

export default Messages;
