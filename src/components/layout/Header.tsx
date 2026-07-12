import { type FC } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { MessageSquare, Shield } from 'lucide-react';
import { useAuth, useLogout } from '../../hooks/auth';
import { useMessages } from '../../hooks/users/useMessaging';
import { useMyProfile } from '../../hooks/users';
import Avatar from '../common/Avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

const Header: FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const logoutMutation = useLogout();
  const { data: profile } = useMyProfile({ enabled: isAuthenticated });
  const { data: inboxMessages = [] } = useMessages('inbox', { enabled: isAuthenticated });
  const unreadCount = inboxMessages.filter((msg) => !msg.isRead).length;

  const handleLogout = (): void => {
    logoutMutation.mutate(undefined, { onSuccess: () => navigate('/login') });
  };

  const isStaff = user?.role === 'admin' || user?.role === 'moderator';

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4 sm:px-6">
        {/* Brand */}
        <RouterLink to="/" className="mr-2 flex items-center gap-3">
          <img
            src="/CC-Logo-ColorBg.png"
            alt="Casual Coding Meetup Group logo"
            className="h-9 w-auto rounded-md"
          />
          <span className="flex flex-col leading-none">
            <span className="text-[15px] font-semibold tracking-tight text-foreground">
              CodeCollabProj
            </span>
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              // casual coding meetup
            </span>
          </span>
        </RouterLink>

        <nav className="ml-auto flex items-center gap-1">
          <NavLink to="/projects">Projects</NavLink>

          {isAuthenticated ? (
            <>
              <NavLink to="/members" className="hidden sm:inline-flex">
                Members
              </NavLink>
              <NavLink to="/dashboard" className="hidden sm:inline-flex">
                Dashboard
              </NavLink>

              <Button
                asChild
                variant="ghost"
                size="icon"
                aria-label={`Messages${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
                className="relative"
              >
                <RouterLink to="/messages">
                  <MessageSquare className="size-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-brand-amber px-1 font-mono text-[10px] font-semibold leading-4 text-brand-amber-foreground">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </RouterLink>
              </Button>

              {isStaff && (
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="hidden gap-1.5 border-brand-amber/40 text-foreground sm:inline-flex"
                >
                  <RouterLink to="/admin">
                    <Shield className="size-3.5 text-brand-amber" />
                    Admin
                  </RouterLink>
                </Button>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    aria-label={`Account menu for ${user?.username || 'user'}`}
                    className="ml-1 rounded-full outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <Avatar user={profile || user} size="sm" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel className="font-mono text-xs text-muted-foreground">
                    {profile?.username || user?.username || 'Account'}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <RouterLink to="/profile">Profile</RouterLink>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    data-testid="logout-button"
                    onClick={handleLogout}
                    className="text-destructive focus:text-destructive"
                  >
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <NavLink to="/login">Login</NavLink>
              <Button asChild size="sm" className="ml-1">
                <RouterLink to="/register">Register</RouterLink>
              </Button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
};

function NavLink({
  to,
  children,
  className,
}: {
  to: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Button asChild variant="ghost" size="sm" className={cn('text-muted-foreground', className)}>
      <RouterLink to={to}>{children}</RouterLink>
    </Button>
  );
}

export default Header;
