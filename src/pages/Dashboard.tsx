import React, { useMemo } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Plus, Users, CalendarDays, FolderGit2, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useAuth } from '../hooks/auth';
import { useProjects } from '../hooks/projects';
import { DashboardSkeleton } from '../components/common/Skeletons';
import type { ProjectStatus, CollaboratorStatus } from '../types';

// API response types
interface ProjectOwner {
  _id: string;
  username?: string;
}

interface ProjectCollaborator {
  _id?: string;
  userId?: { _id: string } | string;
  status?: CollaboratorStatus;
}

interface ProjectWithId {
  _id: string;
  id?: string;
  title: string;
  description: string;
  technologies?: string[];
  status?: ProjectStatus;
  owner?: ProjectOwner | string;
  collaborators?: ProjectCollaborator[];
  createdAt: string;
  updatedAt?: string;
}

interface UserWithId {
  _id?: string;
  id?: string;
  username?: string;
  email?: string;
}

const Dashboard: React.FC = () => {
  // Auth and project data
  const { user } = useAuth();
  const { data: projects = [], isLoading: loading, error, refetch } = useProjects();

  const typedUser = user as UserWithId | null;

  // Filter projects for the current user (owned or collaborated)
  const userProjects = useMemo(() => {
    return (projects as unknown as ProjectWithId[]).filter((project) => {
      const ownerId =
        typeof project.owner === 'object' && project.owner !== null
          ? (project.owner as ProjectOwner)._id
          : project.owner;
      const isOwner = ownerId === typedUser?._id;
      const isCollaborator = project.collaborators?.some((collab) => {
        const collabUserId =
          typeof collab.userId === 'object' && collab.userId !== null
            ? (collab.userId as { _id: string })._id
            : collab.userId;
        return collabUserId === typedUser?._id;
      });
      return isOwner || isCollaborator;
    });
  }, [projects, typedUser]);

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <DashboardSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <Alert variant="destructive" className="mb-6">
          <AlertTitle>Error Loading Dashboard</AlertTitle>
          <AlertDescription>
            {(error as Error & { response?: { data?: { message?: string } } })?.response?.data
              ?.message ||
              (error as Error)?.message ||
              'Failed to load dashboard data'}
          </AlertDescription>
        </Alert>
        <Button onClick={() => refetch()}>Try Again</Button>
      </div>
    );
  }

  const stats = [
    {
      icon: FolderGit2,
      label: 'total projects',
      value: userProjects.length,
    },
    {
      icon: Users,
      label: 'active collaborations',
      value: userProjects.reduce((sum, project) => sum + (project.collaborators?.length || 0), 0),
    },
    {
      icon: TrendingUp,
      label: 'technologies used',
      value: new Set(userProjects.flatMap((p) => p.technologies || [])).size,
    },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Welcome Section */}
      <div className="mb-8">
        <p className="mb-2 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
          <span className="text-brand-amber">//</span> dashboard
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Welcome back, {typedUser?.username || 'User'}!
        </h1>
        <p className="mt-1 text-muted-foreground">
          Here&apos;s what&apos;s happening with your projects today.
        </p>
      </div>

      {/* User Stats */}
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        {stats.map(({ icon: Icon, label, value }) => (
          <Card key={label}>
            <CardContent className="flex items-center gap-4">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="size-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{value}</p>
                <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                  {label}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* My Projects Section */}
      <div className="mb-8">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold tracking-tight">My Projects</h2>
          <Button asChild>
            <RouterLink to="/projects/create">
              <Plus className="size-4" />
              Create New Project
            </RouterLink>
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          {userProjects.map((project) => {
            const ownerId =
              typeof project.owner === 'object' && project.owner !== null
                ? project.owner._id
                : project.owner;
            const isOwner = ownerId === typedUser?._id;
            return (
              <Card key={project._id} className="flex flex-col">
                <CardContent className="flex-1">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-foreground">{project.title}</h3>
                    <Badge variant={isOwner ? 'default' : 'secondary'}>
                      {isOwner ? 'Owner' : 'Collaborator'}
                    </Badge>
                  </div>
                  <p className="mb-3 text-sm text-muted-foreground">{project.description}</p>
                  {project.technologies && project.technologies.length > 0 && (
                    <div className="mb-3 flex flex-wrap gap-1.5">
                      {project.technologies.map((tech) => (
                        <Badge key={tech} variant="outline">
                          {tech}
                        </Badge>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-4 text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Users className="size-4" />
                      <span className="text-sm">{project.collaborators?.length || 0}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <CalendarDays className="size-4" />
                      <span className="text-sm">
                        {new Date(project.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="gap-2">
                  <Button asChild variant="ghost" size="sm">
                    <RouterLink to={`/projects/${project._id}`}>View Details</RouterLink>
                  </Button>
                  {isOwner && (
                    <Button asChild variant="ghost" size="sm">
                      <RouterLink to={`/projects/${project._id}/edit`}>Edit</RouterLink>
                    </Button>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>

        {userProjects.length === 0 && (
          <div className="mt-8 text-center">
            <h3 className="text-lg font-semibold text-foreground">No projects yet</h3>
            <p className="mb-4 mt-1 text-sm text-muted-foreground">
              Start by creating your first project or joining an existing one.
            </p>
            <Button asChild>
              <RouterLink to="/projects/create">
                <Plus className="size-4" />
                Create Your First Project
              </RouterLink>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
