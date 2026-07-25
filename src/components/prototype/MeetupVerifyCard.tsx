import React, { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BadgeCheck, Users, XCircle } from 'lucide-react';

/**
 * PROTOTYPE(meetup-gate) — throwaway. The "verify your Casual Coding
 * membership" prompt an unverified member sees on /projects/create. The real
 * build replaces the identity picker with a "Sign in with Meetup" OAuth
 * button; everything else on this card is the intended UX.
 */

interface FakeAccount {
  meetupId: string;
  label: string;
  inGroup: boolean;
}

interface Status {
  canCreate: boolean;
  grandfathered: boolean;
  grant: { meetupId: string; label: string; verifiedAt: string } | null;
  accounts: FakeAccount[];
}

const MeetupVerifyCard: React.FC<{ onVerified?: () => void }> = ({ onVerified }) => {
  const [status, setStatus] = useState<Status | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch('/api/prototype/meetup', { credentials: 'include' });
    if (res.ok) setStatus((await res.json()) as Status);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const link = async (meetupId: string): Promise<void> => {
    setBusy(true);
    setRefusal(null);
    const res = await fetch('/api/prototype/meetup/link', {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ meetupId }),
    });
    const body = (await res.json()) as { ok: boolean; reason?: string };
    if (body.ok) {
      await load();
      onVerified?.();
    } else {
      setRefusal(body.reason ?? 'Verification failed.');
    }
    setBusy(false);
  };

  const reset = async (): Promise<void> => {
    await fetch('/api/prototype/meetup', { method: 'DELETE', credentials: 'include' });
    setRefusal(null);
    await load();
  };

  if (!status) return null;

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader className="text-center">
        <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
          members only · prototype
        </p>
        <CardTitle className="text-2xl">Casual Coding membership</CardTitle>
      </CardHeader>
      <CardContent>
        {status.canCreate ? (
          <div
            role="status"
            className="flex items-start gap-3 rounded-md border border-primary/30 bg-primary/10 px-3 py-3 text-sm text-primary"
          >
            <BadgeCheck className="mt-0.5 size-4 shrink-0" />
            <span>
              {status.grant
                ? `Verified via Meetup as ${status.grant.label}. You can create projects.`
                : 'Your account already has project creation (grandfathered member).'}
            </span>
          </div>
        ) : (
          <>
            <div className="mb-4 flex items-start gap-3 rounded-md border border-brand-amber/30 bg-brand-amber/10 px-3 py-3 text-sm text-brand-amber">
              <Users className="mt-0.5 size-4 shrink-0" />
              <span>
                Project creation is for members of the{' '}
                <a
                  href="https://www.meetup.com/casual-coding/"
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium underline underline-offset-4"
                >
                  Casual Coding meetup group
                </a>
                . Verify your membership by connecting your Meetup account.
              </span>
            </div>

            {refusal && (
              <div
                role="alert"
                className="mb-4 flex items-start gap-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-3 text-sm text-destructive"
              >
                <XCircle className="mt-0.5 size-4 shrink-0" />
                <span>{refusal}</span>
              </div>
            )}

            <p className="mb-2 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
              prototype: pick an identity instead of Meetup OAuth
            </p>
            <div className="space-y-2">
              {status.accounts.map((account) => (
                <Button
                  key={account.meetupId}
                  onClick={() => void link(account.meetupId)}
                  disabled={busy}
                  variant="outline"
                  className="w-full justify-start"
                >
                  {account.label}
                </Button>
              ))}
            </div>
          </>
        )}

        {status.grant && (
          <Button onClick={() => void reset()} variant="ghost" className="mt-4 w-full">
            Prototype: reset my verification
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export default MeetupVerifyCard;
