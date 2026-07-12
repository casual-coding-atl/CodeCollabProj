import React, { useState, useMemo, type ChangeEvent } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Search, Loader2 } from 'lucide-react';
import { useProjects, useProjectSearch } from '../../hooks/projects';
import type { ProjectFilters } from '../../services/projectsService';
import type { Project } from '../../types';
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

// Extended Project type for API responses
interface ProjectApiResponse extends Omit<Project, 'id'> {
  _id: string;
}

const ProjectList: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [skillFilter, setSkillFilter] = useState<string>('');

  // Build filters object for API call
  const filters = useMemo((): ProjectFilters => {
    const filterObj: ProjectFilters = {};
    if (statusFilter !== 'all') filterObj.status = statusFilter;
    if (skillFilter) filterObj.technologies = skillFilter;
    return filterObj;
  }, [statusFilter, skillFilter]);

  // TanStack Query hooks
  const {
    data: projects = [],
    isLoading,
    error,
    refetch,
  } = useProjects(filters) as unknown as {
    data: ProjectApiResponse[];
    isLoading: boolean;
    error: Error | null;
    refetch: () => void;
  };

  // useProjectSearch already handles enabled internally based on query length
  const { data: searchResults = [], isLoading: isSearching } = useProjectSearch(searchQuery) as unknown as {
    data: ProjectApiResponse[];
    isLoading: boolean;
  };

  const handleSearch = (e: ChangeEvent<HTMLInputElement>): void => {
    setSearchQuery(e.target.value);
  };

  const handleStatusFilter = (value: string): void => {
    setStatusFilter(value);
  };

  const handleSkillFilter = (value: string): void => {
    setSkillFilter(value === 'all' ? '' : value);
  };

  // Determine which projects to display
  const displayProjects: ProjectApiResponse[] = searchQuery.length > 2 ? searchResults : projects;

  if (isLoading) {
    return (
      <div className="mx-auto flex max-w-6xl justify-center px-4 py-16 sm:px-6">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <Alert variant="destructive" className="flex items-center justify-between gap-4">
          <AlertDescription>Failed to load projects: {error.message}</AlertDescription>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Retry
          </Button>
        </Alert>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      {/* Search and Filter Section */}
      <div className="mb-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <Label htmlFor="project-search" className="sr-only">
            Search Projects
          </Label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              {isSearching ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Search className="size-4" />
              )}
            </span>
            <Input
              id="project-search"
              placeholder="Search Projects"
              value={searchQuery}
              onChange={handleSearch}
              className="pl-9"
            />
          </div>
          {searchQuery.length > 0 && searchQuery.length <= 2 && (
            <p className="mt-1.5 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
              Type at least 3 characters to search
            </p>
          )}
        </div>

        <div>
          <Label className="mb-1.5 block font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            Status
          </Label>
          <Select value={statusFilter} onValueChange={handleStatusFilter}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="ideation">Ideation</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="mb-1.5 block font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            Required Skill
          </Label>
          <Select value={skillFilter || 'all'} onValueChange={handleSkillFilter}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Required Skill" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Skills</SelectItem>
              <SelectItem value="javascript">JavaScript</SelectItem>
              <SelectItem value="python">Python</SelectItem>
              <SelectItem value="java">Java</SelectItem>
              <SelectItem value="react">React</SelectItem>
              <SelectItem value="node">Node.js</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Projects Grid */}
      {displayProjects?.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {displayProjects.map((project) => (
            <Card
              key={project._id}
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
                <p className="line-clamp-3 text-sm text-muted-foreground">
                  {project.description}
                </p>
                {project.requiredSkills && project.requiredSkills.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {project.requiredSkills.map((skill) => (
                      <Badge key={skill} variant="outline" className="text-primary">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                )}
                <div className="mt-auto">
                  <Badge
                    variant={
                      project.status === 'completed'
                        ? 'default'
                        : project.status === 'in_progress'
                          ? 'secondary'
                          : 'outline'
                    }
                    className="font-mono text-[11px] uppercase tracking-widest"
                  >
                    {project.status}
                  </Badge>
                </div>
              </CardContent>
              <CardFooter>
                <Button asChild variant="outline" size="sm">
                  <RouterLink to={`/projects/${project._id}`}>View Details</RouterLink>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <p className="text-center text-muted-foreground">
          {searchQuery.length > 2
            ? 'No projects found matching your search'
            : 'No projects found'}
        </p>
      )}
    </div>
  );
};

export default ProjectList;
