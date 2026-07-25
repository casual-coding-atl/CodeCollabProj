import React from 'react';
import ChangePassword from '../components/auth/ChangePassword';
import PasskeyManager from '../components/auth/PasskeyManager';
import SessionManager from '../components/auth/SessionManager';

/**
 * Security settings: how the member signs in (password, passkeys) and where
 * they're signed in (sessions). Everything on this page talks to Better Auth.
 */
const Security: React.FC = () => (
  <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
    <div>
      <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
        account
      </p>
      <h1 className="text-2xl font-semibold">Security</h1>
    </div>

    <PasskeyManager />
    <SessionManager />
    <ChangePassword />
  </div>
);

export default Security;
