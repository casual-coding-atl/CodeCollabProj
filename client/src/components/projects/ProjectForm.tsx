import React, { useState, type ChangeEvent, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Container,
  Paper,
  Typography,
  TextField,
  Button,
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Autocomplete,
  IconButton,
  Grid,
  Alert,
  CircularProgress,
  type SelectChangeEvent,
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material';
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
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | SelectChangeEvent<string>
  ): void => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name as string]: value,
    });
  };

  const handleSkillsChange = (_event: React.SyntheticEvent, newValue: string[]): void => {
    console.log('🔧 Skills changed:', newValue);
    setFormData({
      ...formData,
      requiredSkills: newValue,
    });
  };

  const handleTagsChange = (_event: React.SyntheticEvent, newValue: string[]): void => {
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

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
      <Paper sx={{ p: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          {projectId ? 'Edit Project' : 'Create Project'}
        </Typography>

        {(createProjectMutation.error || updateProjectMutation.error) && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {(createProjectMutation.error as Error & { response?: { data?: { message?: string } } })
              ?.response?.data?.message ||
              (
                updateProjectMutation.error as Error & {
                  response?: { data?: { message?: string } };
                }
              )?.response?.data?.message ||
              createProjectMutation.error?.message ||
              updateProjectMutation.error?.message ||
              'Error saving project. Please try again.'}
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Project Title"
                name="title"
                value={formData.title}
                onChange={handleChange}
                error={!!formErrors.title}
                helperText={formErrors.title}
                required
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description"
                name="description"
                multiline
                rows={4}
                value={formData.description}
                onChange={handleChange}
                error={!!formErrors.description}
                helperText={formErrors.description}
                required
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="GitHub URL (optional)"
                name="githubUrl"
                value={formData.githubUrl}
                onChange={handleChange}
                placeholder="https://github.com/username/project"
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Live URL (optional)"
                name="liveUrl"
                value={formData.liveUrl}
                onChange={handleChange}
                placeholder="https://your-project.com"
              />
            </Grid>

            <Grid item xs={12}>
              <Autocomplete
                multiple
                freeSolo
                options={commonSkills}
                value={formData.technologies}
                onChange={(_event, newValue) => {
                  setFormData({
                    ...formData,
                    technologies: newValue,
                  });
                }}
                isOptionEqualToValue={(option, value) => option === value}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Technologies Used"
                    placeholder="Select or type technologies"
                  />
                )}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => (
                    <Chip label={option} {...getTagProps({ index })} key={option} />
                  ))
                }
              />
            </Grid>

            <Grid item xs={12}>
              <Autocomplete
                multiple
                freeSolo
                options={commonSkills}
                value={formData.requiredSkills}
                onChange={handleSkillsChange}
                isOptionEqualToValue={(option, value) => option === value}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Required Skills (optional)"
                    error={!!formErrors.requiredSkills}
                    helperText={formErrors.requiredSkills}
                  />
                )}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => (
                    <Chip label={option} {...getTagProps({ index })} key={option} />
                  ))
                }
              />
            </Grid>

            <Grid item xs={12}>
              <Autocomplete
                multiple
                freeSolo
                options={[] as string[]}
                value={formData.tags}
                onChange={handleTagsChange}
                renderInput={(params) => <TextField {...params} label="Tags (optional)" />}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => (
                    <Chip label={option} {...getTagProps({ index })} key={option} />
                  ))
                }
              />
            </Grid>

            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  label="Status"
                >
                  <MenuItem value="ideation">Ideation</MenuItem>
                  <MenuItem value="in_progress">In Progress</MenuItem>
                  <MenuItem value="completed">Completed</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                Resources (optional)
              </Typography>
              {formData.resources.map((resource, index) => (
                <Box key={index} sx={{ display: 'flex', gap: 2, mb: 2 }}>
                  <TextField
                    label="Resource Name"
                    value={resource.name}
                    onChange={(e) => handleResourceChange(index, 'name', e.target.value)}
                    error={!!formErrors[`resource${index}Name`]}
                    helperText={formErrors[`resource${index}Name`]}
                    sx={{ flex: 1 }}
                  />
                  <TextField
                    label="Resource URL"
                    value={resource.url}
                    onChange={(e) => handleResourceChange(index, 'url', e.target.value)}
                    error={!!formErrors[`resource${index}Url`]}
                    helperText={formErrors[`resource${index}Url`]}
                    sx={{ flex: 2 }}
                  />
                  <IconButton
                    onClick={() => removeResource(index)}
                    disabled={formData.resources.length === 1}
                  >
                    <DeleteIcon />
                  </IconButton>
                </Box>
              ))}
              <Button startIcon={<AddIcon />} onClick={addResource} sx={{ mt: 1 }}>
                Add Resource
              </Button>
            </Grid>

            {/* Incentives Section - Simplified */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                Project Incentives (Optional)
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Indicate if you will offer incentives to contributors. Specific details can be
                discussed privately.
              </Typography>

              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <FormControl>
                  <InputLabel>Offer Incentives to Contributors</InputLabel>
                  <Select
                    value={formData.incentives.enabled ? 'yes' : 'no'}
                    onChange={(e: SelectChangeEvent<string>) => {
                      setFormData({
                        ...formData,
                        incentives: {
                          ...formData.incentives,
                          enabled: e.target.value === 'yes',
                        },
                      });
                    }}
                    label="Offer Incentives to Contributors"
                  >
                    <MenuItem value="no">No</MenuItem>
                    <MenuItem value="yes">Yes - I will offer incentives</MenuItem>
                  </Select>
                </FormControl>
              </Box>

              {formData.incentives.enabled && (
                <Box sx={{ p: 2, bgcolor: 'info.light', borderRadius: 1 }}>
                  <Typography variant="body2" color="info.contrastText">
                    💡 <strong>Note:</strong> This will show potential contributors that incentives
                    are available. Specific details about rewards will be discussed privately with
                    accepted collaborators.
                  </Typography>
                </Box>
              )}
            </Grid>

            <Grid item xs={12}>
              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                <Button variant="outlined" onClick={() => navigate('/projects')}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  color="primary"
                  disabled={createProjectMutation.isPending || updateProjectMutation.isPending}
                >
                  {createProjectMutation.isPending || updateProjectMutation.isPending
                    ? 'Saving...'
                    : projectId
                      ? 'Update Project'
                      : 'Create Project'}
                </Button>
              </Box>
            </Grid>
          </Grid>
        </form>
      </Paper>
    </Container>
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
      <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
        <Alert severity="warning" sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Authentication Required
          </Typography>
          You must be logged in to create or edit projects.
        </Alert>
        <Button variant="contained" onClick={() => navigate('/login')}>
          Go to Login
        </Button>
      </Container>
    );
  }

  // Loading state for editing
  if (projectId && loading) {
    return (
      <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
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
            Loading project data...
          </Typography>
        </Box>
      </Container>
    );
  }

  // Error state for editing
  if (projectId && projectError) {
    const errorObj = projectError as Error & { response?: { data?: { message?: string } } };
    return (
      <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
        <Alert severity="error" sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Error Loading Project
          </Typography>
          {errorObj?.response?.data?.message || errorObj?.message || 'Failed to load project data'}
        </Alert>
        <Button variant="contained" onClick={() => navigate('/projects')}>
          Back to Projects
        </Button>
      </Container>
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
