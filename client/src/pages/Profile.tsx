import React, { useState, useRef, ChangeEvent, FormEvent, KeyboardEvent } from 'react';
import {
  Container,
  Typography,
  TextField,
  Button,
  Box,
  Paper,
  Alert,
  Grid,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Divider,
  CircularProgress,
  IconButton,
  SelectChangeEvent,
} from '@mui/material';
import { Add, Delete, Save, PhotoCamera, Close } from '@mui/icons-material';
import { useAuth } from '../hooks/auth';
import { useMyProfile, useUpdateProfile, useUploadAvatar, useDeleteAvatar } from '../hooks/users';
import Avatar from '../components/common/Avatar';
import type { User, PortfolioLink, SocialLinks, ExperienceLevel, Availability } from '../types';

interface ProfileFormData {
  firstName: string;
  lastName: string;
  bio: string;
  skills: string[];
  experience: ExperienceLevel;
  location: string;
  timezone: string;
  availability: Availability;
  portfolioLinks: PortfolioLink[];
  socialLinks: SocialLinks;
  isProfilePublic: boolean;
}

interface UserWithId extends Omit<User, 'id'> {
  _id?: string;
  profileImage?: string;
}

interface ProfileFormProps {
  profile: UserWithId | undefined;
  profileError: unknown;
}

const ProfileForm: React.FC<ProfileFormProps> = ({ profile, profileError }) => {
  const updateProfileMutation = useUpdateProfile();
  const uploadAvatarMutation = useUploadAvatar();
  const deleteAvatarMutation = useDeleteAvatar();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState<ProfileFormData>(() => ({
    firstName: profile?.firstName || '',
    lastName: profile?.lastName || '',
    bio: profile?.bio || '',
    skills: profile?.skills || [],
    experience: profile?.experience || 'beginner',
    location: profile?.location || '',
    timezone: profile?.timezone || '',
    availability: profile?.availability || 'flexible',
    portfolioLinks: profile?.portfolioLinks || [],
    socialLinks: {
      github: profile?.socialLinks?.github || '',
      linkedin: profile?.socialLinks?.linkedin || '',
      twitter: profile?.socialLinks?.twitter || '',
      website: profile?.socialLinks?.website || '',
    },
    isProfilePublic: profile?.isProfilePublic ?? true,
  }));

  const [newSkill, setNewSkill] = useState('');
  const [newPortfolioLink, setNewPortfolioLink] = useState<PortfolioLink>({ name: '', url: '' });
  const [validationError, setValidationError] = useState('');

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | SelectChangeEvent
  ): void => {
    const { name, value } = e.target;
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setFormData((prev) => ({
        ...prev,
        [parent]: {
          ...(prev[parent as keyof ProfileFormData] as object),
          [child]: value,
        },
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
    setValidationError('');
  };

  const handleAddSkill = (): void => {
    if (newSkill.trim() && !formData.skills.includes(newSkill.trim())) {
      setFormData((prev) => ({
        ...prev,
        skills: [...prev.skills, newSkill.trim()],
      }));
      setNewSkill('');
    }
  };

  const handleRemoveSkill = (skillToRemove: string): void => {
    setFormData((prev) => ({
      ...prev,
      skills: prev.skills.filter((skill) => skill !== skillToRemove),
    }));
  };

  const handleAddPortfolioLink = (): void => {
    if (newPortfolioLink.name.trim() && newPortfolioLink.url.trim()) {
      setFormData((prev) => ({
        ...prev,
        portfolioLinks: [...prev.portfolioLinks, { ...newPortfolioLink }],
      }));
      setNewPortfolioLink({ name: '', url: '' });
    }
  };

  const handleRemovePortfolioLink = (index: number): void => {
    setFormData((prev) => ({
      ...prev,
      portfolioLinks: prev.portfolioLinks.filter((_, i) => i !== index),
    }));
  };

  const handleAvatarClick = (): void => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setValidationError('Please select an image file');
        return;
      }

      // Validate file size (5MB max)
      if (file.size > 5 * 1024 * 1024) {
        setValidationError('Image must be less than 5MB');
        return;
      }

      const avatarFormData = new FormData();
      avatarFormData.append('avatar', file);

      uploadAvatarMutation.mutate(avatarFormData, {
        onSuccess: (data) => {
          console.log('✅ Avatar uploaded:', data);
          setValidationError('');
        },
        onError: (error: Error & { response?: { data?: { message?: string } } }) => {
          console.error('❌ Avatar upload failed:', error);
          setValidationError(error?.response?.data?.message || 'Failed to upload avatar');
        },
      });
    }

    // Reset the input so the same file can be selected again
    event.target.value = '';
  };

  const handleRemoveAvatar = (): void => {
    deleteAvatarMutation.mutate(undefined, {
      onSuccess: () => {
        setValidationError('');
      },
      onError: (error: Error & { response?: { data?: { message?: string } } }) => {
        setValidationError(error?.response?.data?.message || 'Failed to remove avatar');
      },
    });
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();

    if (!formData.firstName.trim()) {
      setValidationError('First name is required');
      return;
    }

    if (!formData.lastName.trim()) {
      setValidationError('Last name is required');
      return;
    }

    updateProfileMutation.mutate(formData, {
      onSuccess: (data) => {
        console.log('✅ Profile updated successfully:', data);
        setValidationError('');
      },
      onError: (
        error: Error & {
          response?: { data?: { message?: string; errors?: Array<{ msg: string }> } };
        }
      ) => {
        console.error('❌ Profile update failed:', error);
        if (error?.response?.data?.errors && Array.isArray(error.response.data.errors)) {
          const errorMessages = error.response.data.errors.map((err) => err.msg).join(', ');
          setValidationError(`Validation errors: ${errorMessages}`);
        } else if (error?.response?.data?.message) {
          setValidationError(error.response.data.message);
        } else if (error?.message) {
          setValidationError(error.message);
        } else {
          setValidationError('Failed to update profile. Please try again.');
        }
      },
    });
  };

  return (
    <Container maxWidth="md">
      <Box sx={{ mt: 4, mb: 4 }}>
        <Paper elevation={3} sx={{ p: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom align="center">
            Profile Settings
          </Typography>
          <Typography variant="body1" color="text.secondary" align="center" sx={{ mb: 4 }}>
            Manage your profile information and visibility
          </Typography>

          {(profileError || updateProfileMutation.error || validationError) && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {(profileError as Error & { response?: { data?: { message?: string } } })?.response
                ?.data?.message ||
                (profileError as Error)?.message ||
                (
                  updateProfileMutation.error as Error & {
                    response?: { data?: { message?: string } };
                  }
                )?.response?.data?.message ||
                (updateProfileMutation.error as Error)?.message ||
                validationError ||
                'An error occurred'}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit}>
            <Grid container spacing={3}>
              {/* Profile Picture */}
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 3 }}>
                  <Box sx={{ position: 'relative', mb: 2 }}>
                    <Avatar
                      user={profile}
                      size="xxl"
                      onClick={handleAvatarClick}
                      sx={{ cursor: 'pointer' }}
                    />
                    <IconButton
                      sx={{
                        position: 'absolute',
                        bottom: 0,
                        right: 0,
                        bgcolor: 'primary.main',
                        color: 'white',
                        '&:hover': { bgcolor: 'primary.dark' },
                      }}
                      size="small"
                      onClick={handleAvatarClick}
                      disabled={uploadAvatarMutation.isPending}
                    >
                      <PhotoCamera fontSize="small" />
                    </IconButton>
                  </Box>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleAvatarChange}
                    accept="image/*"
                    style={{ display: 'none' }}
                  />
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={handleAvatarClick}
                      disabled={uploadAvatarMutation.isPending}
                      startIcon={
                        uploadAvatarMutation.isPending ? (
                          <CircularProgress size={16} />
                        ) : (
                          <PhotoCamera />
                        )
                      }
                    >
                      {uploadAvatarMutation.isPending ? 'Uploading...' : 'Change Photo'}
                    </Button>
                    {profile?.profileImage && (
                      <Button
                        variant="outlined"
                        size="small"
                        color="error"
                        onClick={handleRemoveAvatar}
                        disabled={deleteAvatarMutation.isPending}
                        startIcon={
                          deleteAvatarMutation.isPending ? (
                            <CircularProgress size={16} />
                          ) : (
                            <Close />
                          )
                        }
                      >
                        {deleteAvatarMutation.isPending ? 'Removing...' : 'Remove'}
                      </Button>
                    )}
                  </Box>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                    Click on the avatar or button to upload a new photo
                  </Typography>
                </Box>
              </Grid>

              {/* Basic Information */}
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom>
                  Basic Information
                </Typography>
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  required
                  fullWidth
                  label="First Name"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  disabled={updateProfileMutation.isPending}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  required
                  fullWidth
                  label="Last Name"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  disabled={updateProfileMutation.isPending}
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Bio"
                  name="bio"
                  multiline
                  rows={4}
                  value={formData.bio}
                  onChange={handleChange}
                  disabled={updateProfileMutation.isPending}
                  helperText="Tell others about yourself and your interests"
                />
              </Grid>

              {/* Skills */}
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom>
                  Skills
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                  <TextField
                    size="small"
                    placeholder="Add a skill (e.g., React, Python)"
                    value={newSkill}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setNewSkill(e.target.value)}
                    onKeyPress={(e: KeyboardEvent<HTMLInputElement>) =>
                      e.key === 'Enter' && (e.preventDefault(), handleAddSkill())
                    }
                    disabled={updateProfileMutation.isPending}
                  />
                  <Button
                    variant="outlined"
                    onClick={handleAddSkill}
                    disabled={!newSkill.trim() || updateProfileMutation.isPending}
                    startIcon={<Add />}
                  >
                    Add
                  </Button>
                </Box>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {formData.skills.map((skill, index) => (
                    <Chip
                      key={`${skill}-${index}`}
                      label={skill}
                      onDelete={() => handleRemoveSkill(skill)}
                      deleteIcon={<Delete />}
                    />
                  ))}
                </Box>
              </Grid>

              {/* Experience and Availability */}
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Experience Level</InputLabel>
                  <Select
                    name="experience"
                    value={formData.experience}
                    onChange={handleChange}
                    disabled={updateProfileMutation.isPending}
                    label="Experience Level"
                  >
                    <MenuItem value="beginner">Beginner</MenuItem>
                    <MenuItem value="intermediate">Intermediate</MenuItem>
                    <MenuItem value="advanced">Advanced</MenuItem>
                    <MenuItem value="expert">Expert</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Availability</InputLabel>
                  <Select
                    name="availability"
                    value={formData.availability}
                    onChange={handleChange}
                    disabled={updateProfileMutation.isPending}
                    label="Availability"
                  >
                    <MenuItem value="full-time">Full-time</MenuItem>
                    <MenuItem value="part-time">Part-time</MenuItem>
                    <MenuItem value="weekends">Weekends</MenuItem>
                    <MenuItem value="evenings">Evenings</MenuItem>
                    <MenuItem value="flexible">Flexible</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              {/* Location and Timezone */}
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Location"
                  name="location"
                  value={formData.location}
                  onChange={handleChange}
                  disabled={updateProfileMutation.isPending}
                  placeholder="City, Country"
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Timezone"
                  name="timezone"
                  value={formData.timezone}
                  onChange={handleChange}
                  disabled={updateProfileMutation.isPending}
                  placeholder="UTC-5, EST, etc."
                />
              </Grid>

              {/* Social Links */}
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom>
                  Social Links
                </Typography>
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="GitHub"
                  name="socialLinks.github"
                  value={formData.socialLinks.github}
                  onChange={handleChange}
                  disabled={updateProfileMutation.isPending}
                  placeholder="https://github.com/username"
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="LinkedIn"
                  name="socialLinks.linkedin"
                  value={formData.socialLinks.linkedin}
                  onChange={handleChange}
                  disabled={updateProfileMutation.isPending}
                  placeholder="https://linkedin.com/in/username"
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Twitter"
                  name="socialLinks.twitter"
                  value={formData.socialLinks.twitter}
                  onChange={handleChange}
                  disabled={updateProfileMutation.isPending}
                  placeholder="https://twitter.com/username"
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Website"
                  name="socialLinks.website"
                  value={formData.socialLinks.website}
                  onChange={handleChange}
                  disabled={updateProfileMutation.isPending}
                  placeholder="https://yourwebsite.com"
                />
              </Grid>

              {/* Portfolio Links */}
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom>
                  Portfolio Links
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                  <TextField
                    size="small"
                    placeholder="Project name"
                    value={newPortfolioLink.name}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      setNewPortfolioLink((prev) => ({ ...prev, name: e.target.value }))
                    }
                    disabled={updateProfileMutation.isPending}
                  />
                  <TextField
                    size="small"
                    placeholder="Project URL"
                    value={newPortfolioLink.url}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      setNewPortfolioLink((prev) => ({ ...prev, url: e.target.value }))
                    }
                    disabled={updateProfileMutation.isPending}
                  />
                  <Button
                    variant="outlined"
                    onClick={handleAddPortfolioLink}
                    disabled={
                      !newPortfolioLink.name.trim() ||
                      !newPortfolioLink.url.trim() ||
                      updateProfileMutation.isPending
                    }
                    startIcon={<Add />}
                  >
                    Add
                  </Button>
                </Box>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {formData.portfolioLinks.map((link, index) => (
                    <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2" sx={{ flex: 1 }}>
                        {link.name}: {link.url}
                      </Typography>
                      <Button
                        size="small"
                        onClick={() => handleRemovePortfolioLink(index)}
                        startIcon={<Delete />}
                      >
                        Remove
                      </Button>
                    </Box>
                  ))}
                </Box>
              </Grid>

              {/* Profile Visibility */}
              <Grid item xs={12}>
                <Divider sx={{ my: 2 }} />
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.isProfilePublic}
                      onChange={(e: ChangeEvent<HTMLInputElement>) =>
                        setFormData((prev) => ({ ...prev, isProfilePublic: e.target.checked }))
                      }
                      disabled={updateProfileMutation.isPending}
                    />
                  }
                  label="Make my profile public (visible to other members)"
                />
              </Grid>

              {/* Submit Button */}
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                  <Button
                    type="submit"
                    variant="contained"
                    size="large"
                    disabled={updateProfileMutation.isPending}
                    startIcon={<Save />}
                  >
                    {updateProfileMutation.isPending ? 'Saving...' : 'Save Profile'}
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
};

const Profile: React.FC = () => {
  // Auth and profile data
  const { isAuthenticated } = useAuth();
  const { data: profile, isLoading: profileLoading, error: profileError } = useMyProfile();

  const typedProfile = profile as UserWithId | undefined;

  // Authentication check
  if (!isAuthenticated) {
    return (
      <Container maxWidth="md">
        <Box sx={{ mt: 4 }}>
          <Alert severity="warning" sx={{ mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Authentication Required
            </Typography>
            You must be logged in to view your profile.
          </Alert>
          <Button variant="contained" href="/login">
            Go to Login
          </Button>
        </Box>
      </Container>
    );
  }

  if (profileLoading) {
    return (
      <Container maxWidth="md">
        <Box
          sx={{
            mt: 4,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '300px',
          }}
        >
          <CircularProgress />
          <Typography variant="h6" sx={{ ml: 2 }}>
            Loading profile...
          </Typography>
        </Box>
      </Container>
    );
  }

  return (
    <ProfileForm
      profile={typedProfile}
      profileError={profileError}
      // Re-seed the form only when the server data actually changes (post-save or an
      // out-of-band edit) — updatedAt changes then, but stays stable across no-op
      // refetches, so in-progress edits aren't clobbered by background revalidation.
      key={typedProfile?.updatedAt ?? typedProfile?._id}
    />
  );
};

export default Profile;
