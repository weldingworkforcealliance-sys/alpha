'use client';

import { useMemo, useState, type ReactNode } from 'react';
import styles from './PlannerTeachingConsole.module.css';

export type PlannerPlanRow = {
  id: string;
  time: string;
  instructor: string;
  students?: string | null;
  kind?: 'core' | 'math' | 'assessment';
};

export type PlannerLaunchResource = {
  id: string;
  title: string;
  url?: string | null;
  type: string;
  notes?: string | null;
  required?: boolean;
};

export type PlannerDayOption = {
  id: string;
  dayNumber: number;
  title?: string | null;
};

export type PlannerSupportItem = {
  key: string;
  label: string;
  body?: string | null;
  content?: ReactNode;
};

type Props = {
  courseLabel: string;
  sectionLabel?: string | null;
  dayNumber: number;
  totalDays?: number | null;
  title: string;
  objective?: string | null;
  formatLabel?: string | null;
  protectedOutcomes?: Array<{ id: string; code: string; text: string }>;
  rows: PlannerPlanRow[];
  resources: PlannerLaunchResource[];
  supportItems: PlannerSupportItem[];
  dayOptions?: PlannerDayOption[];
  selectedGuideDayId?: string | null;
  isCurrentDay?: boolean;
  loading?: boolean;
  onPrevious?: () => void;
  onNext?: () => void;
  onSelectDay?: (dayNumber: number) => void;
  onReturnCurrent?: () => void;
  studentDisplayUrl?: string | null;
  actionPanel?: ReactNode;
  footerPanel?: ReactNode;
};

const STUDENT_SAFE_TYPES = new Set([
  'student_display',
  'student_resource',
  'book_reference',
  'aws_reference',
  'print',
  'wps_swps',
  'assessment',
  'video',
  'handout',
  'resource',
]);

const INSTRUCTOR_ONLY_TYPES = new Set([
  'instructor_report',
  'instructor_only',
  'secure_exam',
]);

function resourceButtonLabel(type: string) {
  if (type === 'assessment') return 'Launch Assessment';
  if (type === 'book_reference') return 'Open Book Reference';
  if (type === 'aws_reference') return 'Open AWS Reference';
  if (type === 'print') return 'Open Print';
  if (type === 'wps_swps') return 'Open WPS / SWPS';
  if (type === 'instructor_report') return 'Open Instructor Report';
  if (type === 'secure_exam') return 'Secure Exam';
  return 'Open Resource';
}

export default function PlannerTeachingConsole({
  courseLabel,
  sectionLabel,
  dayNumber,
  totalDays,
  title,
  objective,
  formatLabel,
  protectedOutcomes = [],
  rows,
  resources,
  supportItems,
  dayOptions = [],
  selectedGuideDayId,
  isCurrentDay = true,
  loading = false,
  onPrevious,
  onNext,
  onSelectDay,
  onReturnCurrent,
  studentDisplayUrl,
  actionPanel,
  footerPanel,
}: Props) {
  const [showPreview, setShowPreview] = useState(false);
  const [showStudentActions, setShowStudentActions] = useState(true);

  const studentSafeResources = useMemo(
    () => resources.filter((resource) => STUDENT_SAFE_TYPES.has(resource.type)),
    [resources]
  );

  const currentOptionIndex = dayOptions.findIndex(
    (option) => option.id === selectedGuideDayId
  );

  const canPrevious = currentOptionIndex > 0;
  const canNext =
    currentOptionIndex >= 0 && currentOptionIndex < dayOptions.length - 1;

  const openStudentDisplay = () => {
    if (!studentDisplayUrl) return;
    window.open(studentDisplayUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <section className={styles.console} aria-label="Teaching console">
      <header className={styles.dayHeader}>
        <div className={styles.dayIdentity}>
          <div className={styles.eyebrow}>
            {courseLabel}
            {sectionLabel ? ` · ${sectionLabel}` : ''}
          </div>
          <h1>
            Day {dayNumber}{totalDays ? ` of ${totalDays}` : ''}: {title}
          </h1>
          {formatLabel && <div className={styles.formatBadge}>{formatLabel}</div>}
        </div>

        <div className={styles.dayNav}>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={onPrevious}
            disabled={!canPrevious || loading}
          >
            ‹ Previous
          </button>
          {dayOptions.length > 0 && (
            <select
              className={styles.daySelect}
              value={dayNumber}
              onChange={(event) => onSelectDay?.(Number(event.target.value))}
              disabled={loading}
              aria-label="Go to planner day"
            >
              {dayOptions.map((option) => (
                <option key={option.id} value={option.dayNumber}>
                  Day {option.dayNumber}{option.title ? ` · ${option.title}` : ''}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={onNext}
            disabled={!canNext || loading}
          >
            Next ›
          </button>
          {!isCurrentDay && onReturnCurrent && (
            <button
              type="button"
              className={styles.currentButton}
              onClick={onReturnCurrent}
            >
              Current Day
            </button>
          )}
        </div>
      </header>

      {!isCurrentDay && (
        <div className={styles.previewBanner}>
          Previewing another planner day. Class progress and attendance are not changed.
        </div>
      )}

      <div className={styles.objectiveCard}>
        <div>
          <span className={styles.label}>Daily Objective</span>
          <p>{objective || 'No daily objective has been entered yet.'}</p>
        </div>
        {protectedOutcomes.length > 0 && (
          <div className={styles.outcomes}>
            <span className={styles.label}>Protected Outcomes</span>
            <div className={styles.outcomeList}>
              {protectedOutcomes.map((outcome) => (
                <span className={styles.outcomeChip} key={outcome.id} title={outcome.text}>
                  {outcome.code}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className={styles.primaryGrid}>
        <section className={styles.planCard}>
          <div className={styles.planHeader}>
            <div>
              <span className={styles.label}>Live Teaching View</span>
              <h2>Today&apos;s Instructor Plan</h2>
            </div>
            <label className={styles.toggleLabel}>
              <input
                type="checkbox"
                checked={showStudentActions}
                onChange={(event) => setShowStudentActions(event.target.checked)}
              />
              Show student actions
            </label>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.planTable}>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>What the Instructor Does</th>
                  {showStudentActions && <th>What Students Do</th>}
                </tr>
              </thead>
              <tbody>
                {rows.length > 0 ? (
                  rows.map((row) => (
                    <tr
                      key={row.id}
                      className={
                        row.kind === 'math'
                          ? styles.mathRow
                          : row.kind === 'assessment'
                          ? styles.assessmentRow
                          : undefined
                      }
                    >
                      <td className={styles.timeCell}>{row.time}</td>
                      <td>{row.instructor}</td>
                      {showStudentActions && (
                        <td>
                          {row.students || 'Follow instructor direction / complete assigned activity.'}
                        </td>
                      )}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={showStudentActions ? 3 : 2} className={styles.emptyCell}>
                      No timed instructional segments are available for this day.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <aside className={styles.launchCard}>
          <div className={styles.launchHeader}>
            <span className={styles.label}>One-Click Teaching Tools</span>
            <h2>Student Display / Launch</h2>
          </div>

          <div className={styles.heroButtons}>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={openStudentDisplay}
              disabled={!studentDisplayUrl}
            >
              Launch Student Screen
            </button>
            <button
              type="button"
              className={styles.previewButton}
              onClick={() => setShowPreview(true)}
            >
              Preview
            </button>
          </div>

          <div className={styles.resourceList}>
            {resources.length > 0 ? (
              resources.map((resource) => {
                const teacherOnly = INSTRUCTOR_ONLY_TYPES.has(resource.type);
                const secureExam = resource.type === 'secure_exam';
                return (
                  <div className={styles.resourceItem} key={resource.id}>
                    <div className={styles.resourceCopy}>
                      <strong>{resource.title}</strong>
                      <span>
                        {teacherOnly ? 'Instructor only' : 'Student-safe when authorized'}
                        {resource.notes ? ` · ${resource.notes}` : ''}
                      </span>
                    </div>
                    {resource.url && !secureExam ? (
                      <a
                        className={styles.resourceButton}
                        href={resource.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {resourceButtonLabel(resource.type)}
                      </a>
                    ) : (
                      <span className={styles.resourceStatus}>
                        {secureExam ? 'Protected' : 'Link pending'}
                      </span>
                    )}
                  </div>
                );
              })
            ) : (
              <div className={styles.emptyResources}>
                No launch resources have been attached to this day yet.
              </div>
            )}
          </div>
        </aside>
      </div>

      <div className={styles.supportGrid}>
        {supportItems
          .filter((item) => item.body || item.content)
          .map((item) => (
            <details className={styles.supportItem} key={item.key}>
              <summary>{item.label}</summary>
              <div className={styles.supportBody}>
                {item.content ?? <p>{item.body}</p>}
              </div>
            </details>
          ))}
      </div>

      {actionPanel && <div className={styles.actionSlot}>{actionPanel}</div>}
      {footerPanel && <div className={styles.footerSlot}>{footerPanel}</div>}

      {showPreview && (
        <div className={styles.modalBackdrop} role="presentation" onClick={() => setShowPreview(false)}>
          <div
            className={styles.previewModal}
            role="dialog"
            aria-modal="true"
            aria-label="Student screen preview"
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.previewModalHeader}>
              <div>
                <span className={styles.label}>Student Screen Preview</span>
                <h2>{courseLabel} · Day {dayNumber}</h2>
              </div>
              <button
                type="button"
                className={styles.closeButton}
                onClick={() => setShowPreview(false)}
                aria-label="Close preview"
              >
                ×
              </button>
            </div>
            <h3>{title}</h3>
            <p className={styles.previewObjective}>{objective}</p>
            <div className={styles.previewRows}>
              {rows.map((row) => (
                <div className={styles.previewRow} key={`preview-${row.id}`}>
                  <span>{row.time}</span>
                  <p>{row.students || row.instructor}</p>
                </div>
              ))}
            </div>
            {studentSafeResources.length > 0 && (
              <div className={styles.previewResourceList}>
                <h4>Resources</h4>
                {studentSafeResources.map((resource) => (
                  <div key={`safe-${resource.id}`}>{resource.title}</div>
                ))}
              </div>
            )}
            <div className={styles.previewSafetyNote}>
              Instructor coaching, answer keys, grades, private notes, and secure exam content are intentionally hidden.
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
