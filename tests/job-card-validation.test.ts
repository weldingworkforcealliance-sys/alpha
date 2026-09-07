import { describe, expect, it } from 'vitest';
import {
  validateExpectedStudents,
  validateStudentRequirement,
} from '../lib/job-card-validation';

const baseRequirement = {
  key: 'amps',
  label: 'Amperage',
  requiredValue: '90-110 A',
  actualValue: '100 A',
  status: 'pass' as const,
  issue: '',
  correction: '',
  recheck: '',
};

describe('Live Job Card validation', () => {
  it('enforces the 17-student program capacity', () => {
    expect(validateExpectedStudents(17)).toBeNull();
    expect(validateExpectedStudents(18)).toContain('17');
  });

  it('allows a blank actual value only for N/A', () => {
    expect(validateStudentRequirement({ ...baseRequirement, actualValue: '', status: 'na' })).toBeNull();
    expect(validateStudentRequirement({ ...baseRequirement, actualValue: '', status: 'pass' })).toContain('Student Actual');
  });

  it('requires issue, correction, and recheck when Correct is selected', () => {
    expect(validateStudentRequirement({ ...baseRequirement, status: 'correct' })).toContain('issue');
    expect(validateStudentRequirement({ ...baseRequirement, status: 'correct', issue: 'Too high' })).toContain('correction');
    expect(validateStudentRequirement({ ...baseRequirement, status: 'correct', issue: 'Too high', correction: 'Reduced setting' })).toContain('recheck');
    expect(validateStudentRequirement({ ...baseRequirement, status: 'correct', issue: 'Too high', correction: 'Reduced setting', recheck: 'Verified at 100 A' })).toBeNull();
  });
});
