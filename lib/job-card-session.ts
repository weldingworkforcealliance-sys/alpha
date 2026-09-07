import { getSupabase } from './supabase-browser';
import type {
  JobCardDecision,
  JobCardHeader,
  JobCardRequirement,
  JobCardSession,
  JobCardSubmission,
  JobCardTemplate,
} from './job-card-types';

type BrowserSupabaseClient = ReturnType<typeof getSupabase>;

const SESSION_FIELDS =
  'id,school_id,section_id,instructor_id,template_slug,guide_day_id,join_code,status,expected_students,job_header,requirements,start_checks,quality_checks,started_at,ended_at,expires_at';
const SUBMISSION_FIELDS =
  'id,job_card_session_id,student_name,student_id,actual_values,requirement_checks,start_check_confirmations,quality_check_confirmations,issue_found,correction,recheck_status,evidence_types,evidence_note,submitted_at,final_decision,instructor_note,reviewed_by,reviewed_at';

export async function listJobCardTemplates(supabase: BrowserSupabaseClient) {
  const { data, error } = await supabase.rpc('list_job_card_templates');
  if (error) throw error;
  return (data ?? []) as JobCardTemplate[];
}

export async function expireJobCardSessions(supabase: BrowserSupabaseClient) {
  const { error } = await supabase.rpc('expire_job_card_sessions');
  if (error) throw error;
}

export async function findActiveJobCardSession(
  supabase: BrowserSupabaseClient,
  options: { sectionId: string; templateSlug?: string }
) {
  let query = supabase
    .from('job_card_sessions')
    .select(SESSION_FIELDS)
    .eq('section_id', options.sectionId)
    .eq('status', 'active')
    .gt('expires_at', new Date().toISOString());

  if (options.templateSlug) query = query.eq('template_slug', options.templateSlug);

  const { data, error } = await query
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as JobCardSession | null;
}

export async function startJobCardSession(
  supabase: BrowserSupabaseClient,
  options: {
    sectionId: string;
    templateSlug: string;
    jobHeader: JobCardHeader;
    requirements: JobCardRequirement[];
    expectedStudents: number;
    guideDayId?: string | null;
  }
) {
  const { data: sessionId, error: startError } = await supabase.rpc('start_job_card_session', {
    p_section_id: options.sectionId,
    p_template_slug: options.templateSlug,
    p_job_header: options.jobHeader,
    p_requirements: options.requirements,
    p_expected_students: options.expectedStudents,
    p_guide_day_id: options.guideDayId ?? null,
  });
  if (startError) throw startError;
  if (!sessionId) throw new Error('The Live Job Card session was not created.');

  const { data, error } = await supabase
    .from('job_card_sessions')
    .select(SESSION_FIELDS)
    .eq('id', sessionId)
    .single();
  if (error) throw error;

  const session = data as JobCardSession;
  if (session.section_id !== options.sectionId || session.template_slug !== options.templateSlug) {
    throw new Error('The created job card session did not match the requested class and template.');
  }
  return session;
}

export async function endJobCardSession(
  supabase: BrowserSupabaseClient,
  sessionId: string
) {
  const { error } = await supabase.rpc('end_job_card_session', { p_session_id: sessionId });
  if (error) throw error;
}

export async function loadJobCardSubmissions(
  supabase: BrowserSupabaseClient,
  sessionId: string
) {
  const { data, error } = await supabase
    .from('job_card_submissions')
    .select(SUBMISSION_FIELDS)
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

export async function reviewJobCardSubmission(
  supabase: BrowserSupabaseClient,
  options: { submissionId: string; decision: JobCardDecision; instructorNote: string }
) {
  const { error } = await supabase.rpc('review_job_card_submission', {
    p_submission_id: options.submissionId,
    p_final_decision: options.decision,
    p_instructor_note: options.instructorNote,
  });
  if (error) throw error;
}
