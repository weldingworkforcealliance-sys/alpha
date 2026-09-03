'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import TeacherIdentityBar from './teacher-identity-bar';
import ReviewQueueLink from './review-queue-link';
import PayrollNavLink from './payroll-nav-link';
import AgendaNotePolicyBanner from './agenda-note-policy-banner';
import CohortWorkspaceBar from './cohort-workspace-bar';
import BetaUiConsistency from './beta-ui-consistency';
import ClockAwareLogoutGuard from './clock-aware-logout-guard';
import './styles.css';
import './agenda/agenda.css';
import './desktop-layout-fix.css';
import './large-text-fields.css';
import './night-shift-theme.css';
import './night-shift-global.css';
import './coaching-positive-theme.css';
import './readability-font-scale.css';
import './guide-navigation-readability.css';

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const isStudentJoin = pathname.startsWith('/join/');
  const isTrainingRoute = pathname.startsWith('/training');
  const isAccountRoute = pathname.startsWith('/accounts');
  const isAuthRoute =
    pathname === '/login' ||
    pathname === '/account-setup' ||
    pathname === '/forgot-password' ||
    pathname === '/reset-password' ||
    pathname === '/training/login';
  const isPrimaryPlannerRoute = pathname === '/dashboard' || pathname === '/agenda';

  const hideWorkspaceNav = isAuthRoute || isStudentJoin;
  const useNightShift = !isStudentJoin;
  const isSecondaryRoute =
    useNightShift && !isAuthRoute && !isTrainingRoute && !isPrimaryPlannerRoute;

  const bodyClassName = [
    useNightShift ? 'night-shift-shell' : '',
    isAuthRoute ? 'ltg-auth-route' : '',
    isTrainingRoute ? 'ltg-training-route' : '',
    isSecondaryRoute ? 'ltg-secondary-route' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Living Teacher Planner</title>
      </head>
      <body className={bodyClassName || undefined}>
        <ClockAwareLogoutGuard />
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
              <Link
                href="/time-clock"
                className={`ltg-nav-link ${pathname === '/time-clock' ? 'active' : ''}`}
              >
                Employee Time Clock
              </Link>
              <PayrollNavLink />
              <ReviewQueueLink />
              {isAccountRoute && (
                <>
                  <div className="ltg-nav-section-label">Account Tools</div>
                  <Link
                    href="/accounts"
                    className={`ltg-nav-link ${pathname === '/accounts' ? 'active' : ''}`}
                  >
                    Account Management
                  </Link>
                  <Link
                    href="/accounts/diagnostics"
                    className={`ltg-nav-link ${pathname === '/accounts/diagnostics' ? 'active' : ''}`}
                  >
                    Invitation Diagnostics
                  </Link>
                </>
              )}
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
