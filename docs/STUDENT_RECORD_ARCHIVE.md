# LTG permanent student records and independent archive

Latest checkpoint: the corrected private PCCC certificate is now live at production commit `7bfd733de7ee1131f8749c043f8e7e53305a446e`. The nightly archive worker, retained-version recovery, 25 additional context tables and inert scheduling/alert configuration are prepared in this branch. **Production backups remain inactive.** See [activation status and remaining gates](ARCHIVE_ACTIVATION.md). Historical checkpoints below retain their original scope.

Status: option 2 approved. AWS destination, restricted synthetic automation and a synthetic indefinite hold are verified as of 2026-09-19. The user approved indefinite retention with administrator-controlled release. Production export and recovery remain pending. This document is not evidence of a working production backup. No real student records have been copied by this archive work.

Scope decision: the user approved **every school hosted in LTG**, with separate school archive packages. This authorizes the scope of records, not additional IAM grants or production backup activation.

## Ownership and storage

LTG remains the working record system. The user currently has no access to school storage and authorized an LTG AWS account owned by Richard Genco. The console account name is LTG Education Operating System, account ID 551626544567. The destination is `ltg-student-archive-551626544567-us-east-2`, in US East (Ohio). Encryption uses SSE-S3, public access is blocked, ACLs are disabled, versioning and Object Lock are enabled. Only synthetic transfers are enabled. A future school transfer must include recovery access and archive ownership.

The console displayed $100 credits and a free-plan end date of March 19, 2027, or earlier credit exhaustion. No paid upgrade was performed. Long-term funding or migration to the user's external drive remains necessary; a free-plan bucket is not a permanent retention guarantee.

Do not enable automatic expiration or choose an irreversible compliance retention period without the school's policy. Never put student data, database dumps, credentials, or certificate files in GitHub. Staging uses synthetic records and a separate destination prefix or bucket.

## Required inventory

| Record | Sources identified | Preservation requirement |
| --- | --- | --- |
| Student identity | attendance_students, tower_student_ids | Stable student UUID, identifiers and historical display names |
| Enrollment | attendance_pair_enrollments, gradebook_students, attendance_pairs, gradebook_course_pairs, gradebooks | Include inactive enrollments and course/term context |
| Attendance | attendance_records, attendance_sessions, related audit events | Statuses, notes, completion flags, dates, corrections and responsible staff |
| Grades | gradebook_categories, gradebook_statuses, gradebook_items, gradebook_attempts, gradebook_revisions | All attempts and corrections, not only latest scores |
| Official finals | gradebook_finalizations | Every revision, grading policy, source fingerprint, approver and reason |
| Tower assessments | tower_assignments, tower_records, tower_history, tower_grade_links | Rubrics, original attempts, critical defects and replacement decisions |
| Permanent tests/certificates | tower_permanent_tests, tower_certificates | Issued snapshot, issuer, timestamp, final PDF bytes and template version when available |
| Classroom evidence | classroom_submissions and referenced sessions/assessments | Canonical student linkage, responses and scoring context; flag unresolved legacy identities |
| Shop job-card evidence | job_card_submissions, job_card_sessions and templates | Student linkage, submitted checks, evidence notes and instructor review |
| Supporting files | Referenced private storage objects and certificate attachments | Actual bytes, media type, original object identity, length and checksum |

This inventory is a starting point. Before export, reconcile live schema and file references, including historical correction audit storage. A reference to a file is not a backup of the file. Supabase database backups exclude Storage object bytes: https://supabase.com/docs/guides/platform/backups

## Two recovery products

1. A school-scoped student archive: portable structured records plus readable transcript, attendance summary, certificates and evidence files. School-authorized access only; do not derive permission to all historical records from access to one current class.
2. An encrypted operational recovery set: consistent database export, schema/migration version and associated object files, with a separately controlled recovery procedure. Keep privileged operational data out of student-facing exports.

The archive must preserve old versions when an instructor makes a correction. A replacement certificate does not overwrite its predecessor; record its supersession explicitly.

## Delivery and verification contract

Use a durable queue with retryable export jobs. Proposed cadence is nightly plus new finalized grades/certificates; scheduling is not configured yet. Read database records from a consistent snapshot and enumerate file versions. If files can change during export, verify their versions/checksums and fail or retry rather than accepting mixed evidence.

Each export has an opaque export ID, school ID, source environment, schema version, creation time and complete manifest. Manifest entries identify each dataset or file, record count where applicable, byte length and SHA-256 digest. Avoid student names in cloud object keys.

States: queued, preparing, uploading, verifying, verified, failed. Mark verified only after reading back the stored object versions, checking content hashes, and confirming destination encryption and required retention. Record bucket, object keys, version IDs and verification timestamp. Upload acceptance alone is not verification. Integrity hashes alone do not establish authenticity; preserve the manifest in protected storage with separately controlled signing or audit evidence.

Incomplete pagination, inaccessible files, ambiguous student identities, missing mandatory datasets and cross-school rows must fail verification visibly. Show the last successful archive date and any failed jobs to authorized administrators. Do not display a claim that records are permanently protected while destination configuration is missing.

## Acceptance gates

- Synthetic complete student record survives export and restore with identical grade history, attendance, certificate files and hashes.
- An inactive student's historical record is retained.
- Cross-school access is denied, including export/job status endpoints.
- Missing or altered files fail verification.
- Retried jobs cannot replace a previously verified immutable export.
- Corrections create a new archive version while retaining the earlier version.
- Restore into an isolated environment succeeds without production credentials or production writes.
- School recovery administrator can retrieve the archive independently of LTG.
- Monitoring, retention settings and an agreed restore-test schedule are recorded before production activation.

## Current release constraints

Official grade finalization and the integrated Student record display were released through PR 72 on September 19, 2026, after explicit production approval. Approved certificate artwork and final PDF delivery remain unresolved. Archive implementation must preserve available certificate snapshots now and add issued PDF artifacts when implemented; it must not claim those PDFs already exist.

No Codespaces, branches, repositories, student records or deployment resources may be deleted as part of this work. The user requires full live gradebook/Tower functionality before reconsidering Codespace cleanup.

## Required external configuration

- Destination account and region are verified above. Richard Genco owns the account; school access remains unavailable.
- Narrowly scoped workload access and independent recovery access.
- Retention policy and Object Lock mode, plus encryption key ownership/recovery.
- Alert recipient and acceptable recovery window.

Object Lock behavior and limitations: https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lock.html

## Synthetic connection test

`scripts/archive/synthetic-roundtrip.mjs` uses the AWS CLI's existing credentials. It first verifies the expected AWS account, bucket versioning, all public-access blocks, ownership enforcement, and SSE-S3 encryption. It uploads a small generated synthetic record to a unique `staging/synthetic/` key with a supplied SHA-256 checksum and a conditional create. It downloads the exact returned object version and verifies bytes, checksum, version ID, size and encryption before writing a verification receipt. It performs no delete operations. Its success explicitly does not certify production backup completeness, student export permissions, retention locks or a database restore.

Run locally with `node scripts/archive/synthetic-roundtrip.test.mjs` (no credentials or network). Ten unit tests cover a successful restore of inactive identity/history and refusal of incorrect account, missing protections, changed bytes, checksum, version or encryption.

`infra/archive-probe-access.json` prepares a short-lived GitHub OIDC role for the exact `integration/student-archive` branch of `weldingworkforcealliance-sys/alpha`. It permits read/write only under `staging/synthetic/`, plus read-only bucket protection checks. Deletion and retention changes are explicitly denied. It creates no access keys, paid upgrade, schedule, production access or storage bucket. Check whether the GitHub OIDC provider already exists before deployment; supply its ARN if so. Creating this access through the console requires user confirmation at the final action.

The GitHub workflow always runs unit tests on relevant branch pushes. The cloud test is disabled unless the repository variable `LTG_ARCHIVE_PROBE_ENABLED` is set to `true`. There is no backup schedule. AWS role sessions last 15 minutes. Before enabling production automation, complete the required inventory, export consistency, private file transfer, retention, monitoring and isolated recovery gates above.

### Verified live test, September 19, 2026

The committed probe at `243e960244187ea0672d58a86abaac3c2c4b2a69` ran through the owner's signed-in AWS CloudShell session. AWS account and bucket protections passed. A 903-byte synthetic record was uploaded and its exact version downloaded with matching encryption, checksum and bytes:

- Key: `staging/synthetic/fd814818-52fe-4025-85a3-3f46c6452a5b.json`
- Version: `FoU64Onpv6gikXx7RfyLIEGzUskVRVYh`
- SHA-256: `a80d06582e0a896322cbea1fb5e0b96a006ebdcb2bfdffaecd455c8861caab36`
- Verified: `2026-09-19T13:28:11.592Z`
- Production backup verified: **false**

The synthetic object was retained; no delete request was made. The access template passed AWS CloudFormation validation. After explicit user approval, stack `ltg-archive-synthetic-access` created the GitHub OIDC provider and role `arn:aws:iam::551626544567:role/ltg-archive-synthetic-probe`. No provider existed beforehand. Repository variable `LTG_ARCHIVE_PROBE_ENABLED=true` is saved. This is synthetic-only access, not authorization or credentials for a production export.

GitHub emits the immutable-ID subject `repo:weldingworkforcealliance-sys@322272778/alpha@1350025517:ref:refs/heads/integration/student-archive` for this repository. The exact trust condition was corrected to that observed identity and the stack reached `UPDATE_COMPLETE`. No wildcard or additional repository/branch access was introduced.

GitHub run `35446269788`, attempt 2, then passed both jobs. The synthetic job authenticated through the restricted role (15-minute session) and verified a second 903-byte archive:

- Key: `staging/synthetic/3a6e397f-cc81-45fd-8262-ba3fcd84c301.json`
- Version: `C1V09gFkiDvaV_9REeB7Y7JB6H.8i6s_`
- SHA-256: `44ebb97dcfeeb145d933cb543f6590bd5a3d8c131cbbca9a5d8ee019ff3f8e31`
- Verified: `2026-09-19T13:38:32.125Z`

AWS IAM policy simulation denied `GetObject` and `PutObject` on a production key, and explicitly denied `DeleteObject`, `DeleteObjectVersion` and `PutObjectRetention`. Simulation did not issue any actual data-access or deletion request. Both synthetic objects remain stored. This proves the synthetic connection and exact-version restore path; it does not prove complete database recovery or permanent retention.

### Approved indefinite retention policy

The user selected: "Keep indefinitely; administrator can release protection." Object Lock is now enabled on the existing bucket; AWS does not allow disabling that capability afterward. The GitHub-generated synthetic version above was placed under an S3 legal hold, and `GetObjectLegalHold` returned `Status: ON`. This is a technical indefinite hold, not a determination that a legal preservation obligation exists. No fixed compliance period or automatic expiration was configured.

The synthetic workflow role cannot place or release holds. The owner applied the test hold through the signed-in administrator session. Production export must set and verify a hold on every finalized archive version before declaring protection complete. Simply enabling Object Lock does not protect future uploads automatically. Production uploader access must allow placing a hold but deny releasing one, deletion, retention bypass and unrelated object access. Releasing holds remains an explicitly authorized administrator action. No production export or backup schedule is active yet.

## All-school export implementation, September 19, 2026

`scripts/archive/snapshot-reader.mjs` prepares an internal, server-only reader for 25 core record tables. It uses a dedicated connection and a read-only repeatable-read transaction, verifies the reviewed column/type inventory in `core-schema.json`, and aggregates entire datasets without pagination or active-student filters. Decimal strings preserve bigint identities. It explicitly excludes live classroom/job-card join codes. `row_security=off` makes incomplete RLS-filtered reads fail; it does not grant or bypass access. This reader requires separately provisioned and reviewed database read access; it is not exposed as an RPC or end-user route.

The generated projection was executed against Gltg staging with only aggregate counts returned: 3 schools, 5 student rows, 8 gradebooks, 9 Tower history rows, 5 classroom submissions and 1 job-card submission. No record contents were exported by that check. The real database connection adapter and worker are not configured.

`school-bundle.mjs` reconciles source counts and school inventory, checks duplicate identities and school/book/student relationships, separates school packages, and preserves all core grade revisions and inactive students. Attachments require an explicit inventory, immutable source version, exact byte count and SHA-256 digest. The reader leaves attachment fields unresolved rather than assuming zero files. Recovery requires an independently protected expected bundle digest and the expected school/export identities, then rechecks the dataset manifest and relationships. It returns structured records and bytes; it never executes restored SQL or trusts archived filesystem paths.

These packages are deliberately labeled **core-records-only**. Course/term and rubric context, historical audit events, private-file discovery and transfer, readable transcripts, independent receipt protection, job scheduling/status, and actual database restore still need implementation and verification. Unit-tested JSON recovery is not a full database restore or proof of production retention. The existing synthetic cloud probe is separate and has not uploaded these school bundles.

Read-only readiness checks found no unlinked classroom/job-card students in production and 3 inactive students that must be retained. The official finalization tables were subsequently installed in production through PR 72. Staging has 5 classroom submissions and 1 job-card submission without canonical student links; an all-staging package must remain incomplete until those legacy records are reconciled. Do not silently drop them, guess links, or modify live student identities to satisfy a test.

Validation: 18 bundle tests, 5 reader tests and the original 10 synthetic AWS tests. Tests cover school separation, inactive students, all grade revisions, correction history, mismatched relationships, duplicate/truncated records, missing datasets, unresolved students, forbidden join codes, missing/corrupt/version-changed attachments, schema drift, transactional rollback, and trusted-receipt verification. No new database objects, access grants, production uploads, schedules or deletions were made by this implementation.

## Live final-grade dependency verified

Production commit `8f883206f5adc74d1c7c7ef35207f7899be2e397` was published in Netlify deploy `6aae99422df84f00083b45bf` at `2026-09-19T14:17:23.684Z`. The approved `gradebook_finalization_release` migration installed the final-grade table and protected functions. Direct authenticated inserts/updates and anonymous reads/RPC execution are denied; RLS and the immutable-history trigger are enabled.

Signed-in staging tests saved a 90% shop final, corrected it to 85%, and preserved both versions. A 67.5% theory final appeared alongside the shop final in Student record. Another synthetic student showed no finalized grades. Live LTG verification confirmed final-review controls load, incomplete course requirements disable finalization, Student record reads the production history, and no browser errors were recorded. Production finalization count remained zero: no real student grades were finalized by these checks.

This release satisfies the final-grade database dependency; it does not activate the independent archive or complete certificate delivery. No Codespaces, repositories, branches or deployment resources were deleted.

