-- Provision only after approval. Credentials are a separate secure handoff.
-- NOLOGIN means this role cannot connect until its password is installed securely.
create role ltg_archive_reader nologin noinherit nosuperuser nocreatedb nocreaterole noreplication bypassrls;
alter role ltg_archive_reader set default_transaction_read_only = on;
alter role ltg_archive_reader set statement_timeout = '60s';
grant connect on database postgres to ltg_archive_reader;
grant usage on schema public,certificate_private,storage to ltg_archive_reader;
grant select on public.schools,\n public.attendance_students,\n public.attendance_pair_enrollments,\n public.attendance_pairs,\n public.attendance_sessions,\n public.attendance_records,\n public.sections,\n public.gradebooks,\n public.gradebook_students,\n public.gradebook_categories,\n public.gradebook_statuses,\n public.gradebook_items,\n public.gradebook_attempts,\n public.gradebook_revisions,\n public.gradebook_finalizations,\n public.tower_student_ids,\n public.tower_records,\n public.tower_history,\n public.tower_grade_links,\n public.tower_permanent_tests,\n public.tower_certificates,\n public.classroom_sessions,\n public.classroom_submissions,\n public.job_card_sessions,\n public.job_card_submissions,\n public.academic_terms,\n public.cohorts,\n public.courses,\n public.programs,\n public.program_levels,\n public.program_semesters,\n public.gradebook_course_pairs,\n public.tower_assignments,\n public.job_card_templates,\n public.assessment_modules,\n public.assessment_questions,\n public.assessment_reference_assets,\n public.audit_log,\n public.course_curriculum,\n public.course_outcomes,\n public.course_guides,\n public.course_guide_days,\n public.course_guide_day_resources,\n public.course_guide_day_outcomes,\n public.course_guide_day_segments,\n public.course_guide_day_math,\n public.course_guide_day_math_segments,\n public.program_level_courses,\n public.instructional_blocks,\n public.school_branding to ltg_archive_reader;
grant select on certificate_private.templates,storage.objects to ltg_archive_reader;
-- No default privileges: a new table must be reviewed before the reader can access it.
-- No authentication tables, passwords, production write grants or function grants.

