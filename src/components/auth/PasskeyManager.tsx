import React, { useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { KeyRound, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { toast } from 'sonner';
import { useAddPasskey, useDeletePasskey, usePasskeys } from '../../hooks/auth';
import { isPasskeyCancellation, supportsPasskeys, type Passkey } from '@/lib/auth-client';

/**
 * Passkey registration and management.
 *
 * "Add a passkey" hands off to the browser's WebAuthn prompt (Touch ID, Windows
 * Hello, a security key, a phone). The private key never leaves the
 * authenticator; all we store is the public credential, which is why a passkey
 * is a safer backup sign-in than a second password.
 */

function registeredWhen(value: Date | string | undefined): string {
  if (!value) return 'recently';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'recently';
  return `${formatDistanceToNow(date)} ago`;
}

const PasskeyManager: React.FC = () => {
  const { data: passkeys, isLoading, isError, refetch } = usePasskeys();
  const addPasskey = useAddPasskey();
  const deletePasskey = useDeletePasskey();
  const [name, setName] = useState('');

  // Whether this browser does WebAuthn at all, decided after mount: the server
  // can't know, and branching on it during render would hydrate into different
  // markup than was sent.
  const [canAddPasskeys, setCanAddPasskeys] = useState(false);
  useEffect(() => setCanAddPasskeys(supportsPasskeys()), []);

  const handleAdd = (): void => {
    const startedAt = Date.now();
    addPasskey.mutate(name.trim() || undefined, {
      onSuccess: () => {
        setName('');
        toast.success('Passkey added');
      },
      onError: (error) => {
        // Browsers fold most real WebAuthn failures (no screen lock, keychain
        // disabled, policy) into the same NotAllowedError a user's Escape
        // produces. A human dismissal can't happen instantly — the sheet has
        // to render first — so only a rejection that took a while is treated
        // as a decision and stays quiet.
        const dismissed = isPasskeyCancellation(error) && Date.now() - startedAt >= 1500;
        if (dismissed) return;
        toast.error(
          isPasskeyCancellation(error)
            ? 'Your browser couldn’t create a passkey. Check that a screen lock, Touch ID or iCloud Keychain is set up, then try again.'
            : error.message || 'Could not add a passkey'
        );
      },
    });
  };

  const handleDelete = (passkey: Passkey): void => {
    deletePasskey.mutate(passkey.id, {
      onSuccess: () => toast.success('Passkey removed'),
      onError: (error) => toast.error(error.message || 'Could not remove that passkey'),
    });
  };

  return (
    <Card data-testid="passkey-manager">
      <CardHeader>
        <CardTitle>Passkeys</CardTitle>
        <CardDescription>
          Sign in with Touch ID, Windows Hello, your phone or a security key instead of typing your
          password. Your password keeps working.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {canAddPasskeys ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="passkey-name">Name (optional)</Label>
              <Input
                id="passkey-name"
                data-testid="passkey-name"
                placeholder="Work laptop"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <Button data-testid="add-passkey" onClick={handleAdd} disabled={addPasskey.isPending}>
              {addPasskey.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <KeyRound className="size-4" />
              )}
              Add a passkey
            </Button>
          </div>
        ) : (
          // No point offering a button that can only fail. Any passkeys already
          // registered still list below, so they can be removed from here too.
          <p className="rounded-md border border-border/60 bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
            This browser doesn&apos;t support passkeys, so you can&apos;t add one here.
          </p>
        )}

        {isLoading && <Skeleton className="h-14 w-full" />}

        {!isLoading && isError && (
          <div
            role="alert"
            className="flex items-center justify-between gap-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            <span>Could not load your passkeys.</span>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Try again
            </Button>
          </div>
        )}

        {!isLoading && !isError && (passkeys?.length ?? 0) === 0 && (
          <p className="rounded-lg border border-dashed border-border/60 px-4 py-6 text-center text-sm text-muted-foreground">
            No passkeys registered yet.
          </p>
        )}

        <div className="space-y-2">
          {passkeys?.map((passkey) => (
            <div
              key={passkey.id}
              data-testid="passkey-row"
              className="flex items-center justify-between gap-4 rounded-lg border border-border/60 px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <KeyRound className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                <div>
                  <p className="font-medium">{passkey.name || 'Unnamed passkey'}</p>
                  <p className="text-xs text-muted-foreground">
                    Added {registeredWhen(passkey.createdAt)}
                    {passkey.deviceType ? ` · ${passkey.deviceType}` : ''}
                  </p>
                </div>
              </div>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Remove passkey ${passkey.name || 'Unnamed passkey'}`}
                    data-testid="delete-passkey"
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remove passkey?</AlertDialogTitle>
                    <AlertDialogDescription>
                      You will no longer be able to sign in with{' '}
                      <strong>{passkey.name || 'this passkey'}</strong>. Your password and any other
                      passkeys keep working.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleDelete(passkey)}>
                      Remove
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default PasskeyManager;
