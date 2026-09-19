# LTG permanent student records and independent archive

Status: option 2 approved. Empty AWS destination created on 2026-09-19; automated access and retention policy pending. This document is an implementation specification, not evidence of a working production backup. No real student records have been copied by this archive work.

## Ownership and storage

LTG remains the working record system. The user currently has no access to school storage and authorized an LTG AWS account owned by Richard Genco. The console account name is LTG Education Operating System, account ID 551626544567. The destination is `ltg-student-archive-551626544567-us-east-2`, in US East (Ohio). Encryption uses SSE-S3, public access is blocked, ACLs are disabled, and versioning is enabled. Object Lock and automated transfers are not yet enabled. A future school transfer must include recovery access and archive ownership.

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

Official grade finalization is under review in PR 72. Approved certificate artwork and final PDF delivery remain unresolved. Archive implementation must preserve available certificate snapshots now and add issued PDF artifacts when implemented; it must not claim those PDFs already exist.

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

The synthetic object was retained; no delete request was made. The access template passed AWS CloudFormation validation. After explicit user approval, stack `ltg-archive-synthetic-access` reached `CREATE_COMPLETE`, creating the GitHub OIDC provider and role `arn:aws:iam::551626544567:role/ltg-archive-synthetic-probe`. No provider existed beforehand. Repository variable `LTG_ARCHIVE_PROBE_ENABLED=true` is saved. Local tests and GitHub run `35445760165` passed before cloud activation; a GitHub-authenticated cloud test is now pending. This is synthetic-only access, not authorization or credentials for a production export.
