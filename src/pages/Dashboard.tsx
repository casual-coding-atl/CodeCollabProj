import React, { useMemo } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Container,
  Typography,
  Button,
  Box,
  Grid,
  Card,
  CardContent,
  CardActions,
  Chip,
  Alert,
} from '@mui/material';
import { Add, People, CalendarToday } from '@mui/icons-material';
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
      <Container maxWidth="lg">
        <Box sx={{ mt: 4, mb: 4 }}>
          <DashboardSkeleton />
        </Box>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ mt: 4 }}>
          <Alert severity="error" sx={{ mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Error Loading Dashboard
            </Typography>
            {(error as Error & { response?: { data?: { message?: string } } })?.response?.data
              ?.message ||
              (error as Error)?.message ||
              'Failed to load dashboard data'}
          </Alert>
          <Button variant="contained" onClick={() => refetch()}>
            Try Again
          </Button>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg">
      <Box sx={{ mt: 4, mb: 4 }}>
        {/* Welcome Section */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Welcome back, {typedUser?.username || 'User'}!
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Here&apos;s what&apos;s happening with your projects today.
          </Typography>
        </Box>

        {/* User Stats */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={4}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Total Projects
                </Typography>
                <Typography variant="h4">{userProjects.length}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Active Collaborations
                </Typography>
                <Typography variant="h4">
                  {userProjects.reduce(
                    (sum, project) => sum + (project.collaborators?.length || 0),
                    0
                  )}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Technologies Used
                </Typography>
                <Typography variant="h4">
                  {new Set(userProjects.flatMap((p) => p.technologies || [])).size}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* My Projects Section */}
        <Box sx={{ mb: 4 }}>
          <Box
            sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}
          >
            <Typography variant="h5" component="h2">
              My Projects
            </Typography>
            <Button
              variant="contained"
              startIcon={<Add />}
              component={RouterLink}
              to="/projects/create"
            >
              Create New Project
            </Button>
          </Box>

          <Grid container spacing={3}>
            {userProjects.map((project) => {
              const ownerId =
                typeof project.owner === 'object' && project.owner !== null
                  ? project.owner._id
                  : project.owner;
              const isOwner = ownerId === typedUser?._id;
              return (
                <Grid item xs={12} sm={6} md={4} key={project._id}>
                  <Card>
                    <CardContent>
                      <Box
                        sx={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          mb: 2,
                        }}
                      >
                        <Typography variant="h6" component="h3" gutterBottom>
                          {project.title}
                        </Typography>
                        <Chip
                          label={isOwner ? 'Owner' : 'Collaborator'}
                          size="small"
                          color={isOwner ? 'primary' : 'secondary'}
                        />
                      </Box>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {project.description}
                      </Typography>
                      <Box sx={{ mb: 2 }}>
                        {project.technologies &&
                          project.technologies.map((tech) => (
                            <Chip key={tech} label={tech} size="small" sx={{ mr: 1, mb: 1 }} />
                          ))}
                      </Box>
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 2,
                          color: 'text.secondary',
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <People sx={{ fontSize: 16, mr: 0.5 }} />
                          <Typography variant="body2">
                            {project.collaborators?.length || 0}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <CalendarToday sx={{ fontSize: 16, mr: 0.5 }} />
                          <Typography variant="body2">
                            {new Date(project.createdAt).toLocaleDateString()}
                          </Typography>
                        </Box>
                      </Box>
                    </CardContent>
                    <CardActions>
                      <Button size="small" component={RouterLink} to={`/projects/${project._id}`}>
                        View Details
                      </Button>
                      {isOwner && (
                        <Button
                          size="small"
                          component={RouterLink}
                          to={`/projects/${project._id}/edit`}
                        >
                          Edit
                        </Button>
                      )}
                    </CardActions>
                  </Card>
                </Grid>
              );
            })}
          </Grid>

          {userProjects.length === 0 && (
            <Box sx={{ textAlign: 'center', mt: 4 }}>
              <Typography variant="h6" color="text.secondary" gutterBottom>
                No projects yet
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Start by creating your first project or joining an existing one.
              </Typography>
              <Button
                variant="contained"
                startIcon={<Add />}
                component={RouterLink}
                to="/projects/create"
              >
                Create Your First Project
              </Button>
            </Box>
          )}
        </Box>
      </Box>
    </Container>
  );
};

export default Dashboard;
