import { type FC, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { MessageSquare, Shield, Menu, Search } from 'lucide-react';
import { useAuth, useLogout } from '../../hooks/auth';
import { useMessages } from '../../hooks/users/useMessaging';
import { useMyProfile } from '../../hooks/users';
import Avatar from '../common/Avatar';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { CommandMenu } from '@/components/command/CommandMenu';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

const Header: FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const logoutMutation = useLogout();
  const { data: profile } = useMyProfile({ enabled: isAuthenticated });
  const { data: inboxMessages = [] } = useMessages('inbox', { enabled: isAuthenticated });
  const unreadCount = inboxMessages.filter((msg) => !msg.isRead).length;
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = (): void => {
    logoutMutation.mutate(undefined, { onSuccess: () => navigate('/login') });
  };

  const isStaff = user?.role === 'admin' || user?.role === 'moderator';

  const mobileLinks: { to: string; label: string }[] = [
    { to: '/projects', label: 'Projects' },
    ...(isAuthenticated
      ? [
          { to: '/members', label: 'Members' },
          { to: '/messages', label: 'Messages' },
          { to: '/dashboard', label: 'Dashboard' },
          { to: '/profile', label: 'Profile' },
          ...(isStaff ? [{ to: '/admin', label: 'Admin' }] : []),
        ]
      : [
          { to: '/login', label: 'Login' },
          { to: '/register', label: 'Register' },
        ]),
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <CommandMenu />
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4 sm:px-6">
        {/* Mobile nav */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="sm:hidden"
              aria-label="Open navigation menu"
              data-testid="mobile-nav-trigger"
            >
              <Menu className="size-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72">
            <SheetHeader>
              <SheetTitle className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                Menu
              </SheetTitle>
            </SheetHeader>
            <nav className="mt-2 grid gap-1 px-2">
              {mobileLinks.map((l) => (
                <Button
                  key={l.to}
                  asChild
                  variant="ghost"
                  className="justify-start"
                  onClick={() => setMobileOpen(false)}
                >
                  <RouterLink to={l.to}>{l.label}</RouterLink>
                </Button>
              ))}
              {isAuthenticated && (
                <Button
                  variant="ghost"
                  className="justify-start text-destructive"
                  onClick={() => {
                    setMobileOpen(false);
                    handleLogout();
                  }}
                >
                  Log out
                </Button>
              )}
              <div className="mt-2 flex items-center gap-2 px-1">
                <ThemeToggle />
                <span className="text-sm text-muted-foreground">Theme</span>
              </div>
            </nav>
          </SheetContent>
        </Sheet>

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
          <Button
            variant="outline"
            size="sm"
            className="hidden gap-2 text-muted-foreground sm:inline-flex"
            aria-label="Open command palette"
            onClick={() =>
              document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))
            }
          >
            <Search className="size-3.5" />
            <kbd className="font-mono text-[10px]">⌘K</kbd>
          </Button>
          <ThemeToggle />
          <NavLink to="/projects">Projects</NavLink>

          {isAuthenticated ? (
            <>
              <NavLink to="/members" className="hidden sm:inline-flex">
                Members
              </NavLink>
              <NavLink to="/dashboard" className="hidden sm:inline-flex">
                Dashboard
              </NavLink>

              <Tooltip>
                <TooltipTrigger asChild>
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
                </TooltipTrigger>
                <TooltipContent>
                  Messages{unreadCount > 0 ? ` · ${unreadCount} unread` : ''}
                </TooltipContent>
              </Tooltip>

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
