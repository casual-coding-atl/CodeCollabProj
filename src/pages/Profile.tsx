import React, { useState, useRef, ChangeEvent, FormEvent, KeyboardEvent } from 'react';
import { Plus, Trash2, Save, Camera, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
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

  const handleSelectChange = (name: string, value: string): void => {
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
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

  const errorMessage =
    (profileError as Error & { response?: { data?: { message?: string } } })?.response?.data
      ?.message ||
    (profileError as Error)?.message ||
    (
      updateProfileMutation.error as Error & {
        response?: { data?: { message?: string } };
      }
    )?.response?.data?.message ||
    (updateProfileMutation.error as Error)?.message ||
    validationError ||
    'An error occurred';

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Card>
        <CardHeader className="text-center">
          <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            account
          </p>
          <CardTitle className="text-2xl">Profile Settings</CardTitle>
          <p className="text-sm text-muted-foreground">
            Manage your profile information and visibility
          </p>
        </CardHeader>
        <CardContent>
          {(profileError || updateProfileMutation.error || validationError) && (
            <Alert variant="destructive" className="mb-6">
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Profile Picture */}
            <div className="flex flex-col items-center">
              <div className="relative mb-3">
                <Avatar
                  user={profile}
                  size="xxl"
                  onClick={handleAvatarClick}
                  sx={{ cursor: 'pointer' }}
                />
                <Button
                  type="button"
                  size="icon-sm"
                  className="absolute bottom-0 right-0 rounded-full"
                  onClick={handleAvatarClick}
                  disabled={uploadAvatarMutation.isPending}
                >
                  <Camera className="size-4" />
                </Button>
              </div>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleAvatarChange}
                accept="image/*"
                style={{ display: 'none' }}
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAvatarClick}
                  disabled={uploadAvatarMutation.isPending}
                >
                  {uploadAvatarMutation.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Camera className="size-4" />
                  )}
                  {uploadAvatarMutation.isPending ? 'Uploading...' : 'Change Photo'}
                </Button>
                {profile?.profileImage && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={handleRemoveAvatar}
                    disabled={deleteAvatarMutation.isPending}
                  >
                    {deleteAvatarMutation.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <X className="size-4" />
                    )}
                    {deleteAvatarMutation.isPending ? 'Removing...' : 'Remove'}
                  </Button>
                )}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Click on the avatar or button to upload a new photo
              </p>
            </div>

            {/* Basic Information */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Basic Information</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="firstName">
                    First Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="firstName"
                    required
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleChange}
                    disabled={updateProfileMutation.isPending}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lastName">
                    Last Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="lastName"
                    required
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleChange}
                    disabled={updateProfileMutation.isPending}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bio">Bio</Label>
                <Textarea
                  id="bio"
                  name="bio"
                  rows={4}
                  value={formData.bio}
                  onChange={handleChange}
                  disabled={updateProfileMutation.isPending}
                />
                <p className="text-xs text-muted-foreground">
                  Tell others about yourself and your interests
                </p>
              </div>
            </div>

            {/* Skills */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Skills</h2>
              <div className="flex gap-2">
                <Input
                  placeholder="Add a skill (e.g., React, Python)"
                  value={newSkill}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setNewSkill(e.target.value)}
                  onKeyDown={(e: KeyboardEvent<HTMLInputElement>) =>
                    e.key === 'Enter' && (e.preventDefault(), handleAddSkill())
                  }
                  disabled={updateProfileMutation.isPending}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleAddSkill}
                  disabled={!newSkill.trim() || updateProfileMutation.isPending}
                >
                  <Plus className="size-4" />
                  Add
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {formData.skills.map((skill, index) => (
                  <Badge key={`${skill}-${index}`} variant="secondary" className="gap-1 pr-1">
                    {skill}
                    <button
                      type="button"
                      onClick={() => handleRemoveSkill(skill)}
                      aria-label={`Remove ${skill}`}
                      className="rounded-full p-0.5 text-muted-foreground hover:text-foreground"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>

            {/* Experience and Availability */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="experience">Experience Level</Label>
                <Select
                  name="experience"
                  value={formData.experience}
                  onValueChange={(value) => handleSelectChange('experience', value)}
                  disabled={updateProfileMutation.isPending}
                >
                  <SelectTrigger id="experience" className="w-full">
                    <SelectValue placeholder="Experience Level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="beginner">Beginner</SelectItem>
                    <SelectItem value="intermediate">Intermediate</SelectItem>
                    <SelectItem value="advanced">Advanced</SelectItem>
                    <SelectItem value="expert">Expert</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="availability">Availability</Label>
                <Select
                  name="availability"
                  value={formData.availability}
                  onValueChange={(value) => handleSelectChange('availability', value)}
                  disabled={updateProfileMutation.isPending}
                >
                  <SelectTrigger id="availability" className="w-full">
                    <SelectValue placeholder="Availability" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full-time">Full-time</SelectItem>
                    <SelectItem value="part-time">Part-time</SelectItem>
                    <SelectItem value="weekends">Weekends</SelectItem>
                    <SelectItem value="evenings">Evenings</SelectItem>
                    <SelectItem value="flexible">Flexible</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Location and Timezone */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  name="location"
                  value={formData.location}
                  onChange={handleChange}
                  disabled={updateProfileMutation.isPending}
                  placeholder="City, Country"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="timezone">Timezone</Label>
                <Input
                  id="timezone"
                  name="timezone"
                  value={formData.timezone}
                  onChange={handleChange}
                  disabled={updateProfileMutation.isPending}
                  placeholder="UTC-5, EST, etc."
                />
              </div>
            </div>

            {/* Social Links */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Social Links</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="socialLinks.github">GitHub</Label>
                  <Input
                    id="socialLinks.github"
                    name="socialLinks.github"
                    value={formData.socialLinks.github}
                    onChange={handleChange}
                    disabled={updateProfileMutation.isPending}
                    placeholder="https://github.com/username"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="socialLinks.linkedin">LinkedIn</Label>
                  <Input
                    id="socialLinks.linkedin"
                    name="socialLinks.linkedin"
                    value={formData.socialLinks.linkedin}
                    onChange={handleChange}
                    disabled={updateProfileMutation.isPending}
                    placeholder="https://linkedin.com/in/username"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="socialLinks.twitter">Twitter</Label>
                  <Input
                    id="socialLinks.twitter"
                    name="socialLinks.twitter"
                    value={formData.socialLinks.twitter}
                    onChange={handleChange}
                    disabled={updateProfileMutation.isPending}
                    placeholder="https://twitter.com/username"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="socialLinks.website">Website</Label>
                  <Input
                    id="socialLinks.website"
                    name="socialLinks.website"
                    value={formData.socialLinks.website}
                    onChange={handleChange}
                    disabled={updateProfileMutation.isPending}
                    placeholder="https://yourwebsite.com"
                  />
                </div>
              </div>
            </div>

            {/* Portfolio Links */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Portfolio Links</h2>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  placeholder="Project name"
                  value={newPortfolioLink.name}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    setNewPortfolioLink((prev) => ({ ...prev, name: e.target.value }))
                  }
                  disabled={updateProfileMutation.isPending}
                />
                <Input
                  placeholder="Project URL"
                  value={newPortfolioLink.url}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    setNewPortfolioLink((prev) => ({ ...prev, url: e.target.value }))
                  }
                  disabled={updateProfileMutation.isPending}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleAddPortfolioLink}
                  disabled={
                    !newPortfolioLink.name.trim() ||
                    !newPortfolioLink.url.trim() ||
                    updateProfileMutation.isPending
                  }
                >
                  <Plus className="size-4" />
                  Add
                </Button>
              </div>
              <div className="flex flex-col gap-2">
                {formData.portfolioLinks.map((link, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <p className="flex-1 text-sm text-foreground">
                      {link.name}: {link.url}
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemovePortfolioLink(index)}
                    >
                      <Trash2 className="size-4" />
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* Profile Visibility */}
            <div>
              <Separator className="mb-6" />
              <div className="flex items-center gap-3">
                <Switch
                  id="isProfilePublic"
                  checked={formData.isProfilePublic}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({ ...prev, isProfilePublic: checked }))
                  }
                  disabled={updateProfileMutation.isPending}
                />
                <Label htmlFor="isProfilePublic">
                  Make my profile public (visible to other members)
                </Label>
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex justify-center">
              <Button
                type="submit"
                size="lg"
                disabled={updateProfileMutation.isPending}
              >
                <Save className="size-4" />
                {updateProfileMutation.isPending ? 'Saving...' : 'Save Profile'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
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
      <div className="mx-auto max-w-3xl px-4 py-8">
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>
            <span className="font-semibold">Authentication Required</span> — You must be logged in
            to view your profile.
          </AlertDescription>
        </Alert>
        <Button asChild>
          <a href="/login">Go to Login</a>
        </Button>
      </div>
    );
  }

  if (profileLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="flex min-h-[300px] items-center justify-center gap-3">
          <Loader2 className="size-6 animate-spin text-primary" />
          <p className="text-lg font-medium">Loading profile...</p>
        </div>
      </div>
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
