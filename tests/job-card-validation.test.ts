import { describe, expect, it } from 'vitest';
import {
  correctionIsRequired,
  makeRequirementRows,
  validateInstructorJobSetup,
  validateStudentJobCard,
} from '../lib/job-card-validation';

const requirements = [
  { key: 'r1', label: 'Machine setting / welding variable', required: '115–165 A' },
  { key: 'r2', label: 'Fit-up / root opening / bevel', required: '1/8 in' },
];

const header = {
  jobPlannerDay: 'Job 1 / Day 1',
  drawingRevision: 'N/A',
  wpsSwps: 'AWS B2.1 example',
  processPosition: 'SMAW / 3G',
  materialJoint: 'Carbon steel / groove',
};

describe('Live Job Card validation', () => {
  it('creates no more than four requirement rows', () => {
    expect(makeRequirementRows(['a', 'b', 'c', 'd', 'e'])).toHaveLength(4);
  });

  it('enforces the welding lab/class capacity of 17', () => {
    expect(validateInstructorJobSetup({ header, requirements, expectedStudents: 17 })).toBeNull();
    expect(validateInstructorJobSetup({ header, requirements, expectedStudents: 18 })).toContain('17');
  });

  it('requires every applicable student actual value', () => {
    const result = validateStudentJobCard({
      requirements,
      actualValues: { r1: '128 A', r2: '' },
      requirementChecks: { r1: 'pass', r2: 'pass' },
      startChecks: ['PPE ready'],
      startConfirmations: { 'PPE ready': true },
      qualityChecks: ['Visual acceptable'],
      qualityConfirmations: { 'Visual acceptable': true },
      issueFound: '',
      correction: '',
      recheckStatus: '',
    });
    expect(result).toContain('actual value');
  });

  it('allows N/A without an actual value', () => {
    const result = validateStudentJobCard({
      requirements,
      actualValues: { r1: '128 A', r2: '' },
      requirementChecks: { r1: 'pass', r2: 'na' },
      startChecks: ['PPE ready'],
      startConfirmations: { 'PPE ready': true },
      qualityChecks: ['Visual acceptable'],
      qualityConfirmations: { 'Visual acceptable': true },
      issueFound: '',
      correction: '',
      recheckStatus: '',
    });
    expect(result).toBeNull();
  });

  it('requires issue, correction and recheck after Correct is selected', () => {
    expect(correctionIsRequired({ r1: 'correct', r2: 'pass' })).toBe(true);
    const result = validateStudentJobCard({
      requirements,
      actualValues: { r1: '128 A', r2: '1/8 in' },
      requirementChecks: { r1: 'correct', r2: 'pass' },
      startChecks: ['PPE ready'],
      startConfirmations: { 'PPE ready': true },
      qualityChecks: ['Visual acceptable'],
      qualityConfirmations: { 'Visual acceptable': true },
      issueFound: '',
      correction: '',
      recheckStatus: '',
    });
    expect(result).toContain('issue and correction');
  });

  it('accepts a corrected job after a recorded recheck', () => {
    const result = validateStudentJobCard({
      requirements,
      actualValues: { r1: '128 A', r2: '1/8 in' },
      requirementChecks: { r1: 'correct', r2: 'pass' },
      startChecks: ['PPE ready'],
      startConfirmations: { 'PPE ready': true },
      qualityChecks: ['Visual acceptable'],
      qualityConfirmations: { 'Visual acceptable': true },
      issueFound: 'Root opening was wide',
      correction: 'Reset fit-up to 1/8 in',
      recheckStatus: 'pass',
    });
    expect(result).toBeNull();
  });
});
