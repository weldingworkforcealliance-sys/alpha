# LTG Standalone Product Readiness — 2026-09-10

## Objective

Prepare LTG to move from an NJCWWA-linked live beta into a standalone, multi-school education product without destabilizing the working PCCC implementation.

## Release principle

Production remains the evidence base. Productization work is isolated until it passes security and deployment gates. Do not rebuild the functioning LTG core simply to change the product domain or public presentation.

## Environment status

### Production
- The live `beta genco` Supabase project is the database referenced by current production migrations and current operational features.
- All audited `public` tables have RLS enabled.
- The production database currently contains the full LTG schema and current migration history.
- Current GitHub `main` remains the source of truth for the live application.

### Existing test project
- The `Gltg` Supabase project is not a production-equivalent staging environment.
- It has only a small subset of the current public tables/functions and migration history.
- It must not be represented as a reliable production clone for multi-school release testing.

### Productization branch
- GitHub branch: `product/standalone-hardening-2026-09-10`
- This branch contains the standalone public LTG shell and related regression coverage.
- Nothing on this branch should be merged to production until CI passes and the target standalone deployment/domain is ready.

## Standalone public shell

The branch changes the public root from an automatic login redirect to a standalone LTG product page while preserving `/login` and the authenticated workspace.

Positioning:
- LTG = Living Teacher Guide / Education Operating System
- Welding = first proven implementation, not the platform boundary
- Nursing = next non-welding demonstration program
- Founding School Beta = controlled initial multi-school adoption model

The public route does not load the authenticated in-app usage tracker or the instructor workspace navigation.

## Security review status

### Positive findings
- Every audited table in the exposed `public` schema has RLS enabled.
- Core school, section, planner, attendance, report, and time-clock policies use school membership/role predicates rather than authentication alone.
- Sampled privileged RPCs enforce authorization internally before performing protected writes or cross-school reads.
- Existing stabilization migrations already removed direct execution from multiple internal helpers and retired legacy RPC surfaces.

### Items requiring controlled review

Supabase Security Advisor flags numerous `SECURITY DEFINER` functions as executable by authenticated users. This is not itself evidence of a vulnerability. Many are intentional public RPC wrappers and sampled functions contain proper school/owner checks.

Before School #2 launches, complete a function-by-function authorization audit for all authenticated `SECURITY DEFINER` RPCs and classify each as:
1. intentional public RPC with validated authorization,
2. internal helper whose direct EXECUTE privilege should be revoked,
3. obsolete/legacy function to deprecate and later remove.

Anonymous access is currently expected only where a student joins an active classroom/job-card session by expiring join code. These endpoints require separate abuse and data-minimization tests.

### Auth hardening

Supabase currently reports leaked-password protection as disabled. Enabling it is an operational authentication-policy change and should be approved before production activation.

## Multi-school release gates

Do not add a second live institution until all gates below pass:

- RLS enabled on every Data API exposed table.
- Cross-school SELECT attempts return no rows / authorization failure.
- Cross-school UPDATE/INSERT/DELETE attempts fail.
- School admins cannot elevate themselves to Platform Owner.
- Instructors cannot assign themselves to unauthorized sections.
- Instructor attendance access cannot cross school boundaries.
- Instructor classroom/job-card review cannot cross school/section boundaries.
- Time-clock employee and payroll/report data remain school-scoped.
- School-level reporting cannot request another school's data by changing an object ID.
- Anonymous classroom endpoints expose only the minimum data required for an active join code.
- Expired/ended join codes stop reading and writing immediately.
- Platform Owner access continues to work as designed and produces audit events for privileged management actions.

## Staging gap

A production-equivalent staging environment does not yet exist. The preferred implementation is a database branch/clone derived from the production schema without production data, paired with a deployment preview of the productization Git branch.

Creating a Supabase development branch has a billable cost and therefore requires explicit approval before creation.

## Domain/deployment gate

The application source is already largely domain-neutral. No active NJCWWA hostname is hardcoded in the audited application source. The final standalone cutover therefore should be a deployment and Auth redirect configuration change rather than an application rewrite.

Before domain cutover:
- choose the permanent LTG product/domain name,
- configure the standalone host,
- configure Supabase Site URL and allowed redirect URLs,
- verify account setup, login, password reset, invitations, and QR/student join flows on the new hostname,
- leave an NJCWWA link/redirect to the new LTG site during transition.

## Immediate next sequence

1. Pass CI for the standalone public shell.
2. Complete authenticated SECURITY DEFINER RPC classification.
3. Obtain approval for a production-equivalent Supabase staging branch if needed.
4. Select permanent LTG product/domain name.
5. Connect standalone hosting and configure Auth redirect URLs.
6. Deploy and test the public site plus existing authenticated application on the new hostname.
7. Build the Nursing demonstration in the non-production environment.
8. Build the Founding School onboarding and approval packet.

## Production constraint

No approved curriculum/course outcome changes are part of this productization effort. No production student, attendance, payroll, time-clock, or assessment records should be created merely for testing.
