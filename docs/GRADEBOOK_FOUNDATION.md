# LTG gradebook foundation — implementation and rollout

## Production database rollout — September 17, 2026

All three gradebook migrations have been applied successfully to production (`qsmvgyyaemjmklceyikr`). Verified ten separate WLD gradebooks with Level I/II Semester 1 mappings. Initial authorized owner refresh imported all 20 existing student-linked theory submissions (6 PVHS B, 1 PVHS C, 13 PVHS A), with zero unresolved submissions and no lab imports. Active roster sizes per linked course are Night 11, PVHS B 6, PVHS C 7, PVHS A 4, and Day Level II 1 after the new enrollment, matching the enrollment source. Attendance and classroom submission routines were not changed. Netlify production and preview builds enable the gradebook via `NEXT_PUBLIC_GRADEBOOK_ENABLED=true`.

Implemented September 16, 2026 in the existing `living-teacher-planner` Next.js/Supabase checkout and ported onto production commit `dada3be39f48f30018d8a6e4349ebba87e35337e` for deployment September 17.

## Delivered

- Program and level reuse existing `programs` and `program_levels`; `program_semesters` adds a positive semester number with no upper limit. Curriculum semester is distinct from the delivery term already attached to each section.
- `gradebook_course_pairs` records theory/lab course relationships. The migration seeds Level I Semester 1 (WLD 105/110) and Level II Semester 1 (WLD 205/210) only where the existing school/program courses and levels match. Future semesters and pairs use manager-authorized RPCs, without new application code or invented course numbers.
- Every active section gets exactly one gradebook. Existing active sections are backfilled; section creation/activation initializes future gradebooks. Inactive books and historical records remain accessible to authorized staff.
- Existing student UUIDs and `attendance_pair_enrollments` are the enrollment authority. `gradebook_roster` reflects enrollment immediately; refresh retains roster membership snapshots and inactive students. This reuses identity/enrollment data only: attendance marks, sessions, reporting, timers, and payroll are not used for grades.
- The gradebook refresh imports classroom assessments only into a mapped theory section, using `student_uuid`. A source submission is imported once; separate sessions remain separate attempts. Scores are snapshots: later corrections are appended as revisions rather than rewriting an imported attempt. Unlinked or invalid source submissions are counted as unresolved rather than guessed or discarded.
- Categories and statuses are configurable per gradebook. Custom assessments and manual attempts are supported. Score validation distinguishes zero from missing/ungraded; correction reasons are required. Attempts and revisions cannot be overwritten or deleted through the gradebook API.
- `/gradebook` provides program, level, semester and section navigation; enrolled students, assessment attempts, correction/history controls, and linked course panels. Pair matching requires the same curriculum pair, cohort and term and a unique counterpart accessible to the user. Ambiguous/unavailable links are shown explicitly.
- No official final-grade arithmetic, category weights, retake selection policy, or lab rubrics have been invented. Linked panels never average theory and lab together.

## Migrations

Apply in this order:

1. `20260916173635_gradebook_foundation.sql`
2. `20260916174550_gradebook_catalog_management.sql`
3. `20260916175204_gradebook_current_enrollment_guard.sql`

These exact versions are applied to isolated Gltg staging (`ezlvivmeneefiiwqwgqd`). Production (`qsmvgyyaemjmklceyikr`, beta genco) recorded the same migration names/content under service-generated versions `20260917121337`, `20260917121349`, and `20260917121403`, respectively. Reconcile migration history before any future CLI database push; do not reapply these migrations under their local timestamps. Frontend deployment does not run database migrations.

The base migration creates nine tables, protected read views, narrowly authorized RPCs, and an initialization trigger on section insert/status activation. The second adds catalog-management RPCs, immediate roster reads, and academic mapping guards. The third rechecks current enrollment at manual-attempt insertion, preventing a stale open roster from accepting a new grade for a withdrawn student. Historical imports and corrections remain possible.

## Verification

- TypeScript and repository lint passed.
- Full Vitest suite passed: 53 files / 288 tests before the final pagination enhancement; the final gradebook suite passed all 5 tests, including 1,003 attempts across multiple API pages.
- Next.js production build with isolated staging configuration passed; `/gradebook` compiled successfully. Final build is recorded in the task results.
- `supabase/gradebook-integration-test.sql` passed against staging with synthetic data in one rolled-back transaction. Coverage includes automatic section books, immediate enrollment, Semester 4, idempotent imports, unknown identities, separate lab records, multiple attempts, custom statuses, revision history, invalid/cross-book scores, withdrawal preservation, stale-roster rejection, assigned/unassigned instructors, cross-school RLS, manager permissions and anonymous denial.
- Confirmed no synthetic test schools or attempts remained after rollback.
- Migration filename guard passed with existing legacy duplicates preserved.
- Supabase security/performance advisors reviewed. New gradebook RPCs appear in the advisory for authenticated SECURITY DEFINER functions intentionally: direct writes are revoked and those RPCs explicitly authorize section staff or school managers. Their search paths are fixed and unauthenticated execution is revoked. Transactional role tests verify allow/deny behavior. New indexes appear as unused before production traffic; retain them for foreign-key and history lookups. Existing unrelated advisor findings were not changed.

Advisory references: https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable and https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index.

## Activation and follow-up

1. The base core schema predates the tracked migrations, so this checkout alone is not a complete empty-database bootstrap.
2. Both target databases already contain the gradebook migrations. Inspect migration history before future database changes; see version mapping above.
3. `netlify.toml` enables the gradebook in production and deploy previews. Preview Supabase settings remain isolated to staging. No test login or student credentials were created.
4. Opening a gradebook or choosing Refresh automatically synchronizes its roster and imports new theory submissions. This foundation deliberately has no background importer and no trigger on live submissions or attendance writes. A sync failure cannot fail a classroom submission or attendance transaction.
5. The 29 unlinked owner test submissions were removed as explicitly requested; all 20 student-linked submissions were retained and imported. No name-based or external-ID guesses were applied.
6. Sections without current enrollment-source pairs have empty rosters until their existing class enrollment is configured. Ambiguous curriculum mappings remain unassigned and must be explicitly assigned by a school manager. Future pair/semester setup is exposed through the authorized RPCs below; there is no separate academic-catalog editor screen in this foundation.
7. Keep section academic identity stable after grading begins; new delivery terms/course identities should use new sections. Changing an existing section's course/cohort/term is outside this foundation's enrollment workflow. Once attempts exist, gradebook course-pair reassignment is rejected. Official grade calculation, lab rubrics, publication/finalization and external transcript export remain separate future work.

## Manager operations

Use the existing authenticated Supabase client as an authorized school manager:

- `configure_gradebook_course_pair(p_level_id, p_semester_number, p_semester_name, p_pair_name, p_theory_course_id, p_lab_course_id)` returns the curriculum pair ID. Use any positive semester number and actual courses in that level's school/program.
- `assign_gradebook_course_pair(p_gradebook_id, p_course_pair_id)` maps an empty book to its curriculum pair. It validates the course and cohort level, and rejects changing a book that already has attempts.
- `refresh_gradebook(p_gradebook_id)` returns imported and unresolved counts.

Rollback of the UI is simply disabling the feature flag and rebuilding. Preserve gradebook tables and migrations once grades exist; do not drop them as a rollback because they contain student history.

## Follow-up — owner test submissions resolved

The user identified the 29 unlinked submissions as their own testing data. They and their 29 linked submission-analytics events were deleted from production on September 16, 2026. All 20 linked student submissions were retained. Future signed-in submissions from Grimmdriver@gmail.com and rgenco@pccc.edu are discarded by a database rule tested first in staging. See OWNER_TEST_SUBMISSIONS.md.
