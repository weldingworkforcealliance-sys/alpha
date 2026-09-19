-- Provision only after approval. Credentials are a separate secure handoff.
-- NOLOGIN means this role cannot connect until its password is installed securely.
-- Preserve service workers while preventing a new SQL reader from invoking
-- background mutations through inherited PUBLIC function permissions.
revoke execute on function public.claim_due_class_watchdog_reminders(integer) from public,anon,authenticated;
revoke execute on function public.enqueue_class_watchdog_reminders(timestamptz) from public,anon,authenticated;
revoke execute on function public.run_class_end_of_day_cleanup(timestamptz) from public,anon,authenticated;
grant execute on function public.claim_due_class_watchdog_reminders(integer),public.enqueue_class_watchdog_reminders(timestamptz),public.run_class_end_of_day_cleanup(timestamptz) to service_role;
create role ltg_archive_reader nologin noinherit nosuperuser nocreatedb nocreaterole noreplication bypassrls;
alter role ltg_archive_reader set default_transaction_read_only = on;
alter role ltg_archive_reader set statement_timeout = '60s';
grant connect on database postgres to ltg_archive_reader;
grant usage on schema public,certificate_private,storage to ltg_archive_reader;
grant select on public.schools,
 public.attendance_students,
 public.attendance_pair_enrollments,
 public.attendance_pairs,
 public.attendance_sessions,
 public.attendance_records,
 public.sections,
 public.gradebooks,
 public.gradebook_students,
 public.gradebook_categories,
 public.gradebook_statuses,
 public.gradebook_items,
 public.gradebook_attempts,
 public.gradebook_revisions,
 public.gradebook_finalizations,
 public.wld110_shop_progress,
 public.wld110_shop_attempts,
 public.wld110_shop_completions,
 public.tower_student_ids,
 public.tower_records,
 public.tower_history,
 public.tower_grade_links,
 public.tower_permanent_tests,
 public.tower_certificates,
 public.classroom_sessions,
 public.classroom_submissions,
 public.job_card_sessions,
 public.job_card_submissions,
 public.academic_terms,
 public.cohorts,
 public.courses,
 public.programs,
 public.program_levels,
 public.program_semesters,
 public.gradebook_course_pairs,
 public.tower_assignments,
 public.job_card_templates,
 public.assessment_modules,
 public.assessment_questions,
 public.assessment_reference_assets,
 public.audit_log,
 public.course_curriculum,
 public.course_outcomes,
 public.course_guides,
 public.course_guide_days,
 public.course_guide_day_resources,
 public.course_guide_day_outcomes,
 public.course_guide_day_segments,
 public.course_guide_day_math,
 public.course_guide_day_math_segments,
 public.program_level_courses,
 public.instructional_blocks,
 public.school_branding to ltg_archive_reader;
grant select on certificate_private.templates,storage.objects to ltg_archive_reader;
-- No default privileges: a new table must be reviewed before the reader can access it.
-- No authentication tables, passwords, production write grants or function grants.

