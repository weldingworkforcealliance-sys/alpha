'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { getSupabase } from '@/lib/supabase-browser';

type AccessMode = 'school' | 'instructor' | null;

type TeachingSection = {
  section_id: string;
  section_name: string | null;
  course_code: string | null;
  course_name: string | null;
  cohort_name: string | null;
  current_planner_day_number: number | null;
  scheduled_date: string | null;
};

function readMode(): AccessMode {
  if (typeof document === 'undefined') return null;
  if (!document.body.classList.contains('pccc-welding-skin')) return null;
  if (document.body.classList.contains('pccc-school-skin')) return 'school';
  if (document.body.classList.contains('pccc-instructor-skin')) return 'instructor';
  return null;
}

function formatDate(value: string | null) {
  if (!value) return 'Schedule pending';
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function sectionLabel(section: TeachingSection) {
  return section.course_code || section.course_name || section.section_name || 'Teaching section';
}

function cohortLabel(section: TeachingSection) {
  return section.cohort_name || section.section_name || 'Assigned cohort';
}

export default function PcccDashboardOverview() {
  const [supabase] = useState(getSupabase);
  const [mode, setMode] = useState<AccessMode>(null);
  const [sections, setSections] = useState<TeachingSection[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const syncMode = () => {
      if (cancelled) return;
      const nextMode = readMode();
      setMode(nextMode);
      document.body.classList.toggle('pccc-overview-ready', Boolean(nextMode));
    };

    syncMode();
    const observer = new MutationObserver(syncMode);
    observer.observe(document.body, { attributes: true, attributeFilter: ['class', 'data-pccc-access'] });

    return () => {
      cancelled = true;
      observer.disconnect();
      document.body.classList.remove('pccc-overview-ready');
    };
  }, []);

  useEffect(() => {
    if (!mode) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('current_teaching_sections')
        .select('section_id,section_name,course_code,course_name,cohort_name,current_planner_day_number,scheduled_date');

      if (!cancelled) {
        if (error) {
          console.error('Unable to load PCCC dashboard sections:', error);
          setSections([]);
        } else {
          setSections((data ?? []) as TeachingSection[]);
        }
        setLoading(false);
      }
    };

    void load();
    return () => { cancelled = true; };
  }, [mode, supabase]);

  const visibleSections = useMemo(
    () => [...sections]
      .sort((left, right) => (left.scheduled_date ?? '').localeCompare(right.scheduled_date ?? ''))
      .slice(0, 5),
    [sections]
  );

  if (!mode) return null;

  return (
    <section className="pccc-portal-dashboard" aria-label="PCCC Welding portal overview">
      <div className="pccc-portal-dashboard__heading">
        <div>
          <span className="pccc-portal-dashboard__eyebrow">
            {mode === 'school' ? 'PCCC Welding · School Access' : 'PCCC Welding · Instructor Access'}
          </span>
          <h2>{mode === 'school' ? 'Education Operations' : 'Teaching Workspace'}</h2>
          <p>
            {mode === 'school'
              ? 'Students, curriculum, instructors, attendance, outcomes, and program operations in one school-level workspace.'
              : 'Plan instruction, run the classroom, document evidence, support students, and keep the day moving.'}
          </p>
        </div>
        <div className="pccc-portal-dashboard__seal" aria-hidden="true">
          <span>PCCC</span>
          <strong>WELDING</strong>
        </div>
      </div>

      <div className="pccc-portal-dashboard__actions pccc-instructor-only">
        <Link href="/planner"><span>01</span><strong>Living Teacher Planner</strong><small>Plan · Teach · Track</small></Link>
        <Link href="/classroom"><span>02</span><strong>Live Classroom</strong><small>Activities · Assessments</small></Link>
        <Link href="/attendance"><span>03</span><strong>Student Attendance</strong><small>Daily & class-pair records</small></Link>
        <Link href="/resources"><span>04</span><strong>Content & Resources</strong><small>WPS · Codes · Teaching media</small></Link>
        <Link href="/reports"><span>05</span><strong>Results & Reports</strong><small>Progress · Evidence · Outcomes</small></Link>
        <Link href="/time-clock"><span>06</span><strong>Employee Time</strong><small>Open workforce time module</small></Link>
      </div>

      <div className="pccc-portal-dashboard__actions pccc-school-only">
        <Link href="/school"><span>01</span><strong>School Dashboard</strong><small>Program operations</small></Link>
        <Link href="/attendance"><span>02</span><strong>Students & Attendance</strong><small>Daily participation records</small></Link>
        <Link href="/school"><span>03</span><strong>Programs & Curriculum</strong><small>Courses · Sections · Outcomes</small></Link>
        <Link href="/reports"><span>04</span><strong>Reports & Analytics</strong><small>Progress · Results · Trends</small></Link>
        <Link href="/time-clock/payroll"><span>05</span><strong>Instructor Time</strong><small>Hours · Payroll review</small></Link>
        <Link href="/resources"><span>06</span><strong>Education Resources</strong><small>Instructional support</small></Link>
      </div>

      <div className="pccc-portal-dashboard__lower">
        <article className="pccc-portal-dashboard__schedule">
          <header>
            <div>
              <span>{mode === 'school' ? 'PROGRAM ACTIVITY' : 'MY TEACHING'}</span>
              <h3>Current Teaching Sections</h3>
            </div>
            <Link href="/planner">Open Planner →</Link>
          </header>

          {loading ? (
            <div className="pccc-portal-dashboard__empty">Loading teaching sections…</div>
          ) : visibleSections.length ? (
            <div className="pccc-portal-dashboard__section-list">
              {visibleSections.map((section) => (
                <div key={section.section_id} className="pccc-portal-dashboard__section-row">
                  <span className="pccc-portal-dashboard__status-dot" aria-hidden="true" />
                  <strong>{sectionLabel(section)}</strong>
                  <span>{cohortLabel(section)}</span>
                  <span>{section.current_planner_day_number ? `Day ${section.current_planner_day_number}` : 'Not started'}</span>
                  <span>{formatDate(section.scheduled_date)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="pccc-portal-dashboard__empty">No active teaching sections are available for this account.</div>
          )}
        </article>

        <aside className="pccc-portal-dashboard__education">
          <span>EDUCATION FIRST</span>
          <h3>Skills become opportunity when progress is visible.</h3>
          <p>
            LTG keeps curriculum, instruction, attendance, assessment, evidence, and instructor support connected without changing approved course outcomes.
          </p>
          <div>
            <strong>{sections.length}</strong>
            <small>{sections.length === 1 ? 'active teaching section' : 'active teaching sections'}</small>
          </div>
        </aside>
      </div>
    </section>
  );
}
