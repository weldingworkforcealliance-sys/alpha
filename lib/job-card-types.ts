export type JobCardRequirementStatus = 'pass' | 'correct' | 'na';
export type JobCardReviewDecision = 'accepted' | 'correction_required';
export type JobCardEvidenceType = 'photo' | 'measurement' | 'inspection_test_result' | 'none';

export type JobCardRequirementInput = {
  key: string;
  label: string;
  requiredValue: string;
};

export type JobCardStudentRequirement = JobCardRequirementInput & {
  actualValue: string;
  status: JobCardRequirementStatus;
  issue: string;
  correction: string;
  recheck: string;
};

export type JobCardStartCheck = {
  drawingReviewed: boolean;
  procedureReviewed: boolean;
  materialJointVerified: boolean;
};

export type JobCardQualityCheck = {
  requirementsChecked: boolean;
  correctionsRecorded: boolean;
  readyForInstructor: boolean;
};

export type JobCardSession = {
  id: string;
  school_id: string;
  section_id: string;
  guide_day_id: string | null;
  planner_day_number: number | null;
  instructor_id: string;
  join_code: string;
  status: 'active' | 'ended' | 'expired';
  expected_students: number;
  job_title: string;
  drawing_ref: string | null;
  drawing_revision: string | null;
  wps_swps_ref: string | null;
  process: string | null;
  position: string | null;
  material_joint: string | null;
  requirements: JobCardRequirementInput[];
  started_at: string;
  expires_at: string;
  ended_at: string | null;
};

export type JobCardPublicSession = {
  sessionId: string;
  joinCode: string;
  status: string;
  expiresAt: string;
  sectionLabel: string;
  jobTitle: string;
  plannerDayNumber: number | null;
  drawingRef: string | null;
  drawingRevision: string | null;
  wpsSwpsRef: string | null;
  process: string | null;
  position: string | null;
  materialJoint: string | null;
  requirements: JobCardRequirementInput[];
};

export type JobCardSubmission = {
  id: string;
  job_card_session_id: string;
  student_name: string;
  student_id: string;
  start_check: JobCardStartCheck;
  quality_check: JobCardQualityCheck;
  requirement_results: JobCardStudentRequirement[];
  evidence_type: JobCardEvidenceType;
  evidence_note: string | null;
  submitted_at: string;
  review_decision: JobCardReviewDecision | null;
  review_notes: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
};
