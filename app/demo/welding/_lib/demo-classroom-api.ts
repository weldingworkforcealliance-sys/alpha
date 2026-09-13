'use client';

import { getSupabase } from '@/lib/supabase-browser';

export type DemoClassroomSession = {
  session_id: string;
  join_code: string;
  activity_key: string;
  title: string;
  course_code: string;
  day_number: number;
  created_at?: string;
  last_activity_at?: string;
  expires_at?: string;
  question_count?: number;
};

export type DemoClassroomQuestion = {
  key: string;
  number: number;
  type: 'mc' | 'text';
  text: string;
  domain: string;
  options: Record<string, string> | null;
};

export type DemoAssessmentPayload = {
  session: DemoClassroomSession;
  questions: DemoClassroomQuestion[];
};

export type DemoParticipant = {
  student_name: string;
  connected_at: string;
  last_seen_at: string;
};

export type DemoSubmissionSummary = {
  submission_id: string;
  student_name: string;
  score: number;
  possible_score: number;
  percent: number;
  domain_scores: Record<string, { correct: number; total: number }>;
  submitted_at: string;
};

export type DemoResultsPayload = {
  session: DemoClassroomSession;
  participants: DemoParticipant[];
  submissions: DemoSubmissionSummary[];
};

export type DemoSubmissionQuestion = {
  key: string;
  number: number;
  domain: string;
  text: string;
  options: Record<string, string> | null;
  student_answer: string;
  correct_answer: string;
  is_correct: boolean;
  explanation: string | null;
};

export type DemoSubmissionReport = {
  submission: DemoSubmissionSummary & { id: string; assessment_title: string };
  questions: DemoSubmissionQuestion[];
};

type CreateResult = {
  session_id: string;
  instructor_token: string;
  join_code: string;
  expires_in_minutes: number;
};

async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await getSupabase().rpc(name, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export function createDemoClassroomSession(input: {
  activityKey: string;
  title: string;
  courseCode: string;
  dayNumber: number;
}) {
  return rpc<CreateResult>('create_demo_classroom_session', {
    p_activity_key: input.activityKey,
    p_title: input.title,
    p_course_code: input.courseCode,
    p_day_number: input.dayNumber,
  });
}

export function getDemoClassroomAssessment(joinCode: string) {
  return rpc<DemoAssessmentPayload>('get_demo_classroom_assessment', {
    p_join_code: joinCode,
  });
}

export function connectDemoClassroomStudent(joinCode: string, studentName: string) {
  return rpc<{ session_id: string; connected: boolean }>('connect_demo_classroom_student', {
    p_join_code: joinCode,
    p_student_name: studentName,
  });
}

export function submitDemoClassroomAssessment(joinCode: string, studentName: string, answers: Record<string, string>) {
  return rpc<{ score: number; possible_score: number; percent: number }>('submit_demo_classroom_assessment', {
    p_join_code: joinCode,
    p_student_name: studentName,
    p_answers: answers,
  });
}

export function getDemoClassroomResults(sessionId: string, instructorToken: string) {
  return rpc<DemoResultsPayload>('get_demo_classroom_results', {
    p_session_id: sessionId,
    p_instructor_token: instructorToken,
  });
}

export function getDemoClassroomSubmissionReport(submissionId: string, instructorToken: string) {
  return rpc<DemoSubmissionReport>('get_demo_classroom_submission_report', {
    p_submission_id: submissionId,
    p_instructor_token: instructorToken,
  });
}

export function endDemoClassroomSession(sessionId: string, instructorToken: string) {
  return rpc<boolean>('end_demo_classroom_session', {
    p_session_id: sessionId,
    p_instructor_token: instructorToken,
  });
}
