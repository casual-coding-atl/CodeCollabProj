import React, { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '../../hooks/auth';
import type { UserRole } from '../../types';

interface AdminRouteProps {
  children: ReactNode;
  requireRole?: UserRole | UserRole[];
}

const AdminRoute: React.FC<AdminRouteProps> = ({ children, requireRole = 'admin' }) => {
  const { isAuthenticated, isLoading, user, hasRole } = useAuth();

  console.log('AdminRoute Debug:');
  console.log('- isAuthenticated:', isAuthenticated);
  console.log('- isLoading:', isLoading);
  console.log('- user role:', user?.role);
  console.log('- required role:', requireRole);
  console.log('- hasRole check:', hasRole && hasRole(requireRole as UserRole));

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Check authentication
  if (!isAuthenticated) {
    console.log('Not authenticated, redirecting to login');
    return <Navigate to="/login" replace />;
  }

  // Check if user account is suspended
  if (user?.isSuspended) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertDescription>
            Your account has been suspended. Please contact support for assistance.
            {user?.suspensionReason && <div>Reason: {user.suspensionReason}</div>}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Check role permission
  const allowedRoles: UserRole[] = Array.isArray(requireRole) ? requireRole : [requireRole];
  const hasRequiredRole = user?.role ? allowedRoles.includes(user.role as UserRole) : false;

  if (!hasRequiredRole) {
    console.log('Insufficient privileges, user role:', user?.role, 'required:', allowedRoles);
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

  console.log('Admin access granted');
  return <>{children}</>;
};

export default AdminRoute;
