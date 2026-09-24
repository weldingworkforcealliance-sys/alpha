# LTG directional attendance fix — September 24, 2026

## Status

Implemented in an isolated copy of production source commit `63a06d3253949a912367097a358043d9c3abde3b` from `product/standalone-mainline-2026-09-11`. Not deployed. No live attendance was edited, reset, or deleted.

## Night Level 1 audit

Read-only production inspection confirmed that PCCC Night is configured with WLD 105 as primary and WLD 110 as completion. Day Level 2 and PVHS Level 2 are configured as WLD 205 → WLD 210. No reversed configuration was found.

The existing model has one attendance session per pair and date. `initial_status` is the first course's saved attendance; `final_status` records completion-course exceptions. The open function creates unmarked records and reads only the exact pair/date. It does not automatically mark Present or copy yesterday's attendance.

Two confirmed implementation gaps could display or write the wrong attendance:

1. Both course screens could call the same unscoped mutation functions and change initial attendance. A completion-course mark could therefore change what the primary course displayed.
2. The screen did not discard out-of-order open/roster/save responses after changing context. Its asynchronous startup could also overwrite the embedded planner's locked date with today's date, and it retained overall notes between sessions.

On September 24 the live Night session already had 11/11 students marked Present and was finalized at 12:00:55 PM Eastern, before the evening class. September 23 was finalized at 12:12:50 PM Eastern with 10/11 Present. Both audit events came through authenticated finalization, not the automatic cleanup action. Those saved records must be preserved under the requested reopen rule. The available audit does not establish which screen originally wrote the initial marks, so it cannot prove the exact origin of Fin's screenshot.

## Changed behavior

- Fresh WLD 105/205 opens unmarked; an exact saved session reopens its saved initial marks.
- WLD 110/210 displays only the persisted initial marks from its matching primary course and date. An explicit status click or Mark All Present in the primary course saves those marks; pair finalization remains in the completion course.
- Completion saves change completion status/flags/notes and cannot overwrite initial attendance, even when a stale initial value is submitted.
- Primary saves retain completion fields. Completion cannot bulk-mark or reset the primary attendance.
- Every instructor mutation validates session ID, section, and attendance date under a session lock. Wrong dates, other pairs, null context, and stale session/context combinations fail before writing.
- Old responses cannot replace the currently selected roster, notes, alerts, or session. Embedded section/date changes remount the attendance state; locked dates survive asynchronous startup.
- Failed explicit marks revert their optimistic selection.
- Existing attendance records, finalization, orientation handling, reporting, and the audited manager-correction workflow are retained. The migration delegates to installed functions so production-specific orientation/report behavior is not replaced by older repository definitions.

## Validation

- Full Vitest suite: **467 passed**, zero failures.
- New regression coverage: **31 tests** (17 executable PostgreSQL/PGlite checks and 14 rendered React screen checks).
- Both 105→110 and 205→210: fresh primary, completion opened first, explicitly saved/reopened primary, finalized reopen, allowed forward sharing, blocked reverse writes, prior-day isolation, other-class and stale-session rejection.
- Delayed open, roster, and save responses; locked-date changes; failed saves; note isolation; legacy endpoint grants; saved-data preservation during migration.
- TypeScript, repository lint, migration filename guard, and whitespace validation passed.
- Production build passed with synthetic public Supabase configuration. The isolated checkout has no deployment credentials; this verifies compilation and prerendering, not a live deployment.
- PostgreSQL tests use synthetic data and the repository's real attendance table definitions and RPC bodies, with surrounding school/auth/audit infrastructure stubbed. Live production was inspected read-only.

## Security review

The production security advisor was read as a pre-release baseline. Its attendance-related notice identifies the existing authenticated SECURITY DEFINER API surface ([advisor guidance](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)). These RPCs intentionally retain checked pair authorization. The new wrappers use an empty search path, reject null or mismatched context, lock the session, and deny anonymous execution; executable tests verify grants. The advisor does not inspect this unapplied local migration. No production policy or unrelated security setting was changed.

## Release

Release the attendance screen and `20260924211144_directional_attendance_session_scope.sql` together. The migration must be installed before the new screen can save. It revokes authenticated execution of the four older unscoped mutation endpoints, so already-open tabs must refresh after release. The replacement endpoints preserve existing authorization and record locking; no historical attendance migration or clearing is performed.

After release, use a synthetic/staging roster to confirm a fresh 105 and 205 remain unmarked, save a primary mark, open same-day 110/210, save a completion exception, and reopen the primary. Verify the primary mark is unchanged. Do not reset the existing Night records as part of deployment.
