import React, { useState, useEffect, useRef, useMemo, ChangeEvent } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Search, Plus, Users, Calendar } from 'lucide-react';
import { useProjects } from '../hooks/projects';
import { useAuth } from '../hooks/auth';
import { ProjectListSkeleton } from '../components/common/Skeletons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

// API response types - standalone interfaces to handle _id fields
interface ProjectWithId {
  _id: string;
  id?: string;
  title: string;
  description: string;
  technologies?: string[];
  image?: string;
  createdAt: string;
  owner?:
    | {
        _id: string;
        username?: string;
      }
    | string
    | null;
  collaborators?: Array<{
    _id?: string;
    userId?: string;
  }>;
}

interface UserWithId {
  _id?: string;
  id?: string;
}

const ProjectList: React.FC = () => {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const projectRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const typedUser = user as UserWithId | null;

  // TanStack Query hook
  const { data: projects = [], isLoading, error, refetch } = useProjects();

  const typedProjects = projects as unknown as ProjectWithId[];

  // Scroll to project card if hash is present
  useEffect(() => {
    if (window.location.hash) {
      const id = window.location.hash.replace('#', '');
      setTimeout(() => {
        if (projectRefs.current[id]) {
          projectRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 200); // Wait for render
    }
  }, [projects]);

  const filteredProjects = useMemo(
    () =>
      typedProjects.filter(
        (project) =>
          project.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          project.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (project.technologies &&
            project.technologies.some((tech) =>
              tech.toLowerCase().includes(searchTerm.toLowerCase())
            ))
      ),
    [typedProjects, searchTerm]
  );

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
              <span className="text-brand-amber">//</span> projects
            </p>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Projects</h1>
          </div>
        </div>
        <ProjectListSkeleton count={6} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <Alert variant="destructive" className="flex items-center justify-between gap-4">
          <AlertDescription>
            Failed to load projects: {(error as Error).message}
          </AlertDescription>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Retry
          </Button>
        </Alert>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            <span className="text-brand-amber">//</span> projects
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Projects</h1>
        </div>
        <Button asChild>
          <RouterLink to="/projects/create">
            <Plus className="size-4" />
            Create Project
          </RouterLink>
        </Button>
      </div>

      <div className="relative mb-8">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search projects..."
          value={searchTerm}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
          className="pl-9"
        />
      </div>

      <div
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        data-testid="project-list"
      >
        {filteredProjects.map((project) => (
          <div
            key={project._id}
            ref={(el: HTMLDivElement | null) => {
              projectRefs.current[project._id] = el;
            }}
          >
            <Card
              data-testid="project-card"
              className="group flex h-full flex-col gap-0 overflow-hidden py-0 transition-colors hover:border-primary/40 hover:shadow-sm"
            >
              {project.image && (
                <img
                  src={`http://localhost:5000${project.image}`}
                  alt={project.title}
                  className="h-48 w-full object-cover"
                />
              )}
              <CardContent className="flex flex-1 flex-col gap-3 p-6">
                <h2 className="text-lg font-semibold leading-tight">
                  <RouterLink
                    to={`/projects/${project._id}`}
                    className="transition-colors hover:text-primary"
                  >
                    {project.title}
                  </RouterLink>
                </h2>
                <p className="line-clamp-3 text-sm text-muted-foreground">
                  {project.description}
                </p>
                {project.technologies && project.technologies.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {project.technologies.map((tech) => (
                      <Badge key={tech} variant="secondary">
                        {tech}
                      </Badge>
                    ))}
                  </div>
                )}
                <div className="mt-auto flex items-center gap-4 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Users className="size-3.5" />
                    {project.collaborators ? project.collaborators.length : 0}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="size-3.5" />
                    {new Date(project.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </CardContent>
              <CardFooter className="gap-2 px-6 pb-6">
                <Button asChild variant="outline" size="sm">
                  <RouterLink to={`/projects/${project._id}`}>View Details</RouterLink>
                </Button>
                {project.owner &&
                  typeof project.owner === 'object' &&
                  project.owner._id === typedUser?._id && (
                    <Button asChild variant="ghost" size="sm">
                      <RouterLink to={`/projects/${project._id}/edit`}>Edit</RouterLink>
                    </Button>
                  )}
              </CardFooter>
            </Card>
          </div>
        ))}
      </div>

      {filteredProjects.length === 0 && (
        <div className="mt-8 text-center">
          <p className="text-lg font-semibold text-muted-foreground">
            {typedProjects.length === 0 ? 'No projects yet' : 'No projects found'}
          </p>
          <p className="text-sm text-muted-foreground">
            {typedProjects.length === 0
              ? 'Be the first to create a project!'
              : 'Try adjusting your search terms or create a new project.'}
          </p>
        </div>
      )}
    </div>
  );
};

export default ProjectList;
