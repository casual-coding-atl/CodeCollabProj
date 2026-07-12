import React, { useState, useMemo, type ChangeEvent, type FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Pencil,
  Trash2,
  Send,
  GitBranch,
  ExternalLink,
  Calendar,
  User as UserIcon,
  Code2,
  Loader2,
} from 'lucide-react';
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
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

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

// Small badge that reflects a project's status using design tokens.
const StatusBadge: React.FC<{ status: string }> = ({ status }) => (
  <Badge
    variant={
      status === 'completed' ? 'default' : status === 'in_progress' ? 'secondary' : 'outline'
    }
    className="font-mono text-[11px] uppercase tracking-widest"
  >
    {status}
  </Badge>
);

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
  } = useComments(projectId) as unknown as {
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
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="flex min-h-[300px] items-center justify-center gap-3">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
          <span className="text-lg font-semibold text-muted-foreground">
            Loading project details...
          </span>
        </div>
      </div>
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
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <Alert variant="destructive" className="mb-6">
          <AlertTitle>Error Loading Project</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
        <Button onClick={() => refetchProject()}>Try Again</Button>
      </div>
    );
  }

  if (!currentProject) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <Alert className="mb-6 border-brand-amber/40">
          <AlertTitle>Project Not Found</AlertTitle>
          <AlertDescription>
            The project you&apos;re looking for doesn&apos;t exist or has been removed.
          </AlertDescription>
        </Alert>
        <Button onClick={() => navigate('/projects')}>Back to Projects</Button>
      </div>
    );
  }

  // Additional safety check to ensure currentProject is valid
  if (typeof currentProject !== 'object' || currentProject === null) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <Alert variant="destructive" className="mb-6">
          <AlertTitle>Invalid Project Data</AlertTitle>
          <AlertDescription>The project data is corrupted or invalid.</AlertDescription>
        </Alert>
        <Button onClick={() => refetchProject()}>Reload Project</Button>
      </div>
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
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      {/* Page Title */}
      <div className="mb-8">
        <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
          <span className="text-brand-amber">//</span> project details
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Project Details</h1>
        <p className="mt-1 text-sm text-muted-foreground">View and manage project information</p>
      </div>

      <div className="grid gap-6">
        {/* Project Details */}
        <Card>
          <CardContent className="grid gap-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold tracking-tight">
                  {typeof currentProject.title === 'string'
                    ? currentProject.title
                    : 'Untitled Project'}
                </h2>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <StatusBadge
                    status={
                      typeof currentProject.status === 'string' ? currentProject.status : 'Unknown'
                    }
                  />
                  <Badge variant="outline" className="font-mono text-[11px] tracking-widest">
                    Owner: {getOwnerUsername()}
                  </Badge>
                </div>
              </div>
              {isOwner ? (
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleEdit}
                    aria-label="Edit project"
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleDelete}
                    aria-label="Delete project"
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ) : (
                <div>
                  {!user ? (
                    <Button variant="outline" onClick={() => navigate('/login')}>
                      Login to Collaborate
                    </Button>
                  ) : collaborationStatus === 'pending' ? (
                    <Button variant="outline" disabled>
                      Request Pending
                    </Button>
                  ) : collaborationStatus === 'accepted' ? (
                    <Button disabled>Collaborator</Button>
                  ) : (
                    <Button
                      onClick={handleCollaborate}
                      disabled={requestCollaborationMutation.isPending}
                    >
                      {requestCollaborationMutation.isPending
                        ? 'Sending...'
                        : 'Request Collaboration'}
                    </Button>
                  )}
                </div>
              )}
            </div>

            <p className="text-sm leading-relaxed text-foreground">
              {typeof currentProject.description === 'string'
                ? currentProject.description
                : 'No description available.'}
            </p>

            <Separator />

            {/* Project Metadata */}
            <div>
              <h3 className="mb-3 text-base font-semibold">Project Information</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="size-4" />
                    <span>
                      <strong className="text-foreground">Created:</strong>{' '}
                      {new Date(currentProject.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="size-4" />
                    <span>
                      <strong className="text-foreground">Updated:</strong>{' '}
                      {new Date(currentProject.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <UserIcon className="size-4" />
                    <span>
                      <strong className="text-foreground">Collaborators:</strong>{' '}
                      {currentProject.collaborators?.length || 0}
                    </span>
                  </div>
                </div>
                <div className="grid gap-2">
                  {currentProject.githubUrl && (
                    <div className="flex items-center gap-2 text-sm">
                      <GitBranch className="size-4 text-muted-foreground" />
                      <a
                        href={currentProject.githubUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        GitHub Repository
                      </a>
                    </div>
                  )}
                  {currentProject.liveUrl && (
                    <div className="flex items-center gap-2 text-sm">
                      <ExternalLink className="size-4 text-muted-foreground" />
                      <a
                        href={currentProject.liveUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        Live Demo
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Technologies */}
            {currentProject.technologies && currentProject.technologies.length > 0 && (
              <div>
                <h3 className="mb-3 flex items-center gap-2 text-base font-semibold">
                  <Code2 className="size-4" />
                  Technologies
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {currentProject.technologies.map((tech) => (
                    <Badge key={tech} variant="outline" className="text-primary">
                      {tech}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Project Incentives - Simple Indicator */}
            {currentProject.incentives && currentProject.incentives.enabled && (
              <div>
                <h3 className="mb-3 text-base font-semibold text-foreground">
                  💰 Project Incentives Available
                </h3>
                <div className="rounded-lg border border-border bg-muted p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="text-lg">🎁</span>
                    <span className="text-base font-semibold">Incentives Available</span>
                  </div>

                  <p className="mb-1 text-sm">
                    This project offers incentives to contributors. Details will be discussed
                    privately with accepted collaborators.
                  </p>

                  <p className="text-sm italic text-muted-foreground">
                    💬 Contact the project owner for more information about available rewards.
                  </p>
                </div>
              </div>
            )}

            {/* Required Skills */}
            {currentProject.requiredSkills && currentProject.requiredSkills.length > 0 && (
              <div>
                <h3 className="mb-3 text-base font-semibold">Required Skills</h3>
                <div className="flex flex-wrap gap-1.5">
                  {currentProject.requiredSkills.map((skill) => (
                    <Badge key={skill} variant="secondary">
                      {skill}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Tags */}
            {currentProject.tags && currentProject.tags.length > 0 && (
              <div>
                <h3 className="mb-3 text-base font-semibold">Tags</h3>
                <div className="flex flex-wrap gap-1.5">
                  {currentProject.tags.map((tag) => (
                    <Badge key={tag} variant="outline">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Resources */}
            {currentProject.resources && currentProject.resources.length > 0 && (
              <div>
                <h3 className="mb-3 text-base font-semibold">Resources</h3>
                <ul className="grid gap-3">
                  {currentProject.resources.map((resource) => (
                    <li key={(resource as { _id?: string })._id || resource.url}>
                      <p className="text-sm font-medium text-foreground">{resource.name}</p>
                      <a
                        href={resource.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline"
                      >
                        {resource.url}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Pending Collaboration Requests (for project owners) */}
            {isOwner &&
              currentProject.collaborators &&
              currentProject.collaborators.filter((c) => c.status === 'pending').length > 0 && (
                <div>
                  <h3 className="mb-3 text-base font-semibold text-brand-amber">
                    Pending Collaboration Requests
                  </h3>
                  <ul className="grid gap-2">
                    {currentProject.collaborators
                      .filter((collaborator) => collaborator.status === 'pending')
                      .map((collaborator) => (
                        <li
                          key={collaborator._id || getUserId(collaborator.userId)}
                          className="flex items-center gap-3 rounded-lg border border-border p-3"
                        >
                          <Avatar>
                            <AvatarFallback>
                              {getCollaboratorUsername(collaborator)[0] || 'C'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-foreground">
                              {getCollaboratorUsername(collaborator)}
                            </p>
                            <p className="truncate text-sm text-muted-foreground">
                              {getCollaboratorEmail(collaborator)}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
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
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                handleCollaborationResponse(
                                  getUserId(collaborator.userId) || '',
                                  'rejected'
                                )
                              }
                              disabled={handleCollaborationMutation.isPending}
                              className="text-destructive hover:text-destructive"
                            >
                              {handleCollaborationMutation.isPending ? 'Processing...' : 'Reject'}
                            </Button>
                          </div>
                        </li>
                      ))}
                  </ul>
                </div>
              )}

            {/* Collaborators */}
            {currentProject.collaborators &&
              currentProject.collaborators.filter((c) => c.status === 'accepted').length > 0 && (
                <div>
                  <h3 className="mb-3 text-base font-semibold">Collaborators</h3>
                  <ul className="grid gap-2">
                    {currentProject.collaborators
                      .filter((collaborator) => collaborator.status === 'accepted')
                      .map((collaborator) => (
                        <li
                          key={collaborator._id || getUserId(collaborator.userId)}
                          className="flex items-center gap-3 rounded-lg border border-border p-3"
                        >
                          <Avatar>
                            <AvatarFallback>
                              {getCollaboratorUsername(collaborator)[0] || 'C'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-foreground">
                              {getCollaboratorUsername(collaborator)}
                            </p>
                            <p className="truncate text-sm text-muted-foreground">
                              {getCollaboratorEmail(collaborator)}
                            </p>
                          </div>
                          <Badge>Accepted</Badge>
                        </li>
                      ))}
                  </ul>
                </div>
              )}
          </CardContent>
        </Card>

        {/* Comments Section */}
        <Card>
          <CardContent className="grid gap-4">
            <h2 className="text-xl font-semibold">Comments</h2>

            {user && (
              <form onSubmit={handleCommentSubmit} className="grid gap-2">
                <Textarea
                  rows={3}
                  placeholder="Write a comment..."
                  value={comment}
                  onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setComment(e.target.value)}
                />
                <div>
                  <Button
                    type="submit"
                    disabled={!comment.trim() || createCommentMutation.isPending}
                  >
                    {createCommentMutation.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <>
                        Post Comment
                        <Send className="size-4" />
                      </>
                    )}
                  </Button>
                </div>
              </form>
            )}

            {commentSuccess && (
              <Alert className="border-primary/40">
                <AlertDescription>Comment posted successfully!</AlertDescription>
              </Alert>
            )}

            {(commentsError || createCommentMutation.error) && (
              <Alert variant="destructive">
                <AlertDescription>
                  {(commentsError as Error & { response?: { data?: { message?: string } } })
                    ?.response?.data?.message ||
                    commentsError?.message ||
                    (
                      createCommentMutation.error as Error & {
                        response?: { data?: { message?: string } };
                      }
                    )?.response?.data?.message ||
                    createCommentMutation.error?.message ||
                    'Error loading or posting comments'}
                </AlertDescription>
              </Alert>
            )}

            {commentsLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <ul className="grid gap-4">
                {comments && comments.length > 0 ? (
                  comments.map((commentItem) => (
                    <React.Fragment key={commentItem._id}>
                      <li className="flex items-start gap-3">
                        <Avatar>
                          <AvatarFallback>
                            {(
                              commentItem.userId as
                                | User
                                | UserSummary
                                | { username?: string }
                                | undefined
                            )?.username?.[0] || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium text-foreground">
                              {(
                                commentItem.userId as
                                  | User
                                  | UserSummary
                                  | { username?: string }
                                  | undefined
                              )?.username || 'Unknown User'}
                            </span>
                            <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                              {new Date(commentItem.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {commentItem.content}
                          </p>
                        </div>
                      </li>
                      <Separator />
                    </React.Fragment>
                  ))
                ) : (
                  <li>
                    <p className="text-sm font-medium text-foreground">No comments yet</p>
                    <p className="text-sm text-muted-foreground">
                      Be the first to comment on this project!
                    </p>
                  </li>
                )}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Project</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this project? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProjectDetail;
