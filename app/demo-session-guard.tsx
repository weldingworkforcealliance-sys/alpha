'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

const DEMO_SESSION_KEY = 'ltg_demo_started_at';
const DEMO_SESSION_MS = 30 * 60 * 1000;

function clearDemoStorage() {
  for (let index = sessionStorage.length - 1; index >= 0; index -= 1) {
    const key = sessionStorage.key(index);
    if (key?.startsWith('ltg_demo_')) sessionStorage.removeItem(key);
  }

  for (let index = localStorage.length - 1; index >= 0; index -= 1) {
    const key = localStorage.key(index);
    if (key?.startsWith('ltg_demo_')) localStorage.removeItem(key);
  }
}

export default function DemoSessionGuard() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname.startsWith('/demo')) return;

    // The entry pages do not consume demo time. The 30-minute session starts
    // only after a visitor opens an interactive program demonstration.
    if (pathname === '/demo' || pathname === '/demo/programs') return;

    const storedStart = Number(sessionStorage.getItem(DEMO_SESSION_KEY));
    const startedAt = Number.isFinite(storedStart) && storedStart > 0 ? storedStart : Date.now();

    if (!storedStart) {
      sessionStorage.setItem(DEMO_SESSION_KEY, String(startedAt));
    }

    const expireSession = () => {
      clearDemoStorage();
      window.location.replace('/demo');
    };

    const remaining = DEMO_SESSION_MS - (Date.now() - startedAt);
    if (remaining <= 0) {
      expireSession();
      return;
    }

    const timeoutId = window.setTimeout(expireSession, remaining);
    return () => window.clearTimeout(timeoutId);
  }, [pathname]);

  return null;
}
