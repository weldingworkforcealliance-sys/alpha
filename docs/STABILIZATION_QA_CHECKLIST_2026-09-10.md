# LTG Stabilization QA Checklist — 2026-09-10

Run this checklist before merging large feature work into `main`.

## Automated gate

- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- Confirm no unresolved merge markers, TODO/FIXME debt added in production paths, or debug `console.log` statements.

## Database integrity gate

Verify all counts remain zero unless explicitly documented:

- duplicate active attendance pairs
- duplicate active pair enrollments
- duplicate attendance sessions for the same pair/date
- duplicate attendance records for a session/student
- multiple open time-clock entries per employee
- orphan classroom/job-card/time-clock rows
- failed or stuck attendance-report queue items
- finalized PVHS sessions without a report queue row
- invalid or not-ready indexes
- unvalidated constraints
- disabled application triggers
- active classroom/training sessions whose expiration is already in the past

## Live workflow smoke gate

Use dedicated test records where a write is required.

1. Instructor login reaches the assigned-class dashboard without redirect loops.
2. Class selection stays synchronized between dashboard, planner, agenda, attendance, and Connected Classroom.
3. Start Day creates one delivery record and Complete Day closes it once.
4. Instructor completion note appears in the review workflow with the correct instructor and day.
5. Attendance opens with the correct pair roster, saves marks, finalizes once, and preserves prior-day history.
6. PVHS finalization creates one delayed queue item per intended report event and the worker clears it without a failed/stuck state.
7. Connected Classroom creates one active session for the selected class, student join succeeds, duplicate Student ID is rejected, result returns to the instructor, and End Session invalidates the code.
8. Time clock prevents overlapping open punches, records clock-out, and the weekly payroll report reproduces the entry correctly.
9. Training Mode does not mutate production planner delivery records and expired sessions are not treated as active.
10. Live Job Card enforces capacity, duplicate Student ID protection, requirement validation, review decision, and expired-code rejection.
11. School Admin pages expose only the school-management operations allowed to that role.
12. Platform Owner views can cross schools without weakening school-level RLS for non-owner users.

## Release discipline

- One coherent feature/fix per branch or release bundle.
- Database changes ship as idempotent migrations.
- Never patch production data to make a test pass unless the reason is documented.
- Preserve approved curriculum and outcomes; implementation/pacing changes remain the editable layer.
- Any failure in attendance reporting, time clock, authentication, role isolation, or planner delivery blocks the release.
