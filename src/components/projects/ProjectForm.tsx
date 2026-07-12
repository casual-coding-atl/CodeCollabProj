import React, { useState, type ChangeEvent, type FormEvent, type KeyboardEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Trash2, X, Loader2 } from 'lucide-react';
import { useAuth } from '../../hooks/auth';
import { useProject, useCreateProject, useUpdateProject } from '../../hooks/projects';
import type {
  ProjectStatus,
  IncentiveType,
  ProjectResource,
  Project,
  User,
  UserSummary,
} from '../../types';
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

// Local resource type with optional name/url for form handling
interface ResourceFormItem {
  name: string;
  url: string;
}

// Form data interface
interface FormData {
  title: string;
  description: string;
  technologies: string[];
  requiredSkills: string[];
  tags: string[];
  githubUrl: string;
  liveUrl: string;
  resources: ResourceFormItem[];
  status: ProjectStatus;
  incentives: {
    enabled: boolean;
    type: IncentiveType;
    description: string;
    amount: number;
    currency: string;
    equityPercentage: number;
    customReward: string;
  };
}

// Form errors interface
interface FormErrors {
  title?: string;
  description?: string;
  requiredSkills?: string;
  [key: string]: string | undefined;
}

// Maps a fetched project (or undefined, for create mode) into initial form state.
const mapProjectToFormData = (initialProject: ProjectApiResponse | undefined): FormData => {
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

interface TagEditorProps {
  id: string;
  label: string;
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  options?: string[];
  error?: string;
}

// Free-form tag editor: type + Enter/comma to add, click a badge's X to remove.
// Preserves the array-of-strings state shape the previous Autocomplete produced.
const TagEditor: React.FC<TagEditorProps> = ({
  id,
  label,
  value,
  onChange,
  placeholder,
  options = [],
  error,
}) => {
  const [inputValue, setInputValue] = useState('');

  const addTag = (raw: string): void => {
    const tag = raw.trim();
    if (!tag || value.includes(tag)) {
      setInputValue('');
      return;
    }
    onChange([...value, tag]);
    setInputValue('');
  };

  const removeTag = (tag: string): void => {
    onChange(value.filter((t) => t !== tag));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(inputValue);
    } else if (e.key === 'Backspace' && !inputValue && value.length > 0) {
      removeTag(value[value.length - 1]);
    }
  };

  const suggestions = options.filter((opt) => !value.includes(opt));

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
                onClick={() => removeTag(tag)}
                aria-label={`Remove ${tag}`}
                className="rounded-full outline-none hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      <Input
        id={id}
        value={inputValue}
        placeholder={placeholder}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => addTag(inputValue)}
        aria-invalid={!!error}
      />
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {suggestions.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => addTag(opt)}
              className="rounded-full border border-border px-2 py-0.5 font-mono text-[11px] uppercase tracking-widest text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
            >
              {opt}
            </button>
          ))}
        </div>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
};

interface ProjectFormFieldsProps {
  initialProject: ProjectApiResponse | undefined;
  projectId: string | undefined;
}

// Owns the editable form state. Seeded once from initialProject via a useState
// initializer; the parent remounts this via `key` when the project identity changes,
// so a background refetch of the same project never clobbers in-progress edits.
const ProjectFormFields: React.FC<ProjectFormFieldsProps> = ({ initialProject, projectId }) => {
  const navigate = useNavigate();

  // Mutations
  const createProjectMutation = useCreateProject();
  const updateProjectMutation = useUpdateProject();

  const [formData, setFormData] = useState<FormData>(() => mapProjectToFormData(initialProject));

  const [formErrors, setFormErrors] = useState<FormErrors>({});

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

    alert(errorMessage);
  };

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

  const validateForm = (): boolean => {
    const errors: FormErrors = {};
    if (!formData.title) {
      errors.title = 'Title is required';
    } else if (formData.title.length < 3) {
      errors.title = 'Title must be at least 3 characters';
    }

    if (!formData.description) {
      errors.description = 'Description is required';
    } else if (formData.description.length < 10) {
      errors.description = 'Description must be at least 10 characters';
    }

    // Removed required skills validation since it's not mandatory

    formData.resources.forEach((resource, index) => {
      if (resource.name && !resource.url) {
        errors[`resource${index}Url`] = 'URL is required if name is provided';
      }
      if (!resource.name && resource.url) {
        errors[`resource${index}Name`] = 'Name is required if URL is provided';
      }
    });

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ): void => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name as string]: value,
    });
  };

  const handleSkillsChange = (newValue: string[]): void => {
    console.log('🔧 Skills changed:', newValue);
    setFormData({
      ...formData,
      requiredSkills: newValue,
    });
  };

  const handleTagsChange = (newValue: string[]): void => {
    setFormData({
      ...formData,
      tags: newValue,
    });
  };

  const handleResourceChange = (index: number, field: 'name' | 'url', value: string): void => {
    const newResources = [...formData.resources];
    newResources[index] = {
      ...newResources[index],
      [field]: value,
    };
    setFormData({
      ...formData,
      resources: newResources,
    });
  };

  const addResource = (): void => {
    setFormData({
      ...formData,
      resources: [...formData.resources, { name: '', url: '' }],
    });
  };

  const removeResource = (index: number): void => {
    const newResources = formData.resources.filter((_, i) => i !== index);
    setFormData({
      ...formData,
      resources: newResources.length ? newResources : [{ name: '', url: '' }],
    });
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    console.log('📝 Form submission started');
    console.log('📋 Form data:', formData);
    console.log('🔍 Project ID:', projectId);

    if (validateForm()) {
      console.log('✅ Form validation passed');
      const filteredResources = formData.resources.filter(
        (resource) => resource.name && resource.url
      );

      // Ensure arrays are properly formatted
      const projectData = {
        ...formData,
        resources: filteredResources,
        requiredSkills: Array.isArray(formData.requiredSkills) ? formData.requiredSkills : [],
        technologies: Array.isArray(formData.technologies) ? formData.technologies : [],
        tags: Array.isArray(formData.tags) ? formData.tags : [],
      };

      console.log('📤 Sending project data:', projectData);
      console.log('🔍 Data types:', {
        requiredSkills: typeof projectData.requiredSkills,
        technologies: typeof projectData.technologies,
        tags: typeof projectData.tags,
        resources: typeof projectData.resources,
      });

      if (projectId) {
        console.log('🔄 Updating project:', projectId, projectData);
        updateProjectMutation.mutate(
          { projectId, projectData },
          {
            onSuccess: (result) => {
              console.log('✅ Project updated successfully:', result);
              console.log('🚀 Navigating to projects page');
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
        console.log('➕ Creating new project:', projectData);
        createProjectMutation.mutate(projectData, {
          onSuccess: (result) => {
            console.log('✅ Project created successfully:', result);
            console.log('🚀 Navigating to projects page');
            navigate('/projects');
          },
          onError: (error) => {
            handleSubmissionError(
              error as Error & { response?: { data?: { message?: string }; status?: number } }
            );
          },
        });
      }
    } else {
      console.log('❌ Form validation failed:', formErrors);
      alert('Please fix the form errors before submitting.');
    }
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

          <form onSubmit={handleSubmit} className="grid gap-6">
            <div className="grid gap-2">
              <Label htmlFor="title">
                Project Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="title"
                name="title"
                value={formData.title}
                onChange={handleChange}
                aria-invalid={!!formErrors.title}
                required
              />
              {formErrors.title && <p className="text-sm text-destructive">{formErrors.title}</p>}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">
                Description <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="description"
                name="description"
                rows={4}
                value={formData.description}
                onChange={handleChange}
                aria-invalid={!!formErrors.description}
                required
              />
              {formErrors.description && (
                <p className="text-sm text-destructive">{formErrors.description}</p>
              )}
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="githubUrl">GitHub URL (optional)</Label>
                <Input
                  id="githubUrl"
                  name="githubUrl"
                  value={formData.githubUrl}
                  onChange={handleChange}
                  placeholder="https://github.com/username/project"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="liveUrl">Live URL (optional)</Label>
                <Input
                  id="liveUrl"
                  name="liveUrl"
                  value={formData.liveUrl}
                  onChange={handleChange}
                  placeholder="https://your-project.com"
                />
              </div>
            </div>

            <TagEditor
              id="technologies"
              label="Technologies Used"
              value={formData.technologies}
              onChange={(newValue) =>
                setFormData({
                  ...formData,
                  technologies: newValue,
                })
              }
              placeholder="Select or type technologies"
              options={commonSkills}
            />

            <TagEditor
              id="requiredSkills"
              label="Required Skills (optional)"
              value={formData.requiredSkills}
              onChange={handleSkillsChange}
              options={commonSkills}
              error={formErrors.requiredSkills}
            />

            <TagEditor
              id="tags"
              label="Tags (optional)"
              value={formData.tags}
              onChange={handleTagsChange}
            />

            <div className="grid gap-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    status: value as ProjectStatus,
                  })
                }
              >
                <SelectTrigger id="status" className="w-full">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ideation">Ideation</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <div className="grid gap-3">
              <h3 className="text-base font-semibold">Resources (optional)</h3>
              {formData.resources.map((resource, index) => (
                <div key={index} className="flex items-start gap-2">
                  <div className="grid flex-1 gap-1">
                    <Input
                      placeholder="Resource Name"
                      value={resource.name}
                      onChange={(e) => handleResourceChange(index, 'name', e.target.value)}
                      aria-invalid={!!formErrors[`resource${index}Name`]}
                    />
                    {formErrors[`resource${index}Name`] && (
                      <p className="text-sm text-destructive">
                        {formErrors[`resource${index}Name`]}
                      </p>
                    )}
                  </div>
                  <div className="grid flex-[2] gap-1">
                    <Input
                      placeholder="Resource URL"
                      value={resource.url}
                      onChange={(e) => handleResourceChange(index, 'url', e.target.value)}
                      aria-invalid={!!formErrors[`resource${index}Url`]}
                    />
                    {formErrors[`resource${index}Url`] && (
                      <p className="text-sm text-destructive">
                        {formErrors[`resource${index}Url`]}
                      </p>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeResource(index)}
                    disabled={formData.resources.length === 1}
                    aria-label="Remove resource"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
              <div>
                <Button type="button" variant="outline" size="sm" onClick={addResource}>
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
                  value={formData.incentives.enabled ? 'yes' : 'no'}
                  onValueChange={(value) => {
                    setFormData({
                      ...formData,
                      incentives: {
                        ...formData.incentives,
                        enabled: value === 'yes',
                      },
                    });
                  }}
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

              {formData.incentives.enabled && (
                <div className="rounded-md bg-muted p-4 text-sm text-muted-foreground">
                  💡 <strong className="text-foreground">Note:</strong> This will show potential
                  contributors that incentives are available. Specific details about rewards will be
                  discussed privately with accepted collaborators.
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
