'use client';

import { useState } from 'react';
import type { DemoCourseDay, DemoResource } from '../_lib/demo-types';
import styles from './fabtech-v2.module.css';

type Props = {
  courseCode: string;
  day: DemoCourseDay;
  dayCount: number;
  started: boolean;
  completed: boolean;
  elapsed: string;
  attendanceFinalized: boolean;
  note: string;
  followUp: boolean;
  gradedCount: number;
  onDay: (number: number) => void;
  onStart: () => void;
  onComplete: () => void;
  onAttendance: () => void;
  onGrade: () => void;
  onClassroom: () => void;
  onResources: () => void;
  onLaunch: (resource: DemoResource) => void;
  onNote: (text: string) => void;
  onFollowUp: (checked: boolean) => void;
};

const INSTRUCTOR_ONLY_TYPES = new Set(['secure_exam', 'instructor_only', 'instructor_report']);

export default function FabtechTeachingDayV2({
  courseCode,
  day,
  dayCount,
  started,
  completed,
  elapsed,
  attendanceFinalized,
  note,
  followUp,
  gradedCount,
  onDay,
  onStart,
  onComplete,
  onAttendance,
  onGrade,
  onClassroom,
  onResources,
  onLaunch,
  onNote,
  onFollowUp,
}: Props) {
  const [showStudentActions, setShowStudentActions] = useState(false);
  const [reviewText, setReviewText] = useState('');
  const [copyStatus, setCopyStatus] = useState('');
  const safeResources = day.resources.filter((resource) => !INSTRUCTOR_ONLY_TYPES.has(resource.type));
  const primaryResources = safeResources.slice(0, 2);
  const isSafetyRelevant = Boolean(day.support.safetyFocus || day.support.safetyGate);

  const copyReview = async () => {
    setCopyStatus('');
    const message = [
      'FABTECH Teaching View v2 - UX review',
      courseCode + ' / Day ' + day.dayNumber + ': ' + day.title,
      'Class started: ' + started,
      'Pair attendance finalized: ' + attendanceFinalized,
      'Sample students graded: ' + gradedCount,
      'Course day completed: ' + completed,
      'Comments: ' + reviewText,
    ].join('\n');
    try {
      await navigator.clipboard.writeText(message);
      setCopyStatus('Review copied. You can paste it into a message.');
    } catch {
      setCopyStatus('Browser clipboard unavailable. Select and copy your notes manually.');
    }
  };

  return (
    <div className={styles.dayPage}>
      <section className={styles.dayHeading} aria-label="Selected teaching day">
        <div className={styles.dayTitle}>
          <span className={styles.kicker}>{courseCode} · Day {day.dayNumber} of {dayCount}</span>
          <h2>{day.title}</h2>
          <span className={styles.lessonLength}>{day.formatLabel}</span>
        </div>
        <div className={styles.dayNavigation}>
          <button type="button" onClick={() => onDay(day.dayNumber - 1)} disabled={day.dayNumber <= 1} aria-label="Previous day">‹</button>
          <label>
            <span>Go to day</span>
            <select value={day.dayNumber} onChange={(event) => onDay(Number(event.target.value))} aria-label="Choose teaching day">
              {Array.from({ length: dayCount }, (_, i) => i + 1).map((number) => (
                <option key={number} value={number}>Day {number}</option>
              ))}
            </select>
          </label>
          <button type="button" onClick={() => onDay(day.dayNumber + 1)} disabled={day.dayNumber >= dayCount} aria-label="Next day">›</button>
        </div>
      </section>

      <section className={styles.actionBar} aria-label="Today's class actions">
        <div className={styles.actionStatus}>
          <span>Class status</span>
          <strong>{completed ? 'Complete' : started ? 'In progress · ' + elapsed : 'Ready to teach'}</strong>
          <small>{attendanceFinalized ? 'Attendance finalized' : 'Attendance needs finalization'}</small>
        </div>
        <div className={styles.actionButtons}>
          <button className={styles.primaryAction} type="button" onClick={onStart} disabled={started || completed}>
            {started ? 'Class Started' : completed ? 'Day Completed' : 'Start Today'}
          </button>
          <button className={styles.secondaryAction} type="button" onClick={onAttendance}>
            Attendance{attendanceFinalized ? ' ✓' : ' · Needed'}
          </button>
          <button className={styles.completeAction} type="button" onClick={onComplete} disabled={!started || completed}>
            Complete Day
          </button>
        </div>
      </section>

      <section className={styles.objective}>
        <div className={styles.sectionLabel}>Today's Objective</div>
        <p>{day.objective}</p>
        {isSafetyRelevant && (
          <div className={styles.safety}>
            <strong>Safety check</strong>
            <p>{day.support.safetyFocus || day.support.safetyGate}</p>
          </div>
        )}
      </section>

      <section className={styles.teachingPanel}>
        <div className={styles.panelHeading}>
          <div>
            <span className={styles.sectionLabel}>Teaching Plan</span>
            <h3>What to do next</h3>
          </div>
          <label className={styles.studentToggle}>
            <input type="checkbox" checked={showStudentActions} onChange={(event) => setShowStudentActions(event.target.checked)} />
            Show student actions
          </label>
        </div>
        <div className={styles.stepList}>
          {day.rows.map((row, index) => (
            <article className={styles.step} key={row.id}>
              <div className={styles.stepMarker}>{String(index + 1).padStart(2, '0')}</div>
              <div className={styles.stepBody}>
                <strong>{row.time}</strong>
                <p>{row.instructor}</p>
                {showStudentActions && row.students && (
                  <div className={styles.studentActions}><b>Student activity:</b> {row.students}</div>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.resources} aria-label="Teaching resources">
        <div className={styles.panelHeading}>
          <div><span className={styles.sectionLabel}>Key Teaching Tools</span><h3>Resources for this day</h3></div>
          <button className={styles.textAction} type="button" onClick={onResources}>All resources ›</button>
        </div>
        <div className={styles.quickResources}>
          {primaryResources.length > 0 ? primaryResources.map((resource) => (
            <div className={styles.resourceItem} key={resource.id}>
              <div><strong>{resource.title}</strong><span>{resource.type.replace(/_/g, ' ')}</span></div>
              {resource.demoActivityKey ? (
                <button type="button" onClick={() => onLaunch(resource)}>Launch Activity</button>
              ) : resource.url ? (
                <a href={resource.url} target="_blank" rel="noopener noreferrer">Open ↗</a>
              ) : <small>Referenced in guide</small>}
            </div>
          )) : <p className={styles.quiet}>No student-safe resources linked for this day. Check the full resource library.</p>}
          <div className={styles.resourceLinks}>
            <button type="button" onClick={onClassroom}>Open Live Classroom ›</button>
            <button type="button" onClick={onGrade}>Open Practice Grading ›</button>
          </div>
        </div>
      </section>

      <details className={styles.collapse}>
        <summary>Instructor Toolkit <span>Preparation · Coaching · AWS · Notes</span></summary>
        <div className={styles.collapseBody}>
          {[
            ['Preparation', day.support.instructorPrep],
            ['Demonstration', day.support.demonstration],
            ['Common difficulties', day.support.commonProblems],
            ['Teaching tips', day.support.teachingTips],
            ['AWS alignment', day.support.awsAlignment],
            ['Evidence and checks', day.support.evidenceCheck || day.support.instructorChecks],
            ['Additional safety guidance', day.support.safetyGate],
            ['Qualification guardrail', day.support.qualificationGuardrail],
          ].filter(([, value]) => Boolean(value)).map(([label, value]) => (
            <div className={styles.supportItem} key={label}><strong>{label}</strong><p>{value}</p></div>
          ))}
          <details className={styles.nested}>
            <summary>Show all curriculum outcome references</summary>
            <ul>{day.outcomes.map((outcome) => <li key={outcome.id}><b>{outcome.code}:</b> {outcome.text}</li>)}</ul>
          </details>
        </div>
      </details>

      <details className={styles.collapse}>
        <summary>End-of-Day Notes & Follow-up <span>Optional during class</span></summary>
        <div className={styles.collapseBody}>
          <label className={styles.noteLabel}>
            Daily observations or teaching adjustments
            <textarea value={note} onChange={(event) => onNote(event.target.value)} placeholder="What worked? What needs adjusting?" rows={3} />
          </label>
          <label className={styles.checkboxLine}>
            <input type="checkbox" checked={followUp} onChange={(event) => onFollowUp(event.target.checked)} />
            Follow-up needed
          </label>
          <p className={styles.quiet}>Notes are kept in this temporary browser demo only, not the real LTG gradebook or instructor log.</p>
        </div>
      </details>

      <details className={styles.collapse}>
        <summary>Evaluate this layout <span>Try the workflow and copy your feedback</span></summary>
        <div className={styles.collapseBody}>
          <div className={styles.workflowChecks}>
            <span>{started || completed ? '✓' : '○'} Start today's lesson</span>
            <span>{attendanceFinalized ? '✓' : '○'} Finalize attendance</span>
            <span>{gradedCount > 0 ? '✓' : '○'} Grade a sample student</span>
            <span>{completed ? '✓' : '○'} Complete the day</span>
          </div>
          <label className={styles.noteLabel}>
            Was anything difficult to find? Was anything unnecessary?
            <textarea rows={3} value={reviewText} onChange={(event) => setReviewText(event.target.value)} placeholder="Example: I had to look under More to find the clock." />
          </label>
          <button className={styles.secondaryAction} type="button" onClick={() => void copyReview()}>Copy UX Review</button>
          {copyStatus && <p role="status" className={styles.quiet}>{copyStatus}</p>}
        </div>
      </details>
    </div>
  );
}
