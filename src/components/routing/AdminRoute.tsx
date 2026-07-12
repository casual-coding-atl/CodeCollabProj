import React, { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { CircularProgress, Box, Alert } from '@mui/material';
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
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
        <CircularProgress />
      </Box>
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
      <Box p={3}>
        <Alert severity="error">
          Your account has been suspended. Please contact support for assistance.
          {user?.suspensionReason && <div>Reason: {user.suspensionReason}</div>}
        </Alert>
      </Box>
    );
  }

  // Check role permission
  const allowedRoles: UserRole[] = Array.isArray(requireRole) ? requireRole : [requireRole];
  const hasRequiredRole = user?.role ? allowedRoles.includes(user.role as UserRole) : false;

  if (!hasRequiredRole) {
    console.log('Insufficient privileges, user role:', user?.role, 'required:', allowedRoles);
    return (
      <Box p={3}>
        <Alert severity="error">
          Access denied. You don&apos;t have sufficient privileges to view this page.
          <br />
          Required role: {allowedRoles.join(' or ')}
          <br />
          Your role: {user?.role || 'none'}
        </Alert>
      </Box>
    );
  }

  console.log('Admin access granted');
  return <>{children}</>;
};

export default AdminRoute;
