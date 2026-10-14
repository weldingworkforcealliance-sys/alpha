'use client';

import { useState } from 'react';
import styles from './fabtech-v2.module.css';

export const DEMO_RUBRIC_CRITERIA = [
  'Safety and PPE',
  'Preparation and fit-up',
  'Process and technique',
  'Visual inspection',
  'Work documentation',
] as const;

export function scoredSampleCount(scoresByStudent: Record<string, number[]>, students: readonly string[]): number {
  return students.filter((student) =>
    DEMO_RUBRIC_CRITERIA.every((_, index) => Number.isFinite(scoresByStudent[student]?.[index]))
  ).length;
}

export default function FabtechGradingPracticeV2({
  students,
  scoresByStudent,
  onScore,
  onToday,
}: {
  students: string[];
  scoresByStudent: Record<string, number[]>;
  onScore: (student: string, criterionIndex: number, points: number) => void;
  onToday: () => void;
}) {
  const [student, setStudent] = useState(students[0] ?? '');
  const scores = scoresByStudent[student] ?? [];
  const scored = DEMO_RUBRIC_CRITERIA.filter((_, index) => Number.isFinite(scores[index])).length;
  const total = DEMO_RUBRIC_CRITERIA.reduce((sum, _, index) => sum + (scores[index] ?? 0), 0);
  const finished = scored === DEMO_RUBRIC_CRITERIA.length;
  const completedStudents = scoredSampleCount(scoresByStudent, students);

  return (
    <section className={styles.gradePage} aria-label="Practice grading tower">
      <div className={styles.gradeHeader}>
        <div>
          <span className={styles.sectionLabel}>Grade Tower · UI exercise</span>
          <h2>Shop Performance Scoring</h2>
          <p>This is an interactive sample rubric. It does not change the live gradebook, qualification decisions, or student records.</p>
        </div>
        <button type="button" className={styles.secondaryAction} onClick={onToday}>Back to Today</button>
      </div>

      <div className={styles.gradeSummary} role="status">
        <strong>{completedStudents} / {students.length} sample students fully scored</strong>
        <span>Five criteria. Maximum practice score 95 points.</span>
      </div>

      <div className={styles.gradeStudentChooser}>
        <label className={styles.noteLabel}>
          Choose a sample student
          <select value={student} onChange={(event) => setStudent(event.target.value)}>
            {students.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>
      </div>

      <div className={styles.rubricRows}>
        {DEMO_RUBRIC_CRITERIA.map((name, index) => (
          <div className={styles.rubricRow} key={name}>
            <div><strong>{index + 1}. {name}</strong><small>Max 19 of 19 points</small></div>
            <label>
              <span className={styles.visuallyHidden}>{name} rating</span>
              <select
                aria-label={name + ' points'}
                value={Number.isFinite(scores[index]) ? scores[index] : ''}
                onChange={(event) => {
                  if (event.target.value !== '') onScore(student, index, Number(event.target.value));
                }}
              >
                <option value="">Not rated</option>
                <option value="0">0 · Not demonstrated</option>
                <option value="10">10 · Needs improvement</option>
                <option value="15">15 · Developing</option>
                <option value="19">19 · Meets example standard</option>
              </select>
            </label>
          </div>
        ))}
      </div>

      <div className={styles.gradeSummary}>
        <strong>{finished ? total + ' / 95' : scored + ' / 5 criteria rated'}</strong>
        <span>{finished ? 'Sample scoring complete. Select another student or return to the lesson.' : 'Finish each criterion to view the sample score.'}</span>
      </div>
      <p className={styles.quiet}>This rubric tests navigation and data entry ergonomics only. It is not the actual approved WLD 110 rubric or a replacement for its safety gates.</p>
    </section>
  );
}
