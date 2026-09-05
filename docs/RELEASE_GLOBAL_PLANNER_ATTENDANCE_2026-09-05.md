# LTG Global Planner + Attendance Release Gate

Release branch: `release/global-planner-attendance-20260905`

This batch intentionally combines the global Teaching Console and paired student-attendance module into one release.

## Merge order

1. Reconcile the release branch with current `main`.
2. Run CI: typecheck, lint, tests, and production build.
3. Validate attendance migrations against the current LTG Supabase schema.
4. Apply database migrations before the web release.
5. Deploy the attendance report Edge Function.
6. Configure `ATTENDANCE_CRON_SECRET`, `RESEND_API_KEY`, and `ATTENDANCE_FROM_EMAIL` server-side.
7. Configure a scheduler to invoke the worker with the custom secret.
8. Run a controlled PVHS report test with non-real student names/data.
9. Confirm paired-course completion cannot bypass final attendance.
10. Merge/deploy the web application only after the database and worker are ready.

## Planner acceptance criteria

- Instructor Plan is the dominant center panel.
- Student Display / Launch Resources is adjacent and one-click.
- Student screen never exposes instructor notes, answer keys, private results, or secure AWS exam material.
- Secondary coaching/reference content is collapsed by default.
- Welding Math appears in the timed plan when mapped.
- Training Mode reuses the same Teaching Console without mutating production records.
- Class selection, time clock, connected assessment, notes, review queue, school/admin, and owner navigation remain reachable.

## Attendance acceptance criteria

- School admin can configure any linked course pair, including future pairs.
- One bulk-pasted roster serves both linked sections.
- Instructor can take initial attendance from either paired section.
- Completion section requires end-of-pair confirmation.
- Notes/flags support unprepared, left early, disappeared, and other context.
- Final attendance is auditable and locked from routine instructor editing after finalization.
- PVHS mode queues exactly one delayed report using the configured recipient and delay.
- Planner-day completion is blocked at the database layer when required pair attendance is not finalized.

## Safety rule

Do not enable production PVHS email until the recipient, sender, server secrets, scheduler, and controlled test have all been verified.