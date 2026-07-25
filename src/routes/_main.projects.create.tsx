import React, { useCallback, useEffect, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { BadgeCheck, RefreshCw } from 'lucide-react';
import PrivateRoute from '../components/routing/PrivateRoute';
import ProjectForm from '../components/projects/ProjectForm';
import MeetupVerifyCard from '../components/prototype/MeetupVerifyCard';
import { Button } from '@/components/ui/button';

/**
 * PROTOTYPE(meetup-gate): unverified members see the membership prompt where
 * the form would be; verifying swaps the form in with a confirmation strip.
 * Fails CLOSED — if the status check errors, the card (with its retry) shows
 * rather than the form, matching the server, which refuses regardless.
 * Revert to the plain <ProjectForm /> wrapper to remove.
 */
const CreateProjectGate: React.FC = () => {
  const [gate, setGate] = useState<'checking' | 'locked' | 'open' | 'just-verified'>('checking');

  const check = useCallback(async () => {
    try {
      const res = await fetch('/api/prototype/meetup', { credentials: 'include' });
      if (!res.ok) throw new Error(String(res.status));
      const status = (await res.json()) as { canCreate: boolean };
      setGate(status.canCreate ? 'open' : 'locked');
    } catch {
      setGate('locked');
    }
  }, []);

  useEffect(() => {
    void check();
  }, [check]);

  if (gate === 'checking') return null;

  if (gate === 'locked') {
    return (
      <div className="px-4 py-12">
        <MeetupVerifyCard onVerified={() => setGate('just-verified')} />
      </div>
    );
  }

  return (
    <>
      {gate === 'just-verified' && (
        <div className="mx-auto mt-6 max-w-3xl px-4">
          <div
            role="status"
            className="flex items-center gap-3 rounded-md border border-primary/30 bg-primary/10 px-3 py-2.5 text-sm text-primary"
          >
            <BadgeCheck className="size-4 shrink-0" />
            <span className="flex-1">Membership verified — you can now create projects.</span>
            <Button
              onClick={() => setGate('open')}
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-primary"
            >
              Dismiss
            </Button>
          </div>
        </div>
      )}
      <ProjectForm />
    </>
  );
};

export const Route = createFileRoute('/_main/projects/create')({
  component: () => (
    <PrivateRoute>
      <CreateProjectGate />
    </PrivateRoute>
  ),
});
