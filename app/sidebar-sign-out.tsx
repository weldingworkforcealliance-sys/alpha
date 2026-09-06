'use client';

import { useState } from 'react';
import { guardedSignOut } from '@/lib/guarded-signout';

export default function SidebarSignOut() {
  const [busy, setBusy] = useState(false);

  const signOut = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await guardedSignOut('/login');
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      className="ltg-sidebar-signout"
      onClick={signOut}
      disabled={busy}
    >
      <span className="ltg-sidebar-signout-icon" aria-hidden="true">↪</span>
      {busy ? 'Signing Out…' : 'Sign Out'}
    </button>
  );
}
