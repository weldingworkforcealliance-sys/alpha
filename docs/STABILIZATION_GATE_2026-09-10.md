# LTG Stabilization Gate — 2026-09-10

## Purpose

Freeze net-new feature work long enough to harden the live beta foundation after the first successful week of sustained use.

## Completed in this stabilization pass

- Audited current `main`, CI, automated tests, active Supabase schema, data integrity, queue health, session state, RLS posture, SECURITY DEFINER exposure, indexes, and repository branches/PRs.
- Revoked direct anonymous/authenticated execution from internal training-report, agenda-recalculation, trigger, and retired Connected Classroom v1 helper functions.
- Removed two verified redundant non-unique indexes whose exact key order is already covered by unique indexes.
- Optimized the advisor-flagged RLS authentication checks and removed duplicate permissive attendance SELECT evaluation without changing intended access.
- Closed expired Connected Classroom and Training Mode runtime rows in `beta genco`; no student-facing join codes were reactivated or altered.
- Repaired attendance roster identity handling so official leading Student IDs populate `external_student_id`; historical attendance was preserved and unmatched learning evidence was not linked by name guessing.
- Corrected Reporting & Analytics so official attendance record/status totals use finalized sessions only. Draft sessions remain separately visible as data-quality issues.
- Added regression tests for the security hardening, RLS cleanup, student identity repair, and finalized-attendance reporting rules.

## Verified after database hardening

- Internal training-report and agenda recalculation helpers are no longer executable by ordinary authenticated users.
- Completion-note trigger helper is no longer executable by anonymous or authenticated users.
- Service-role execution needed by internal server workflows remains available.
- The unique attendance and training-delivery indexes remain in place after removing their redundant non-unique twins.
- The targeted RLS initialization-plan and duplicate-permissive-policy advisor warnings are cleared.
- The four anonymous SECURITY DEFINER endpoints retained for student Connected Classroom / Live Job Card participation require active, unexpired join codes and keep scoring/validation server-side.
- Attendance student identity backfill links only exact school + Student ID matches; unresolved historical/test IDs remain unresolved instead of being guessed.
- For 2026-09-03 through 2026-09-10, finalized attendance reporting reconciles to 32 official records: 30 present, 1 absent, and 1 left early. Draft sessions no longer add `not_recorded` rows to the official totals.
- Attendance report queue at last verification: 0 pending, 0 failed, 6 sent.
- Expired active Connected Classroom sessions: 0.
- Expired active Training Mode sessions: 0.

## Intentionally not auto-corrected

- Draft attendance sessions were not auto-finalized or deleted.
- Open time-clock punches were not auto-closed without evidence that they are erroneous.
- Student submissions without an exact canonical Student ID match were not linked by name similarity.

## Remaining gate items before broad external expansion

1. Add browser-level end-to-end regression coverage for login/role routing, planner start/complete, notes/review, attendance/finalization/reporting, Connected Classroom, time clock/payroll, Training Mode, and Live Job Card.
2. Consolidate the layered global CSS override stack incrementally, with visual regression coverage around each removal.
3. Protect `main` and require passing `LTG Build Check` before merge. This requires repository administration capability outside the current GitHub connector permissions.
4. Enable Supabase leaked-password protection in Auth settings.
5. Continue SECURITY DEFINER review of the authenticated RPC surface, distinguishing intentional application endpoints from internal helpers before changing grants.
6. Review remaining performance-advisor findings using real query plans before adding or removing indexes; do not apply advisor suggestions mechanically.

## Release rule

No large feature bundle should bypass CI or be pushed directly to `main` while this gate is active. Small production fixes should remain isolated, reversible, and covered by a regression test when practical.
