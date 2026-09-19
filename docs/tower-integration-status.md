# Tower integration checkpoint — 2026-09-19

Status: draft integration; not deployed to production and not full integration sign-off.

## Implemented

- Authenticated `/tower` route, using LTG authorized active lab gradebooks and enrollment UUIDs.
- Immutable four-digit Weld Test IDs allocated in the database, with no reuse after exhaustion.
- Database-backed rubric, competencies, knowledge exams, qualifications, AWS registration evidence and destructive-test records.
- Optimistic revision checks, append-only history, idempotent retries and visible save failures.
- Server-calculated shop attempts in the existing gradebook. Critical-defect Attempt 1 is 0% unless replaced by completed Attempt 2, even when Attempt 2 is lower. A critical-defect Attempt 2 has a 76% maximum.
- Counted-attempt selection is separate from retained attempt history. Gradebook corrections for Tower entries link back to the rubric.
- Custom assignments are scoped to a class; shop-project rubrics use the shop-project category.
- Permanent destructive tests and certificate snapshots, with a protected printable record route.
- Production navigation and route remain disabled unless NEXT_PUBLIC_TOWER_ENABLED=true. Deploy previews enable Tower against Gltg staging only.
- Two explicit Map type annotations resolve an existing watchdog TypeScript build error on the integration base.

## Verified

- 111 tests passed across 28 files, including 18 Tower tests: grading arithmetic, all nine screen renderers, roster identity, cross-origin message rejection, failed saves and immutable in-flight payloads.
- TypeScript, targeted lint, migration filename checks and a production build with Tower/gradebooks enabled passed.
- Transactional tests on Gltg exercised gradebook integration, stale revision rejection, retry idempotency, lower Attempt 2 replacement, completed-rubric preservation, custom shop-project grading and tenant isolation.
- Certificate tests exercised issuance from permanent passing evidence, prevention of certificate/test removal, and preservation of historical student names after roster changes.
- Anonymous access and cross-school reads/RPC calls were denied. Withdrawn students cannot receive new Tower grades.
- Supabase advisors reviewed: authenticated SECURITY DEFINER warnings are intentional for authorized RPC entry points. Student-reference indexes and the catalog auth initplan were corrected. No unrelated database warnings were changed.
- Tests used synthetic fixtures and rolled back. Staging has 79 default assignments and no saved student Tower records or certificates after testing.

## Environment changes

Only staging Gltg (ezlvivmeneefiiwqwgqd) was migrated after explicit user approval:

1. 20260919004344_tower_integration
2. 20260919005045_tower_record_hardening
3. 20260919010157_tower_course_assignments
4. 20260919010424_tower_certificate_save_fix

Production beta genco (qsmvgyyaemjmklceyikr) has not been migrated by this task. The LTG production deployment has not been changed.

## Remaining work before full production sign-off

- Establish a staging app test account with an isolated class and roster, then perform real signed-in browser tests (including refresh, concurrent editors, certificate print and tablet layout). The user has no staging account; CLI admin credentials were unavailable. No account or credentials were fabricated to bypass sign-in.
- Complete official course-finalization and linked theory/planner workflows; current course totals are previews and the existing gradebook does not finalize official course grades.
- Connect certificate email delivery and approved branded/reissue workflow. The printable record is implemented; no certificate email was sent or represented as delivered.
- Review the complete production deployment delta. The integration base is product/standalone-mainline-2026-09-11 at 1f918e0; the previously verified production commit was 243eca9.
- Obtain approval for the concrete production database migration, deploy, and verify live behavior before any Codespace deletion.

## Codespace preservation

Neither Codespace was deleted. The organic journey export branch exists:
`codespace-organic-journey-qvp4qw99j7wvc4x9` at a5438194e1d51f32052c39d5b51180589d3fba3e.

This confirms the export branch exists; it does not establish that all work in both Codespaces is included in production. The ubiquitous space zebra Codespace still requires an independent work-preservation check.
