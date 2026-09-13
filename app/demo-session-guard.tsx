'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

const DEMO_LAST_ACTIVITY_KEY = 'ltg_demo_last_activity_at';
const DEMO_INACTIVITY_MS = 30 * 60 * 1000;

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

    const isEntryPage = pathname === '/demo' || pathname === '/demo/programs';
    const storedActivity = Number(sessionStorage.getItem(DEMO_LAST_ACTIVITY_KEY));
    const hasActiveDemoSession = Number.isFinite(storedActivity) && storedActivity > 0;

    // Browsing the public landing/selector does not start a demo session.
    // Once an interactive demo has started, however, the inactivity rule
    // continues across every /demo route until the temporary session expires.
    if (isEntryPage && !hasActiveDemoSession) return;

    let lastActivityAt = hasActiveDemoSession ? storedActivity : Date.now();
    let timeoutId: number | undefined;

    if (!hasActiveDemoSession) {
      sessionStorage.setItem(DEMO_LAST_ACTIVITY_KEY, String(lastActivityAt));
    }

    const expireSession = () => {
      clearDemoStorage();
      window.location.replace('/demo');
    };

    const scheduleExpiration = () => {
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      const remaining = DEMO_INACTIVITY_MS - (Date.now() - lastActivityAt);

      if (remaining <= 0) {
        expireSession();
        return;
      }

      timeoutId = window.setTimeout(expireSession, remaining);
    };

    const registerActivity = () => {
      const now = Date.now();

      // If the browser woke from a suspended/backgrounded state after the
      // inactivity window, expire first instead of allowing the new event to
      // revive stale demo data.
      if (now - lastActivityAt >= DEMO_INACTIVITY_MS) {
        expireSession();
        return;
      }

      lastActivityAt = now;
      sessionStorage.setItem(DEMO_LAST_ACTIVITY_KEY, String(lastActivityAt));
      scheduleExpiration();
    };

    const checkExpiration = () => {
      if (Date.now() - lastActivityAt >= DEMO_INACTIVITY_MS) {
        expireSession();
      } else {
        scheduleExpiration();
      }
    };

    const activityEvents: Array<keyof WindowEventMap> = [
      'pointerdown',
      'keydown',
      'wheel',
      'scroll',
      'touchstart',
    ];

    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, registerActivity, { passive: true });
    });

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') checkExpiration();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    scheduleExpiration();

    return () => {
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, registerActivity);
      });
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [pathname]);

  return null;
}
