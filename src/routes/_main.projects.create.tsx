import React, { useEffect, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import PrivateRoute from '../components/routing/PrivateRoute';
import ProjectForm from '../components/projects/ProjectForm';
import MeetupVerifyCard from '../components/prototype/MeetupVerifyCard';

/**
 * PROTOTYPE(meetup-gate): unverified members see the membership prompt where
 * the form would be; verifying swaps the form in without leaving the page.
 * Revert to the plain <ProjectForm /> wrapper to remove.
 */
const CreateProjectGate: React.FC = () => {
  const [canCreate, setCanCreate] = useState<boolean | null>(null);

  useEffect(() => {
    void fetch('/api/prototype/meetup', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : { canCreate: true }))
      .then((status: { canCreate: boolean }) => setCanCreate(status.canCreate));
  }, []);

  if (canCreate === null) return null;
  if (!canCreate) {
    return (
      <div className="px-4 py-12">
        <MeetupVerifyCard onVerified={() => setCanCreate(true)} />
      </div>
    );
  }
  return <ProjectForm />;
};

export const Route = createFileRoute('/_main/projects/create')({
  component: () => (
    <PrivateRoute>
      <CreateProjectGate />
    </PrivateRoute>
  ),
});
