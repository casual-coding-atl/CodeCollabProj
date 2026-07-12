import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
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

const DEFAULT_STATE: ProjectFilterState = {
  search: '',
  status: 'all',
  technology: 'all',
  featured: false,
  sort: 'newest',
};

function readFiltersFromUrl(): ProjectFilterState {
  if (typeof window === 'undefined') return { ...DEFAULT_STATE };
  const sp = new URLSearchParams(window.location.search);
  return {
    search: sp.get('q') ?? '',
    status: sp.get('status') ?? 'all',
    technology: sp.get('tech') ?? 'all',
    featured: sp.get('featured') === 'true',
    sort: (sp.get('sort') as ProjectSort) ?? 'newest',
  };
}

const ProjectList: React.FC = () => {
  const { user } = useAuth();
  const typedUser = user as UserWithId | null;
  const projectRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Filter state is local; the URL is synced directly with History (shareable)
  // rather than via the router's search serializer, which mangles string values
  // like "true" on repeated writes.
  const [state, setState] = useState<ProjectFilterState>(readFiltersFromUrl);

  const patch = (partial: Partial<ProjectFilterState>): void => {
    setState((prev) => {
      const next = { ...prev, ...partial };
      if (typeof window !== 'undefined') {
        const sp = new URLSearchParams();
        if (next.search) sp.set('q', next.search);
        if (next.status && next.status !== 'all') sp.set('status', next.status);
        if (next.technology && next.technology !== 'all') sp.set('tech', next.technology);
        if (next.featured) sp.set('featured', 'true');
        if (next.sort && next.sort !== 'newest') sp.set('sort', next.sort);
        const qs = sp.toString();
        window.history.replaceState(null, '', qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
      }
      return next;
    });
  };

  const clearFilters = (): void => {
    setState({ ...DEFAULT_STATE });
    if (typeof window !== 'undefined') window.history.replaceState(null, '', window.location.pathname);
  };

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
    <div className="mb-6 space-y-3">
      {/* Toolbar: search grows, filters grouped at fixed widths */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        <div className="relative w-full md:flex-1">
          <Label htmlFor="project-search" className="sr-only">
            Search projects
          </Label>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="project-search"
            data-testid="project-search"
            placeholder="Search projects…"
            value={state.search}
            onChange={(e) => patch({ search: e.target.value })}
            className="pl-9"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={state.status} onValueChange={(v) => patch({ status: v })}>
            <SelectTrigger data-testid="filter-status" className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="ideation">Ideation</SelectItem>
              <SelectItem value="in_progress">In progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={state.technology} onValueChange={(v) => patch({ technology: v })}>
            <SelectTrigger data-testid="filter-tech" className="w-[140px]">
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
          <Select value={state.sort} onValueChange={(v) => patch({ sort: v as ProjectSort })}>
            <SelectTrigger data-testid="project-sort" className="w-[170px]">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="oldest">Oldest</SelectItem>
              <SelectItem value="collaborators">Most collaborators</SelectItem>
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant={state.featured ? 'default' : 'outline'}
            className="gap-1.5"
            aria-pressed={state.featured}
            onClick={() => patch({ featured: !state.featured })}
          >
            <Star className={cn('size-3.5', state.featured && 'fill-current')} />
            Featured
          </Button>
        </div>
      </div>

      {/* Meta row: active-filter reset + result count */}
      <div className="flex min-h-6 items-center gap-3">
        {hasActiveFilters && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            data-testid="clear-filters"
            onClick={clearFilters}
            className="h-6 gap-1.5 px-2 text-muted-foreground"
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
    </div>
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
