# LTG Technical Debt Audit — 2026-09-05

This document records the deep technical-debt audit of the Living Teacher Guide / Living Teacher Planner repository and live beta-genco Supabase schema.

## Phase 1 safe cleanup

Completed:

- Removed committed `tsconfig.tsbuildinfo` generated build artifact and added `*.tsbuildinfo` to `.gitignore`.
- Removed confirmed-unused legacy theme/UI patch files.
- Standardized browser Supabase client creation through the shared client helper in the audited frontend paths.
- Replaced global text-based logout interception with explicit guarded sign-out handling.
- Removed post-render `BetaUiConsistency` DOM patching and rendered planner/course labels directly.
- Consolidated duplicated Connected Classroom session mechanics into `lib/classroom-session.ts` while retaining separate manual-library and planner-locked launch modes.
- Reconciled frontend time-clock payroll/report permissions so `viewer` does not imply payroll authority.
- Kept all previously applied Supabase migration history intact.
- Kept the public demo fixture content because it is an intentional product feature.

## Phase 2 backend hardening

Completed in live beta-genco and tracked by `202609050002_harden_rpc_grants_and_retire_legacy_proposals.sql`:

- Removed accidental anonymous EXECUTE access from the public RPC surface.
- Changed public-schema default function privileges so newly created functions do not automatically become executable by PUBLIC.
- Preserved anonymous access only for the two intentional student Connected Classroom endpoints:
  - `get_classroom_assessment(text)`
  - `submit_classroom_assessment_v2(text,text,text,text,jsonb)`
- Preserved authenticated access to current LTG RPCs.
- Removed client execution access from internal helper/trigger functions including `make_classroom_join_code`, `block_protected_content_changes`, and `block_school_id_change`.
- Stage-1 deprecated v1 Connected Classroom RPCs by revoking authenticated/anonymous execution while retaining definitions for rollback/forensics:
  - `list_assessment_modules()`
  - `start_classroom_session(uuid,text)`
  - `submit_classroom_assessment(text,text,text,jsonb)`
- Stage-1 deprecated old section-level planner RPC entry points while retaining definitions for service-role rollback/forensics:
  - `advance_section_planner(uuid)`
  - `complete_section_planner(uuid)`
  - `hold_section_planner(uuid,text)`
  - `resume_section_planner(uuid)`
  - `start_section_planner(uuid)`
  - `rebuild_section_schedule(uuid)`
- Retired the superseded proposal/voting subsystem after verification that both tables contained zero rows and no current frontend callers existed:
  - dropped `proposal_votes`
  - dropped `change_proposals`
  - dropped the proposal review/vote/publication RPCs and proposal-only trigger helpers
- Left the active agenda note/review workflow intact, including `agenda_change_reviews`.
- Did not alter approved curriculum, course outcomes, classroom submissions, planner delivery records, payroll records, time-clock entries, or training data.

## Verification evidence

- Current repository code uses `start_classroom_session_v2`, `list_assessment_modules_v2`, and `submit_classroom_assessment_v2`.
- Live API logs from the preceding 24 hours showed current v2 classroom traffic and no v1 classroom RPC traffic in the reviewed log window.
- After hardening, `anon` can execute only the two intended student classroom RPCs.
- Current instructor classroom RPCs remain executable by `authenticated`.
- Deprecated v1 classroom and old planner RPCs are no longer executable by `anon` or `authenticated` but remain available to `service_role` during the observation period.

## Remaining high-priority work

1. Remove the product-level hardcoded Connected Classroom expected enrollment default (`17`) and derive it from section/cohort data with a safe editable fallback.
2. Decide when to physically drop the staged-deprecated v1 classroom and old planner functions after an observation period confirms no external client use.
3. Investigate the active `get_section_instructor_names` HTTP 400 responses observed in API logs; the teacher identity UI currently has fallback behavior, but the RPC should be corrected or retired.
4. Review remaining empty legacy planner tables (`planner_day_coverage`, `planner_day_implementations`, `planner_day_versions`) before deciding whether they are future architecture or removable residue.
5. Add ESLint plus unit/Playwright regression coverage for critical planner, classroom, time-clock, invitation, and logout workflows.
6. Continue security review of SECURITY DEFINER routines that still use `search_path=public`; migrate appropriate routines to explicit object qualification / empty search path without breaking policy helpers.

## Constraints

- Do not alter approved core curriculum or approved course outcomes.
- Do not rewrite previously applied migration files to make history look cleaner.
- Prefer new deprecation/hardening migrations for database cleanup.
- Verify live dependencies before deleting database objects or public RPCs.
