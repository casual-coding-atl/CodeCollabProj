import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Laptop, Loader2, LogOut, Smartphone } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useSessions } from '../../hooks/auth/useSessions';
import { describeUserAgent } from '@/lib/userAgent';
import type { AuthSession } from '@/lib/auth-client';

/**
 * Active sessions, from Better Auth's `list-sessions`.
 *
 * A member can end any one of them, or every one but this browser. The session
 * they're currently using is labelled and has no revoke button — signing
 * yourself out from a list of devices is the "Log out" menu item, not this.
 */

function DeviceIcon({ platform }: { platform: string }): React.ReactElement {
  const handheld = platform === 'iPhone' || platform === 'iPad' || platform === 'Android';
  const Icon = handheld ? Smartphone : Laptop;
  return <Icon className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />;
}

function when(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'unknown';
  return `${formatDistanceToNow(date)} ago`;
}

const SessionManager: React.FC = () => {
  const {
    sessions,
    sessionCount,
    isLoading,
    isCurrentSessionKnown,
    error,
    refetch,
    revokeSession,
    revokeOtherSessions,
    isCurrentSession,
  } = useSessions();

  // Until we know which row is this browser, every row looks like someone
  // else's — offering revocation then would let a member sign themselves out
  // from a list that had not yet worked out where they were sitting.
  const otherCount = isCurrentSessionKnown
    ? sessions.filter((s) => !isCurrentSession(s)).length
    : 0;

  return (
    <Card data-testid="session-manager">
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle>Active sessions</CardTitle>
          <CardDescription>
            Every browser and device currently signed in to your account.
          </CardDescription>
        </div>
        {otherCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            data-testid="revoke-other-sessions"
            disabled={revokeOtherSessions.isPending}
            onClick={() => revokeOtherSessions.mutate()}
          >
            {revokeOtherSessions.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <LogOut className="size-4" />
            )}
            Sign out other devices
          </Button>
        )}
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Held back until BOTH answers are in: the list, and which row is this
            browser. Rendering on the list alone flashes rows that all look
            revocable, including the member's own. */}
        {(isLoading || !isCurrentSessionKnown) && !error && (
          <>
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </>
        )}

        {!isLoading && error && (
          <div
            role="alert"
            className="flex items-center justify-between gap-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            <span>Could not load your sessions.</span>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Try again
            </Button>
          </div>
        )}

        {!isLoading && isCurrentSessionKnown && !error && sessionCount === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No active sessions to show.
          </p>
        )}

        {!isLoading &&
          isCurrentSessionKnown &&
          !error &&
          sessions.map((session: AuthSession) => {
            const device = describeUserAgent(session.userAgent);
            const current = isCurrentSession(session);
            return (
              <div
                key={session.id}
                data-testid="session-row"
                className="flex items-start justify-between gap-4 rounded-lg border border-border/60 px-4 py-3"
              >
                <div className="flex items-start gap-3">
                  <DeviceIcon platform={device.platform} />
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{device.label}</p>
                      {current && (
                        <Badge variant="secondary" data-testid="current-session">
                          This device
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Signed in {when(session.createdAt)} · expires {when(session.expiresAt)}
                    </p>
                    {session.ipAddress && (
                      <p className="font-mono text-xs text-muted-foreground">{session.ipAddress}</p>
                    )}
                  </div>
                </div>

                {!current && (
                  <Button
                    variant="ghost"
                    size="sm"
                    data-testid="revoke-session"
                    className="text-destructive hover:text-destructive"
                    disabled={revokeSession.isPending}
                    onClick={() => revokeSession.mutate(session.token)}
                  >
                    {revokeSession.isPending && revokeSession.variables === session.token ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : null}
                    Revoke
                  </Button>
                )}
              </div>
            );
          })}
      </CardContent>
    </Card>
  );
};

export default SessionManager;
