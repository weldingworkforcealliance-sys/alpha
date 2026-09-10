# LTG Stabilization Findings — 2026-09-10

## Current conclusion

LTG's core beta architecture is stable enough for continued live use. The strongest evidence is a successful week of real planner, attendance, Connected Classroom, time-clock, notes, and reporting activity combined with clean integrity checks in the live beta database.

The system should remain under a short feature freeze until the security/repository/test gates below are completed.

## Findings that did not require destructive cleanup

Historical attendance rows were intentionally preserved even when the student is no longer an active member of the current pair. Current enrollment is not a valid reason to erase prior attendance history.

The existing open attendance session was also preserved. The stabilization pass does not auto-finalize attendance because doing so could trigger reporting and would manufacture an instructor decision that never occurred.

## Repository observations

- CI already runs typecheck, lint, Vitest, and a production Next.js build.
- Browser Supabase creation is centralized in `lib/supabase-browser.ts` for audited app paths.
- The repository still has many historical feature/release/temp branches and two old Job Card PRs that diverge from current `main`. They must be verified before deletion/closure rather than discarded by branch name alone.
- `main` was observed without branch protection. Repository administration is required to enforce CI as a merge gate.
- The global CSS stack remains the largest maintainability hotspot; consolidation should be incremental, not a one-shot visual rewrite.

## Database observations

- No structural duplicate attendance sessions/records, active pair enrollments, school memberships, section instructors, guide-day numbers, segment sequences, resource sequences/URLs, or assessment question numbers were found in the integrity sweep.
- No failed/stuck attendance-report queue rows, orphan classroom/job-card/time-clock rows, overlapping open punches, invalid indexes, unvalidated constraints, or disabled application triggers were found.
- Two exact duplicate non-unique indexes were removed while their unique equivalents were retained.
- Internal SECURITY DEFINER helpers that should not be direct RPC endpoints were removed from anonymous/authenticated execution.
- Student join-code RPCs remain intentionally anonymous because students use QR/code access without LTG accounts; their server-side code validates active status, expiration, code, duplicate Student ID, answer/job-card shape, and capacity where applicable.

## Remaining engineering work

- Browser-level end-to-end regression automation for authenticated workflows.
- Continued classification of SECURITY DEFINER functions into intentional public RPCs versus private helpers.
- Auth leaked-password protection review/enablement.
- Incremental CSS consolidation with regression coverage.
- Query-plan-driven performance tuning as live usage grows.
