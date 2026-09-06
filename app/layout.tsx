'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import TeacherIdentityBar from './teacher-identity-bar';
import ReviewQueueLink from './review-queue-link';
import PayrollNavLink from './payroll-nav-link';
import PlannerUtilityNavLinks from './planner-utility-nav-links';
import AgendaNotePolicyBanner from './agenda-note-policy-banner';
import CohortWorkspaceBar from './cohort-workspace-bar';
import ThemeProvider from './theme-provider';
import ThemeToggle from './theme-toggle';
import SidebarSignOut from './sidebar-sign-out';
import DashboardHero from './dashboard-hero';
import DashboardPunchClock from './dashboard-punch-clock';
import PlannerAttendancePanel from './planner-attendance-panel';
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
import './launch-theme.css';
import './theme-consistency.css';
import './theme-component-overrides.css';
import './interaction-feedback.css';

const THEME_BOOTSTRAP = `(function(){try{var t=localStorage.getItem('ltg_theme');if(t!=='light'&&t!=='dark')t='dark';document.documentElement.dataset.theme=t;document.documentElement.style.colorScheme=t;}catch(e){document.documentElement.dataset.theme='dark';document.documentElement.style.colorScheme='dark';}})();`;

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [navOpen, setNavOpen] = useState(false);
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

  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  const bodyClassName = [
    useNightShift ? 'night-shift-shell' : '',
    isAuthRoute ? 'ltg-auth-route' : '',
    isTrainingRoute ? 'ltg-training-route' : '',
    isSecondaryRoute ? 'ltg-secondary-route' : '',
    isStudentDisplay ? 'ltg-student-display-route' : '',
    pathname === '/dashboard' ? 'ltg-dashboard-route' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>LTG | Welding Education Operating System</title>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body className={bodyClassName || undefined}>
        <ThemeProvider>
          <div className="app-container">
            {!hideWorkspaceNav && (
              <nav
                aria-label="Planner workspace navigation"
                className={navOpen ? 'ltg-sidebar mobile-open' : 'ltg-sidebar'}
              >
                <div className="ltg-sidebar-header">
                  <div className="ltg-brand">
                    <span className="ltg-brand-mark">LTG</span>
                    <span className="ltg-brand-copy">
                      Welding Education
                      <br />
                      Operating System
                    </span>
                  </div>
                  <button
                    type="button"
                    className="ltg-mobile-menu-button"
                    aria-expanded={navOpen}
                    aria-controls="ltg-sidebar-menu"
                    onClick={() => setNavOpen((open) => !open)}
                  >
                    <span aria-hidden="true">☰</span>
                    Menu
                  </button>
                </div>

                <div id="ltg-sidebar-menu" className="ltg-sidebar-menu">
                  <div className="ltg-nav-section-label">Teaching</div>
                  <Link
                    href="/dashboard"
                    className={`ltg-nav-link ${
                      pathname === '/dashboard' || pathname === '/planner' ? 'active' : ''
                    }`}
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
                    href="/classroom"
                    className={`ltg-nav-link ${pathname.startsWith('/classroom') ? 'active' : ''}`}
                  >
                    Live Classroom
                  </Link>

                  <div className="ltg-nav-section-label">Classroom Tools</div>
                  <Link
                    href="/attendance"
                    className={`ltg-nav-link ${isAttendanceRoute ? 'active' : ''}`}
                  >
                    Student Attendance
                  </Link>
                  <ReviewQueueLink />
                  <Link
                    href="/time-clock"
                    className={`ltg-nav-link ${
                      pathname === '/time-clock' ? 'active' : ''
                    }`}
                  >
                    Employee Time Clock
                  </Link>

                  <div className="ltg-nav-section-label">Reports</div>
                  <PayrollNavLink />

                  <div className="ltg-nav-section-label">Admin</div>
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
                        className={`ltg-nav-link ${
                          pathname === '/accounts/diagnostics' ? 'active' : ''
                        }`}
                      >
                        Invitation Diagnostics
                      </Link>
                    </>
                  )}

                  <div className="ltg-sidebar-footer">
                    <ThemeToggle />
                    <SidebarSignOut />
                  </div>
                </div>
              </nav>
            )}

            <div className={hideWorkspaceNav ? 'ltg-public-content' : 'ltg-main-content'}>
              {pathname === '/dashboard' && <DashboardHero />}
              <DashboardPunchClock pathname={pathname} />
              {!isStudentDisplay && <CohortWorkspaceBar pathname={pathname} />}
              {!isStudentDisplay && <TeacherIdentityBar pathname={pathname} />}
              <PlannerAttendancePanel pathname={pathname} />
              {!isStudentDisplay && <AgendaNotePolicyBanner pathname={pathname} />}
              {children}
            </div>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
