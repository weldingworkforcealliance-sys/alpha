'use client';

import { useEffect } from 'react';
import { RECOVERY_REQUEST_KEY, recoveryCallbackPath } from '@/lib/password-recovery';

export default function PasswordRecoveryRedirect({ pathname }: { pathname: string }) {
  useEffect(() => {
    if (pathname !== '/login' && pathname !== '/') return;
    let requestedAt: string | null = null;
    try { requestedAt = window.localStorage.getItem(RECOVERY_REQUEST_KEY); } catch { /* Storage may be disabled. */ }
    const target = recoveryCallbackPath(window.location.search, window.location.hash, requestedAt);
    if (target) window.location.replace(target);
  }, [pathname]);
  return null;
}
