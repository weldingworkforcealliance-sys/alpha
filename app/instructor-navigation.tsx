'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import ReviewQueueLink from './review-queue-link';
import PayrollNavLink from './payroll-nav-link';
import PlannerUtilityNavLinks from './planner-utility-nav-links';
import { readSelectedSectionId, subscribeSelectedSection } from '@/lib/section-selection';

type Props = { pathname: string; onNavigate: () => void };

export default function InstructorNavigation(props: Props) {
  return <Suspense fallback={<div className="ltg-nav-section-label">Loading menu…</div>}>
    <InstructorNavigationContent {...props} />
  </Suspense>;
}

function InstructorNavigationContent({ pathname, onNavigate }: Props) {
  const params = useSearchParams();
  const detailed = pathname === '/dashboard' && params.get('view') === 'detailed';
  const essentialsActive = !detailed && (
    pathname === '/dashboard' || pathname.startsWith('/attendance') || pathname === '/classroom' ||
    pathname.startsWith('/gradebook') || pathname.startsWith('/resources')
  );
  const [moreOpen, setMoreOpen] = useState(!essentialsActive);
  const [sectionId, setSectionId] = useState('');

  useEffect(() => { setMoreOpen(!essentialsActive); }, [pathname, detailed, essentialsActive]);
  useEffect(() => {
    setSectionId(readSelectedSectionId());
    return subscribeSelectedSection(setSectionId);
  }, []);

  const contextual = (path: string) => sectionId ? `${path}?section=${encodeURIComponent(sectionId)}` : path;
  const link = (label: string, href: string, active: boolean) => (
    <Link href={href} className={`ltg-nav-link${active ? ' active' : ''}`}
      aria-current={active ? 'page' : undefined}>{label}</Link>
  );

  return <div className="ltg-instructor-navigation" onClick={event => {
    if ((event.target as HTMLElement).closest('a')) onNavigate();
  }}>
    <div className="ltg-nav-section-label">Instructor essentials</div>
    <div className="ltg-essential-links">
      {link('Today', '/dashboard', pathname === '/dashboard' && !detailed)}
      {link('Attendance', contextual('/attendance'), pathname.startsWith('/attendance'))}
      {process.env.NEXT_PUBLIC_GRADEBOOK_ENABLED === 'true' && link('Grading', '/gradebook', pathname.startsWith('/gradebook'))}
      {link('Live Classroom', contextual('/classroom'), pathname === '/classroom')}
      {link('Resources', '/resources', pathname.startsWith('/resources'))}
    </div>
    <button type="button" className="ltg-more-tools-button" aria-expanded={moreOpen}
      aria-controls="ltg-more-tools" onClick={() => setMoreOpen(open => !open)}>
      More tools <span aria-hidden="true">{moreOpen ? '▴' : '▾'}</span>
    </button>
    <div id="ltg-more-tools" className="ltg-more-tools" hidden={!moreOpen}>
      <div className="ltg-nav-section-label">Plan &amp; teach</div>
      {link('Full Detailed Planner', '/dashboard?view=detailed', detailed)}
      {link('Planner Workspace', '/planner', pathname === '/planner')}
      {link('Agenda Workspace', '/agenda', pathname === '/agenda')}
      {link('Classroom Activities', contextual('/classroom/planner'), pathname === '/classroom/planner')}
      {link('Student Job Cards', contextual('/classroom/job-card'), pathname.startsWith('/classroom/job-card'))}
      <ReviewQueueLink />
      <div className="ltg-nav-section-label">Time &amp; reports</div>
      {link('Employee Time Clock', '/time-clock', pathname === '/time-clock')}
      {link('Reporting & Analytics', '/reports', pathname.startsWith('/reports'))}
      <PayrollNavLink />
      <div className="ltg-nav-section-label">Administration</div>
      <PlannerUtilityNavLinks />
      {pathname.startsWith('/accounts') && <>
        <div className="ltg-nav-section-label">Account tools</div>
        {link('Account Management', '/accounts', pathname === '/accounts')}
        {link('Invitation Diagnostics', '/accounts/diagnostics', pathname === '/accounts/diagnostics')}
      </>}
    </div>
  </div>;
}
