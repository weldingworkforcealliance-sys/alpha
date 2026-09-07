import { getSupabase } from './supabase-browser';
import type {
  JobCardPublicSession,
  JobCardRequirementInput,
  JobCardSubmission,
  JobCardStudentRequirement,
  JobCardStartCheck,
  JobCardQualityCheck,
  JobCardEvidenceType,
  JobCardReviewDecision,
  JobCardSession,
} from './job-card-types';

type BrowserSupabaseClient = ReturnType<typeof getSupabase>;

export async function startJobCardSession(
  supabase: BrowserSupabaseClient,
  input: {
    sectionId: string;
    guideDayId?: string | null;
    plannerDayNumber?: number | null;
    expectedStudents: number;
    jobTitle: string;
    drawingRef?: string | null;
    drawingRevision?: string | null;
    wpsSwpsRef?: string | null;
    process?: string | null;
    position?: string | null;
    materialJoint?: string | null;
    requirements: JobCardRequirementInput[];
  }
) {
  const { data, error } = await supabase.rpc('start_job_card_session', {
    p_section_id: input.sectionId,
    p_guide_day_id: input.guideDayId ?? null,
    p_planner_day_number: input.plannerDayNumber ?? null,
    p_expected_students: input.expectedStudents,
    p_job_title: input.jobTitle,
    p_drawing_ref: input.drawingRef ?? null,
    p_drawing_revision: input.drawingRevision ?? null,
    p_wps_swps_ref: input.wpsSwpsRef ?? null,
    p_process: input.process ?? null,
    p_position: input.position ?? null,
    p_material_joint: input.materialJoint ?? null,
    p_requirements: input.requirements,
  });
  if (error) throw error;
  if (!data) throw new Error('The Live Job Card session was not created.');
  return data as JobCardSession;
}

export async function findActiveJobCardSession(
  supabase: BrowserSupabaseClient,
  sectionId: string
) {
  const { data, error } = await supabase
    .from('job_card_sessions')
    .select('id,school_id,section_id,guide_day_id,planner_day_number,instructor_id,join_code,status,expected_students,job_title,drawing_ref,drawing_revision,wps_swps_ref,process,position,material_joint,requirements,started_at,expires_at,ended_at')
    .eq('section_id', sectionId)
    .eq('status', 'active')
    .gt('expires_at', new Date().toISOString())
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as JobCardSession | null;
}

export async function endJobCardSession(supabase: BrowserSupabaseClient, sessionId: string) {
  const { error } = await supabase.rpc('end_job_card_session', { p_session_id: sessionId });
  if (error) throw error;
}

export async function loadJobCardSubmissions(supabase: BrowserSupabaseClient, sessionId: string) {
  const { data, error } = await supabase
    .from('job_card_submissions')
    .select('id,job_card_session_id,student_name,student_id,start_check,quality_check,requirement_results,evidence_type,evidence_note,submitted_at,review_decision,review_notes,reviewed_at,reviewed_by')
    .eq('job_card_session_id', sessionId)
    .order('submitted_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as JobCardSubmission[];
}

export function subscribeJobCardSubmissions(
  supabase: BrowserSupabaseClient,
  sessionId: string,
  onChange: () => void
) {
  const channel = supabase
    .channel(`job-card-${sessionId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'job_card_submissions',
        filter: `job_card_session_id=eq.${sessionId}`,
      },
      onChange
    )
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}

export async function getJobCardByCode(
  supabase: BrowserSupabaseClient,
  code: string
) {
  const { data, error } = await supabase.rpc('get_job_card_by_code', {
    p_join_code: code.trim().toUpperCase(),
  });
  if (error) throw error;
  if (!data) throw new Error('This Live Job Card code is invalid or expired.');
  return data as JobCardPublicSession;
}

export async function submitJobCard(
  supabase: BrowserSupabaseClient,
  input: {
    joinCode: string;
    studentName: string;
    studentId: string;
    startCheck: JobCardStartCheck;
    qualityCheck: JobCardQualityCheck;
    requirementResults: JobCardStudentRequirement[];
    evidenceType: JobCardEvidenceType;
    evidenceNote?: string | null;
  }
) {
  const { data, error } = await supabase.rpc('submit_job_card', {
    p_join_code: input.joinCode.trim().toUpperCase(),
    p_student_name: input.studentName.trim(),
    p_student_id: input.studentId.trim(),
    p_start_check: input.startCheck,
    p_quality_check: input.qualityCheck,
    p_requirement_results: input.requirementResults,
    p_evidence_type: input.evidenceType,
    p_evidence_note: input.evidenceNote?.trim() || null,
  });
  if (error) throw error;
  return data as string;
}

export async function reviewJobCardSubmission(
  supabase: BrowserSupabaseClient,
  submissionId: string,
  decision: JobCardReviewDecision,
  notes: string
) {
  const { error } = await supabase.rpc('review_job_card_submission', {
    p_submission_id: submissionId,
    p_decision: decision,
    p_notes: notes.trim() || null,
  });
  if (error) throw error;
}
