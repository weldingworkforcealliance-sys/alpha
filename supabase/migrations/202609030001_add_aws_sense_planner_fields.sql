-- AWS SENSE Level I planner alignment fields.
-- These fields are supplemental implementation metadata only.
-- Protected course curriculum and approved outcomes remain unchanged.

alter table public.course_guide_days
  add column if not exists aws_alignment text,
  add column if not exists aws_key_indicators text,
  add column if not exists safety_gate text,
  add column if not exists procedure_variable_focus text,
  add column if not exists evidence_type text,
  add column if not exists inspection_acceptance_focus text,
  add column if not exists focused_retry text,
  add column if not exists record_link_expectation text,
  add column if not exists qualification_guardrail text;

comment on column public.course_guide_days.aws_alignment is
  'Supplemental AWS SENSE Level I module alignment. Does not replace protected course outcomes.';
comment on column public.course_guide_days.aws_key_indicators is
  'Relevant AWS EG2.0 Level I key-indicator summary for the planner day.';
comment on column public.course_guide_days.safety_gate is
  'Safety-clearance state or procedure-specific daily safety control.';
comment on column public.course_guide_days.procedure_variable_focus is
  'Procedure/WPS/SWPS variables students should verify for the day.';
comment on column public.course_guide_days.evidence_type is
  'Evidence shorthand: K knowledge, I instructor observation, V visual inspection, P course performance checkpoint, D documentation, Q formal qualification only when applicable.';
comment on column public.course_guide_days.inspection_acceptance_focus is
  'Inspection or acceptance evidence emphasized for the day.';
comment on column public.course_guide_days.focused_retry is
  'Specific remediation path when the student does not meet the current evidence target.';
comment on column public.course_guide_days.record_link_expectation is
  'Evidence or record the instructor should retain or link in LTG.';
comment on column public.course_guide_days.qualification_guardrail is
  'Prevents ordinary course evidence from being mislabeled as AWS SENSE qualification.';
