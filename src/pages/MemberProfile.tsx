import { type FC, useMemo, useState } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { MessageSquare, Loader2 } from 'lucide-react';
import { useUser } from '../hooks/users';
import { useProjects } from '../hooks/projects';
import Avatar from '../components/common/Avatar';
import MessageForm from '../components/messaging/MessageForm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import type { User } from '../types';

interface UserWithId {
  _id: string;
  username: string;
  email?: string;
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
  owner?: { _id: string } | string;
  collaborators?: Array<{ userId?: { _id: string } | string }>;
}

const metaLabel = 'font-mono text-[11px] uppercase tracking-widest text-muted-foreground';

const MemberProfile: FC = () => {
  const { id } = useParams<{ id: string }>();
  const { data: member, isLoading, error } = useUser(id);
  const { data: projects = [] } = useProjects();
  const [showMessage, setShowMessage] = useState(false);

  const user = member as unknown as UserWithId | undefined;

  const memberProjects = useMemo(() => {
    if (!id) return [] as ProjectWithId[];
    return (projects as unknown as ProjectWithId[]).filter((p) => {
      const ownerId = typeof p.owner === 'object' && p.owner ? p.owner._id : p.owner;
      return (
        ownerId?.toString() === id ||
        p.collaborators?.some((c) => {
          const cid = typeof c.userId === 'object' && c.userId ? c.userId._id : c.userId;
          return cid?.toString() === id;
        })
      );
    });
  }, [projects, id]);

  if (isLoading) {
    return (
      <div className="mx-auto flex max-w-4xl justify-center py-16">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="mx-auto max-w-4xl">
        <Alert variant="destructive">
          <AlertTitle>Member not found</AlertTitle>
          <AlertDescription>
            {(error as Error)?.message || 'This member’s profile is unavailable.'}
          </AlertDescription>
        </Alert>
        <Button asChild variant="outline" className="mt-4">
          <RouterLink to="/members">Back to members</RouterLink>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <Breadcrumb className="mb-4">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <RouterLink to="/members">Members</RouterLink>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{user.username}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Avatar user={user} size="xl" />
              <div>
                <CardTitle className="text-2xl">{user.username}</CardTitle>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  {user.role && (
                    <Badge variant="secondary" className="font-mono text-[10px] uppercase">
                      {user.role}
                    </Badge>
                  )}
                  {user.experience && (
                    <Badge variant="outline" className="font-mono text-[10px] uppercase">
                      {user.experience}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            <Button data-testid="message-member" onClick={() => setShowMessage(true)} className="gap-1.5">
              <MessageSquare className="size-4" />
              Message
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-6">
          {user.bio && <p className="text-sm text-muted-foreground">{user.bio}</p>}

          <div>
            <p className={metaLabel}>Skills</p>
            {user.skills && user.skills.length > 0 ? (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {user.skills.map((s) => (
                  <Badge key={s} variant="outline">
                    {s}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">—</p>
            )}
          </div>

          <div>
            <p className={metaLabel}>Projects</p>
            {memberProjects.length > 0 ? (
              <ul className="mt-1.5 grid gap-1.5">
                {memberProjects.map((p) => (
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
              <p className="mt-1 text-sm text-muted-foreground">No projects yet.</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={showMessage} onOpenChange={setShowMessage}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Send message to {user.username}</DialogTitle>
          </DialogHeader>
          <MessageForm
            recipientId={user._id}
            recipientUser={user as unknown as User}
            onSuccess={() => setShowMessage(false)}
            onCancel={() => setShowMessage(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MemberProfile;
