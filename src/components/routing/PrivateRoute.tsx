import React, { ReactNode } from 'react';
import { Navigate } from '@tanstack/react-router';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../../hooks/auth';
import logger from '../../utils/logger';

interface PrivateRouteProps {
  children: ReactNode;
}

const PrivateRoute: React.FC<PrivateRouteProps> = ({ children }) => {
  const { isAuthenticated, isLoading, user, token } = useAuth();

  // Only log in development
  if (process.env.NODE_ENV === 'development') {
    logger.debug('PrivateRoute Debug (TanStack Query):');
    logger.debug('- isAuthenticated:', isAuthenticated);
    logger.debug('- isLoading:', isLoading);
    logger.debug('- token exists:', !!token);
    logger.debug('- user:', user);
  }

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAuthenticated) {
    if (process.env.NODE_ENV === 'development') {
      logger.debug('Not authenticated, redirecting to login');
    }
    return <Navigate to="/login" replace />;
  }

  if (process.env.NODE_ENV === 'development') {
    logger.debug('Authenticated, showing protected content');
  }
  return <>{children}</>;
};

export default PrivateRoute;
