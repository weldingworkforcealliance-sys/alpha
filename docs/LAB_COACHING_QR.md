# Core LTG lab coaching and student QR handoff

In every active course whose catalog role is lab, instructors can save practice
coaching and immediately show that student's QR card in the same place. The
shared card shows the student's name, assignment and saved practice focus, with
open/copy link fallbacks. The QR image is generated in the browser.

WLD 110 keeps its shop-board progression and qualification rules. Other labs,
including WLD 210 and future lab course codes, use the shared coaching panel in
the welding-assessment workspace. Planner lab grading, course Gradebooks and
the standalone welding workspace all use these components. No course-number
allowlist is used for the core feature.

## Instructor workflow

Choose Practice / coach, select the actual assignment and focus, optionally add
a short note, then Save practice focus. The form is replaced by the student's QR
card. Student QR also opens it directly. Students see only their own current
assignment and coaching and can request a check. Ready requests appear in the
instructor coaching panel; selecting one opens that student's assignment.
Check handled clears the request after the instructor addresses it. Saving
new coaching also clears the request.

Coaching is ungraded. It does not create an attempt, alter a score, advance a
competency or apply Level 1 rules to Level 2. Existing formal assessment rules
continue to control grading.

## Persistence and isolation

Other labs store coaching and its append-only save history in a separate
lab_coaching column on the existing tower_records row. Coaching uses its own
revision and save ID. Tower rubric data, rubric revisions and grade history
are untouched by coaching. Existing rubric saves leave coaching columns intact.
Check requests use lab_requested_at and do not invalidate a coaching form.

Instructor RPCs reuse current course-role, section, enrollment and access
checks. Private, hashed personal links expire after 120 days and are invalid
after reissue, expiry, withdrawal or section closure. Student RPCs project
only the linked student's current coaching; no instructor IDs, coaching
history, grades or other students are returned. Links are reused within a
workspace session; QR retries do not repeat coaching saves.

The public student entry route is exactly /lab/student. All instructor routes
remain protected. URL fragments move to tab session storage; token data and
student pages are not cached. Private link tables are not archived.

## Release and validation

The staging-generated migration is
20260920185518_shared_lab_coaching_qr.sql. Apply it before publishing the UI.
Update the pinned archive worker to this tested release: core-schema.json now
includes both coaching columns, so archive snapshots and isolated recovery
retain all coaching history without a new dataset or a schedule change.

Synthetic database checks in supabase/lab-coaching-test.sql exercise WLD 110,
WLD 210 and a future FAB 900 lab, including ungraded saves, immutable retries,
stale writes, preserved grade data, link isolation, anonymous permissions,
expiry, reissue, withdrawal, cross-school denial and theory-course rejection.
UI tests cover the automatic handoff, save/QR failures, navigation blocking,
student switching and the student check request. Archive tests retain coaching
history and check requests in school-isolated recovery.
