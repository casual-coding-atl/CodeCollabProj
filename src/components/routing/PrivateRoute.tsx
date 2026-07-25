import React, { ReactNode } from 'react';
import { Navigate } from '@tanstack/react-router';
import { Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useAuth } from '../../hooks/auth';
import logger from '../../utils/logger';

interface PrivateRouteProps {
  children: ReactNode;
}

const PrivateRoute: React.FC<PrivateRouteProps> = ({ children }) => {
  const { isAuthenticated, isLoading, isError, user, refetch } = useAuth();

  // Only log in development
  if (process.env.NODE_ENV === 'development') {
    logger.debug('PrivateRoute Debug (TanStack Query):');
    logger.debug('- isAuthenticated:', isAuthenticated);
    logger.debug('- isLoading:', isLoading);
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

  // The session check failed rather than answering. That is not the same as
  // being signed out, and sending a member to the login screen over a blip
  // would make them re-authenticate for no reason. Say so, and offer a retry.
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
