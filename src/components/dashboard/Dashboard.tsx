import React from 'react';
import { toast } from 'sonner';
import { useNavigate } from '@tanstack/react-router';
import { Loader2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useAuth } from '../../hooks/auth';
import { useHandleCollaborationRequest } from '../../hooks/projects';
import type { Project, User, CollaboratorStatus } from '../../types';

// Extended types for API response format
interface ProjectWithId extends Omit<Project, 'id'> {
  _id: string;
  id?: string;
}

interface CollaborationRequest {
  _id: string;
  user: {
    _id: string;
    username: string;
  };
  project: {
    _id: string;
    title: string;
  };
  status: CollaboratorStatus;
}

interface UserWithCollaborations extends Omit<User, 'id'> {
  _id?: string;
  projects?: ProjectWithId[];
  collaborationRequests?: CollaborationRequest[];
}

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const handleCollaborationMutation = useHandleCollaborationRequest();

  const handleCreateProject = (): void => {
    navigate({ to: '/projects/create' });
  };

  const handleViewProject = (projectId: string): void => {
    navigate({ to: '/projects/$projectId', params: { projectId } });
  };

  const handleCollaborationRequest = (
    projectId: string,
    userId: string,
    status: 'accepted' | 'rejected'
  ): void => {
    handleCollaborationMutation.mutate(
      { projectId, userId, status },
      {
        onSuccess: () => {
          toast.success(`Request ${status}`);
        },
        onError: (error: Error & { response?: { data?: { message?: string } } }) => {
          toast.error(
            error?.response?.data?.message ||
              error?.message ||
              'Failed to handle collaboration request'
          );
        },
      }
    );
  };

  if (authLoading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="flex min-h-[300px] items-center justify-center gap-3">
          <Loader2 className="size-6 animate-spin text-primary" />
          <p className="text-lg font-medium">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <Alert variant="destructive" className="mb-6">
          <AlertTitle>Authentication Required</AlertTitle>
          <AlertDescription>You must be logged in to view your dashboard.</AlertDescription>
        </Alert>
        <Button onClick={() => navigate({ to: '/login' })}>Go to Login</Button>
      </div>
    );
  }

  const userWithCollabs = user as UserWithCollaborations;

  const statusVariant = (status: string): 'default' | 'secondary' | 'outline' =>
    status === 'completed' ? 'default' : status === 'in_progress' ? 'secondary' : 'outline';

  return (
    <div className="mx-auto grid max-w-5xl gap-6 px-4 py-8 md:grid-cols-3">
      {/* My Projects Section */}
      <Card className="md:col-span-2">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-lg">My Projects</CardTitle>
          <Button onClick={handleCreateProject}>
            <Plus className="size-4" />
            Create Project
          </Button>
        </CardHeader>
        <CardContent>
          {userWithCollabs.projects && userWithCollabs.projects.length > 0 ? (
            <ul className="divide-y divide-border">
              {userWithCollabs.projects.map((project) => (
                <li key={project._id}>
                  <button
                    type="button"
                    onClick={() => handleViewProject(project._id)}
                    className="flex w-full items-center justify-between gap-4 py-3 text-left transition-colors hover:bg-muted/50"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">{project.title}</p>
                      <p className="truncate text-sm text-muted-foreground">
                        {project.description}
                      </p>
                    </div>
                    <Badge variant={statusVariant(project.status)}>{project.status}</Badge>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-3 text-sm text-muted-foreground">No projects yet</p>
          )}
        </CardContent>
      </Card>

      {/* Collaboration Requests Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Collaboration Requests</CardTitle>
        </CardHeader>
        <CardContent>
          {userWithCollabs.collaborationRequests &&
          userWithCollabs.collaborationRequests.length > 0 ? (
            <ul className="space-y-3">
              {userWithCollabs.collaborationRequests.map((request, index) => (
                <li key={request._id}>
                  {index > 0 && <Separator className="mb-3" />}
                  <p className="text-sm text-foreground">
                    {`${request.user.username} wants to collaborate on ${request.project.title}`}
                  </p>
                  <p className="mt-0.5 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                    Status: {request.status}
                  </p>
                  {request.status === 'pending' && (
                    <div className="mt-2 flex gap-2">
                      <Button
                        size="sm"
                        disabled={handleCollaborationMutation.isPending}
                        onClick={() =>
                          handleCollaborationRequest(
                            request.project._id,
                            request.user._id,
                            'accepted'
                          )
                        }
                      >
                        {handleCollaborationMutation.isPending ? 'Processing...' : 'Accept'}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={handleCollaborationMutation.isPending}
                        onClick={() =>
                          handleCollaborationRequest(
                            request.project._id,
                            request.user._id,
                            'rejected'
                          )
                        }
                      >
                        {handleCollaborationMutation.isPending ? 'Processing...' : 'Reject'}
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-3 text-sm text-muted-foreground">
              No pending collaboration requests
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
