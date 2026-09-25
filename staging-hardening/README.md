# Staging-only anonymous RPC hardening

Target: **Gltg, ezlvivmeneefiiwqwgqd**. Never apply to production. These files are deliberately outside the application's normal supabase/migrations directory. The CLI generated the migration filename in this separate staging work directory.

## Change

Four RPCs now reject raw join codes over 128 bytes before trimming; trimmed codes must be 4–32 characters. Anonymous reads have the same bounds as writes. JSON type checks explicitly reject SQL NULL. Job Card input checks (including evidence type) precede global expiry cleanup. The Classroom read definer now uses an empty search path; its relations were already schema-qualified.

Valid return shapes, roster resolution, scoring, duplicate checks, capacity limits, expiry semantics, ownership and EXECUTE grants are unchanged. This is input hardening, **not distributed rate limiting**. Raw JSON parsing and HTTP request-size enforcement remain gateway responsibilities.

## Applied and rollback-tested

See manifest.json for exact Gltg ledger versions and before/after function hashes. Applied once, rolled back, verified exact definitions and ACLs, and reapplied. Forward and rollback each stop on function-definition drift.

Only use an explicit project-scoped Supabase apply_migration call with project_id ezlvivmeneefiiwqwgqd. Verify get_project returns Gltg first. The SQL must run inside one transaction; apply_migration provides that transaction. The SQL itself does not cryptographically identify a project: project selection is enforced by the tool call and operator. Do not use a previously linked production CLI or a broad db push.

Forward requires the captured pre-change definitions, so it intentionally fails if applied again while the hardening is already present. Rollback requires the captured hardened definitions. After rollback, reapply the same forward SQL under a distinct migration name so the drill remains visible in history. Never repair history by deleting these ledger entries.

## Tests

Run SQL files with execute_sql scoped only to Gltg. All fixtures are transactional and end in ROLLBACK. The anonymous contract files now raise on a failed assertion. Role-smoke observations must match the captured baseline, including expected denials and the intentionally unsuitable generic lab gradebook. lab-smoke supplies the appropriate temporary lab fixtures.

- anonymous-negative.sql: 10 early-validation checks.
- anonymous-journeys.sql: 10 positive/negative checks covering valid reads, answer-key omission, roster-linked submissions, duplicates and expiry.
- role-smoke.sql: 44 observations across instructor, transactional lead instructor, school admin and owner; matched before, after, rollback and reapply.
- lab-smoke.sql: 8 positive Shop/Tower openings, with transactional memberships and course fixtures.
- anonymous-api.mjs: 16 real HTTPS rejection tests using the staging publishable key. From repository root: node staging-hardening/tests/anonymous-api.mjs. Target URL is hard-allowlisted to Gltg. No auth secrets are used.

No generated student submissions, assessment modules, students or temporary memberships remain after the SQL tests. The test suite uses pre-existing synthetic Gltg fixture IDs; it is not a portable production seed script.

## Remaining limits

No signed-in staging browser session was available; the conventional PR 112 preview URL returned HTTP 404. Browser login/TOTP/recovery and full write journeys remain unverified. Neither concurrency/load testing nor a complete database/Auth/storage restore drill is claimed. The tested function rollback is narrower than disaster recovery. Supabase advisors remain at the baseline counts.

MFA enforcement remains OFF, the global pre-request hook remains absent, and the seven restored demo RPCs retain their grants.
