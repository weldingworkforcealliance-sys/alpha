'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import TeacherIdentityBar from './teacher-identity-bar';
import ReviewQueueLink from './review-queue-link';
import PayrollNavLink from './payroll-nav-link';
import PlannerUtilityNavLinks from './planner-utility-nav-links';
import AgendaNotePolicyBanner from './agenda-note-policy-banner';
import CohortWorkspaceBar from './cohort-workspace-bar';
import './styles.css';
import './agenda/agenda.css';
import './desktop-layout-fix.css';
import './large-text-fields.css';
import './night-shift-theme.css';
import './night-shift-global.css';
import './coaching-positive-theme.css';
import './readability-font-scale.css';
import './guide-navigation-readability.css';
import './resource-focus-highlight.css';
import './brand-os.css';

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const isStudentJoin = pathname.startsWith('/join/');
  const isStudentDisplay = pathname.startsWith('/student-display/');
  const isTrainingRoute = pathname.startsWith('/training');
  const isAccountRoute = pathname.startsWith('/accounts');
  const isAttendanceRoute = pathname.startsWith('/attendance');
  const isResourcesRoute = pathname.startsWith('/resources');
  const isAuthRoute =
    pathname === '/login' ||
    pathname === '/account-setup' ||
    pathname === '/forgot-password' ||
    pathname === '/reset-password' ||
    pathname === '/training/login';
  const isPrimaryPlannerRoute =
    pathname === '/planner' || pathname === '/dashboard' || pathname === '/agenda';

  const hideWorkspaceNav = isAuthRoute || isStudentJoin || isStudentDisplay;
  const useNightShift = !isStudentJoin;
  const isSecondaryRoute =
    useNightShift &&
    !isAuthRoute &&
    !isTrainingRoute &&
    !isPrimaryPlannerRoute &&
    !isStudentDisplay;

  const bodyClassName = [
    useNightShift ? 'night-shift-shell' : '',
    isAuthRoute ? 'ltg-auth-route' : '',
    isTrainingRoute ? 'ltg-training-route' : '',
    isSecondaryRoute ? 'ltg-secondary-route' : '',
    isStudentDisplay ? 'ltg-student-display-route' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>LTG | Welding Education Operating System</title>
      </head>
      <body className={bodyClassName || undefined}>
        <div className="app-container">
          {!hideWorkspaceNav && (
            <nav aria-label="Planner workspace navigation">
              <div className="ltg-brand">
                <span className="ltg-brand-mark">LTG</span>
                <span className="ltg-brand-copy">
                  Welding Education
                  <br />
                  Operating System
                </span>
              </div>
              <div className="ltg-nav-section-label">Workspace</div>
              <Link
                href="/planner"
                className={`ltg-nav-link ${pathname === '/planner' ? 'active' : ''}`}
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
                href="/resources"
                className={`ltg-nav-link ${isResourcesRoute ? 'active' : ''}`}
              >
                Content &amp; Resources
              </Link>
              <Link
                href="/attendance"
                className={`ltg-nav-link ${isAttendanceRoute ? 'active' : ''}`}
              >
                Student Attendance
              </Link>
              <Link
                href="/time-clock"
                className={`ltg-nav-link ${pathname === '/time-clock' ? 'active' : ''}`}
              >
                Employee Time Clock
              </Link>
              <PayrollNavLink />
              <ReviewQueueLink />
              <PlannerUtilityNavLinks />
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
          {!isStudentDisplay && <CohortWorkspaceBar pathname={pathname} />}
          {!isStudentDisplay && <TeacherIdentityBar pathname={pathname} />}
          {!isStudentDisplay && <AgendaNotePolicyBanner pathname={pathname} />}
          {children}
        </div>
      </body>
    </html>
  );
}
