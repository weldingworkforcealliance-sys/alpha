# Planner Start Today hardening — 26 September 2026

STAGING ONLY: Gltg ezlvivmeneefiiwqwgqd. Production untouched.

Changed only public.start_current_planner_day(uuid,date) search_path from public to the empty string. Table references and application-function calls were already schema-qualified. This follows [Supabase function guidance](https://supabase.com/docs/guides/database/functions#security-definer-vs-invoker). No function body, owner, EXECUTE grants, RLS, global API configuration or MFA enforcement changed. This is defense in depth, not a demonstrated privilege-escalation exploit.

Permission review: expire_classroom_sessions() has a live caller in lib/classroom-session.ts and scopes updates to the caller's sessions unless platform owner. Do not revoke its authenticated grant merely to reduce an advisor count. The seven emergency-restored demo RPCs were not changed.

Definition hash before: 31ef4c62a63bb8bdb14bd9d8f43b4afc.
Definition hash after: a5c7f788586342e78a25540c96d9cc04.
Exact ACL unchanged: {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}.
Both directions refuse definition drift and use 3-second lock / 15-second statement timeouts.

Ledger:
- 20260926145543 harden_planner_start_search_path_staging
- 20260926145617 rollback_planner_start_search_path_staging_drill
- 20260926145701 reapply_planner_start_search_path_staging

Validation:
- Eight Start Today checks passed before/after/rollback/reapply: instructor, lead instructor, school admin and owner each reject an early date and successfully create the expected in-progress delivery on the scheduled date.
- Successful test starts, audit records and temporary memberships/assignments were rolled back; final synthetic delivery count is zero.
- 44 representative role observations across the requested modules stayed identical after apply, rollback and reapply. Eight expected generic-gradebook lab-precondition rejections are observations, not successful lab openings.
- Eight separate Shop/Tower checks with suitable synthetic fixtures passed at each stage.
- Rollback restored the exact original definition hash and ACL; reapply restored the hardened hash.
- Final checks: MFA flag false, global hook count zero.
- Security advisor still reports the existing four categories: no-policy RLS informational, anonymous definers, authenticated definers and leaked-password protection. Their presence is not a reason for blanket revocation. See [RPC grant guidance](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).

Limits: the new write tests use transactional SQL role simulation, not four separate browser logins. They exercise ordinary planner starts and schedule rejection, not every paired-course recovery branch. Complete browser/MFA, distributed throttle and full restore work remains open.

Scripts: supabase/migrations/20260926145435_harden_planner_start_search_path.sql, rollback/planner-start-search-path.sql, tests/planner-start-search-path.sql (all paths relative to staging-hardening). Never replay these via a broad production migration push.
