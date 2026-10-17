// Keep the dashboard query and guidance display in step so existing curriculum
// notes are not lost when instructors switch from the detailed planner.
export const TEACHER_GUIDANCE_FIELDS = [
  ['instructor_prep', 'Before Class'],
  ['materials_equipment', 'Materials & Equipment'],
  ['safety_focus', 'Safety Focus'],
  ['opening_review', 'Opening Review'],
  ['demonstration', 'Demonstration'],
  ['guided_practice', 'Guided Practice'],
  ['independent_practice', 'Independent Practice'],
  ['instructor_checks', 'Instructor Checks'],
  ['assessment', 'Assessment'],
  ['common_problems', 'Common Problems'],
  ['teaching_tips', 'Teaching Tips'],
  ['weekly_coaching_focus', 'Weekly Coaching Focus'],
  ['coaching_focus', 'Instructor Coaching'],
  ['if_students_struggle', 'If Students Struggle'],
  ['keep_momentum', 'Keep Momentum'],
  ['corresponding_application', 'Paired-Course Coordination'],
  ['evidence_check_for_understanding', 'Evidence / Check for Understanding'],
  ['record_link_expectation', 'After Class'],
  ['aws_alignment', 'AWS Alignment'],
  ['aws_key_indicators', 'AWS Key Indicators'],
  ['safety_gate', 'Safety Gate'],
  ['procedure_variable_focus', 'Procedure Variables'],
  ['evidence_type', 'Evidence to Collect'],
  ['inspection_acceptance_focus', 'Inspection / Acceptance'],
  ['focused_retry', 'Focused Retry'],
  ['qualification_guardrail', 'Qualification Guardrail'],
] as const;

export type TeacherGuidance = Partial<Record<typeof TEACHER_GUIDANCE_FIELDS[number][0], string | null>>;

export const TEACHING_GUIDE_DAY_SELECT = [
  'id', 'guide_id', 'planner_day_number', 'title', 'objective',
  ...TEACHER_GUIDANCE_FIELDS.map(([key]) => key),
].join(',');
