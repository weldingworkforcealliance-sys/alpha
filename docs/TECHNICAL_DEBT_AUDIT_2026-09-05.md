# LTG Technical Debt Audit — 2026-09-05

This document records the first deep technical-debt audit of the Living Teacher Guide / Living Teacher Planner repository and live beta-genco Supabase schema.

## Phase 1 safe cleanup

Completed:

- Removed committed `tsconfig.tsbuildinfo` generated build artifact.
- Added `*.tsbuildinfo` to `.gitignore`.
- Removed confirmed-unused `app/hybrid-theme.css` legacy theme file.
- Kept all applied Supabase migration history intact.
- Kept the public demo fixture content because it is an intentional product feature.

## High-priority follow-up findings

1. Consolidate class-selection state around one React workspace provider. The current `CohortWorkspaceBar`, `TeacherIdentityBar`, and `BetaUiConsistency` share localStorage/custom events and manipulate older UI controls through DOM queries and MutationObservers.
2. Retire `BetaUiConsistency` after the planner renders correct values directly.
3. Standardize browser Supabase client creation through a single shared helper.
4. Replace text-based global logout interception with an explicit guarded sign-out function/component.
5. Extract shared classroom session logic used by `/classroom` and `/classroom/planner` while retaining the two distinct launch modes.
6. Remove hardcoded classroom default enrollment (`17`) and course-specific fallbacks (`WLD 105`, `WLD 110`) from product-level behavior.
7. Reconcile frontend time-clock role definitions with the tightened backend payroll/report permissions; `viewer` should not appear to have payroll reporting authority.
8. Audit public Supabase function grants and revoke unnecessary `anon` EXECUTE privileges.
9. Deprecate verified-unused v1 classroom RPCs only after confirming no external clients depend on them.
10. Investigate retirement of old planner RPCs and the older proposal/voting subsystem after dependency verification.
11. Add ESLint, unit tests, and Playwright regression coverage for critical planner, classroom, time-clock, and logout workflows.

## Constraints

- Do not alter approved core curriculum or approved course outcomes.
- Do not rewrite previously applied migration files to make history look cleaner.
- Prefer new deprecation/hardening migrations for database cleanup.
- Verify production dependencies before deleting database objects or public RPCs.
