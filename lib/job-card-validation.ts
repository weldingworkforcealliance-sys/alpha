import { MAX_WELDING_CLASS_CAPACITY } from './program-constraints';
import type {
  JobCardQualityCheck,
  JobCardRequirementInput,
  JobCardStartCheck,
  JobCardStudentRequirement,
} from './job-card-types';

export const JOB_CARD_MAX_REQUIREMENTS = 4;

export function validateExpectedStudents(value: number) {
  if (!Number.isInteger(value) || value < 1 || value > MAX_WELDING_CLASS_CAPACITY) {
    return `Expected students must be between 1 and ${MAX_WELDING_CLASS_CAPACITY}.`;
  }
  return null;
}

export function normalizeRequirements(requirements: JobCardRequirementInput[]) {
  return requirements
    .map((item, index) => ({
      key: item.key.trim() || `requirement_${index + 1}`,
      label: item.label.trim(),
      requiredValue: item.requiredValue.trim(),
    }))
    .filter((item) => item.label && item.requiredValue)
    .slice(0, JOB_CARD_MAX_REQUIREMENTS);
}

export function validateSessionRequirements(requirements: JobCardRequirementInput[]) {
  const normalized = normalizeRequirements(requirements);
  if (!normalized.length) return 'At least one critical job requirement is required.';
  if (requirements.filter((item) => item.label.trim() || item.requiredValue.trim()).length > JOB_CARD_MAX_REQUIREMENTS) {
    return `A Job Card can contain no more than ${JOB_CARD_MAX_REQUIREMENTS} critical requirements.`;
  }
  return null;
}

export function validateStartCheck(check: JobCardStartCheck) {
  return check.drawingReviewed && check.procedureReviewed && check.materialJointVerified
    ? null
    : 'Complete the Start Check before submitting.';
}

export function validateQualityCheck(check: JobCardQualityCheck) {
  return check.requirementsChecked && check.correctionsRecorded && check.readyForInstructor
    ? null
    : 'Complete the Quick Quality Check before submitting.';
}

export function validateStudentRequirement(item: JobCardStudentRequirement) {
  if (!item.label.trim() || !item.requiredValue.trim()) return 'Job requirement is incomplete.';
  if (item.status !== 'na' && !item.actualValue.trim()) {
    return `${item.label}: enter the Student Actual value or mark N/A.`;
  }
  if (item.status === 'correct') {
    if (!item.issue.trim()) return `${item.label}: describe the issue that required correction.`;
    if (!item.correction.trim()) return `${item.label}: record the correction made.`;
    if (!item.recheck.trim()) return `${item.label}: record the recheck result.`;
  }
  return null;
}

export function validateStudentRequirements(items: JobCardStudentRequirement[]) {
  for (const item of items) {
    const error = validateStudentRequirement(item);
    if (error) return error;
  }
  return null;
}
