export type JobCardTemplate = {
  slug: string;
  title: string;
  description: string | null;
  estimated_student_minutes: number;
  default_requirement_labels: string[];
  start_checks: string[];
  quality_checks: string[];
  version: number;
};

export type JobCardRequirement = {
  key: string;
  label: string;
  required: string;
};

export type JobCardHeader = {
  jobPlannerDay: string;
  drawingRevision: string;
  wpsSwps: string;
  processPosition: string;
  materialJoint: string;
};

export type JobCardSession = {
  id: string;
  school_id: string;
  section_id: string;
  instructor_id: string;
  template_slug: string;
  guide_day_id: string | null;
  join_code: string;
  status: 'active' | 'ended';
  expected_students: number;
  job_header: JobCardHeader;
  requirements: JobCardRequirement[];
  start_checks: string[];
  quality_checks: string[];
  started_at: string;
  ended_at: string | null;
  expires_at: string;
};

export type RequirementCheck = 'pass' | 'correct' | 'na';
export type RecheckStatus = 'pass' | 'needs_more_work';
export type JobCardDecision = 'pass_move_on' | 'continue_practice' | 'rework_retry';
export type JobCardEvidenceType = 'photo' | 'measurement' | 'inspection_test_result';

export type JobCardSubmission = {
  id: string;
  job_card_session_id: string;
  student_name: string;
  student_id: string;
  actual_values: Record<string, string>;
  requirement_checks: Record<string, RequirementCheck>;
  start_check_confirmations: Record<string, boolean>;
  quality_check_confirmations: Record<string, boolean>;
  issue_found: string | null;
  correction: string | null;
  recheck_status: RecheckStatus | null;
  evidence_types: JobCardEvidenceType[];
  evidence_note: string | null;
  submitted_at: string;
  final_decision: JobCardDecision | null;
  instructor_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
};

export type StudentJobCardPayload = {
  session: {
    session_id: string;
    template_title: string;
    expected_students: number;
    class_label: string;
    started_at: string;
    job_header: JobCardHeader;
    requirements: JobCardRequirement[];
    start_checks: string[];
    quality_checks: string[];
    expires_at: string;
  };
};
