import React from 'react';
import {
  Box,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Chip,
  Typography,
  Paper,
  IconButton,
  Divider,
} from '@mui/material';
import {
  Email as EmailIcon,
  MarkEmailRead as EmailOpenIcon,
  Delete as DeleteIcon,
  Reply as ReplyIcon,
} from '@mui/icons-material';
import { formatDistanceToNow } from 'date-fns';
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
      <Box display="flex" justifyContent="center" p={3}>
        <Typography>Loading messages...</Typography>
      </Box>
    );
  }

  if (messages.length === 0) {
    return (
      <Paper sx={{ p: 3, textAlign: 'center' }}>
        <EmailIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
        <Typography variant="h6" color="text.secondary">
          No messages yet
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Your messages will appear here
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper>
      <List sx={{ width: '100%' }}>
        {messages.map((message, index) => (
          <React.Fragment key={message._id}>
            <ListItem
              alignItems="flex-start"
              sx={{
                backgroundColor: message.isRead ? 'transparent' : 'action.hover',
                cursor: 'pointer',
                '&:hover': {
                  backgroundColor: 'action.selected',
                },
              }}
              onClick={() => onMessageClick && onMessageClick(message)}
            >
              <ListItemAvatar>
                <Avatar sx={{ bgcolor: message.isRead ? 'grey.400' : 'primary.main' }}>
                  {message.isRead ? <EmailOpenIcon /> : <EmailIcon />}
                </Avatar>
              </ListItemAvatar>

              <ListItemText
                primary={
                  <Box display="flex" alignItems="center" gap={1}>
                    <Typography
                      variant="subtitle1"
                      fontWeight={message.isRead ? 'normal' : 'bold'}
                      sx={{ flexGrow: 1 }}
                    >
                      {message.subject}
                    </Typography>
                    {!message.isRead && (
                      <Chip label="New" size="small" color="primary" sx={{ height: 20 }} />
                    )}
                  </Box>
                }
                secondary={
                  <Box>
                    <Typography
                      component="span"
                      variant="body2"
                      color="text.primary"
                      fontWeight={message.isRead ? 'normal' : 'medium'}
                    >
                      From:{' '}
                      {(message.sender as UserSummary)?.username ||
                        (message.sender as UserSummary)?.firstName ||
                        'Unknown'}
                    </Typography>
                    <Typography
                      component="div"
                      variant="body2"
                      color="text.secondary"
                      sx={{
                        mt: 0.5,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {message.content}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}
                    </Typography>
                  </Box>
                }
              />

              <Box display="flex" flexDirection="column" gap={1}>
                {onReplyMessage && (
                  <IconButton
                    size="small"
                    onClick={(e: React.MouseEvent) => {
                      e.stopPropagation();
                      onReplyMessage(message);
                    }}
                    title="Reply"
                  >
                    <ReplyIcon />
                  </IconButton>
                )}
                {onDeleteMessage && (
                  <IconButton
                    size="small"
                    onClick={(e: React.MouseEvent) => {
                      e.stopPropagation();
                      onDeleteMessage(message._id);
                    }}
                    title="Delete"
                    sx={{ color: 'error.main' }}
                  >
                    <DeleteIcon />
                  </IconButton>
                )}
              </Box>
            </ListItem>
            {index < messages.length - 1 && <Divider variant="inset" component="li" />}
          </React.Fragment>
        ))}
      </List>
    </Paper>
  );
};

export default MessageList;
