# LTG Stabilization Gate — 2026-09-10

## Purpose

Freeze net-new feature work long enough to harden the live beta foundation after the first successful week of sustained use.

## Completed in this stabilization pass

- Audited current `main`, CI, automated tests, active Supabase schema, data integrity, queue health, session state, RLS posture, SECURITY DEFINER exposure, indexes, and repository branches/PRs.
- Revoked direct anonymous/authenticated execution from internal training-report, agenda-recalculation, trigger, and retired Connected Classroom v1 helper functions.
- Removed two verified redundant non-unique indexes whose exact key order is already covered by unique indexes.
- Closed expired Connected Classroom and Training Mode runtime rows in `beta genco`; no student-facing join codes were reactivated or altered.
- Preserved historical attendance records and the existing unfinalized attendance session instead of deleting or auto-finalizing them.

## Verified after database hardening

- Internal training-report and agenda recalculation helpers are no longer executable by `authenticated`.
- Completion-note trigger helper is no longer executable by `anon` or `authenticated`.
- Service-role execution needed by internal server workflows remains available.
- The unique attendance and training-delivery indexes remain in place after removing their redundant non-unique twins.
- Expired active Connected Classroom sessions: 0.
- Expired active Training Mode sessions: 0.

## Remaining gate items before broad external expansion

1. Add browser-level end-to-end regression coverage for login/role routing, planner start/complete, notes/review, attendance/finalization/reporting, Connected Classroom, time clock/payroll, Training Mode, and Live Job Card.
2. Consolidate the layered global CSS override stack incrementally, with visual regression coverage around each removal.
3. Protect `main` and require passing CI before merge. This requires repository administration capability outside the current GitHub connector permissions.
4. Review and enable Supabase leaked-password protection in Auth settings.
5. Continue SECURITY DEFINER review by distinguishing intentional user-facing RPCs from helpers that can be moved private or have direct grants removed.
6. Review performance-advisor findings based on real query plans before adding indexes; do not add every suggested index mechanically.

## Release rule

No large feature bundle should bypass CI or be pushed directly to `main` while this gate is active. Small production fixes should remain isolated, reversible, and covered by a regression test when practical.
