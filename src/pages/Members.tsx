import React, { useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useUsers } from '../hooks/users';
import { useProjects } from '../hooks/projects';
import MessageForm from '../components/messaging/MessageForm';
import Avatar from '../components/common/Avatar';
import type { User } from '../types';

// API response types - standalone interfaces to handle _id fields
interface UserWithId {
  _id: string;
  id?: string;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  bio?: string;
  skills?: string[];
  experience?: string;
  availability?: string;
  location?: string;
  profileImage?: string;
}

interface ProjectWithId {
  _id: string;
  id?: string;
  title: string;
  description: string;
  technologies?: string[];
  createdAt: string;
  owner?:
    | {
        _id: string;
        username?: string;
      }
    | string;
  collaborators?: Array<{
    _id?: string;
    userId?:
      | {
          _id: string;
        }
      | string;
  }>;
}

const metaLabel = 'font-mono text-[11px] uppercase tracking-widest text-muted-foreground';

const Members: React.FC = () => {
  const [showMessageForm, setShowMessageForm] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithId | null>(null);

  // Fetch users and projects using TanStack Query
  const {
    data: users = [],
    isLoading: usersLoading,
    error: usersError,
    refetch: refetchUsers,
  } = useUsers();

  const {
    data: projects = [],
    isLoading: projectsLoading,
    error: projectsError,
    refetch: refetchProjects,
  } = useProjects();

  const loading = usersLoading || projectsLoading;
  const error = usersError || projectsError;

  const typedUsers = users as unknown as UserWithId[];
  const typedProjects = projects as unknown as ProjectWithId[];

  // Memoized helper: get projects for a user
  const getUserProjects = useMemo(() => {
    return (userId: string): ProjectWithId[] => {
      return typedProjects.filter((p) => {
        // Handle both populated and unpopulated owner fields
        const ownerId = typeof p.owner === 'object' && p.owner !== null ? p.owner._id : p.owner;
        return (
          (ownerId && ownerId.toString() === userId.toString()) ||
          (p.collaborators &&
            p.collaborators.some((c) => {
              const collabUserId =
                typeof c.userId === 'object' && c.userId !== null
                  ? (c.userId as { _id: string })._id
                  : c.userId;
              return collabUserId?.toString() === userId.toString();
            }))
        );
      });
    };
  }, [typedProjects]);

  const handleMessageUser = (user: UserWithId): void => {
    setSelectedUser(user);
    setShowMessageForm(true);
  };

  const handleCloseMessageForm = (): void => {
    setShowMessageForm(false);
    setSelectedUser(null);
  };

  const handleMessageSent = (): void => {
    setShowMessageForm(false);
    setSelectedUser(null);
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        <p className={metaLabel}>the group</p>
        <h1 className="mb-6 text-3xl font-bold tracking-tight text-foreground">Members</h1>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Skeleton className="size-10 rounded-full" />
                  <Skeleton className="h-4 w-28" />
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-3/4" />
                <div className="flex gap-1.5 pt-1">
                  <Skeleton className="h-5 w-14 rounded-full" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
              </CardContent>
              <CardFooter>
                <Skeleton className="h-8 w-24 rounded-md" />
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        <Alert variant="destructive" className="mb-6">
          <AlertTitle>Error Loading Members</AlertTitle>
          <AlertDescription>
            {(error as Error & { response?: { data?: { message?: string } } })?.response?.data
              ?.message ||
              (error as Error)?.message ||
              'Failed to load members data'}
          </AlertDescription>
        </Alert>
        <Button
          onClick={() => {
            refetchUsers();
            refetchProjects();
          }}
        >
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <p className={metaLabel}>the group</p>
      <h1 className="mb-6 text-3xl font-bold tracking-tight text-foreground">Members</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {typedUsers.map((user) => {
          const userProjects = getUserProjects(user._id);
          return (
            <Card key={user._id} className="flex flex-col transition-colors hover:border-primary/40">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Avatar user={user} size="md" />
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{user.username}</p>
                    {user.experience && (
                      <Badge variant="secondary" className="mt-1 font-mono text-[10px] uppercase tracking-wide">
                        {user.experience}
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>

              <CardContent className="flex-1 space-y-4 text-sm">
                <div>
                  <p className={metaLabel}>Skills</p>
                  {user.skills && user.skills.length > 0 ? (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {user.skills.map((skill) => (
                        <Badge key={skill} variant="outline">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-1 text-muted-foreground">—</p>
                  )}
                </div>

                <div>
                  <p className={metaLabel}>Availability</p>
                  <p className="mt-1 text-foreground">{user.availability ? user.availability : '—'}</p>
                </div>

                <div>
                  <p className={metaLabel}>Project Name(s)</p>
                  <p className="mt-1">
                    {userProjects.length > 0
                      ? userProjects.map((p, idx) => (
                          <span key={p._id}>
                            <RouterLink
                              to={`/projects#${p._id}`}
                              className="font-medium text-primary underline-offset-4 hover:underline"
                            >
                              {p.title}
                            </RouterLink>
                            {idx < userProjects.length - 1 && ', '}
                          </span>
                        ))
                      : <span className="text-muted-foreground">—</span>}
                  </p>
                </div>
              </CardContent>

              <CardFooter>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleMessageUser(user)}
                >
                  <MessageSquare className="size-4" />
                  Message
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>

      {/* Message Form Dialog */}
      <Dialog
        open={showMessageForm}
        onOpenChange={(open) => {
          if (!open) handleCloseMessageForm();
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Send Message to {selectedUser?.username}</DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <MessageForm
              recipientId={selectedUser._id}
              recipientUser={selectedUser as unknown as User}
              onSuccess={handleMessageSent}
              onCancel={handleCloseMessageForm}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Members;
