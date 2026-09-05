# LTG Technical Debt Audit — 2026-09-05

This document records the deep technical-debt audit of the Living Teacher Guide / Living Teacher Planner repository and live beta-genco Supabase schema.

## Audit status

The primary technical-debt cleanup is complete. The application was not rewritten; the work removed confirmed residue, consolidated duplicated infrastructure, hardened the database surface, and added permanent quality gates while preserving current LTG behavior and protected curriculum/outcomes.

## Repository and frontend cleanup completed

- Removed committed `tsconfig.tsbuildinfo` generated build artifact and added `*.tsbuildinfo` to `.gitignore`.
- Removed confirmed-unused legacy theme/UI patch files.
- Standardized all audited browser Supabase client creation through `lib/supabase-browser.ts`; the one-time consolidation job verified no remaining `createBrowserClient` use under `app/`.
- Centralized frontend role definitions and corrected payroll/report permission drift so `viewer` does not imply payroll authority.
- Replaced DOM-based class-selection synchronization, hidden legacy selectors, synthetic clicks, and MutationObserver class switching with the shared section-selection contract.
- Removed post-render `BetaUiConsistency` DOM patching and rendered planner/course labels directly.
- Replaced global text-based logout interception with explicit guarded sign-out handling.
- Consolidated Connected Classroom session mechanics into `lib/classroom-session.ts` while retaining separate manual-library and planner-locked launch modes.
- Removed confirmed dead Training Mode `userId` state discovered by ESLint.
- Made `.env.example` deployment-neutral and limited it to the two intended public Supabase variables. It contains no active project reference or service-role secret.
- No hardcoded production Netlify URL or audited section UUID was found in the active application source.

## Welding class capacity rule

`17` is not placeholder data. It is the real maximum welding-program class/cohort capacity because the welding lab supports a maximum of 17 students. This applies to welding cohorts even when a course period, such as WLD 105 or WLD 205, is theory.

The rule is now centralized in `lib/program-constraints.ts` as `MAX_WELDING_CLASS_CAPACITY = 17` and both classroom launchers use that shared value instead of duplicating the literal.

## Backend hardening completed

### `202609050002_harden_rpc_grants_and_retire_legacy_proposals.sql`

Applied in live beta-genco and tracked in GitHub:

- Removed accidental anonymous EXECUTE access from the public RPC surface.
- Changed public-schema default function privileges so newly created functions do not automatically become executable by PUBLIC.
- Preserved anonymous access only for the two intentional Connected Classroom student endpoints:
  - `get_classroom_assessment(text)`
  - `submit_classroom_assessment_v2(text,text,text,text,jsonb)`
- Preserved authenticated access to current LTG RPCs.
- Removed client execution access from internal helper/trigger functions.
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
- Retired the superseded proposal/voting subsystem after verifying both tables had zero rows and no current frontend callers:
  - dropped `proposal_votes`
  - dropped `change_proposals`
  - dropped proposal-only RPCs and trigger helpers
- Preserved the active instructor-note / `agenda_change_reviews` review workflow.

### `202609050003_fix_section_instructor_names_access.sql`

- Repaired `get_section_instructor_names(uuid)`, which returned HTTP 400 when a school member viewed a visible section they were not personally assigned to teach.
- Aligned the RPC with `current_teaching_sections`: platform owners and active school members may view assigned instructor names for visible sections.
- Changed the SECURITY DEFINER function to `search_path=''` with fully qualified references.
- Reproduced the prior failure under Richard Genco's authenticated school-member context against PVHS B and verified the repaired RPC returned Naji Halil.

### `202609050004_harden_protected_trigger_search_paths.sql`

- Changed `block_protected_content_changes()` to `search_path=''`.
- Changed `block_school_id_change()` to `search_path=''`.
- Did not change Rule #1 behavior or school-ID immutability logic.
- A follow-up Supabase Security Advisor run confirmed the previous mutable-search-path warnings for these functions were removed.

### `202609050005_lock_training_report_outbox_direct_access.sql`

- Verified `training_report_outbox` has no direct frontend callers and is accessed through the training-report RPCs.
- Kept RLS deny-by-default and revoked direct table privileges from `anon` and `authenticated`.
- Did not add a permissive RLS policy merely to silence the advisor; direct PostgREST table access is intentionally not part of the application API.

## Legacy table review

- `planner_day_coverage`: **keep**. It currently has zero rows because coverage has not been triggered, but `start_current_planner_day` and `complete_current_planner_day` actively write/update it for substitute/coverage tracking.
- `planner_day_versions`: **keep dormant**. It has no current runtime caller but its schema supports the planned annual-release/versioning architecture.
- `planner_day_implementations`: **keep dormant**. It has no current runtime caller but its implementation-detail fields map to the intended annual release / school implementation model.
- The older proposal/voting tables were different: they were empty, superseded by the active agenda review workflow, and had no current or planned dependency identified, so they were retired.

## Environment and configuration review

- Active application configuration uses only:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `.env.example` is deployment-neutral and explicitly warns against using service-role/secret keys in browser configuration.
- No `next.config.*` customization is currently required.
- No repository-level Netlify configuration file was found; deployment configuration is therefore external to the repository unless added later.
- No active hardcoded production Netlify URL was found in application source.

## QA tooling added

The old `npm run lint` command was only TypeScript checking. It has been replaced with actual quality gates:

- `npm run typecheck` -> `tsc --noEmit`
- `npm run lint` -> ESLint
- `npm run test` -> Vitest
- `npm run check` -> typecheck + lint + tests

Permanent CI now runs:

1. dependency install
2. TypeScript check
3. ESLint with zero warnings allowed
4. unit tests
5. Next.js production build

ESLint was upgraded to the current v10 major rather than leaving the newly added QA system on the already-EOL v9 line.

## Baseline automated tests

Added permanent tests for:

- payroll role policy: `viewer` must not receive payroll authority
- intended payroll-management roles
- Review Queue vs School Dashboard role boundaries
- welding program maximum class capacity remains 17
- Connected Classroom `start_classroom_session_v2` receives the exact section, assessment, and expected-student context
- classroom service rejects a returned session for the wrong section
- classroom service rejects a returned session for the wrong assessment

These tests specifically protect several regressions already encountered during LTG development.

## Security Advisor disposition

The post-hardening advisor still reports several categories that should not be misrepresented as "all clear":

- the two anonymous Connected Classroom SECURITY DEFINER functions are intentionally anonymous because students join by QR/code without LTG accounts
- many authenticated SECURITY DEFINER functions are intentionally part of the signed-in RPC API and perform their own authorization checks; converting them wholesale to SECURITY INVOKER would be a separate security architecture project and was not done blindly
- leaked-password protection remains disabled in Supabase Auth and should be enabled through the project Auth settings when operationally appropriate
- the advisor still notes `training_report_outbox` has RLS with no policy; this is intentional deny-by-default behavior, and direct app-role table grants have now been revoked
- performance advisor findings such as unindexed foreign keys, RLS init-plan warnings, and unused indexes remain candidates for a workload-aware performance pass; indexes were not bulk-added or removed without query evidence

## Production smoke-test status

- Fresh live Supabase API logs during this audit showed successful current v2 Connected Classroom traffic, authentication traffic, realtime connections, current planner data reads, and the intended student assessment endpoints.
- The production Blueprint Reading flow had also been independently demonstrated earlier through the live LTG UI with QR join, student submission, and instructor live progress.
- A new unauthenticated HTTP smoke request to the Netlify hostname could not be completed from the audit execution environment because that environment could not resolve the hostname, and the web index did not expose the site. This is an environment limitation, not evidence of a production outage.
- GitHub CI validates the current repository head, but GitHub does not expose a Netlify deployment status check for the repository connection. A Netlify account connection would be required to independently attest that the newest commit is deployed, rather than merely build-valid.

## Remaining controlled follow-up

The deep technical-debt cleanup is substantially complete. Remaining work is operational or longer-term architecture rather than confirmed residue:

1. Observe the disabled v1 classroom and old section-planner RPCs for a deprecation window, then physically drop them if no external client usage appears.
2. Add authenticated Playwright end-to-end tests after dedicated LTG test accounts/fixtures are created. Do not automate production workflows using personal instructor/admin credentials.
3. Consider moving additional SECURITY DEFINER implementations behind a private-schema/public-wrapper pattern as a separate security-hardening project, function by function.
4. Enable Supabase leaked-password protection when approved for the production authentication policy.
5. Perform a query-driven performance/index review after enough real school usage exists to distinguish useful indexes from premature ones.
6. Keep `planner_day_versions` and `planner_day_implementations` until the annual-release architecture is implemented or formally abandoned.

## Constraints preserved throughout

- Approved core curriculum and approved course outcomes were not altered.
- Previously applied migration files were not rewritten to make history look cleaner.
- Database cleanup used new migrations.
- Live dependencies were checked before database objects or RPC access were removed.
- No fake classroom submissions, payroll records, time-clock entries, or curriculum records were created as part of this audit.
