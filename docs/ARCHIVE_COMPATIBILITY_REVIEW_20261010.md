# LTG archive compatibility review — preparation only

## Review base and scope

Prepared in an isolated local clone on `fix/archive-compatibility-review-20261010`, based on production-source commit `7d67089b4860ac037a99d45cf8ed72691b2915c7` (PR #132). GitHub main is a different scheduler branch; do not merge the whole production branch into main. No push, merge, deployment, protected-pin change, live backup, permission change, secret read, or student-row read was performed.

The existing project checkouts were left unchanged. Repository tree inspection found no tracked AGENTS.md or .agents instructions in the review base. The parent project AGENTS.md protects synced sources; those were not changed. No open archive PR was returned; existing `fix/archive-test-runners` was inspected and retains the old reader. The production source already contains the lab-coaching inventory and its basic preservation test.

## Changes

- `core-schema.json`: append `wld110_shop_attempts.decision` (`text`), matching migration `20261010120625`. Existing `tower_records.lab_coaching` (`jsonb`) and `lab_requested_at` (`timestamp with time zone`) remain projected.
- `context-schema.json`: append `course_guide_day_math.shared_math_day_number` (`integer`). Type and ordinal 15 match the previously collected production metadata supplied by the parent investigation. Its migration SQL is absent from the checked-out production source; no new migration is introduced.
- `school-bundle.mjs`: support explicit null second attempt only when the first attempt carries instructor decision `grade`. Retain student, gradebook, competency, progress, and posted-grade relationships. Historical two-attempt completions and old archive formats still recover without invented fields.
- `diagnostics.mjs`, `snapshot-reader.mjs`, `context-reader.mjs`, `run-backup.mjs`: use fixed, allowlisted stage labels. Error causes, messages, SQL, credential values and row contents are discarded. Internally registered context failures survive the core wrapper. Schema name/type/order comparison, explicit projection, read-only repeatable-read transaction, RLS fail-closed behavior and rollback remain intact.
- `compatibility.test.mjs` and frozen synthetic `fixtures/legacy-school-v2.json`: regression coverage for four additions, nulls, accepted/retry history, invalid single-attempt relationships, schema drift in both inventories, nested error redaction, legacy v1/v2 and old administrative context. Adds an opt-in real PostgreSQL service recovery test.

## Verification and limits

- Node 24.19.0 archive suite: 104 passed, 0 failed, 3 skipped (107 total). Command: `node --test --test-isolation=none scripts/archive/*.test.mjs`. The ordinary process-isolated runner hit Windows sandbox `spawn EPERM`; no-isolation mode ran the actual tests successfully.
- Offline PGlite 0.3.14 (PostgreSQL/WASM, in memory): actual information_schema comparisons and SQL projections passed for all four additions; isolated recovery verified 49 synthetic rows and 5 exact artifacts and rollback. This is supporting evidence, not a substitute for the PostgreSQL 17.6 service job. The adapter supplies its known in-memory identity and normalizes bytea to Buffer; it cannot open a production connection.
- TypeScript check (`tsc --noEmit --incremental false`): passed using the existing local dependency installation through a workspace junction; no dependency lockfiles changed.
- Archive ESLint with `--max-warnings=0`: passed. Migration filename guard: passed (128 migrations; 3 documented legacy duplicate groups). `node --check scripts/archive/run-backup.mjs`: passed. Git whitespace check: passed.
- Three PostgreSQL service tests remain unrun locally: no docker/psql service tooling was found. CI should run with `LTG_ARCHIVE_DB_DRILL=true` against the existing isolated PostgreSQL service.
- Full application build, route smoke tests and application Vitest suite were not run for this archive-only preparation. Existing CI validation remains a pre-merge gate; no CI or cloud workflow was dispatched.
- The Supabase project named Gltg is staging (confirmed by checked-in database-config). A schema-only staging query succeeded and showed that it lacks both latest additions. An attempted production metadata-only query was rejected by automatic approval review because authorization is preparation/testing only. No retry or indirect production query was made. The new worker intentionally will not accept the older staging schema.
- Historical failure stages remain unproven because old errors were suppressed. The supplied four additive mismatches explain deterministic current incompatibility; this patch cannot establish the exact historical exception.

## Retained production schema evidence

The parent investigation supplied its previously collected information_schema.columns result for production project qsmvgyyaemjmklceyikr (October 10, approximately 12:59:55–13:00:18 UTC; no server timestamp in the result; retained result boundary ID 16c8ab02-40a9-42d9-8116-7f6a12b5682a). Local assertions matched all four entries exactly:

| Table.column | Type | Ordinal |
| --- | --- | --- |
| course_guide_day_math.shared_math_day_number | integer | 15 |
| tower_records.lab_coaching | jsonb | 7 |
| tower_records.lab_requested_at | timestamp with time zone | 8 |
| wld110_shop_attempts.decision | text | 13 |

The supplied applied migration records are 20260920191244 shared_lab_coaching_qr, 20260930162740 wld205_shared_math_day_number, and 20261010120625 wld110_instructor_decision. This closes the sole unresolved schema assumption introduced by this patch (shared math type/order). The other additions were already supported by checked-in inventories/migration SQL; the retained evidence confirms their production positions too. This is verification against retained evidence, not a new independent production query or proof that the entire production schema has not subsequently changed. Exact-schema runtime checks remain the gate.

## Reviewed rollout sequence — separate later approvals

1. Review this local patch against the exact base above. The four changed columns match the retained production metadata above. Any additional production metadata check requires separate authorization. Resolve any later mismatch by reviewing the real schema; do not bypass checks or create migrations solely to match inventories.
2. On an approved review branch, run existing required CI and all PostgreSQL 17.6 synthetic recovery tests, including the new compatibility test. Inspect the full candidate worker dependency closure and compare against pinned `bd6e603732eec7a9079e328fee5228bce4684ac2`. Pinning a later application revision also changes archive dependencies; approve the complete immutable worker SHA. Do not merge into an auto-deploy branch under preparation-only authorization.
3. **Protected-pin change is a separate owner-approved operation.** After review/CI, update only the scheduler's reviewed full worker SHA through its protected process. No permissions, secret destinations, schedule, or retention policy changes are needed. Record the old and new SHA.
4. **Live backup and recovery verification require separate authorization.** Run one supervised backup after the pin update; verify fixed-stage logs, completion receipt, exact object versions/digests, retention holds, isolated recovery and success metric. Preserve trusted receipts privately without exposing student data in logs or artifacts. Perform approved independent exact-version recovery, and check old v1/v2 archives remain readable. Observe the next scheduled run.
5. If the new worker fails, do not certify success or weaken validation. Preserve all retained objects and receipts, use only the safe stage diagnostic, and review the cause privately under appropriate authorization. Reverting the pin alone restores the known incompatible worker; it does not restore working backups. Keep the known-good historical archives intact.

This remains a student-record/file archive and isolated verification drill, not a full operational application/database restore.
