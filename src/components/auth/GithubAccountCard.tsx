import React, { useEffect, useState } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { formatDistanceToNow } from 'date-fns';
import { Loader2, Unlink, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useConnectGithub, useDisconnectGithub, useLinkedGithubAccount } from '../../hooks/auth';
import { linkFailureMessage } from '../../services/githubAccountService';
import GithubMark from '../icons/GithubMark';

/**
 * The member's Linked GitHub Account (CONTEXT.md), on the security page.
 *
 * Connecting is only ever *linking*: GitHub cannot sign anybody in here. What
 * it does is let the server read GitHub on this member's behalf — with their
 * own rate limit rather than the server's — for repository cards and, later,
 * profile enrichment. The token stays on the server.
 *
 * Two failure modes are worth showing plainly. A server with no GitHub OAuth
 * app configured (every dev machine, CI, and prod before the app is
 * registered) has no provider at all; and a round trip GitHub refused comes
 * back to this page as `?error=…`. Both become sentences rather than statuses.
 */

function connectedWhen(value: string | Date | undefined): string {
  if (!value) return 'recently';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'recently';
  return `${formatDistanceToNow(date)} ago`;
}

const GithubAccountCard: React.FC = () => {
  const { data: account, isLoading, isError, refetch } = useLinkedGithubAccount();
  const connect = useConnectGithub();
  const disconnect = useDisconnectGithub();
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { error?: string };

  /**
   * One notice, owned by this component from the first render. It is *seeded*
   * from the round trip's `?error=` rather than derived from it, so a later
   * success can clear it for good — a derived value would reappear the moment
   * local state went back to null, and the member would be told the connection
   * failed while looking at a connected account.
   */
  const [notice, setNotice] = useState<string | null>(() => linkFailureMessage(search?.error));

  // The message has been read into state, so drop the parameter: a reload (or a
  // shared link) should not resurrect a failure from ten minutes ago.
  useEffect(() => {
    if (!search?.error) return;
    void navigate({ to: '/security', search: {}, replace: true });
  }, [search?.error, navigate]);

  const handleConnect = (): void => {
    setNotice(null);
    connect.mutate(undefined, {
      onError: (error) => {
        const text = error.message || 'Could not start the GitHub connection';
        setNotice(text);
        toast.error(text);
      },
    });
  };

  const handleDisconnect = (): void => {
    setNotice(null);
    disconnect.mutate(account?.accountId, {
      onSuccess: () => {
        setNotice(null);
        toast.success('GitHub disconnected');
      },
      onError: (error) => {
        const text = error.message || 'Could not disconnect GitHub';
        setNotice(text);
        toast.error(text);
      },
    });
  };

  return (
    <Card data-testid="github-account">
      <CardHeader>
        <CardTitle>GitHub</CardTitle>
        <CardDescription>
          Connect your GitHub account so this app can read public GitHub data on your behalf, and
          so you can sign in with GitHub next time. Your GitHub token never leaves the server.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {notice && (
          <Alert variant="destructive" data-testid="github-account-error">
            <AlertDescription className="flex items-start justify-between gap-3">
              <span>{notice}</span>
              <button
                type="button"
                aria-label="Dismiss"
                data-testid="dismiss-github-error"
                onClick={() => setNotice(null)}
                className="shrink-0 rounded-sm opacity-70 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="size-4" />
              </button>
            </AlertDescription>
          </Alert>
        )}

        {isLoading && <Skeleton className="h-14 w-full" />}

        {!isLoading && isError && (
          <div
            role="alert"
            className="flex items-center justify-between gap-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            <span>Could not load your connected accounts.</span>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Try again
            </Button>
          </div>
        )}

        {!isLoading && !isError && !account && (
          <div className="flex flex-col gap-3 rounded-lg border border-dashed border-border/60 px-4 py-6 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
            <p className="text-sm text-muted-foreground">No GitHub account connected.</p>
            <Button
              data-testid="connect-github"
              onClick={handleConnect}
              disabled={connect.isPending}
            >
              {connect.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <GithubMark className="size-4" />
              )}
              Connect GitHub
            </Button>
          </div>
        )}

        {!isLoading && !isError && account && (
          <div
            data-testid="github-account-row"
            className="flex items-center justify-between gap-4 rounded-lg border border-border/60 px-4 py-3"
          >
            <div className="flex min-w-0 items-center gap-3">
              <GithubMark className="size-5 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="font-medium">GitHub connected</p>
                <p className="text-xs text-muted-foreground">
                  Connected {connectedWhen(account.createdAt)}
                  {account.scopes?.length ? ` · ${account.scopes.join(', ')}` : ''}
                </p>
              </div>
            </div>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Disconnect GitHub"
                  data-testid="disconnect-github"
                  disabled={disconnect.isPending}
                  className="text-destructive hover:text-destructive"
                >
                  {disconnect.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Unlink className="size-4" />
                  )}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Disconnect GitHub?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This app will stop reading GitHub on your behalf, the stored token is deleted,
                    and you will no longer be able to sign in with GitHub. Repositories already
                    linked to your projects stay linked. Your password and passkeys keep working —
                    and if GitHub is your only way in, disconnecting is refused so you are not
                    locked out.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDisconnect}>Disconnect</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default GithubAccountCard;
