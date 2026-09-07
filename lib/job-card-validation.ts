import type {
  JobCardHeader,
  JobCardRequirement,
  RequirementCheck,
  RecheckStatus,
} from './job-card-types';

export const JOB_CARD_MAX_REQUIREMENTS = 4;
export const JOB_CARD_MAX_STUDENTS = 17;

export function makeRequirementRows(labels: string[]): JobCardRequirement[] {
  return labels.slice(0, JOB_CARD_MAX_REQUIREMENTS).map((label, index) => ({
    key: `r${index + 1}`,
    label,
    required: '',
  }));
}

export function validateInstructorJobSetup(input: {
  header: JobCardHeader;
  requirements: JobCardRequirement[];
  expectedStudents: number;
}): string | null {
  if (!input.header.jobPlannerDay.trim()) return 'Enter the job number or planner day.';
  if (!input.header.wpsSwps.trim()) return 'Enter the WPS/SWPS identifier or N/A.';
  if (!input.header.processPosition.trim()) return 'Enter the process and position.';
  if (!input.header.materialJoint.trim()) return 'Enter the material and joint.';
  if (input.expectedStudents < 1 || input.expectedStudents > JOB_CARD_MAX_STUDENTS) {
    return `Expected students must be between 1 and ${JOB_CARD_MAX_STUDENTS}.`;
  }
  if (input.requirements.length < 1 || input.requirements.length > JOB_CARD_MAX_REQUIREMENTS) {
    return `Use between 1 and ${JOB_CARD_MAX_REQUIREMENTS} critical requirements.`;
  }
  for (const requirement of input.requirements) {
    if (!requirement.label.trim()) return 'Every critical requirement needs a label.';
    if (!requirement.required.trim()) return 'Every critical requirement needs a required value or N/A.';
  }
  return null;
}

export function correctionIsRequired(checks: Record<string, RequirementCheck>): boolean {
  return Object.values(checks).some((value) => value === 'correct');
}

export function validateStudentJobCard(input: {
  requirements: JobCardRequirement[];
  actualValues: Record<string, string>;
  requirementChecks: Record<string, RequirementCheck | undefined>;
  startChecks: string[];
  startConfirmations: Record<string, boolean>;
  qualityChecks: string[];
  qualityConfirmations: Record<string, boolean>;
  issueFound: string;
  correction: string;
  recheckStatus: RecheckStatus | '';
}): string | null {
  for (const requirement of input.requirements) {
    const check = input.requirementChecks[requirement.key];
    if (!check) return 'Mark each critical requirement Pass, Correct, or N/A.';
    if (check !== 'na' && !input.actualValues[requirement.key]?.trim()) {
      return 'Enter the actual value for every applicable critical requirement.';
    }
  }
  if (input.startChecks.some((check) => !input.startConfirmations[check])) {
    return 'Complete every Start Check before submitting.';
  }
  if (input.qualityChecks.some((check) => !input.qualityConfirmations[check])) {
    return 'Complete every Quick Quality Check before submitting.';
  }
  const checks = input.requirementChecks as Record<string, RequirementCheck>;
  if (correctionIsRequired(checks)) {
    if (input.issueFound.trim().length < 2 || input.correction.trim().length < 2) {
      return 'Describe the issue and correction when something needed correction.';
    }
    if (!input.recheckStatus) return 'Record the recheck result after a correction.';
  }
  return null;
}
