import React, { useEffect, useMemo, useRef } from 'react';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import { Search, Plus, Users, Calendar, X, Star } from 'lucide-react';
import { useProjects } from '../hooks/projects';
import { useAuth } from '../hooks/auth';
import { ProjectListSkeleton } from '../components/common/Skeletons';
import AvatarGroup from '../components/common/AvatarGroup';
import {
  toProjectQuery,
  sortProjects,
  type ProjectFilterState,
  type ProjectSort,
} from '@/lib/projectFilters';
import type { ProjectFilters } from '../services/projectsService';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface ProjectWithId {
  _id: string;
  id?: string;
  title: string;
  description: string;
  technologies?: string[];
  image?: string;
  createdAt: string;
  collaboratorCount?: number;
  owner?: { _id: string; username?: string } | string | null;
  collaborators?: Array<{
    status?: string;
    userId?: { _id?: string; username?: string; profileImage?: string } | string;
  }>;
}
interface UserWithId {
  _id?: string;
  id?: string;
}

const SKILLS = ['JavaScript', 'Python', 'Java', 'React', 'Node.js'];

const ProjectList: React.FC = () => {
  const { user } = useAuth();
  const typedUser = user as UserWithId | null;
  const projectRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [searchParams, setSearchParams] = useSearchParams();

  const state: ProjectFilterState = {
    search: searchParams.get('q') ?? '',
    status: searchParams.get('status') ?? 'all',
    technology: searchParams.get('tech') ?? 'all',
    featured: searchParams.get('featured') === 'true',
    sort: (searchParams.get('sort') as ProjectSort) ?? 'newest',
  };

  const setFilter = (key: string, value: string | null): void => {
    const next = new URLSearchParams(searchParams);
    if (!value || value === 'all' || value === '' || value === 'false') next.delete(key);
    else next.set(key, value);
    setSearchParams(next);
  };
  const clearFilters = (): void => setSearchParams(new URLSearchParams());
  const hasActiveFilters =
    !!state.search ||
    state.status !== 'all' ||
    state.technology !== 'all' ||
    !!state.featured ||
    (state.sort && state.sort !== 'newest');

  const filters = useMemo(
    () => toProjectQuery(state) as ProjectFilters,
    [state.search, state.status, state.technology, state.featured]
  );

  const { data: projects = [], isLoading, error, refetch } = useProjects(filters);
  const typed = projects as unknown as ProjectWithId[];
  const displayProjects = useMemo(
    () => sortProjects(typed, state.sort ?? 'newest'),
    [typed, state.sort]
  );

  useEffect(() => {
    if (window.location.hash) {
      const id = window.location.hash.replace('#', '');
      setTimeout(() => projectRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 200);
    }
  }, [projects]);

  const header = (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
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
  );

  const controls = (
    <>
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2 lg:col-span-1">
          <Label htmlFor="project-search" className="sr-only">
            Search projects
          </Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="project-search"
              data-testid="project-search"
              placeholder="Search projects…"
              value={state.search}
              onChange={(e) => setFilter('q', e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
        <Select value={state.status} onValueChange={(v) => setFilter('status', v)}>
          <SelectTrigger data-testid="filter-status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="ideation">Ideation</SelectItem>
            <SelectItem value="in_progress">In progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={state.technology} onValueChange={(v) => setFilter('tech', v)}>
          <SelectTrigger data-testid="filter-tech">
            <SelectValue placeholder="Technology" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All tech</SelectItem>
            {SKILLS.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={state.sort} onValueChange={(v) => setFilter('sort', v)}>
          <SelectTrigger data-testid="project-sort">
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest</SelectItem>
            <SelectItem value="oldest">Oldest</SelectItem>
            <SelectItem value="collaborators">Most collaborators</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant={state.featured ? 'default' : 'outline'}
          size="sm"
          className="gap-1.5"
          aria-pressed={state.featured}
          onClick={() => setFilter('featured', state.featured ? null : 'true')}
        >
          <Star className={cn('size-3.5', state.featured && 'fill-current')} />
          Featured
        </Button>
        {hasActiveFilters && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            data-testid="clear-filters"
            onClick={clearFilters}
            className="gap-1.5 text-muted-foreground"
          >
            <X className="size-3.5" />
            Clear filters
          </Button>
        )}
        <span
          data-testid="project-count"
          className="ml-auto font-mono text-[11px] uppercase tracking-widest text-muted-foreground"
        >
          {isLoading ? '…' : `${displayProjects.length} project${displayProjects.length === 1 ? '' : 's'}`}
        </span>
      </div>
    </>
  );

  return (
    <div className="mx-auto max-w-6xl">
      {header}
      {controls}
      {isLoading ? (
        <ProjectListSkeleton count={6} />
      ) : error ? (
        <Alert variant="destructive" className="flex items-center justify-between gap-4">
          <AlertDescription>Failed to load projects: {(error as Error).message}</AlertDescription>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Retry
          </Button>
        </Alert>
      ) : displayProjects.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="project-list">
          {displayProjects.map((project) => (
            <div
              key={project._id}
              ref={(el) => {
                projectRefs.current[project._id] = el;
              }}
            >
              <Card
                data-testid="project-card"
                className="group flex h-full flex-col transition-colors hover:border-primary/40 hover:shadow-sm"
              >
                <CardContent className="flex flex-1 flex-col gap-3">
                  <h2 className="text-lg font-semibold leading-tight">
                    <RouterLink
                      to={`/projects/${project._id}`}
                      className="transition-colors hover:text-primary"
                    >
                      {project.title}
                    </RouterLink>
                  </h2>
                  <p className="line-clamp-3 text-sm text-muted-foreground">{project.description}</p>
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
                      {project.collaboratorCount ?? project.collaborators?.length ?? 0}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="size-3.5" />
                      {new Date(project.createdAt).toLocaleDateString()}
                    </span>
                    <AvatarGroup
                      className="ml-auto"
                      max={4}
                      members={(project.collaborators ?? [])
                        .filter((c) => c.status === 'accepted' && typeof c.userId === 'object')
                        .map((c) => c.userId as { _id?: string; username?: string; profileImage?: string })}
                    />
                  </div>
                </CardContent>
                <CardFooter className="gap-2">
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
      ) : (
        <div className="rounded-lg border border-dashed py-16 text-center">
          <p className="text-sm text-muted-foreground">
            {hasActiveFilters ? 'No projects match your filters.' : 'No projects yet.'}
          </p>
          {hasActiveFilters && (
            <Button variant="link" onClick={clearFilters} className="mt-1">
              Clear filters
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default ProjectList;
