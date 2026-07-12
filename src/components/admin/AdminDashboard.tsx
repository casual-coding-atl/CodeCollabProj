import React from 'react';
import {
  Users,
  FolderOpen,
  MessageSquare,
  Shield,
  TrendingUp,
  ShieldCheck,
  Loader2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { useAdminDashboard } from '../../hooks/admin';

type StatColor = 'primary' | 'secondary' | 'success' | 'error' | 'warning' | 'info';

interface StatCardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  color?: StatColor;
  subtitle?: string;
}

interface AdminStats {
  users?: {
    total?: number;
    newThisWeek?: number;
    active?: number;
    suspended?: number;
    admins?: number;
    moderators?: number;
  };
  content?: {
    projects?: {
      total?: number;
      active?: number;
      newThisWeek?: number;
    };
    comments?: {
      total?: number;
    };
  };
  system?: {
    activeSessions?: number;
  };
}

const iconTileColors: Record<StatColor, string> = {
  primary: 'bg-primary/10 text-primary',
  secondary: 'bg-muted text-muted-foreground',
  success: 'bg-primary/10 text-primary',
  info: 'bg-primary/10 text-primary',
  warning: 'bg-brand-amber/10 text-brand-amber',
  error: 'bg-destructive/10 text-destructive',
};

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, color = 'primary', subtitle }) => (
  <Card>
    <CardContent className="flex items-center justify-between">
      <div className="space-y-1">
        <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
          {title}
        </p>
        <p className="text-3xl font-bold tracking-tight text-foreground">{value}</p>
        {subtitle && <p className="font-mono text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      <div
        className={cn(
          'flex size-12 shrink-0 items-center justify-center rounded-lg',
          iconTileColors[color]
        )}
      >
        {icon}
      </div>
    </CardContent>
  </Card>
);

const AdminDashboard: React.FC = () => {
  const { data: stats, isLoading, error, isError } = useAdminDashboard();

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertDescription>
            Failed to load dashboard data: {(error as Error)?.message || 'Unknown error'}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const typedStats = stats as AdminStats | undefined;

  const regularUsers =
    (typedStats?.users?.total || 0) -
    (typedStats?.users?.admins || 0) -
    (typedStats?.users?.moderators || 0);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Admin Dashboard</h1>
        <p className="mt-1 text-muted-foreground">System overview and key metrics</p>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
        <StatCard
          title="Total Users"
          value={typedStats?.users?.total || 0}
          icon={<Users className="size-6" />}
          color="primary"
          subtitle={`${typedStats?.users?.newThisWeek || 0} new this week`}
        />
        <StatCard
          title="Active Users"
          value={typedStats?.users?.active || 0}
          icon={<TrendingUp className="size-6" />}
          color="success"
          subtitle={`${typedStats?.users?.suspended || 0} suspended`}
        />
        <StatCard
          title="Total Projects"
          value={typedStats?.content?.projects?.total || 0}
          icon={<FolderOpen className="size-6" />}
          color="info"
          subtitle={`${typedStats?.content?.projects?.active || 0} active`}
        />
        <StatCard
          title="Active Sessions"
          value={typedStats?.system?.activeSessions || 0}
          icon={<Shield className="size-6" />}
          color="warning"
        />
      </div>

      {/* Roles + Content overview */}
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* User Roles Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">User Roles</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-destructive" />
                <span className="text-sm">Administrators</span>
              </div>
              <Badge variant="destructive" className="font-mono">
                {typedStats?.users?.admins || 0}
              </Badge>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="size-4 text-brand-amber" />
                <span className="text-sm">Moderators</span>
              </div>
              <Badge className="bg-brand-amber font-mono text-brand-amber-foreground hover:bg-brand-amber/90">
                {typedStats?.users?.moderators || 0}
              </Badge>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="size-4 text-primary" />
                <span className="text-sm">Regular Users</span>
              </div>
              <Badge className="font-mono">{regularUsers}</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Content Statistics */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Content Overview</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderOpen className="size-4 text-primary" />
                <span className="text-sm">Total Projects</span>
              </div>
              <span className="font-mono text-base font-semibold">
                {typedStats?.content?.projects?.total || 0}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="size-4 text-primary" />
                <span className="text-sm">Active Projects</span>
              </div>
              <span className="font-mono text-base font-semibold">
                {typedStats?.content?.projects?.active || 0}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="size-4 text-primary" />
                <span className="text-sm">Total Comments</span>
              </div>
              <span className="font-mono text-base font-semibold">
                {typedStats?.content?.comments?.total || 0}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">New projects this week</span>
              <Badge variant="outline" className="font-mono">
                {typedStats?.content?.projects?.newThisWeek || 0}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity Summary */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">Recent Activity Summary</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Badge variant="outline" className="font-mono">
            {typedStats?.users?.newThisWeek || 0} new users this week
          </Badge>
          <Badge variant="outline" className="font-mono">
            {typedStats?.content?.projects?.newThisWeek || 0} new projects this week
          </Badge>
          <Badge
            variant="outline"
            className={cn(
              'font-mono',
              (typedStats?.users?.suspended || 0) > 0 && 'border-brand-amber/40 text-brand-amber'
            )}
          >
            {typedStats?.users?.suspended || 0} suspended accounts
          </Badge>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminDashboard;
