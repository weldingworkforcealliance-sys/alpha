import { getSupabase } from './supabase-browser';

type BrowserSupabaseClient = ReturnType<typeof getSupabase>;

export type ClassroomSession = {
  id: string;
  join_code: string;
  status: string;
  started_at: string;
  expires_at: string;
  section_id: string;
  assessment_slug: string;
  expected_students: number;
};

export type ClassroomSubmission = {
  id: string;
  student_name: string;
  student_id: string;
  team_members: string | null;
  score: number;
  possible_score: number;
  submitted_at: string;
  domain_scores: Record<string, { correct: number; total: number }>;
};

const SESSION_FIELDS =
  'id,join_code,status,started_at,expires_at,section_id,assessment_slug,expected_students';

const SUBMISSION_FIELDS =
  'id,student_name,student_id,team_members,score,possible_score,submitted_at,domain_scores';

export async function expireClassroomSessions(supabase: BrowserSupabaseClient) {
  const { error } = await supabase.rpc('expire_classroom_sessions');
  if (error) throw error;
}

export async function findActiveClassroomSession(
  supabase: BrowserSupabaseClient,
  options: {
    sectionIds?: string[];
    sectionId?: string;
    assessmentSlug?: string;
  }
) {
  let query = supabase
    .from('classroom_sessions')
    .select(SESSION_FIELDS)
    .eq('status', 'active')
    .gt('expires_at', new Date().toISOString());

  if (options.sectionId) {
    query = query.eq('section_id', options.sectionId);
  } else if (options.sectionIds?.length) {
    query = query.in('section_id', options.sectionIds);
  }

  if (options.assessmentSlug) {
    query = query.eq('assessment_slug', options.assessmentSlug);
  }

  const { data, error } = await query
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return (data ?? null) as ClassroomSession | null;
}

export async function createClassroomSession(
  supabase: BrowserSupabaseClient,
  options: {
    sectionId: string;
    assessmentSlug: string;
    expectedStudents: number;
  }
) {
  const { data: sessionId, error: startError } = await supabase.rpc(
    'start_classroom_session_v2',
    {
      p_section_id: options.sectionId,
      p_assessment_slug: options.assessmentSlug,
      p_expected_students: options.expectedStudents,
    }
  );

  if (startError) throw startError;
  if (!sessionId) throw new Error('The classroom session was not created.');

  const { data, error } = await supabase
    .from('classroom_sessions')
    .select(SESSION_FIELDS)
    .eq('id', sessionId)
    .single();

  if (error) throw error;

  const session = data as ClassroomSession;
  if (
    session.section_id !== options.sectionId ||
    session.assessment_slug !== options.assessmentSlug
  ) {
    throw new Error('The created classroom session did not match the requested class and assessment.');
  }

  return session;
}

export async function endClassroomSession(
  supabase: BrowserSupabaseClient,
  sessionId: string
) {
  const { error } = await supabase.rpc('end_classroom_session', {
    p_session_id: sessionId,
  });
  if (error) throw error;
}

export async function loadClassroomSubmissions(
  supabase: BrowserSupabaseClient,
  sessionId: string
) {
  const { data, error } = await supabase
    .from('classroom_submissions')
    .select(SUBMISSION_FIELDS)
    .eq('classroom_session_id', sessionId)
    .order('submitted_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as ClassroomSubmission[];
}

export function subscribeClassroomSubmissions(
  supabase: BrowserSupabaseClient,
  sessionId: string,
  onSubmission: () => void,
  channelPrefix = 'classroom'
) {
  const channel = supabase
    .channel(`${channelPrefix}-${sessionId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'classroom_submissions',
        filter: `classroom_session_id=eq.${sessionId}`,
      },
      onSubmission
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
