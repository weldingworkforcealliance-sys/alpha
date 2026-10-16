-- Read-only staging release check: an empty result means all required grading RPCs exist with instructor access.
WITH required(name) AS (VALUES
  ('ensure_wld105_gradebook_setup'),
  ('refresh_gradebook'),
  ('get_wld105_grade_tower'),
  ('get_wld105_homework_status'),
  ('record_wld105_homework_status'),
  ('record_wld105_fabrication_grade'),
  ('open_tower'),
  ('create_tower_assignment'),
  ('save_tower_student'),
  ('certificate_template_for_test'),
  ('preview_gradebook_final'),
  ('finalize_gradebook_student'),
  ('correct_gradebook_attempt'),
  ('open_lab_coaching'),
  ('issue_lab_student_link'),
  ('save_lab_coaching'),
  ('mark_lab_check_handled'),
  ('read_lab_student'),
  ('request_lab_check'),
  ('read_wld110_student'),
  ('request_wld110_check'),
  ('open_wld110_shop'),
  ('decide_wld110_weld'),
  ('coach_wld110_practice'),
  ('issue_wld110_student_link'),
  ('configure_gradebook'),
  ('create_gradebook_item'),
  ('record_gradebook_attempt')
)
SELECT r.name AS missing_or_unavailable_function FROM required r
WHERE NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname=r.name AND has_function_privilege('authenticated',p.oid,'EXECUTE'));

