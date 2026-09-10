# Post-Hardening Verification — 2026-09-10

Live beta verification after the database hardening migration:

- authenticated -> build_training_report: denied
- authenticated -> queue_training_report_and_purge: denied
- authenticated -> recalculate_guide_day_times: denied
- authenticated -> recalculate_math_lesson_times: denied
- anon/authenticated -> sync_completed_day_instructor_note: denied
- service_role -> build_training_report: retained
- redundant attendance_sessions index: removed
- unique attendance_sessions pair/date index: retained
- redundant training_day_delivery index: removed
- unique training_day_delivery session/section/day index: retained
- expired active Connected Classroom rows after cleanup: 0
- expired active Training Mode rows after cleanup: 0

Supabase security advisor rerun confirmed the anonymous completion-note trigger warning was removed. The remaining anonymous SECURITY DEFINER warnings are the intentional student QR/code functions and should remain available unless the student-access architecture changes.
