import React, { useMemo, useState } from 'react';
import { Link as RouterLink } from '@tanstack/react-router';
import { MessageSquare, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useUsers } from '../hooks/users';
import { useProjects } from '../hooks/projects';
import MessageForm from '../components/messaging/MessageForm';
import Avatar from '../components/common/Avatar';
import { sortByKey, paginate, pageCount, type SortDir } from '@/lib/table';
import type { User } from '../types';

interface UserWithId {
  _id: string;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  bio?: string;
  skills?: string[];
  experience?: string;
  availability?: string;
  role?: string;
  profileImage?: string;
}
interface ProjectWithId {
  _id: string;
  title: string;
  owner?: { _id: string; username?: string } | string;
  collaborators?: Array<{ userId?: { _id: string } | string }>;
}

const metaLabel = 'font-mono text-[11px] uppercase tracking-widest text-muted-foreground';
const PER_PAGE = 10;

function SortHeader({
  label,
  k,
  onSort,
}: {
  label: string;
  k: keyof UserWithId;
  onSort: (key: keyof UserWithId) => void;
}) {
  return (
    <TableHead>
      <button
        type="button"
        onClick={() => onSort(k)}
        className="inline-flex items-center gap-1 hover:text-foreground"
      >
        {label}
        <ArrowUpDown className="size-3" />
      </button>
    </TableHead>
  );
}

const Members: React.FC = () => {
  const [showMessageForm, setShowMessageForm] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithId | null>(null);
  const [sortKey, setSortKey] = useState<keyof UserWithId>('username');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [page, setPage] = useState(1);

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
  const loadError = usersError || projectsError;
  const typedUsers = users as unknown as UserWithId[];
  const typedProjects = projects as unknown as ProjectWithId[];

  const getUserProjects = useMemo(
    () => (userId: string) =>
      typedProjects.filter((p) => {
        const ownerId = typeof p.owner === 'object' && p.owner ? p.owner._id : p.owner;
        return (
          ownerId?.toString() === userId ||
          p.collaborators?.some((c) => {
            const id = typeof c.userId === 'object' && c.userId ? c.userId._id : c.userId;
            return id?.toString() === userId;
          })
        );
      }),
    [typedProjects]
  );

  const sorted = useMemo(() => sortByKey(typedUsers, sortKey, sortDir), [typedUsers, sortKey, sortDir]);
  const totalPages = pageCount(sorted.length, PER_PAGE);
  const pageUsers = paginate(sorted, Math.min(page, totalPages), PER_PAGE);

  const toggleSort = (key: keyof UserWithId): void => {
    if (key === sortKey) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('asc');
    }
    setPage(1);
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl">
        <p className={metaLabel}>the group</p>
        <h1 className="mb-6 text-3xl font-bold tracking-tight">Members</h1>
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-md" />
          ))}
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-6xl">
        <Alert variant="destructive" className="mb-6">
          <AlertTitle>Error loading members</AlertTitle>
          <AlertDescription>{(loadError as Error)?.message || 'Failed to load members'}</AlertDescription>
        </Alert>
        <Button
          onClick={() => {
            refetchUsers();
            refetchProjects();
          }}
        >
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <p className={metaLabel}>the group</p>
      <div className="mb-6 flex items-baseline gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Members</h1>
        <span className="font-mono text-xs text-muted-foreground">{sorted.length}</span>
      </div>

      <div className="rounded-lg border">
        <Table data-testid="members-table">
          <TableHeader>
            <TableRow>
              <SortHeader label="Member" k="username" onSort={toggleSort} />
              <SortHeader label="Experience" k="experience" onSort={toggleSort} />
              <TableHead>Skills</TableHead>
              <TableHead>Projects</TableHead>
              <TableHead className="text-right">Message</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageUsers.map((user) => {
              const userProjects = getUserProjects(user._id);
              return (
                <TableRow key={user._id}>
                  <TableCell>
                    <HoverCard openDelay={150}>
                      <HoverCardTrigger asChild>
                        <RouterLink
                          to="/members/$id"
                          params={{ id: user._id }}
                          className="flex items-center gap-3 text-left hover:text-primary"
                        >
                          <Avatar user={user} size="sm" />
                          <span className="font-medium">{user.username}</span>
                        </RouterLink>
                      </HoverCardTrigger>
                      <HoverCardContent className="w-72">
                        <div className="flex items-start gap-3">
                          <Avatar user={user} size="md" />
                          <div className="min-w-0">
                            <p className="font-medium">{user.username}</p>
                            {user.role && (
                              <Badge variant="secondary" className="mt-1 font-mono text-[10px] uppercase">
                                {user.role}
                              </Badge>
                            )}
                            {user.bio && (
                              <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{user.bio}</p>
                            )}
                            {user.skills && user.skills.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {user.skills.slice(0, 5).map((s) => (
                                  <Badge key={s} variant="outline" className="text-[10px]">
                                    {s}
                                  </Badge>
                                ))}
                              </div>
                            )}
                            <RouterLink
                              to="/members/$id"
                          params={{ id: user._id }}
                              className="mt-3 inline-block text-xs font-medium text-primary underline-offset-4 hover:underline"
                            >
                              View full profile →
                            </RouterLink>
                          </div>
                        </div>
                      </HoverCardContent>
                    </HoverCard>
                  </TableCell>
                  <TableCell>
                    {user.experience ? (
                      <Badge variant="secondary" className="font-mono text-[10px] uppercase">
                        {user.experience}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex max-w-xs flex-wrap gap-1">
                      {user.skills && user.skills.length > 0 ? (
                        user.skills.slice(0, 3).map((s) => (
                          <Badge key={s} variant="outline">
                            {s}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                      {user.skills && user.skills.length > 3 && (
                        <span className="text-xs text-muted-foreground">+{user.skills.length - 3}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-xs">
                    {userProjects.length > 0 ? (
                      <span className="line-clamp-1 text-sm">
                        {userProjects.map((p, i) => (
                          <span key={p._id}>
                            <RouterLink
                              to="/projects"
                              hash={p._id}
                              className="text-primary underline-offset-4 hover:underline"
                            >
                              {p.title}
                            </RouterLink>
                            {i < userProjects.length - 1 && ', '}
                          </span>
                        ))}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`Message ${user.username}`}
                          onClick={() => {
                            setSelectedUser(user);
                            setShowMessageForm(true);
                          }}
                        >
                          <MessageSquare className="size-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Message {user.username}</TooltipContent>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-end gap-2">
          <span className={metaLabel}>
            Page {Math.min(page, totalPages)} of {totalPages}
          </span>
          <Button
            size="icon"
            variant="outline"
            aria-label="Previous page"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            size="icon"
            variant="outline"
            data-testid="members-next-page"
            aria-label="Next page"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      )}

      <Dialog open={showMessageForm} onOpenChange={(open) => !open && setShowMessageForm(false)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Send message to {selectedUser?.username}</DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <MessageForm
              recipientId={selectedUser._id}
              recipientUser={selectedUser as unknown as User}
              onSuccess={() => setShowMessageForm(false)}
              onCancel={() => setShowMessageForm(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Members;
