import { describe, expect, it } from 'vitest';
import {
  categoryAverages,
  currentWeightedAverage,
  gradeWeightTotal,
  gradebookStudentKey,
  unweightedGradeAverage,
} from '../lib/gradebook';

describe('gradebook calculations', () => {
  const submissions = [
    { grade_category: 'test' as const, counts_toward_grade: true, percent: 80 },
    { grade_category: 'test' as const, counts_toward_grade: true, percent: 90 },
    { grade_category: 'task' as const, counts_toward_grade: true, percent: 100 },
    { grade_category: 'practice_only' as const, counts_toward_grade: false, percent: 20 },
  ];

  it('averages counted items by grade category and ignores practice', () => {
    expect(categoryAverages(submissions)).toEqual({ test: 85, task: 100 });
    expect(unweightedGradeAverage(submissions)).toBe(90);
  });

  it('computes a current weighted grade using only categories that have evidence', () => {
    const weights = { test: 50, task: 30, activity: 20 };
    expect(gradeWeightTotal(weights)).toBe(100);
    expect(currentWeightedAverage(categoryAverages(submissions), weights)).toBe(90.6);
  });

  it('does not produce an official weighted grade until weights total 100', () => {
    expect(currentWeightedAverage(categoryAverages(submissions), { test: 40 })).toBeNull();
  });

  it('prefers the canonical attendance student id over typed student id text', () => {
    expect(gradebookStudentKey('student-uuid', ' 2001756 ')).toBe('roster:student-uuid');
    expect(gradebookStudentKey(null, ' AbC123 ')).toBe('external:abc123');
  });
});
