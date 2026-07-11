import React, { useState, useMemo, type ChangeEvent, type FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Paper,
  Typography,
  Box,
  Grid,
  Chip,
  Button,
  Divider,
  TextField,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Link,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Send as SendIcon,
  GitHub as GitHubIcon,
  Language as LanguageIcon,
  CalendarToday as CalendarIcon,
  Person as PersonIcon,
  Code as CodeIcon,
} from '@mui/icons-material';
import { useAuth } from '../../hooks/auth';
import {
  useProject,
  useRequestCollaboration,
  useHandleCollaborationRequest,
  useDeleteProject,
} from '../../hooks/projects';
import { useComments, useCreateComment } from '../../hooks/comments';
import type {
  Project,
  User,
  UserSummary,
  Collaborator,
  CollaboratorStatus,
  Comment,
} from '../../types';

// Extended Collaborator type for API responses that may include populated user data
interface CollaboratorWithUserData extends Omit<Collaborator, 'userId'> {
  _id?: string;
  userId: string | User | UserSummary | { _id: string; username?: string; email?: string };
  username?: string;
  email?: string;
  status: CollaboratorStatus;
}

// Extended Project type for API responses
interface ProjectApiResponse extends Omit<Project, 'id' | 'owner' | 'collaborators'> {
  _id: string;
  owner?: User | UserSummary | { _id: string; username?: string };
  collaborators?: CollaboratorWithUserData[];
}

// Extended Comment type for API responses
interface CommentApiResponse extends Omit<Comment, 'id' | 'userId'> {
  _id: string;
  userId?: User | UserSummary | { _id?: string; username?: string };
  content: string;
  createdAt: string;
}

const ProjectDetail: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  // Auth state
  const { user } = useAuth();

  // Project data
  const {
    data: currentProject,
    isLoading: loading,
    error,
    refetch: refetchProject,
  } = useProject(projectId) as {
    data: ProjectApiResponse | undefined;
    isLoading: boolean;
    error: Error | null;
    refetch: () => void;
  };

  // Comments data
  const {
    data: comments = [],
    isLoading: commentsLoading,
    error: commentsError,
    refetch: refetchComments,
  } = useComments(projectId) as {
    data: CommentApiResponse[];
    isLoading: boolean;
    error: Error | null;
    refetch: () => void;
  };

  // Mutations
  const createCommentMutation = useCreateComment();
  const requestCollaborationMutation = useRequestCollaboration();
  const handleCollaborationMutation = useHandleCollaborationRequest();
  const deleteProjectMutation = useDeleteProject();

  // Local state
  const [comment, setComment] = useState<string>('');
  const [showDeleteDialog, setShowDeleteDialog] = useState<boolean>(false);
  const [commentSuccess, setCommentSuccess] = useState<boolean>(false);

  // Helper to get user ID from various user object shapes
  const getUserId = (
    userObj: string | User | UserSummary | { _id?: string } | undefined
  ): string | undefined => {
    if (!userObj) return undefined;
    if (typeof userObj === 'string') return userObj;
    if ('_id' in userObj) return userObj._id;
    if ('id' in userObj) return userObj.id;
    return undefined;
  };

  // Compute collaboration status
  const collaborationStatus = useMemo<CollaboratorStatus | null>(() => {
    if (!currentProject || !user) return null;

    console.log('🔍 Checking collaboration status:', {
      projectId: currentProject._id,
      userId: user.id || (user as unknown as { _id?: string })._id,
      collaborators: currentProject.collaborators,
    });

    const userId = user.id || (user as unknown as { _id?: string })._id;
    const userCollaboration = currentProject.collaborators?.find((collab) => {
      const collabUserId = getUserId(collab.userId);
      return collabUserId === userId;
    });

    console.log('🤝 User collaboration found:', userCollaboration);
    return userCollaboration?.status || null;
  }, [currentProject, user]);

  // Check if current user is owner
  const isOwner = useMemo<boolean>(() => {
    if (!currentProject || !user) return false;
    const userId = user.id || (user as unknown as { _id?: string })._id;
    const ownerId = getUserId(currentProject.owner);
    return userId === ownerId;
  }, [currentProject, user]);

  const handleEdit = (): void => {
    console.log('🔧 Edit button clicked for project:', projectId);
    console.log('👤 Current user:', user);
    console.log('👑 Is owner:', isOwner);
    navigate(`/projects/${projectId}/edit`);
  };

  const handleDelete = (): void => {
    setShowDeleteDialog(true);
  };

  const confirmDelete = (): void => {
    if (!projectId) return;
    deleteProjectMutation.mutate(projectId, {
      onSuccess: () => {
        setShowDeleteDialog(false);
        navigate('/projects');
      },
      onError: () => {
        // Keep the dialog open so the user can see it failed and retry.
      },
    });
  };

  const handleCollaborate = async (): Promise<void> => {
    if (!user) {
      alert('Please log in to request collaboration');
      return;
    }

    const userId = user.id || (user as unknown as { _id?: string })._id;
    // Check if user is already a collaborator
    const isAlreadyCollaborator = currentProject?.collaborators?.some((collab) => {
      const collabUserId = getUserId(collab.userId);
      return (
        collabUserId === userId && (collab.status === 'accepted' || collab.status === 'pending')
      );
    });

    if (isAlreadyCollaborator) {
      alert('You have already requested collaboration or are already a collaborator');
      return;
    }

    requestCollaborationMutation.mutate(projectId as string, {
      onSuccess: (result) => {
        console.log('✅ Collaboration request sent:', result);
        alert('Collaboration request sent successfully!');
        // TanStack Query will automatically refetch the project data
        refetchProject();
      },
      onError: (error: Error & { response?: { data?: { message?: string } } }) => {
        console.error('❌ Error requesting collaboration:', error);
        alert(
          error?.response?.data?.message || error?.message || 'Failed to request collaboration'
        );
      },
    });
  };

  const handleCollaborationResponse = async (
    userId: string,
    status: 'accepted' | 'rejected'
  ): Promise<void> => {
    handleCollaborationMutation.mutate(
      { projectId: projectId as string, userId, status },
      {
        onSuccess: (result) => {
          console.log('✅ Collaboration request handled:', result);
          alert(`Collaboration request ${status} successfully!`);
          // TanStack Query will automatically refetch the project data
          refetchProject();
        },
        onError: (error: Error & { response?: { data?: { message?: string } } }) => {
          console.error('❌ Error handling collaboration request:', error);
          alert(
            error?.response?.data?.message ||
              error?.message ||
              'Failed to handle collaboration request'
          );
        },
      }
    );
  };

  const handleCommentSubmit = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    if (comment.trim()) {
      createCommentMutation.mutate(
        { projectId: projectId as string, content: comment },
        {
          onSuccess: (result) => {
            console.log('✅ Comment created successfully:', result);
            setComment('');
            setCommentSuccess(true);
            setTimeout(() => setCommentSuccess(false), 3000);
            // TanStack Query will automatically refetch comments
            refetchComments();
          },
          onError: (error) => {
            console.error('❌ Error creating comment:', error);
          },
        }
      );
    }
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '300px',
          }}
        >
          <CircularProgress />
          <Typography variant="h6" sx={{ ml: 2 }}>
            Loading project details...
          </Typography>
        </Box>
      </Container>
    );
  }

  if (error) {
    // Ensure we never render an object as a React child
    const errorObj = error as Error & { response?: { data?: { message?: string } } };
    const errorMessage =
      typeof error === 'object'
        ? errorObj?.response?.data?.message || errorObj?.message || JSON.stringify(error)
        : String(error);

    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Alert severity="error" sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Error Loading Project
          </Typography>
          {errorMessage}
        </Alert>
        <Button variant="contained" onClick={() => refetchProject()}>
          Try Again
        </Button>
      </Container>
    );
  }

  if (!currentProject) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Alert severity="warning" sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Project Not Found
          </Typography>
          The project you&apos;re looking for doesn&apos;t exist or has been removed.
        </Alert>
        <Button variant="contained" onClick={() => navigate('/projects')}>
          Back to Projects
        </Button>
      </Container>
    );
  }

  // Additional safety check to ensure currentProject is valid
  if (typeof currentProject !== 'object' || currentProject === null) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Alert severity="error" sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Invalid Project Data
          </Typography>
          The project data is corrupted or invalid.
        </Alert>
        <Button variant="contained" onClick={() => refetchProject()}>
          Reload Project
        </Button>
      </Container>
    );
  }

  // Safety check for missing owner data
  if (!currentProject.owner) {
    console.warn('Project owner data is missing for project:', currentProject._id);
  }

  // Helper to get username from owner object
  const getOwnerUsername = (): string => {
    if (!currentProject.owner) return 'Unknown';
    if (typeof currentProject.owner === 'string') return 'Unknown';
    return currentProject.owner.username || 'Unknown';
  };

  // Helper to get username from collaborator
  const getCollaboratorUsername = (collab: CollaboratorWithUserData): string => {
    if (collab.username) return collab.username;
    if (typeof collab.userId === 'object' && collab.userId !== null) {
      const userObj = collab.userId as User | UserSummary | { username?: string };
      return userObj.username || 'Unknown User';
    }
    return 'Unknown User';
  };

  // Helper to get email from collaborator
  const getCollaboratorEmail = (collab: CollaboratorWithUserData): string => {
    if (collab.email) return collab.email;
    if (typeof collab.userId === 'object' && collab.userId !== null) {
      const userObj = collab.userId as User | { email?: string };
      return userObj.email || 'No email';
    }
    return 'No email';
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      {/* Page Title */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h3" component="h1" gutterBottom>
          Project Details
        </Typography>
        <Typography variant="body1" color="text.secondary">
          View and manage project information
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {/* Project Details */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Box
              sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}
            >
              <Box>
                <Typography variant="h4" gutterBottom>
                  {typeof currentProject.title === 'string'
                    ? currentProject.title
                    : 'Untitled Project'}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                  <Chip
                    label={
                      typeof currentProject.status === 'string' ? currentProject.status : 'Unknown'
                    }
                    color={
                      currentProject.status === 'completed'
                        ? 'success'
                        : currentProject.status === 'in_progress'
                          ? 'primary'
                          : 'default'
                    }
                  />
                  <Chip label={`Owner: ${getOwnerUsername()}`} variant="outlined" />
                </Box>
              </Box>
              {isOwner ? (
                <Box>
                  <IconButton onClick={handleEdit} color="primary">
                    <EditIcon />
                  </IconButton>
                  <IconButton onClick={handleDelete} color="error">
                    <DeleteIcon />
                  </IconButton>
                </Box>
              ) : (
                <Box>
                  {!user ? (
                    <Button variant="outlined" color="primary" onClick={() => navigate('/login')}>
                      Login to Collaborate
                    </Button>
                  ) : collaborationStatus === 'pending' ? (
                    <Button variant="outlined" color="warning" disabled>
                      Request Pending
                    </Button>
                  ) : collaborationStatus === 'accepted' ? (
                    <Button variant="contained" color="success" disabled>
                      Collaborator
                    </Button>
                  ) : (
                    <Button
                      variant="contained"
                      color="primary"
                      onClick={handleCollaborate}
                      disabled={requestCollaborationMutation.isPending}
                    >
                      {requestCollaborationMutation.isPending
                        ? 'Sending...'
                        : 'Request Collaboration'}
                    </Button>
                  )}
                </Box>
              )}
            </Box>

            <Typography variant="body1" paragraph>
              {typeof currentProject.description === 'string'
                ? currentProject.description
                : 'No description available.'}
            </Typography>

            {/* Project Metadata */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Project Information
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <CalendarIcon sx={{ mr: 1, fontSize: 20 }} />
                    <Typography variant="body2">
                      <strong>Created:</strong>{' '}
                      {new Date(currentProject.createdAt).toLocaleDateString()}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <CalendarIcon sx={{ mr: 1, fontSize: 20 }} />
                    <Typography variant="body2">
                      <strong>Updated:</strong>{' '}
                      {new Date(currentProject.updatedAt).toLocaleDateString()}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <PersonIcon sx={{ mr: 1, fontSize: 20 }} />
                    <Typography variant="body2">
                      <strong>Collaborators:</strong> {currentProject.collaborators?.length || 0}
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6}>
                  {currentProject.githubUrl && (
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <GitHubIcon sx={{ mr: 1, fontSize: 20 }} />
                      <Link
                        href={currentProject.githubUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Typography variant="body2">GitHub Repository</Typography>
                      </Link>
                    </Box>
                  )}
                  {currentProject.liveUrl && (
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <LanguageIcon sx={{ mr: 1, fontSize: 20 }} />
                      <Link href={currentProject.liveUrl} target="_blank" rel="noopener noreferrer">
                        <Typography variant="body2">Live Demo</Typography>
                      </Link>
                    </Box>
                  )}
                </Grid>
              </Grid>
            </Box>

            {/* Technologies */}
            {currentProject.technologies && currentProject.technologies.length > 0 && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" gutterBottom>
                  <CodeIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Technologies
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {currentProject.technologies.map((tech) => (
                    <Chip key={tech} label={tech} color="primary" variant="outlined" />
                  ))}
                </Box>
              </Box>
            )}

            {/* Project Incentives - Simple Indicator */}
            {currentProject.incentives && currentProject.incentives.enabled && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" gutterBottom color="success.main">
                  💰 Project Incentives Available
                </Typography>
                <Paper sx={{ p: 2, bgcolor: 'success.light', color: 'success.contrastText' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <Typography variant="h6" sx={{ mr: 1 }}>
                      🎁
                    </Typography>
                    <Typography variant="h6">Incentives Available</Typography>
                  </Box>

                  <Typography variant="body1" sx={{ mb: 1 }}>
                    This project offers incentives to contributors. Details will be discussed
                    privately with accepted collaborators.
                  </Typography>

                  <Typography variant="body2" sx={{ fontStyle: 'italic' }}>
                    💬 Contact the project owner for more information about available rewards.
                  </Typography>
                </Paper>
              </Box>
            )}

            {/* Required Skills */}
            {currentProject.requiredSkills && currentProject.requiredSkills.length > 0 && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Required Skills
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {currentProject.requiredSkills.map((skill) => (
                    <Chip key={skill} label={skill} />
                  ))}
                </Box>
              </Box>
            )}

            {/* Tags */}
            {currentProject.tags && currentProject.tags.length > 0 && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Tags
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {currentProject.tags.map((tag) => (
                    <Chip key={tag} label={tag} variant="outlined" />
                  ))}
                </Box>
              </Box>
            )}

            {/* Resources */}
            {currentProject.resources && currentProject.resources.length > 0 && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Resources
                </Typography>
                <List>
                  {currentProject.resources.map((resource) => (
                    <ListItem key={(resource as { _id?: string })._id || resource.url}>
                      <ListItemText
                        primary={resource.name}
                        secondary={
                          <Link href={resource.url} target="_blank" rel="noopener noreferrer">
                            {resource.url}
                          </Link>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}

            {/* Pending Collaboration Requests (for project owners) */}
            {isOwner &&
              currentProject.collaborators &&
              currentProject.collaborators.filter((c) => c.status === 'pending').length > 0 && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="h6" gutterBottom color="warning.main">
                    Pending Collaboration Requests
                  </Typography>
                  <List>
                    {currentProject.collaborators
                      .filter((collaborator) => collaborator.status === 'pending')
                      .map((collaborator) => (
                        <ListItem key={collaborator._id || getUserId(collaborator.userId)}>
                          <ListItemAvatar>
                            <Avatar>{getCollaboratorUsername(collaborator)[0] || 'C'}</Avatar>
                          </ListItemAvatar>
                          <ListItemText
                            primary={getCollaboratorUsername(collaborator)}
                            secondary={getCollaboratorEmail(collaborator)}
                          />
                          <Box sx={{ display: 'flex', gap: 1 }}>
                            <Button
                              size="small"
                              variant="contained"
                              color="success"
                              onClick={() =>
                                handleCollaborationResponse(
                                  getUserId(collaborator.userId) || '',
                                  'accepted'
                                )
                              }
                              disabled={handleCollaborationMutation.isPending}
                            >
                              {handleCollaborationMutation.isPending ? 'Processing...' : 'Accept'}
                            </Button>
                            <Button
                              size="small"
                              variant="outlined"
                              color="error"
                              onClick={() =>
                                handleCollaborationResponse(
                                  getUserId(collaborator.userId) || '',
                                  'rejected'
                                )
                              }
                              disabled={handleCollaborationMutation.isPending}
                            >
                              {handleCollaborationMutation.isPending ? 'Processing...' : 'Reject'}
                            </Button>
                          </Box>
                        </ListItem>
                      ))}
                  </List>
                </Box>
              )}

            {/* Collaborators */}
            {currentProject.collaborators &&
              currentProject.collaborators.filter((c) => c.status === 'accepted').length > 0 && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="h6" gutterBottom>
                    Collaborators
                  </Typography>
                  <List>
                    {currentProject.collaborators
                      .filter((collaborator) => collaborator.status === 'accepted')
                      .map((collaborator) => (
                        <ListItem key={collaborator._id || getUserId(collaborator.userId)}>
                          <ListItemAvatar>
                            <Avatar>{getCollaboratorUsername(collaborator)[0] || 'C'}</Avatar>
                          </ListItemAvatar>
                          <ListItemText
                            primary={getCollaboratorUsername(collaborator)}
                            secondary={getCollaboratorEmail(collaborator)}
                          />
                          <Chip label="Accepted" color="success" size="small" sx={{ ml: 1 }} />
                        </ListItem>
                      ))}
                  </List>
                </Box>
              )}
          </Paper>
        </Grid>

        {/* Comments Section */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h5" gutterBottom>
              Comments
            </Typography>

            {user && (
              <Box component="form" onSubmit={handleCommentSubmit} sx={{ mb: 3 }}>
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  placeholder="Write a comment..."
                  value={comment}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setComment(e.target.value)}
                  sx={{ mb: 1 }}
                />
                <Button
                  type="submit"
                  variant="contained"
                  endIcon={<SendIcon />}
                  disabled={!comment.trim() || createCommentMutation.isPending}
                >
                  {createCommentMutation.isPending ? (
                    <CircularProgress size={20} />
                  ) : (
                    'Post Comment'
                  )}
                </Button>
              </Box>
            )}

            {commentSuccess && (
              <Alert severity="success" sx={{ mb: 2 }}>
                Comment posted successfully!
              </Alert>
            )}

            {(commentsError || createCommentMutation.error) && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {(commentsError as Error & { response?: { data?: { message?: string } } })?.response
                  ?.data?.message ||
                  commentsError?.message ||
                  (
                    createCommentMutation.error as Error & {
                      response?: { data?: { message?: string } };
                    }
                  )?.response?.data?.message ||
                  createCommentMutation.error?.message ||
                  'Error loading or posting comments'}
              </Alert>
            )}

            {commentsLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                <CircularProgress />
              </Box>
            ) : (
              <List>
                {comments && comments.length > 0 ? (
                  comments.map((commentItem) => (
                    <React.Fragment key={commentItem._id}>
                      <ListItem alignItems="flex-start">
                        <ListItemAvatar>
                          <Avatar>
                            {(
                              commentItem.userId as
                                | User
                                | UserSummary
                                | { username?: string }
                                | undefined
                            )?.username?.[0] || 'U'}
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                              <Typography component="span" variant="subtitle2">
                                {(
                                  commentItem.userId as
                                    | User
                                    | UserSummary
                                    | { username?: string }
                                    | undefined
                                )?.username || 'Unknown User'}
                              </Typography>
                              <Typography component="span" variant="caption" color="text.secondary">
                                {new Date(commentItem.createdAt).toLocaleDateString()}
                              </Typography>
                            </Box>
                          }
                          secondary={commentItem.content}
                        />
                      </ListItem>
                      <Divider variant="inset" component="li" />
                    </React.Fragment>
                  ))
                ) : (
                  <ListItem>
                    <ListItemText
                      primary="No comments yet"
                      secondary="Be the first to comment on this project!"
                    />
                  </ListItem>
                )}
              </List>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onClose={() => setShowDeleteDialog(false)}>
        <DialogTitle>Delete Project</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this project? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDeleteDialog(false)}>Cancel</Button>
          <Button onClick={confirmDelete} color="error">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default ProjectDetail;
