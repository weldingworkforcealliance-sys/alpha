# LTG staging readiness — 25 September 2026

**AMBER: first database hardening change applied and rollback-tested in Gltg only. Production untouched.**

## Completed

- Emergency rollback reverified: no global pre-request hook; mandatory database MFA remains off; demo RPC grants preserved.
- Prior preview configuration/MFA harness repairs remain in draft PR #112. Their CI passed 275 tests, build, route smoke, lint/type checks, dependency audit and CodeQL execution.
- Applied bounded anonymous-request validation to get_classroom_assessment, get_job_card_by_code, submit_classroom_assessment_v2 and submit_job_card.
- Raw join codes are capped at 128 bytes before trimming, with 4–32-character normalized bounds. SQL NULL JSON input and null evidence types now receive deliberate input errors. Job Card validation occurs before global expiry cleanup. Classroom read uses an empty search path.
- Preserved function owners, exact EXECUTE ACLs, valid payload/return shapes, roster checks, scoring, duplicate rejection, capacity and expiry behavior.
- Applied → tested → restored exact prior definitions/ACLs → retested → reapplied → retested. Gltg ledger: 20260925194313, 20260925194408, 20260925194431.
- Migration artifacts are in staging-hardening/, outside the normal production migration directory. They are not promoted by this draft.

## Evidence

| Check | Result |
|---|---|
| Early malformed-input SQL cases | 10/10 pass after hardening |
| Valid Classroom/Job Card journeys, roster matching, answer-key omission, duplicate and expired-session rejection | 10/10 pass before/after/rollback/reapply |
| Four-role observations across all requested module areas | 44 observations unchanged before/after/rollback/reapply |
| Correct lab fixtures: Shop and Tower for all four roles | 8/8 pass after change, rollback and reapply |
| Direct anonymous HTTPS API tests | 16/16 pass against Gltg |
| API harness non-staging target guard | Refuses target before sending requests |
| Exact rollback | All four original function hashes and grants restored |
| Fixture cleanup | No synthetic assessment modules, students or temporary memberships left |
| Advisors | No new categories/counts: security 7 no-policy informational, 11 anonymous definers, 100 authenticated definers, leaked-password warning; performance 82 unindexed FKs, 26 unused indexes |

The initial malformed-input cases already rejected requests eventually; the improvement is explicit validation before session lookups/cleanup and predictable errors, not a claim that every malformed request previously persisted data. The generic gradebook deliberately fails lab preconditions; separate suitable fixtures pass. SQL role switching is not browser authentication testing. Row-count observations are not full workflow certification.

## Remaining priorities and blockers

- **Browser baseline:** no signed-in staging browser session was present, and the conventional PR 112 preview URL returned 404. Existing open LTG browser tabs were production and were left untouched. A working isolated preview and test-account login are still needed for full browser/TOTP/recovery and write-workflow checks.
- **Leaked passwords:** remains disabled. Planning is complete; verify plan eligibility and capture Auth settings, then trial in staging with new/reset/existing-password flows.
- **MFA:** keep enforcement off; introduce enrollment/recovery plus operation-specific server/RPC or restrictive-RLS AAL2 checks. Never reinstate a global pre-request gate. Client redirects alone are insufficient.
- **Least privilege:** inventory contains 161 application definers (123 public). Exposure warnings require caller/dependency review. No speculative blanket revocation was made. Preserve the restored seven demo RPCs until all callers pass.
- **Rate limiting:** input/capacity limits are not distributed throttling. Need trusted client identity, shared-classroom-NAT allowances, storage with atomic limits, and a plan preventing direct RPC bypass before rollout.
- **CSP:** report-only plan is documented in the original baseline; collect staging resource origins and redacted reports before enforcement. No CSP deployment yet.
- **Performance:** no global timeout increase or blanket index change. Prior 24-hour sample had one Warp timeout; observed high cumulative authenticator work was catalog/schema-cache queries. Correlation with request timing and representative load remains outstanding. This patch reduces work for malformed inputs but does not claim a measured throughput gain.
- **Backups:** the historical archive run succeeded; this pass verified function rollback only. A full isolated database/Auth/storage restore drill, RPO/RTO evidence and coverage of excluded assets remain outstanding.
- **Separation:** Gltg identity and API target are verified. Server secrets, email sinks, callbacks, storage and workers still need deployed-preview verification. No production backup workflow was dispatched.

See staging-hardening/README.md, manifest.json, rollback SQL and test scripts in [draft PR #112](https://github.com/weldingworkforcealliance-sys/alpha/pull/112). No merge, production migration or production deployment is authorized by this run.
