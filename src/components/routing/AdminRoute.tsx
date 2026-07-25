import React, { ReactNode } from 'react';
import { Navigate } from '@tanstack/react-router';
import { Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useAuth } from '../../hooks/auth';
import logger from '../../utils/logger';
import type { UserRole } from '../../types';

interface AdminRouteProps {
  children: ReactNode;
  requireRole?: UserRole | UserRole[];
}

const AdminRoute: React.FC<AdminRouteProps> = ({ children, requireRole = 'admin' }) => {
  const { isAuthenticated, isLoading, isError, user, refetch } = useAuth();

  if (process.env.NODE_ENV === 'development') {
    logger.debug('AdminRoute:', {
      isAuthenticated,
      isLoading,
      role: user?.role,
      requireRole,
    });
  }

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // The session check failed rather than answering — don't mistake that for
  // being signed out (see PrivateRoute).
  if (isError) {
    return (
      <div className="mx-auto max-w-md px-4 py-12">
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>
            We couldn&apos;t check your session just now. You may still be signed in.
          </AlertDescription>
        </Alert>
        <Button onClick={() => refetch()}>Try again</Button>
      </div>
    );
  }

  // Check authentication
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // A member suspended mid-session keeps their cookie until they act; the
  // server denies every API call, so say why rather than showing an admin
  // console that answers 403 to everything. The session carries the reason and
  // the end date (`additionalFields` in src/server/auth.ts), so both are shown
  // when an admin set them — a suspension nobody can read the terms of is just
  // a locked door.
  if (user?.isSuspended) {
    const until = user.suspendedUntil ? new Date(user.suspendedUntil) : null;
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertDescription>
            Your account has been suspended. Please contact support for assistance.
            {user.suspensionReason && <div>Reason: {user.suspensionReason}</div>}
            {until && !Number.isNaN(until.getTime()) && (
              <div>Until: {until.toLocaleString()}</div>
            )}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Check role permission
  const allowedRoles: UserRole[] = Array.isArray(requireRole) ? requireRole : [requireRole];
  const hasRequiredRole = user?.role ? allowedRoles.includes(user.role as UserRole) : false;

  if (!hasRequiredRole) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertDescription>
            Access denied. You don&apos;t have sufficient privileges to view this page.
            <br />
            Required role: {allowedRoles.join(' or ')}
            <br />
            Your role: {user?.role || 'none'}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return <>{children}</>;
};

export default AdminRoute;
