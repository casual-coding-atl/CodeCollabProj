import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BadgeCheck, ExternalLink, RefreshCw, Users } from 'lucide-react';

/**
 * PROTOTYPE(meetup-gate) — throwaway. The "verify your Casual Coding
 * membership" prompt an unverified member sees on /projects/create.
 *
 * The staged "roster check" is deliberate UX, not decoration: the real flow
 * is an OAuth redirect to meetup.com and back, so verification will never be
 * instant. Rehearsing that wait here keeps the prototype honest. The real
 * build replaces the identity rows with one "Continue with Meetup" button.
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

type Phase =
  | { name: 'loading' }
  | { name: 'unreachable' }
  | { name: 'idle' }
  | { name: 'checking'; label: string; step: number }
  | { name: 'refused'; reason: string }
  | { name: 'verified'; label: string };

const CHECK_STEPS = ['connecting to meetup.com', 'checking the Casual Coding roster'];
const STEP_MS = 550;

/** Split "name — detail" identity labels into their two lines. */
function splitLabel(label: string): { name: string; detail: string } {
  const [name, ...rest] = label.split(' — ');
  return { name, detail: rest.join(' — ') };
}

const MeetupVerifyCard: React.FC<{ onVerified?: () => void }> = ({ onVerified }) => {
  const [status, setStatus] = useState<Status | null>(null);
  const [phase, setPhase] = useState<Phase>({ name: 'loading' });
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const later = (fn: () => void, ms: number): void => {
    timers.current.push(setTimeout(fn, ms));
  };
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const load = useCallback(async () => {
    setPhase({ name: 'loading' });
    try {
      const res = await fetch('/api/prototype/meetup', { credentials: 'include' });
      if (!res.ok) throw new Error(String(res.status));
      const body = (await res.json()) as Status;
      setStatus(body);
      setPhase(
        body.canCreate
          ? { name: 'verified', label: body.grant?.label ?? 'existing member' }
          : { name: 'idle' }
      );
    } catch {
      setPhase({ name: 'unreachable' });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const link = (account: FakeAccount): void => {
    const reduceMotion =
      !import.meta.env.SSR && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const stepMs = reduceMotion ? 0 : STEP_MS;

    setPhase({ name: 'checking', label: account.label, step: 0 });
    later(() => setPhase({ name: 'checking', label: account.label, step: 1 }), stepMs);

    later(() => {
      void (async () => {
        const res = await fetch('/api/prototype/meetup/link', {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ meetupId: account.meetupId }),
        });
        const body = (await res.json()) as { ok: boolean; reason?: string };
        if (body.ok) {
          setPhase({ name: 'verified', label: account.label });
          // Let the ✓ land before the parent swaps the form in.
          later(() => onVerified?.(), reduceMotion ? 0 : 900);
        } else {
          setPhase({ name: 'refused', reason: body.reason ?? 'Verification failed.' });
        }
      })();
    }, stepMs * 2);
  };

  const reset = async (): Promise<void> => {
    await fetch('/api/prototype/meetup', { method: 'DELETE', credentials: 'include' });
    await load();
  };

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader className="text-center">
        <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
          members only · prototype
        </p>
        <CardTitle className="text-2xl">Casual Coding membership</CardTitle>
      </CardHeader>
      <CardContent>
        {phase.name === 'loading' && (
          <p className="py-6 text-center text-sm text-muted-foreground">Checking your status…</p>
        )}

        {phase.name === 'unreachable' && (
          <>
            <div
              role="alert"
              className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-3 text-sm text-destructive"
            >
              Couldn&apos;t check your membership status. Project creation stays locked until the
              check succeeds.
            </div>
            <Button onClick={() => void load()} variant="outline" className="w-full">
              <RefreshCw className="size-4" /> Try again
            </Button>
          </>
        )}

        {phase.name === 'idle' && status && (
          <>
            <div className="mb-4 flex items-start gap-3 rounded-md border border-brand-amber/30 bg-brand-amber/10 px-3 py-3 text-sm text-brand-amber">
              <Users className="mt-0.5 size-4 shrink-0" />
              <span>
                Project creation is for members of the Casual Coding meetup group. Connect your
                Meetup account once to verify — it takes a few seconds.
              </span>
            </div>

            <p className="mb-2 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
              prototype: pick an identity instead of meetup oauth
            </p>
            <div className="space-y-2" role="group" aria-label="Choose a Meetup account">
              {status.accounts.map((account) => {
                const { name, detail } = splitLabel(account.label);
                return (
                  <button
                    key={account.meetupId}
                    onClick={() => link(account)}
                    className="flex w-full items-center gap-3 rounded-md border border-input bg-background px-3 py-2.5 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    <span
                      aria-hidden
                      className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-amber/15 font-mono text-sm font-semibold text-brand-amber"
                    >
                      {name.slice(0, 2)}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{name}</span>
                      <span className="block truncate text-xs text-muted-foreground">{detail}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {phase.name === 'checking' && (
          <div
            role="status"
            aria-live="polite"
            className="rounded-md border border-input bg-muted/40 px-4 py-4 font-mono text-[13px] leading-7"
          >
            {CHECK_STEPS.slice(0, phase.step + 1).map((line, i) => (
              <p key={line} className={i === phase.step ? 'text-foreground' : 'text-muted-foreground'}>
                <span className="text-brand-amber">→</span> {line}
                {i === phase.step ? '…' : ' ✓'}
              </p>
            ))}
          </div>
        )}

        {phase.name === 'refused' && (
          <>
            <div
              role="alert"
              className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-3 text-sm text-destructive"
            >
              {phase.reason}
            </div>
            <div className="flex flex-col gap-2">
              <Button asChild className="w-full">
                <a href="https://www.meetup.com/casual-coding/" target="_blank" rel="noreferrer">
                  <ExternalLink className="size-4" /> Open Casual Coding on Meetup
                </a>
              </Button>
              <Button onClick={() => setPhase({ name: 'idle' })} variant="outline" className="w-full">
                Try another account
              </Button>
            </div>
          </>
        )}

        {phase.name === 'verified' && (
          <>
            <div
              role="status"
              className="flex items-start gap-3 rounded-md border border-primary/30 bg-primary/10 px-3 py-3 text-sm text-primary"
            >
              <BadgeCheck className="mt-0.5 size-4 shrink-0" />
              <span>
                {status?.grant || phase.label !== 'existing member'
                  ? `Membership verified as ${splitLabel(phase.label).name}. You can create projects.`
                  : 'Your account already has project creation (grandfathered member).'}
              </span>
            </div>
            {status?.grant && (
              <Button onClick={() => void reset()} variant="ghost" className="mt-4 w-full">
                Prototype: reset my verification
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default MeetupVerifyCard;
