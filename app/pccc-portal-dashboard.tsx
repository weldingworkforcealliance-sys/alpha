'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { getSupabase } from '@/lib/supabase-browser';
import { useLtgSkin } from './skin-provider';

type TeachingSection = {
  section_id: string;
  section_name: string | null;
  course_code: string | null;
  course_name: string | null;
  cohort_name: string | null;
  current_planner_day_number: number | null;
  scheduled_date: string | null;
};

function sectionLabel(section: TeachingSection) {
  return section.course_code || section.course_name || section.section_name || 'Teaching section';
}

function cohortLabel(section: TeachingSection) {
  return section.cohort_name || section.section_name || 'Assigned cohort';
}

function formatDate(value: string | null) {
  if (!value) return 'Schedule pending';
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export default function PcccPortalDashboard() {
  const { skinId, accessMode, ready } = useLtgSkin();
  const [supabase] = useState(getSupabase);
  const [sections, setSections] = useState<TeachingSection[]>([]);
  const [loading, setLoading] = useState(false);

  const active = ready && skinId === 'pccc-welding' && (accessMode === 'school' || accessMode === 'instructor');

  useEffect(() => {
    if (!active) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('current_teaching_sections')
        .select('section_id,section_name,course_code,course_name,cohort_name,current_planner_day_number,scheduled_date');

      if (!cancelled) {
        if (error) {
          console.error('Unable to load PCCC portal sections:', error);
          setSections([]);
        } else {
          setSections((data ?? []) as TeachingSection[]);
        }
        setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [active, supabase]);

  const visibleSections = useMemo(
    () => [...sections]
      .sort((left, right) => (left.scheduled_date ?? '').localeCompare(right.scheduled_date ?? ''))
      .slice(0, 5),
    [sections]
  );

  if (!active) return null;

  const school = accessMode === 'school';

  const actions = school
    ? [
        ['/school', '01', 'School Dashboard', 'Program operations & oversight'],
        ['/attendance', '02', 'Students & Attendance', 'Daily and class-pair records'],
        ['/school', '03', 'Programs & Curriculum', 'Courses, sections & outcomes'],
        ['/accounts', '04', 'Instructors & Access', 'People, roles & assignments'],
        ['/reports', '05', 'Reports & Analytics', 'Progress, results & trends'],
        ['/resources', '06', 'Education Resources', 'Instructional support library'],
      ]
    : [
        ['/planner', '01', 'Living Teacher Planner', 'Plan, teach & document'],
        ['/classroom', '02', 'Live Classroom', 'Activities, tasks & assessments'],
        ['/attendance', '03', 'Students & Attendance', 'Daily and class-pair records'],
        ['/review-queue', '04', 'Assessment Review', 'Evidence, grading & follow-up'],
        ['/resources', '05', 'Content & Resources', 'WPS, codes & teaching media'],
        ['/reports', '06', 'Progress & Reports', 'Student evidence & outcomes'],
      ];

  return (
    <section className="pccc-portal-dashboard" aria-label="PCCC Welding portal overview">
      <div className="pccc-portal-dashboard__heading">
        <div>
          <span className="pccc-portal-dashboard__eyebrow">
            {school ? 'PCCC Welding · School Access' : 'PCCC Welding · Instructor Access'}
          </span>
          <h2>{school ? 'Education Operations' : 'Teaching Workspace'}</h2>
          <p>
            {school
              ? 'Students, instructors, curriculum, attendance, outcomes, resources, and program operations in one education-first workspace.'
              : 'Plan instruction, run the classroom, record evidence, support students, and keep approved course outcomes visible throughout the day.'}
          </p>
        </div>
        <div className="pccc-portal-dashboard__badge" aria-hidden="true">
          <span>PCCC</span>
          <strong>WELDING</strong>
          <small>{school ? 'SCHOOL PORTAL' : 'INSTRUCTOR PORTAL'}</small>
        </div>
      </div>

      <div className="pccc-portal-dashboard__education-strip" aria-label="Education priorities">
        <span>Curriculum</span>
        <span>Instruction</span>
        <span>Assessment</span>
        <span>Student Support</span>
        <span>Career Readiness</span>
      </div>

      <div className="pccc-portal-dashboard__actions">
        {actions.map(([href, number, title, subtitle]) => (
          <Link href={href} key={`${number}-${title}`}>
            <span>{number}</span>
            <strong>{title}</strong>
            <small>{subtitle}</small>
          </Link>
        ))}
      </div>

      <div className="pccc-portal-dashboard__lower">
        <article className="pccc-portal-dashboard__schedule">
          <header>
            <div>
              <span>{school ? 'PROGRAM ACTIVITY' : 'MY TEACHING'}</span>
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
            LTG keeps curriculum, instruction, attendance, assessment, evidence, and instructor support connected without changing approved curriculum or course outcomes.
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
