# LTG staging readiness — 25 September 2026

Status: AMBER — baseline and initial repairs completed; not ready for security sign-off or promotion.

## Scope and rollback verification

Only Gltg `ezlvivmeneefiiwqwgqd` was queried or used for database tests. No production database, authentication, grants, deployment, or backup job was modified. Repository baseline: `a0b0eee9fa96ccc30a49b7dd0789cf18b5420427`.

Gltg reports ACTIVE_HEALTHY, PostgreSQL 17.6.1.166. Its migration ledger contains `restore_demo_classroom_rpc_access_emergency` (20260925154659) and `disable_data_api_mfa_pre_request_gate_emergency` (20260925155528). The repository contains both corresponding rollback scripts (with different file timestamps). Catalog settings contain no global pre-request hook. `require_authenticated_aal2` is false. All seven restored demo RPCs are executable by anon and authenticated. Do not replay all repository migrations to reconcile the differing ledger timestamps.

## Changes in this staging branch

1. Repaired invalid TOML: a literal backslash-n separated two preview environment assignments. A real TOML parser reproduced the failure at line 13 and parsed the repaired file successfully. Preview still targets only Gltg. Set mandatory preview MFA to false to match the rollback while enrollment/recovery and server enforcement are designed. Existing enrolled-account challenge behavior is preserved.
2. Repaired login/setup test harnesses to supply the MFA API and an explicit environment flag. Added behavioral checks for enrolled AAL1, mandatory enrollment, AAL2, and assurance lookup failures. Removed a suppression for an ESLint plugin that is not installed. No application authentication logic was changed.

Rollback: abandon this branch/preview and retain the existing production deployment. To undo only the MFA flag choice in this branch, set it to true on its own valid TOML line; do not restore the malformed line. No persistent database migration was applied in this pass.

## Database smoke evidence and limits

SQL checks used authenticated role switching and JWT claim simulation, not real browser tokens. Every fixture transaction rolled back. Baseline and post-preview-repair results matched exactly.

| Area | Instructor | Lead instructor | School admin | Owner |
|---|---|---|---|---|
| Planner / teaching sections | 5 rows | 5 rows | 5 rows | 8 rows |
| Attendance pairs | 1 | 1 | 1 | 2 |
| Time Clock employees | 1 | 1 | 1 | 2 |
| Gradebook directory | 2 | 2 | 5 | 8 |
| Classroom sessions | 1 | 1 | 0 | 4 |
| Job Card sessions | 1 | 1 | 0 | 1 |
| School reports authorization | denied | allowed | allowed | allowed |
| Membership management authorization | denied | denied | allowed | allowed |
| Other-school sections | 0 | 0 | 0 | 1 |
| Tower open RPC, valid lab fixture | pass | pass | pass | pass |
| WLD110 Shop open RPC, synthetic lab fixture | pass | pass | pass | pass |

Zero session rows for the school-admin fixture are observations, not proof that all admin workflows work. The initial general gradebook was correctly rejected by both lab RPCs. Subsequent lab checks used the existing Tower lab; WLD110 checks temporarily changed its course code and added instructor memberships/assignments within a rolled-back transaction. Confirmed original course code and zero leftover fixture memberships/assignments afterward. The lead role was similarly temporary.

Not covered: real login/TOTP/recovery, actual API JWT validation, browser journeys, punch-in/out, attendance finalization/email, grade writes, student submission round-trips, generated report contents, invitation/password-reset delivery, concurrency or load. These remain release blockers.

## Privileged RPC inventory and least privilege

Captured 161 SECURITY DEFINER routines across public/private/certificate_private; 123 are in public. Advisors flag 11 public anonymous-callable and 100 authenticated-callable routines. These warnings are exposure inventory, not 111 established vulnerabilities. Private-schema USAGE and API exposure must be considered separately from function EXECUTE.

Anonymous public entrypoints: seven demo-classroom RPCs plus get_classroom_assessment, submit_classroom_assessment_v2, get_job_card_by_code, and submit_job_card. Preserve their current contract until valid student and instructor journeys pass. Existing public submission code contains payload bounds, session locks, duplicate checks and capacity limits; the demo creation function has a serialized global capacity guard. These are not per-client rate limits.

Next changes, individually: map each caller and internal dependency; capture the exact ACL and function definition; test allowed and denied callers; revoke only proven unnecessary privileges. Include PUBLIC inheritance, overloaded signatures, service workers and SECURITY INVOKER wrappers. Do not blanket-revoke the restored seven RPCs. Public schema CREATE is denied to both anon and authenticated. Two public definers use search_path=public; review dependencies before changing paths.

[Anonymous definer advisory](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable)

## Ordered hardening plan

1. **Leaked-password protection:** confirmed disabled. Verify Gltg plan eligibility and capture Auth settings before enabling only in Gltg. Exercise signup, invited-account setup, password change/reset, and existing weak-password login messaging using synthetic accounts. Record restore-to-previous-setting instructions. No setting changed. [Supabase password security](https://supabase.com/docs/guides/auth/password-security)
2. **MFA without a global hook:** keep enforcement off during baseline. Implement enrollment, challenge, verified AAL2, factor removal and recovery first. Enforce selected privileged mutations in the server/RPC authorization boundary using signed claims and current server-owned roles; a client redirect alone is not enforcement. For RLS, use restrictive policies or strengthen existing policies so permissive OR combinations cannot bypass AAL2. Cover direct REST/RPC calls, expired tokens, unenrolled users, recovery and service workers. Add one independently reversible operation at a time. Never reinstall pgrst.db_pre_request. [Supabase MFA](https://supabase.com/docs/guides/auth/auth-mfa)
3. **Anonymous endpoints and rate limiting:** test valid/expired codes, token mismatch, answer-key secrecy, oversized payloads, duplicate submissions and simultaneous final slots. Put distributed throttling on a verified server/gateway boundary, scoped by session and trustworthy client identity with classroom shared-NAT tolerance. Prevent direct RPC bypass before claiming gateway coverage. Return safe 429/retry guidance; do not count rejected calls solely in the same database transaction that rolls back. Keep database capacity guards as defense in depth.
4. **CSP report-only:** first inventory staging scripts, styles, images, Supabase HTTPS/WSS, PDF/blob and frame needs. Trial a report-only policy with default-src 'self', base-uri 'self', object-src 'none', frame-ancestors 'none'; derive remaining sources from observed usage and a nonce strategy. Collect redacted, size-limited reports at a staging-only endpoint; avoid student data and token-bearing URLs. Exercise all modules before enforcement. No CSP header was changed.
5. **Performance:** one 'Warp server error: Thread killed by timeout manager' appeared in the sampled prior 24 hours. Configured statement timeouts: anon 3s, authenticated/authenticator 8s. Highest cumulative authenticator statistics were schema-cache/catalog queries; the timezone query averaged ~350 ms and peaked ~710 ms. This does not identify a slow application query or prove the timeout cause. Correlate timestamps/status/request duration, active waits and actual application queries; collect EXPLAIN (ANALYZE, BUFFERS) on bounded staging reads and compare p50/p95 under representative traffic. Advisors list 82 unindexed foreign keys and 26 unused indexes: do not add/drop all mechanically or increase global timeouts. [Timeout guidance](https://supabase.com/docs/guides/database/postgres/timeouts)
6. **Dependency/code scanning:** locked install and npm audit reported zero known vulnerabilities. Existing security workflow includes dependency audits and extended JS/TS CodeQL. Initial local suite: 261 passed, 9 failed from outdated MFA harnesses; repairs are included. Final results are recorded in the PR. CodeQL completion still requires CI evidence; unit tests are not SAST. Migration guard passed 128 files, with 3 documented legacy duplicate groups.
7. **Backup/restore:** read-only verification confirmed historical [archive run 35459272170](https://github.com/weldingworkforcealliance-sys/alpha/actions/runs/35459272170) succeeded on September 19. This run did not execute production archive/restore. The archive workflow is explicitly production-bound and must not be dispatched for staging tests. The local recovery guide describes student-record recovery, not complete application/Auth/config reconstruction. A fresh isolated Gltg restore drill with a trusted manifest, hashes, schema/grants/functions, storage bytes and role tests remains required; record RPO/RTO and all excluded assets.
8. **Separation:** preview browser configuration is pinned to Gltg. Verify deployed server secrets, redirects, cookies, email sinks, storage, webhook URLs, cron and background workers are also staging-only before browser write tests. Keep game/demo resource limits and credentials separate from school data. A separate project is stronger isolation than a schema for anonymous workloads. Do not migrate production data or create paid resources as part of this baseline.

## Gate for the next database change

A confirmed staging application URL/session and complete write-workflow baseline are still needed. Prepare each migration plus exact compensating rollback outside automatic production delivery; explicitly allowlist Gltg in its runner. Apply one change, rerun the role matrix and direct unauthorized-access tests, exercise rollback, then reapply and rerun advisors. Stop on regression. Never merge/promote this branch to production in this run.

This is a staging engineering assessment, not a compliance certification.
