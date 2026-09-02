'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import TeacherIdentityBar from './teacher-identity-bar';
import ReviewQueueLink from './review-queue-link';
import AgendaNotePolicyBanner from './agenda-note-policy-banner';
import CohortWorkspaceBar from './cohort-workspace-bar';
import BetaUiConsistency from './beta-ui-consistency';
import './styles.css';
import './agenda/agenda.css';
import './desktop-layout-fix.css';
import './large-text-fields.css';
import './night-shift-theme.css';

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const hideWorkspaceNav =
    pathname === '/login' ||
    pathname === '/account-setup' ||
    pathname === '/forgot-password' ||
    pathname === '/reset-password';
  const nightShiftPlanner = pathname === '/dashboard' || pathname === '/agenda';

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Living Teacher Planner</title>
      </head>
      <body className={nightShiftPlanner ? 'night-shift-shell' : undefined}>
        <div className="app-container">
          {!hideWorkspaceNav && (
            <nav aria-label="Planner workspace navigation">
              <div className="ltg-brand">
                <span className="ltg-brand-mark">LTG</span>
                <span className="ltg-brand-copy">
                  Living Teacher
                  <br />
                  Planner
                </span>
              </div>
              <div className="ltg-nav-section-label">Workspace</div>
              <Link
                href="/dashboard"
                className={`ltg-nav-link ${pathname === '/dashboard' ? 'active' : ''}`}
              >
                Planner
              </Link>
              <Link
                href="/agenda"
                className={`ltg-nav-link ${pathname === '/agenda' ? 'active' : ''}`}
              >
                Agenda Workspace
              </Link>
              <ReviewQueueLink />
            </nav>
          )}
          <CohortWorkspaceBar pathname={pathname} />
          <TeacherIdentityBar pathname={pathname} />
          <AgendaNotePolicyBanner pathname={pathname} />
          <BetaUiConsistency pathname={pathname} />
          {children}
        </div>
      </body>
    </html>
  );
}
