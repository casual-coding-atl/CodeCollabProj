import React, { useMemo, useState } from 'react';
import {
  Container,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Alert,
  Button,
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { Message as MessageIcon, Close as CloseIcon } from '@mui/icons-material';
import { useUsers } from '../hooks/users';
import { useProjects } from '../hooks/projects';
import MessageForm from '../components/messaging/MessageForm';
import Avatar from '../components/common/Avatar';
import { MembersTableSkeleton } from '../components/common/Skeletons';
import type { User } from '../types';

// API response types - standalone interfaces to handle _id fields
interface UserWithId {
  _id: string;
  id?: string;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  bio?: string;
  skills?: string[];
  experience?: string;
  availability?: string;
  location?: string;
  profileImage?: string;
}

interface ProjectWithId {
  _id: string;
  id?: string;
  title: string;
  description: string;
  technologies?: string[];
  createdAt: string;
  owner?:
    | {
        _id: string;
        username?: string;
      }
    | string;
  collaborators?: Array<{
    _id?: string;
    userId?:
      | {
          _id: string;
        }
      | string;
  }>;
}

const Members: React.FC = () => {
  const [showMessageForm, setShowMessageForm] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithId | null>(null);

  // Fetch users and projects using TanStack Query
  const {
    data: users = [],
    isLoading: usersLoading,
    error: usersError,
    refetch: refetchUsers,
  } = useUsers();

  const {
    data: projects = [],
    isLoading: projectsLoading,
    error: projectsError,
    refetch: refetchProjects,
  } = useProjects();

  const loading = usersLoading || projectsLoading;
  const error = usersError || projectsError;

  const typedUsers = users as unknown as UserWithId[];
  const typedProjects = projects as unknown as ProjectWithId[];

  // Memoized helper: get projects for a user
  const getUserProjects = useMemo(() => {
    return (userId: string): ProjectWithId[] => {
      return typedProjects.filter((p) => {
        // Handle both populated and unpopulated owner fields
        const ownerId = typeof p.owner === 'object' && p.owner !== null ? p.owner._id : p.owner;
        return (
          (ownerId && ownerId.toString() === userId.toString()) ||
          (p.collaborators &&
            p.collaborators.some((c) => {
              const collabUserId =
                typeof c.userId === 'object' && c.userId !== null
                  ? (c.userId as { _id: string })._id
                  : c.userId;
              return collabUserId?.toString() === userId.toString();
            }))
        );
      });
    };
  }, [typedProjects]);

  const handleMessageUser = (user: UserWithId): void => {
    setSelectedUser(user);
    setShowMessageForm(true);
  };

  const handleCloseMessageForm = (): void => {
    setShowMessageForm(false);
    setSelectedUser(null);
  };

  const handleMessageSent = (): void => {
    setShowMessageForm(false);
    setSelectedUser(null);
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Typography variant="h4" gutterBottom>
          Members
        </Typography>
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Username</TableCell>
                <TableCell>Skills</TableCell>
                <TableCell>Experience</TableCell>
                <TableCell>Availability</TableCell>
                <TableCell>Project Name(s)</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <MembersTableSkeleton count={5} />
            </TableBody>
          </Table>
        </TableContainer>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Alert severity="error" sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Error Loading Members
          </Typography>
          {(error as Error & { response?: { data?: { message?: string } } })?.response?.data
            ?.message ||
            (error as Error)?.message ||
            'Failed to load members data'}
        </Alert>
        <Button
          variant="contained"
          onClick={() => {
            refetchUsers();
            refetchProjects();
          }}
        >
          Try Again
        </Button>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4 }}>
      <Typography variant="h4" gutterBottom>
        Members
      </Typography>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Member</TableCell>
              <TableCell>Skills</TableCell>
              <TableCell>Experience</TableCell>
              <TableCell>Availability</TableCell>
              <TableCell>Project Name(s)</TableCell>
              <TableCell align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {typedUsers.map((user) => {
              const userProjects = getUserProjects(user._id);
              return (
                <TableRow key={user._id}>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Avatar user={user} size="sm" />
                      <Typography variant="body2" fontWeight={500}>
                        {user.username}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    {user.skills && user.skills.length > 0 ? user.skills.join(', ') : '—'}
                  </TableCell>
                  <TableCell>{user.experience ? user.experience : '—'}</TableCell>
                  <TableCell>{user.availability ? user.availability : '—'}</TableCell>
                  <TableCell>
                    {userProjects.length > 0
                      ? userProjects.map((p, idx) => (
                          <span key={p._id}>
                            <Typography
                              variant="h6"
                              component={RouterLink}
                              to={`/projects#${p._id}`}
                              style={{ textDecoration: 'none', color: '#1976d2', fontWeight: 500 }}
                              gutterBottom
                            >
                              {p.title}
                            </Typography>
                            {idx < userProjects.length - 1 && ', '}
                          </span>
                        ))
                      : '—'}
                  </TableCell>
                  <TableCell align="center">
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<MessageIcon />}
                      onClick={() => handleMessageUser(user)}
                      sx={{ minWidth: 'auto' }}
                    >
                      Message
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Message Form Dialog */}
      <Dialog open={showMessageForm} onClose={handleCloseMessageForm} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box display="flex" justifyContent="between" alignItems="center">
            Send Message to {selectedUser?.username}
            <IconButton onClick={handleCloseMessageForm} sx={{ ml: 'auto' }}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedUser && (
            <MessageForm
              recipientId={selectedUser._id}
              recipientUser={selectedUser as unknown as User}
              onSuccess={handleMessageSent}
              onCancel={handleCloseMessageForm}
            />
          )}
        </DialogContent>
      </Dialog>
    </Container>
  );
};

export default Members;
