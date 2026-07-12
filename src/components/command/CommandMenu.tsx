import { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import {
  FolderGit2,
  Home,
  LayoutDashboard,
  MessageSquare,
  Shield,
  User,
  Users,
} from 'lucide-react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { useAuth } from '../../hooks/auth';
import { useProjects } from '../../hooks/projects';
import { useUsers } from '../../hooks/users';

interface Row {
  _id: string;
}
interface ProjectRow extends Row {
  title: string;
}
interface UserRow extends Row {
  username: string;
}

/** ⌘K / Ctrl+K command palette: jump to any page, project, or member. */
export function CommandMenu() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const { data: projects = [] } = useProjects();
  const { data: users = [] } = useUsers({ enabled: isAuthenticated });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const isStaff = user?.role === 'admin' || user?.role === 'moderator';
  type PagePath = '/' | '/projects' | '/members' | '/messages' | '/dashboard' | '/profile' | '/admin';
  const allPages: { label: string; to: PagePath; icon: typeof Home; show: boolean }[] = [
    { label: 'Home', to: '/', icon: Home, show: true },
    { label: 'Projects', to: '/projects', icon: FolderGit2, show: true },
    { label: 'Members', to: '/members', icon: Users, show: isAuthenticated },
    { label: 'Messages', to: '/messages', icon: MessageSquare, show: isAuthenticated },
    { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard, show: isAuthenticated },
    { label: 'Profile', to: '/profile', icon: User, show: isAuthenticated },
    { label: 'Admin', to: '/admin', icon: Shield, show: isStaff },
  ];
  const pages = allPages.filter((p) => p.show);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search projects, members, pages…" data-testid="command-menu-input" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Pages">
          {pages.map((p) => (
            <CommandItem
              key={p.to}
              value={`page ${p.label}`}
              onSelect={() => {
                setOpen(false);
                navigate({ to: p.to });
              }}
            >
              <p.icon className="size-4" />
              {p.label}
            </CommandItem>
          ))}
        </CommandGroup>
        {(projects as unknown as ProjectRow[]).length > 0 && (
          <CommandGroup heading="Projects">
            {(projects as unknown as ProjectRow[]).slice(0, 20).map((p) => (
              <CommandItem
                key={p._id}
                value={`project ${p.title}`}
                onSelect={() => {
                  setOpen(false);
                  navigate({ to: '/projects/$projectId', params: { projectId: p._id } });
                }}
              >
                <FolderGit2 className="size-4" />
                {p.title}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {isAuthenticated && (users as unknown as UserRow[]).length > 0 && (
          <CommandGroup heading="Members">
            {(users as unknown as UserRow[]).slice(0, 20).map((u) => (
              <CommandItem
                key={u._id}
                value={`member ${u.username}`}
                onSelect={() => {
                  setOpen(false);
                  navigate({ to: '/members/$id', params: { id: u._id } });
                }}
              >
                <Users className="size-4" />
                {u.username}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
