'use client';

import type { ReactNode } from 'react';
import PlannerActivity from '../planner-activity';
import PlannerTimeBudget from '../planner-time-budget';
import { getPlannerTimeBudget } from '@/lib/planner-time-budget';
import type { TeachingSection, GuideDay, GuideDayRef, GuideSegment, GuideResource, ProtectedOutcome, MathLesson, MathSegment } from './page';
import styles from './teaching-view.module.css';

export type TeachingViewProps = {
  section: TeachingSection;
  guide: GuideDay | null;
  days: GuideDayRef[];
  segments: GuideSegment[];
  resources: GuideResource[];
  outcomes: ProtectedOutcome[];
  mathLesson: MathLesson | null;
  mathSegments: MathSegment[];
  loading: boolean;
  busy: boolean;
  current: boolean;
  inProgress: boolean;
  completed: boolean;
  elapsed: string;
  actualDate: string;
  attendanceDate: string | null;
  error: string;
  summary: string;
  followUp: boolean;
  followUpNotes: string;
  onDay: (day: number) => void;
  onCurrentDay: () => void;
  onStart: () => void;
  onComplete: () => void;
  onDate: (date: string) => void;
  onSummary: (value: string) => void;
  onFollowUp: (value: boolean) => void;
  onFollowUpNotes: (value: string) => void;
  onDetailed: () => void;
  attendance: ReactNode;
};

export default function TeachingView(props: TeachingViewProps) {
  const { section, guide, days, segments, resources, mathLesson, mathSegments } = props;
  const index = days.findIndex(day => day.id === guide?.id);
  const budget = getPlannerTimeBudget(segments);
  const locked = props.loading || props.busy || !props.current;
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const futureDay = Boolean(section.scheduled_date && section.scheduled_date > today);
  const scheduledLabel = section.scheduled_date
    ? new Date(`${section.scheduled_date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : '';
  const startReason = section.manual_hold
    ? section.hold_reason || 'An administrator must release this class hold before it can start.'
    : futureDay ? `This day is scheduled for ${scheduledLabel}. Start Today becomes available on that date. Contact an administrator if the schedule needs correcting.`
    : !section.planner_day_id ? 'This class needs a current planner day before it can start.'
    : !props.actualDate ? 'Choose an Actual Date to start this class.' : '';
  const status = props.loading ? 'Loading…' : !props.current ? 'Preview only'
    : props.completed ? 'Completed' : props.inProgress ? `In progress · ${props.elapsed}`
    : props.busy ? 'Starting class…' : section.manual_hold ? 'Class on hold'
    : futureDay ? `Scheduled · ${scheduledLabel}` : startReason ? 'Not ready to start' : 'Ready to teach';
  const showStartReason = !props.loading && props.current && !props.inProgress && !props.completed && Boolean(startReason);
  const sectionQuery = `section=${encodeURIComponent(section.section_id)}`;
  const contextHref = (path: string) => `${path}${path.includes('?') ? '&' : '?'}${sectionQuery}`;
  const attendanceHref = props.attendanceDate
    ? `${contextHref('/attendance')}&date=${encodeURIComponent(props.attendanceDate)}` : null;
  return <main className={styles.page} aria-label="Teaching View">
    <header className={styles.dayHead}>
      <div className={styles.headTitle}>
        <span className={styles.eyebrow}>{section.course_code || section.course_name} · {section.cohort_name || section.section_name}</span>
        <h1>{props.loading ? 'Loading lesson…' : guide?.title || 'Teaching day'}</h1>
        <p className={styles.format}>Day {guide?.planner_day_number ?? '—'} · {budget.usableMinutes + (mathLesson?.planned_minutes ?? 0)} instructional minutes</p>
      </div>
      <div className={styles.dayPicker}>
        <button type="button" aria-label="Previous teaching day" disabled={props.loading || index <= 0} onClick={() => props.onDay(days[index - 1].planner_day_number)}>‹</button>
        <label>Go to day<select aria-label="Choose teaching day" value={guide?.planner_day_number ?? ''} disabled={props.loading || !days.length} onChange={event => props.onDay(Number(event.target.value))}>
          {!guide && <option value="">Select a day</option>}
          {days.map(day => <option key={day.id} value={day.planner_day_number}>Day {day.planner_day_number}</option>)}
        </select></label>
        <button type="button" aria-label="Next teaching day" disabled={props.loading || index < 0 || index >= days.length - 1} onClick={() => props.onDay(days[index + 1].planner_day_number)}>›</button>
      </div>
    </header>
    {!props.current && guide && <div className={styles.previewBanner} role="status">Preview only. Class progress is unchanged. <button type="button" onClick={props.onCurrentDay}>Back to current day</button></div>}
    {section.manual_hold && <p role="status" className={styles.previewBanner}>{section.hold_reason || 'This class is on hold.'}</p>}
    <section className={styles.actionBar} aria-label="Today's class actions">
      <div className={styles.actionStatus} role="status"><small>CLASS STATUS</small><strong>{status}</strong>{showStartReason && <span id="start-availability">{startReason}</span>}</div>
      <div className={styles.actionButtons}>
        <button type="button" className={`${styles.startButton} start-button`} aria-describedby={showStartReason ? 'start-availability' : undefined} disabled={locked || Boolean(startReason) || props.inProgress || props.completed} onClick={props.onStart}>Start Today</button>
        {attendanceHref ? <a href={attendanceHref}>Attendance</a> : <button disabled>Attendance loading…</button>}
        {process.env.NEXT_PUBLIC_GRADEBOOK_ENABLED === 'true' && <a href={contextHref('/gradebook')} className={styles.gradeButton}>Grading</a>}
        <button type="button" className={`${styles.completeButton} complete-button`} disabled={locked || !props.actualDate || !props.inProgress || !props.attendanceDate} onClick={props.onComplete}>{props.busy ? 'Working…' : 'Complete Day'}</button>
      </div>
    </section>
    {props.error && <div role="alert" className={styles.error}>{props.error}</div>}
    <label className={styles.field}>Actual Date<input id="actual-date" type="date" value={props.actualDate} disabled={locked || props.inProgress} onChange={event => props.onDate(event.target.value)} /></label>
    {props.attendance}
    {!props.loading && guide && <>
      <section className={styles.objective}><div className={styles.sectionLabel}>TODAY'S OBJECTIVE</div><p>{guide.objective || 'Follow the approved instruction for this day.'}</p></section>
      <PlannerTimeBudget {...budget} />
      <section className={styles.plan}>
        <header className={styles.planHead}><div><div className={styles.sectionLabel}>TEACHING PLAN</div><h2>What to do next</h2></div></header>
        {budget.teachingSegments.map((segment, step) => <article className={styles.step} key={segment.id}>
          <span className={styles.stepNumber}>{String(step + 1).padStart(2, '0')}</span>
          <div><strong className={styles.stepName}>{segment.segment_title || 'Instruction step'}</strong><span className={styles.stepTime}>{segment.start_minute != null && segment.end_minute != null ? `${segment.start_minute}–${segment.end_minute} minutes` : `${segment.planned_minutes} minutes`}</span>
            {segment.instructor_actions && <PlannerActivity text={segment.instructor_actions} fallbackTitle={segment.segment_title || ''} headingLevel={4} />}
          </div>
        </article>)}
        {!segments.length && <p className={styles.muted}>No instruction steps recorded for this day.</p>}
        {mathLesson && <article className={styles.step}><span className={styles.stepNumber}>M</span><div><strong className={styles.stepName}>Welding Math · {mathLesson.title}</strong><p>{mathLesson.goal}</p>{mathSegments.map(segment => <p key={segment.id}>{segment.planned_minutes} min · {segment.activity}</p>)}</div></article>}
      </section>
      <section className={styles.resources} aria-label="Lesson resources">
        <header className={styles.planHead}><div><div className={styles.sectionLabel}>RESOURCES</div><h2>Tools for this lesson</h2></div><a className={styles.textAction} href={contextHref('/classroom')}>Live Classroom →</a></header>
        <div className={styles.resourceList}>{resources.map(resource => <div className={styles.resource} key={resource.id}><div><strong>{resource.resource_title}</strong><span>{resource.resource_type.replaceAll('_', ' ')}{resource.required ? ' · Required' : ''}</span><p>{resource.resource_notes}</p></div>{resource.resource_url && <a href={resource.resource_url.startsWith('/classroom') ? contextHref(resource.resource_url) : resource.resource_url} target="_blank" rel="noreferrer">Open resource</a>}</div>)}</div>
        <div className={styles.shortcutRow}><a href={contextHref('/classroom/planner')}>Classroom Activities</a><a href={contextHref('/classroom/job-card')}>Student Job Cards</a></div>
      </section>
      <details className={styles.collapsible}><summary>Instructor Toolkit <span>Coaching · Math · Outcomes</span></summary><div className={styles.detailBody}>
        {(['materials_equipment','corresponding_application','evidence_check_for_understanding','weekly_coaching_focus','coaching_focus','if_students_struggle','keep_momentum'] as const).map(key => guide[key] && <section className={styles.tip} key={key}><h3>{key.replaceAll('_', ' ')}</h3><p>{guide[key]}</p></section>)}
        {mathLesson && <section className={styles.tip}><h3>Math instructor reference</h3><p>{mathLesson.book_connection}</p><p>{mathLesson.instructor_notes}</p><p>{mathLesson.answers_quick_check}</p></section>}
        <details><summary>Protected curriculum outcomes ({props.outcomes.length})</summary>{props.outcomes.map(outcome => <p key={outcome.id}><strong>{outcome.outcome_code}</strong> · {outcome.outcome_text}</p>)}</details>
      </div></details>
    </>}
    {!props.loading && !guide && <p role="status">No teacher-guide content is available for this planner day. The full planner remains available below.</p>}
    <details className={styles.collapsible}><summary>End-of-Day Notes <span>Observations · Follow-up</span></summary><div className={styles.detailBody}>
      <label className={styles.field}>Daily Comments / Deviation Summary<textarea id="deviation-summary" value={props.summary} disabled={locked} onChange={event => props.onSummary(event.target.value)} /></label>
      <label className={styles.toggle}><input type="checkbox" checked={props.followUp} disabled={locked} onChange={event => props.onFollowUp(event.target.checked)} /> Follow-up needed</label>
      {props.followUp && <label className={styles.field}>Follow-up Notes<textarea id="follow-up-notes" value={props.followUpNotes} disabled={locked} onChange={event => props.onFollowUpNotes(event.target.value)} /></label>}
      <p className={styles.muted}>Complete Day saves these remarks to the class record.</p>
    </div></details>
    <div className={styles.fullAccess}><div><strong>Need every control and reference?</strong><p>The full planner includes the calendar and all original controls.</p></div><button type="button" onClick={props.onDetailed}>Open Full Detailed Planner →</button></div>
    <nav className={styles.mobileNav} aria-label="Teaching navigation"><a href="/dashboard" aria-current="page">Today</a>{attendanceHref && <a href={attendanceHref}>Attendance</a>}{process.env.NEXT_PUBLIC_GRADEBOOK_ENABLED === 'true' && <a href={contextHref('/gradebook')}>Grading</a>}<button type="button" onClick={props.onDetailed}>More</button></nav>
  </main>;
}
