export const GRADE_CATEGORY_OPTIONS = [
  { value: 'practice_only', label: 'Practice Only', counts: false },
  { value: 'test', label: 'Test', counts: true },
  { value: 'quiz', label: 'Quiz', counts: true },
  { value: 'task', label: 'Task', counts: true },
  { value: 'activity', label: 'Activity', counts: true },
  { value: 'practical', label: 'Practical', counts: true },
  { value: 'competency', label: 'Competency Evidence', counts: false },
] as const;

export const COUNTED_GRADE_CATEGORIES = ['test', 'quiz', 'task', 'activity', 'practical'] as const;

export type CountedGradeCategory = (typeof COUNTED_GRADE_CATEGORIES)[number];
export type GradeCategory = (typeof GRADE_CATEGORY_OPTIONS)[number]['value'];
export type GradeWeights = Partial<Record<CountedGradeCategory, number>>;

export type GradeableSubmission = {
  grade_category: GradeCategory;
  counts_toward_grade: boolean;
  percent: number;
};

export function normalizeExternalStudentId(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase();
}

export function gradebookStudentKey(
  attendanceStudentId: string | null | undefined,
  externalStudentId: string | null | undefined
) {
  if (attendanceStudentId) return `roster:${attendanceStudentId}`;
  const normalized = normalizeExternalStudentId(externalStudentId);
  return normalized ? `external:${normalized}` : 'external:unknown';
}

export function meanPercent(values: number[]) {
  if (!values.length) return null;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
}

export function categoryAverages(submissions: GradeableSubmission[]) {
  const result: Partial<Record<CountedGradeCategory, number>> = {};

  for (const category of COUNTED_GRADE_CATEGORIES) {
    const values = submissions
      .filter((item) => item.counts_toward_grade && item.grade_category === category)
      .map((item) => Number(item.percent))
      .filter(Number.isFinite);
    const average = meanPercent(values);
    if (average !== null) result[category] = average;
  }

  return result;
}

export function unweightedGradeAverage(submissions: GradeableSubmission[]) {
  return meanPercent(
    submissions
      .filter((item) => item.counts_toward_grade)
      .map((item) => Number(item.percent))
      .filter(Number.isFinite)
  );
}

export function gradeWeightTotal(weights: GradeWeights) {
  return COUNTED_GRADE_CATEGORIES.reduce((sum, category) => sum + Number(weights[category] ?? 0), 0);
}

export function currentWeightedAverage(
  averages: Partial<Record<CountedGradeCategory, number>>,
  weights: GradeWeights
) {
  if (Math.round(gradeWeightTotal(weights) * 100) / 100 !== 100) return null;

  let weightedPoints = 0;
  let usedWeight = 0;

  for (const category of COUNTED_GRADE_CATEGORIES) {
    const weight = Number(weights[category] ?? 0);
    const average = averages[category];
    if (weight > 0 && average !== undefined && Number.isFinite(average)) {
      weightedPoints += average * weight;
      usedWeight += weight;
    }
  }

  if (!usedWeight) return null;
  return Math.round((weightedPoints / usedWeight) * 10) / 10;
}

export function gradeCategoryLabel(category: GradeCategory) {
  return GRADE_CATEGORY_OPTIONS.find((option) => option.value === category)?.label ?? category;
}
