import { type FC } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useLocation } from '@tanstack/react-router';
import {
  FolderGit2,
  Users,
  LayoutDashboard,
  MessageSquare,
  Shield,
  Search,
  LogIn,
  UserPlus,
  LogOut,
  User as UserIcon,
} from 'lucide-react';
import { useAuth, useLogout } from '../../hooks/auth';
import { useMessages } from '../../hooks/users/useMessaging';
import { useMyProfile } from '../../hooks/users';
import Avatar from '../common/Avatar';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { CommandMenu } from '@/components/command/CommandMenu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface NavItem {
  to: string;
  label: string;
  icon: typeof FolderGit2;
  badge?: number;
}

function openCommandMenu(): void {
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
}

const Header: FC = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { isAuthenticated, user } = useAuth();
  const logoutMutation = useLogout();
  const { data: profile } = useMyProfile({ enabled: isAuthenticated });
  const { data: inboxMessages = [] } = useMessages('inbox', { enabled: isAuthenticated });
  const unreadCount = inboxMessages.filter((msg) => !msg.isRead).length;

  const handleLogout = (): void => {
    logoutMutation.mutate(undefined, { onSuccess: () => navigate('/login') });
  };

  const isStaff = user?.role === 'admin' || user?.role === 'moderator';
  const isActive = (to: string): boolean => pathname === to || pathname.startsWith(`${to}/`);

  // Primary destinations — the segmented nav group (desktop) and bottom tabs (mobile).
  const primaryNav: NavItem[] = isAuthenticated
    ? [
        { to: '/projects', label: 'Projects', icon: FolderGit2 },
        { to: '/members', label: 'Members', icon: Users },
        { to: '/messages', label: 'Messages', icon: MessageSquare, badge: unreadCount },
        { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      ]
    : [
        { to: '/projects', label: 'Projects', icon: FolderGit2 },
        { to: '/login', label: 'Login', icon: LogIn },
        { to: '/register', label: 'Register', icon: UserPlus },
      ];

  // Desktop nav pills exclude Messages (it lives in the tools cluster as an icon).
  const desktopPills = primaryNav.filter((i) => i.to !== '/messages' && i.to !== '/login' && i.to !== '/register');

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <CommandMenu />
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
          {/* Brand */}
          <RouterLink to="/" className="flex items-center gap-3">
            <img
              src="/CC-Logo-ColorBg.png"
              alt="Casual Coding Meetup Group logo"
              className="h-9 w-auto rounded-md"
            />
            <span className="hidden flex-col leading-none sm:flex">
              <span className="text-[15px] font-semibold tracking-tight text-foreground">
                CodeCollabProj
              </span>
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                // casual coding meetup
              </span>
            </span>
          </RouterLink>

          {/* NAV zone — segmented pill group (desktop only) */}
          <nav className="ml-1 hidden items-center rounded-full border border-border/60 bg-muted/40 p-1 sm:flex">
            {desktopPills.map((item) => (
              <Button
                key={item.to}
                asChild
                variant={isActive(item.to) ? 'secondary' : 'ghost'}
                size="sm"
                className={cn('rounded-full', isActive(item.to) ? 'shadow-sm' : 'text-muted-foreground')}
              >
                <RouterLink to={item.to}>{item.label}</RouterLink>
              </Button>
            ))}
          </nav>

          {/* TOOLS + IDENTITY zone */}
          <div className="ml-auto flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="hidden gap-2 text-muted-foreground sm:inline-flex"
              aria-label="Open command palette"
              onClick={openCommandMenu}
            >
              <Search className="size-3.5" />
              <kbd className="font-mono text-[10px]">⌘K</kbd>
            </Button>

            {isAuthenticated && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    asChild
                    variant="ghost"
                    size="icon"
                    aria-label={`Messages${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
                    className="relative hidden sm:inline-flex"
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
                </TooltipTrigger>
                <TooltipContent>
                  Messages{unreadCount > 0 ? ` · ${unreadCount} unread` : ''}
                </TooltipContent>
              </Tooltip>
            )}

            {/* Bell shows on all viewports for signed-in users (self-hides otherwise) */}
            <NotificationBell />

            <ThemeToggle />

            {isAuthenticated ? (
              <>
                <Separator orientation="vertical" className="mx-1 hidden h-6 sm:block" />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      aria-label={`Account menu for ${user?.username || 'user'}`}
                      className="ml-0.5 rounded-full outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      <Avatar user={profile || user} size="sm" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuLabel className="font-mono text-xs text-muted-foreground">
                      {profile?.username || user?.username || 'Account'}
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <RouterLink to="/profile">
                        <UserIcon className="size-4" /> Profile
                      </RouterLink>
                    </DropdownMenuItem>
                    {/* Dashboard is a bottom-tab/pill on larger surfaces; keep it here too for quick reach */}
                    <DropdownMenuItem asChild className="sm:hidden">
                      <RouterLink to="/dashboard">
                        <LayoutDashboard className="size-4" /> Dashboard
                      </RouterLink>
                    </DropdownMenuItem>
                    {isStaff && (
                      <DropdownMenuItem asChild>
                        <RouterLink to="/admin">
                          <Shield className="size-4 text-brand-amber" /> Admin
                        </RouterLink>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      data-testid="logout-button"
                      onClick={handleLogout}
                      className="text-destructive focus:text-destructive"
                    >
                      <LogOut className="size-4" /> Log out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              // Unauthenticated: keep auth actions reachable on desktop (mobile uses the bottom bar).
              <div className="hidden items-center gap-1 sm:flex">
                <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
                  <RouterLink to="/login">Login</RouterLink>
                </Button>
                <Button asChild size="sm" className="ml-1">
                  <RouterLink to="/register">Register</RouterLink>
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Bottom tab bar — primary destinations on mobile (replaces the hamburger sheet) */}
      <nav
        data-testid="mobile-tabbar"
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 flex items-stretch border-t border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:hidden"
      >
        {primaryNav.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.to);
          return (
            <RouterLink
              key={item.to}
              to={item.to}
              className={cn(
                'relative flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium',
                active ? 'text-brand-amber' : 'text-muted-foreground'
              )}
            >
              <Icon className="size-5" />
              {item.label}
              {item.badge && item.badge > 0 ? (
                <span className="absolute right-1/2 top-1.5 ml-3 translate-x-4 rounded-full bg-brand-amber px-1 font-mono text-[9px] font-semibold leading-4 text-brand-amber-foreground">
                  {item.badge > 9 ? '9+' : item.badge}
                </span>
              ) : null}
            </RouterLink>
          );
        })}
      </nav>
    </>
  );
};

export default Header;
