import React, { useState, useRef, ChangeEvent, KeyboardEvent } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2, Save, Camera, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { addTag, removeTag } from '@/lib/tags';
import { Link as RouterLink } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '../hooks/auth';
import { useMyProfile, useUpdateProfile, useUploadAvatar, useDeleteAvatar } from '../hooks/users';
import { useProjects } from '../hooks/projects';
import Avatar from '../components/common/Avatar';
import type { User, PortfolioLink } from '../types';

// Mirrors the previous validation (first/last name required) and preserves the
// exact ProfileFormData shape sent to updateProfile.
const profileSchema = z.object({
  firstName: z.string().refine((v) => v.trim().length > 0, 'First name is required'),
  lastName: z.string().refine((v) => v.trim().length > 0, 'Last name is required'),
  bio: z.string(),
  skills: z.array(z.string()),
  experience: z.enum(['beginner', 'intermediate', 'advanced', 'expert']),
  location: z.string(),
  timezone: z.string(),
  availability: z.enum(['full-time', 'part-time', 'weekends', 'evenings', 'flexible']),
  portfolioLinks: z.array(z.object({ name: z.string(), url: z.string() })),
  socialLinks: z.object({
    github: z.string(),
    linkedin: z.string(),
    twitter: z.string(),
    website: z.string(),
  }),
  isProfilePublic: z.boolean(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

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

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    mode: 'onTouched',
    defaultValues: {
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
    },
  });

  const [newSkill, setNewSkill] = useState('');
  const [newPortfolioLink, setNewPortfolioLink] = useState<PortfolioLink>({ name: '', url: '' });
  const [validationError, setValidationError] = useState('');

  const skills = form.watch('skills');
  const portfolioLinks = form.watch('portfolioLinks');
  const isSaving = updateProfileMutation.isPending;

  const handleAddSkill = (): void => {
    const next = addTag(skills, newSkill);
    if (next !== skills) {
      form.setValue('skills', next, { shouldDirty: true });
    }
    setNewSkill('');
  };

  const handleRemoveSkill = (skillToRemove: string): void => {
    form.setValue('skills', removeTag(skills, skillToRemove), { shouldDirty: true });
  };

  const handleAddPortfolioLink = (): void => {
    if (newPortfolioLink.name.trim() && newPortfolioLink.url.trim()) {
      form.setValue('portfolioLinks', [...portfolioLinks, { ...newPortfolioLink }], {
        shouldDirty: true,
      });
      setNewPortfolioLink({ name: '', url: '' });
    }
  };

  const handleRemovePortfolioLink = (index: number): void => {
    form.setValue(
      'portfolioLinks',
      portfolioLinks.filter((_, i) => i !== index),
      { shouldDirty: true }
    );
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

  const onSubmit = (values: ProfileFormValues): void => {
    updateProfileMutation.mutate(values, {
      onSuccess: (data) => {
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

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              {/* Profile Picture */}
              <div className="flex flex-col items-center">
                <div className="relative mb-3">
                  <Avatar user={profile} size="xxl" onClick={handleAvatarClick} />
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
                {uploadAvatarMutation.isPending && (
                  <div className="mb-2 w-40">
                    <Progress value={undefined} className="h-1" />
                    <p className="mt-1 text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                      Uploading…
                    </p>
                  </div>
                )}
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
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          First Name <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input {...field} disabled={isSaving} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Last Name <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input {...field} disabled={isSaving} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="bio"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bio</FormLabel>
                      <FormControl>
                        <Textarea rows={4} {...field} disabled={isSaving} />
                      </FormControl>
                      <FormDescription>
                        Tell others about yourself and your interests
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
                    disabled={isSaving}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleAddSkill}
                    disabled={!newSkill.trim() || isSaving}
                  >
                    <Plus className="size-4" />
                    Add
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {skills.map((skill, index) => (
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
                <FormField
                  control={form.control}
                  name="experience"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Experience Level</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                        disabled={isSaving}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Experience Level" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="beginner">Beginner</SelectItem>
                          <SelectItem value="intermediate">Intermediate</SelectItem>
                          <SelectItem value="advanced">Advanced</SelectItem>
                          <SelectItem value="expert">Expert</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="availability"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Availability</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                        disabled={isSaving}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Availability" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="full-time">Full-time</SelectItem>
                          <SelectItem value="part-time">Part-time</SelectItem>
                          <SelectItem value="weekends">Weekends</SelectItem>
                          <SelectItem value="evenings">Evenings</SelectItem>
                          <SelectItem value="flexible">Flexible</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Location and Timezone */}
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Location</FormLabel>
                      <FormControl>
                        <Input {...field} disabled={isSaving} placeholder="City, Country" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="timezone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Timezone</FormLabel>
                      <FormControl>
                        <Input {...field} disabled={isSaving} placeholder="UTC-5, EST, etc." />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Social Links */}
              <div className="space-y-4">
                <h2 className="text-lg font-semibold">Social Links</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="socialLinks.github"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>GitHub</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            disabled={isSaving}
                            placeholder="https://github.com/username"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="socialLinks.linkedin"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>LinkedIn</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            disabled={isSaving}
                            placeholder="https://linkedin.com/in/username"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="socialLinks.twitter"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Twitter</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            disabled={isSaving}
                            placeholder="https://twitter.com/username"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="socialLinks.website"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Website</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            disabled={isSaving}
                            placeholder="https://yourwebsite.com"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
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
                    disabled={isSaving}
                  />
                  <Input
                    placeholder="Project URL"
                    value={newPortfolioLink.url}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      setNewPortfolioLink((prev) => ({ ...prev, url: e.target.value }))
                    }
                    disabled={isSaving}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleAddPortfolioLink}
                    disabled={
                      !newPortfolioLink.name.trim() || !newPortfolioLink.url.trim() || isSaving
                    }
                  >
                    <Plus className="size-4" />
                    Add
                  </Button>
                </div>
                <div className="flex flex-col gap-2">
                  {portfolioLinks.map((link, index) => (
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
                <FormField
                  control={form.control}
                  name="isProfilePublic"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center gap-3 space-y-0">
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          disabled={isSaving}
                        />
                      </FormControl>
                      <FormLabel>
                        Make my profile public (visible to other members)
                      </FormLabel>
                    </FormItem>
                  )}
                />
              </div>

              {/* Submit Button */}
              <div className="flex justify-center">
                <Button type="submit" size="lg" disabled={isSaving}>
                  <Save className="size-4" />
                  {isSaving ? 'Saving...' : 'Save Profile'}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
};

const ProfileProjects: React.FC<{ userId?: string }> = ({ userId }) => {
  const { data: projects = [] } = useProjects();
  const mine = (projects as unknown as { _id: string; title: string; owner?: { _id: string } | string }[]).filter(
    (p) => {
      const ownerId = typeof p.owner === 'object' && p.owner ? p.owner._id : p.owner;
      return ownerId?.toString() === userId;
    }
  );
  return (
    <Card>
      <CardContent className="grid gap-2 pt-6">
        <h2 className="text-lg font-semibold">Your projects</h2>
        {mine.length > 0 ? (
          <ul className="grid gap-1.5">
            {mine.map((p) => (
              <li key={p._id}>
                <RouterLink
                  to={`/projects/${p._id}`}
                  className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                >
                  {p.title}
                </RouterLink>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            You haven’t created any projects yet.{' '}
            <RouterLink to="/projects/create" className="text-primary hover:underline">
              Create one
            </RouterLink>
            .
          </p>
        )}
      </CardContent>
    </Card>
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
    <div className="mx-auto max-w-3xl">
      <Tabs defaultValue="overview">
        <TabsList className="mb-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="projects">Projects</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <ProfileForm
            profile={typedProfile}
            profileError={profileError}
            // Re-seed the form only when the server data actually changes (post-save or an
            // out-of-band edit) — updatedAt changes then, but stays stable across no-op
            // refetches, so in-progress edits aren't clobbered by background revalidation.
            key={typedProfile?.updatedAt ?? typedProfile?._id}
          />
        </TabsContent>
        <TabsContent value="projects">
          <ProfileProjects userId={typedProfile?._id} />
        </TabsContent>
        <TabsContent value="activity">
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              No recent activity to show yet.
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Profile;
