import React, { useState } from 'react';
import { toast } from 'sonner';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2, X, Loader2, Check, ChevronsUpDown } from 'lucide-react';
import { useAuth } from '../../hooks/auth';
import { useProject, useCreateProject, useUpdateProject } from '../../hooks/projects';
import type {
  ProjectStatus,
  ProjectResource,
  Project,
  User,
  UserSummary,
} from '../../types';
import { cn } from '@/lib/utils';
import { addTag, removeTag } from '@/lib/tags';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';

// Extended Project type for API responses
interface ProjectApiResponse extends Omit<Project, 'id' | 'owner' | 'resources'> {
  _id: string;
  owner?: User | UserSummary | { _id: string; username?: string };
  resources?: (ProjectResource & { _id?: string })[];
}

// Type for the useProject hook return
interface UseProjectResult {
  data: ProjectApiResponse | undefined;
  isLoading: boolean;
  error: Error | null;
}

// Mirrors the previous inline validation (title/description) and the per-resource
// name/url pairing rule, while preserving the exact payload shape sent to the API.
const projectSchema = z
  .object({
    title: z
      .string()
      .min(1, 'Title is required')
      .min(3, 'Title must be at least 3 characters'),
    description: z
      .string()
      .min(1, 'Description is required')
      .min(10, 'Description must be at least 10 characters'),
    technologies: z.array(z.string()),
    requiredSkills: z.array(z.string()),
    tags: z.array(z.string()),
    githubUrl: z.string(),
    liveUrl: z.string(),
    resources: z.array(z.object({ name: z.string(), url: z.string() })),
    status: z.enum(['ideation', 'in_progress', 'completed']),
    incentives: z.object({
      enabled: z.boolean(),
      type: z.enum(['monetary', 'equity', 'recognition', 'learning', 'other']),
      description: z.string(),
      amount: z.number(),
      currency: z.string(),
      equityPercentage: z.number(),
      customReward: z.string(),
    }),
  })
  .superRefine((data, ctx) => {
    data.resources.forEach((resource, index) => {
      if (resource.name && !resource.url) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'URL is required if name is provided',
          path: ['resources', index, 'url'],
        });
      }
      if (!resource.name && resource.url) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Name is required if URL is provided',
          path: ['resources', index, 'name'],
        });
      }
    });
  });

type ProjectFormValues = z.infer<typeof projectSchema>;

// Maps a fetched project (or undefined, for create mode) into initial form state.
const mapProjectToFormData = (initialProject: ProjectApiResponse | undefined): ProjectFormValues => {
  if (!initialProject) {
    return {
      title: '',
      description: '',
      technologies: [],
      requiredSkills: [],
      tags: [],
      githubUrl: '',
      liveUrl: '',
      resources: [{ name: '', url: '' }],
      status: 'ideation',
      incentives: {
        enabled: false,
        type: 'recognition',
        description: '',
        amount: 0,
        currency: 'USD',
        equityPercentage: 0,
        customReward: '',
      },
    };
  }

  return {
    title: initialProject.title || '',
    description: initialProject.description || '',
    technologies: initialProject.technologies || [],
    requiredSkills: initialProject.requiredSkills || [],
    tags: initialProject.tags || [],
    githubUrl: initialProject.githubUrl || '',
    liveUrl: initialProject.liveUrl || '',
    resources: initialProject.resources?.length
      ? initialProject.resources.map((r) => ({ name: r.name, url: r.url }))
      : [{ name: '', url: '' }],
    status: initialProject.status || 'ideation',
    incentives: {
      enabled: initialProject.incentives?.enabled ?? false,
      type: initialProject.incentives?.type ?? 'recognition',
      description: initialProject.incentives?.description ?? '',
      amount: initialProject.incentives?.amount ?? 0,
      currency: initialProject.incentives?.currency ?? 'USD',
      equityPercentage: initialProject.incentives?.equityPercentage ?? 0,
      customReward: initialProject.incentives?.customReward ?? '',
    },
  };
};

interface ComboboxTagEditorProps {
  id: string;
  label: string;
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  options?: string[];
}

// Combobox tag editor: suggests from `options` and accepts free-text custom values.
// Preserves the array-of-strings state shape the previous editor produced.
const ComboboxTagEditor: React.FC<ComboboxTagEditorProps> = ({
  id,
  label,
  value,
  onChange,
  placeholder = 'Select or type…',
  options = [],
}) => {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');

  const commit = (raw: string): void => {
    const next = addTag(value, raw);
    if (next !== value) {
      onChange(next);
    }
    setInputValue('');
  };

  const trimmed = inputValue.trim();
  const available = options.filter((opt) => !value.includes(opt));
  const showCreate =
    trimmed.length > 0 &&
    !value.includes(trimmed) &&
    !options.some((opt) => opt.toLowerCase() === trimmed.toLowerCase());

  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((tag) => (
            <Badge key={tag} variant="secondary" className="gap-1">
              {tag}
              <button
                type="button"
                onClick={() => onChange(removeTag(value, tag))}
                aria-label={`Remove ${tag}`}
                className="rounded-full outline-none hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal text-muted-foreground"
          >
            {placeholder}
            <ChevronsUpDown className="size-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command>
            <CommandInput
              placeholder="Search or add…"
              value={inputValue}
              onValueChange={setInputValue}
            />
            <CommandList>
              <CommandEmpty>No matches. Type to add a custom value.</CommandEmpty>
              {available.length > 0 && (
                <CommandGroup heading="Suggestions">
                  {available.map((opt) => (
                    <CommandItem key={opt} value={opt} onSelect={() => commit(opt)}>
                      <Check
                        className={cn(
                          'size-4',
                          value.includes(opt) ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                      {opt}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {showCreate && (
                <CommandGroup heading="Add custom">
                  <CommandItem value={trimmed} onSelect={() => commit(trimmed)}>
                    <Plus className="size-4" />
                    Add &quot;{trimmed}&quot;
                  </CommandItem>
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
};

interface ProjectFormFieldsProps {
  initialProject: ProjectApiResponse | undefined;
  projectId: string | undefined;
}

// Owns the editable form state. Seeded once from initialProject via RHF defaultValues;
// the parent remounts this via `key` when the project identity changes, so a background
// refetch of the same project never clobbers in-progress edits.
const ProjectFormFields: React.FC<ProjectFormFieldsProps> = ({ initialProject, projectId }) => {
  const navigate = useNavigate();

  // Mutations
  const createProjectMutation = useCreateProject();
  const updateProjectMutation = useUpdateProject();

  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema),
    mode: 'onTouched',
    defaultValues: mapProjectToFormData(initialProject),
  });

  const {
    fields: resourceFields,
    append: appendResource,
    remove: removeResourceField,
  } = useFieldArray({ control: form.control, name: 'resources' });

  const commonSkills: string[] = [
    'JavaScript',
    'Python',
    'Java',
    'React',
    'Node.js',
    'TypeScript',
    'HTML',
    'CSS',
    'MongoDB',
    'SQL',
    'Git',
    'Docker',
  ];

  const technologies = form.watch('technologies');
  const requiredSkills = form.watch('requiredSkills');
  const tags = form.watch('tags');
  const incentivesEnabled = form.watch('incentives.enabled');

  // Helper function for handling submission errors
  const handleSubmissionError = (
    error: Error & {
      response?: { data?: { message?: string }; status?: number };
      status?: number;
      data?: unknown;
      message?: string;
    }
  ): void => {
    console.error('❌ Error saving project:', error);
    console.error('❌ Error details:', {
      message: error.message,
      status: error.status,
      data: error.data,
    });

    // Better error handling with more specific messages
    let errorMessage = 'Error saving project. Please try again.';

    if (error?.response?.data?.message) {
      errorMessage = `Error saving project: ${error.response.data.message}`;
    } else if (error?.message) {
      errorMessage = `Error saving project: ${error.message}`;
    } else if (error?.response?.status === 401) {
      errorMessage = 'Authentication error. Please log in again.';
    } else if (error?.response?.status === 403) {
      errorMessage = 'You are not authorized to edit this project.';
    } else if (error?.response?.status === 404) {
      errorMessage = 'Project not found.';
    } else if (error?.response?.status === 422) {
      errorMessage = 'Invalid data. Please check your input.';
    } else if (error?.response?.status && error.response.status >= 500) {
      errorMessage = 'Server error. Please try again later.';
    }

    toast.error(errorMessage);
  };

  const onValid = (values: ProjectFormValues): void => {
    const filteredResources = values.resources.filter(
      (resource) => resource.name && resource.url
    );

    // Ensure arrays are properly formatted
    const projectData = {
      ...values,
      resources: filteredResources,
      requiredSkills: Array.isArray(values.requiredSkills) ? values.requiredSkills : [],
      technologies: Array.isArray(values.technologies) ? values.technologies : [],
      tags: Array.isArray(values.tags) ? values.tags : [],
    };


    if (projectId) {
      updateProjectMutation.mutate(
        { projectId, projectData },
        {
          onSuccess: () => {
            toast.success('Project updated');
            navigate('/projects');
          },
          onError: (error) => {
            handleSubmissionError(
              error as Error & { response?: { data?: { message?: string }; status?: number } }
            );
          },
        }
      );
    } else {
      createProjectMutation.mutate(projectData, {
        onSuccess: () => {
          toast.success('Project created');
          navigate('/projects');
        },
        onError: (error) => {
          handleSubmissionError(
            error as Error & { response?: { data?: { message?: string }; status?: number } }
          );
        },
      });
    }
  };

  const onInvalid = (): void => {
    toast.error('Please fix the form errors before submitting.');
  };

  const isSaving = createProjectMutation.isPending || updateProjectMutation.isPending;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <Card>
        <CardHeader>
          <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            <span className="text-brand-amber">//</span> {projectId ? 'edit' : 'create'}
          </p>
          <CardTitle className="text-2xl font-bold tracking-tight">
            {projectId ? 'Edit Project' : 'Create Project'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(createProjectMutation.error || updateProjectMutation.error) && (
            <Alert variant="destructive" className="mb-6">
              <AlertDescription>
                {(
                  createProjectMutation.error as Error & {
                    response?: { data?: { message?: string } };
                  }
                )?.response?.data?.message ||
                  (
                    updateProjectMutation.error as Error & {
                      response?: { data?: { message?: string } };
                    }
                  )?.response?.data?.message ||
                  createProjectMutation.error?.message ||
                  updateProjectMutation.error?.message ||
                  'Error saving project. Please try again.'}
              </AlertDescription>
            </Alert>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onValid, onInvalid)} className="grid gap-6">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Project Title <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Description <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Textarea rows={4} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-6 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="githubUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>GitHub URL (optional)</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="https://github.com/username/project" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="liveUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Live URL (optional)</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="https://your-project.com" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <ComboboxTagEditor
                id="technologies"
                label="Technologies Used"
                value={technologies}
                onChange={(next) => form.setValue('technologies', next, { shouldDirty: true })}
                placeholder="Select or type technologies"
                options={commonSkills}
              />

              <ComboboxTagEditor
                id="requiredSkills"
                label="Required Skills (optional)"
                value={requiredSkills}
                onChange={(next) => form.setValue('requiredSkills', next, { shouldDirty: true })}
                placeholder="Select or type skills"
                options={commonSkills}
              />

              <ComboboxTagEditor
                id="tags"
                label="Tags (optional)"
                value={tags}
                onChange={(next) => form.setValue('tags', next, { shouldDirty: true })}
                placeholder="Select or type tags"
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger id="status" className="w-full">
                          <SelectValue placeholder="Status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="ideation">Ideation</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Separator />

              <div className="grid gap-3">
                <h3 className="text-base font-semibold">Resources (optional)</h3>
                {resourceFields.map((resourceField, index) => (
                  <div key={resourceField.id} className="flex items-start gap-2">
                    <FormField
                      control={form.control}
                      name={`resources.${index}.name`}
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormControl>
                            <Input placeholder="Resource Name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`resources.${index}.url`}
                      render={({ field }) => (
                        <FormItem className="flex-[2]">
                          <FormControl>
                            <Input placeholder="Resource URL" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeResourceField(index)}
                      disabled={resourceFields.length === 1}
                      aria-label="Remove resource"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
                <div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => appendResource({ name: '', url: '' })}
                  >
                    <Plus className="size-4" />
                    Add Resource
                  </Button>
                </div>
              </div>

              <Separator />

              {/* Incentives Section - Simplified */}
              <div className="grid gap-3">
                <h3 className="text-base font-semibold">Project Incentives (Optional)</h3>
                <p className="text-sm text-muted-foreground">
                  Indicate if you will offer incentives to contributors. Specific details can be
                  discussed privately.
                </p>

                <div className="grid gap-2">
                  <Label htmlFor="incentives-enabled">Offer Incentives to Contributors</Label>
                  <Select
                    value={incentivesEnabled ? 'yes' : 'no'}
                    onValueChange={(value) =>
                      form.setValue('incentives.enabled', value === 'yes', { shouldDirty: true })
                    }
                  >
                    <SelectTrigger id="incentives-enabled" className="w-full sm:w-auto sm:min-w-72">
                      <SelectValue placeholder="Offer Incentives to Contributors" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="no">No</SelectItem>
                      <SelectItem value="yes">Yes - I will offer incentives</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {incentivesEnabled && (
                  <div className="rounded-md bg-muted p-4 text-sm text-muted-foreground">
                    💡 <strong className="text-foreground">Note:</strong> This will show potential
                    contributors that incentives are available. Specific details about rewards will
                    be discussed privately with accepted collaborators.
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => navigate('/projects')}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving && <Loader2 className="size-4 animate-spin" />}
                  {isSaving ? 'Saving...' : projectId ? 'Update Project' : 'Create Project'}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
};

const ProjectForm: React.FC = () => {
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();

  // Auth state
  const { isAuthenticated } = useAuth();

  // Project data for editing - useProject handles enabled internally based on projectId.
  // TanStack Query will automatically fetch the project when projectId exists.
  const {
    data: currentProject,
    isLoading: loading,
    error: projectError,
  } = useProject(projectId) as UseProjectResult;

  // Check authentication
  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <Alert variant="destructive" className="mb-6">
          <AlertTitle>Authentication Required</AlertTitle>
          <AlertDescription>
            You must be logged in to create or edit projects.
          </AlertDescription>
        </Alert>
        <Button onClick={() => navigate('/login')}>Go to Login</Button>
      </div>
    );
  }

  // Loading state for editing
  if (projectId && loading) {
    return (
      <div className="mx-auto flex min-h-[300px] max-w-3xl items-center justify-center gap-3 px-4 py-8 sm:px-6">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
        <span className="text-lg font-semibold text-muted-foreground">
          Loading project data...
        </span>
      </div>
    );
  }

  // Error state for editing
  if (projectId && projectError) {
    const errorObj = projectError as Error & { response?: { data?: { message?: string } } };
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <Alert variant="destructive" className="mb-6">
          <AlertTitle>Error Loading Project</AlertTitle>
          <AlertDescription>
            {errorObj?.response?.data?.message ||
              errorObj?.message ||
              'Failed to load project data'}
          </AlertDescription>
        </Alert>
        <Button onClick={() => navigate('/projects')}>Back to Projects</Button>
      </div>
    );
  }

  // Data is present (edit mode gates on loading above) or absent (create mode).
  // The `key` remounts the form body when the project identity changes, seeding
  // fresh local state from initialProject without an effect.
  return (
    <ProjectFormFields
      key={projectId ?? 'new'}
      initialProject={currentProject}
      projectId={projectId}
    />
  );
};

export default ProjectForm;
