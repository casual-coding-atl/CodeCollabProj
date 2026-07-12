import React from 'react';
import {
  LayoutDashboard,
  Users,
  Shield,
  BarChart3,
  Settings,
  ChevronLeft,
  LogOut,
} from 'lucide-react';
import { useNavigate, useLocation, Outlet } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { useAuth } from '../../hooks/auth';
import logger from '../../utils/logger';

interface MenuItem {
  text: string;
  icon: React.ReactNode;
  path: '/admin' | '/admin/users' | '/admin/logs' | '/admin/analytics' | '/admin/settings';
  exact?: boolean;
}

const AdminLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const menuItems: MenuItem[] = [
    {
      text: 'Dashboard',
      icon: <LayoutDashboard className="size-4" />,
      path: '/admin',
      exact: true,
    },
    {
      text: 'User Management',
      icon: <Users className="size-4" />,
      path: '/admin/users',
    },
    {
      text: 'System Logs',
      icon: <Shield className="size-4" />,
      path: '/admin/logs',
    },
    {
      text: 'Analytics',
      icon: <BarChart3 className="size-4" />,
      path: '/admin/analytics',
    },
    {
      text: 'Settings',
      icon: <Settings className="size-4" />,
      path: '/admin/settings',
    },
  ];

  const isActiveRoute = (item: MenuItem): boolean => {
    if (item.exact) {
      return location.pathname === item.path;
    }
    return location.pathname.startsWith(item.path);
  };

  const handleLogout = async (): Promise<void> => {
    try {
      await logout();
      navigate({ to: '/login' });
    } catch (error) {
      logger.error('Logout failed:', error);
    }
  };

  const handleBackToApp = (): void => {
    navigate({ to: '/dashboard' });
  };

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Sidebar */}
      <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-card">
        <div className="flex h-16 items-center gap-2 px-4">
          <Shield className="size-5 text-brand-amber" />
          <span className="text-sm font-semibold tracking-tight">CodeCollabProj Admin</span>
        </div>
        <Separator />

        <nav className="flex flex-1 flex-col gap-1 p-3">
          {menuItems.map((item) => (
            <Button
              key={item.text}
              variant="ghost"
              onClick={() => navigate({ to: item.path })}
              className={cn(
                'justify-start gap-2',
                isActiveRoute(item)
                  ? 'bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary'
                  : 'text-muted-foreground'
              )}
            >
              {item.icon}
              {item.text}
            </Button>
          ))}
        </nav>

        <Separator />

        <div className="flex flex-col gap-1 p-3">
          <Button
            variant="ghost"
            onClick={handleBackToApp}
            className="justify-start gap-2 text-muted-foreground"
          >
            <ChevronLeft className="size-4" />
            Back to App
          </Button>

          <Button
            data-testid="logout-button"
            variant="ghost"
            onClick={handleLogout}
            className="justify-start gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut className="size-4" />
            Logout
          </Button>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex flex-1 flex-col">
        {/* Top bar */}
        <header className="flex h-16 items-center justify-between border-b border-border bg-card px-6">
          <h1 className="text-lg font-semibold tracking-tight">Admin Panel</h1>
          <span className="font-mono text-sm text-muted-foreground">{user?.username}</span>
        </header>

        {/* Main Content */}
        <main className="flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
