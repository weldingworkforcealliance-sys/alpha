# LTG student records and independent archive

Updated September 19, 2026. Production student archives are enabled for every LTG school. The first supervised live backup and isolated record/file recovery passed in [Actions run 35459272170](https://github.com/weldingworkforcealliance-sys/alpha/actions/runs/35459272170). Independent administrator recovery also verified every stored artifact. The owner received the approved alert-delivery test. See [activation status](ARCHIVE_ACTIVATION.md) for evidence, configuration and remaining gates.

## Current operation

- LTG remains the working record system. Official final grades, retained correction history, Student record and the corrected private PCCC certificate are live.
- The default-branch scheduler installed through PR #77 runs nightly at 07:17 UTC using reviewed worker revision `a917a0942491df8d81986e6d73e42f1cf2c44726`. First scheduled execution remains to be observed after September 20 at 07:17 UTC. An immediate backup triggered by grade finalization or certificate issuance is not implemented.
- A read-only consistent snapshot covers 25 core record tables, 25 reviewed context tables, private certificate artwork and the Storage inventory. Inactive students, previous attempts, correction history and final-grade revisions are retained. Core records are separated by school; the context companion is restricted to archive administrators.
- Certificate snapshots are rendered to PDF with preserved code and private artwork. These archived files do not prove an email was delivered to a student.
- Every uploaded version is encrypted and placed under an indefinite legal hold. Exact-version downloads must match hashes, lengths and protection settings before the completion receipt is written. The uploader cannot delete versions or release holds.
- Each successful run also restores the records and file bytes into an isolated PostgreSQL test database. Independent administrator recovery has passed. This is record/file recovery, not a full operational LTG database restore.
- Failure and missing-success alarms are configured. Alerts and GitHub logs contain no student records. The first overdue-alarm transition after activation remains to be confirmed.

## Ownership and continuity

The owner approved the AWS destination and indefinite retention, with protection released only by an archive administrator. Public access is blocked, ACLs are disabled, versioning and Object Lock are enabled. Production and synthetic prefixes have separate restricted automation roles. Credentials and real student data must never be committed to this public repository.

The AWS free-plan end previously displayed March 19, 2027, or earlier credit exhaustion. No paid upgrade was made. Continued account funding or migration to independently recoverable storage is still required. The external drive is not set up; school storage is not currently available. Indefinite holds alone do not guarantee permanent availability.

## Remaining limits

- The first nightly scheduled run and subsequent overdue-alarm clearance require observation.
- Future Storage objects cause the worker to fail closed until a reviewed byte resolver is installed. Storage was empty at activation. External teaching-resource links are not mirrored.
- Account passwords, payroll, deployment secrets and email configuration are excluded. Full operational disaster recovery is separate work.
- Automatic certificate emailing and the correction/reissue workflow remain unfinished. The approved branded downloadable PDF itself is live.
- A human-readable transcript/attendance export and an in-app archive-status screen are not delivered by this worker.
- No Codespace cleanup is authorized before full Gradebook/Tower functionality and preservation checks. See [integration status](tower-integration-status.md).

## Historical implementation checkpoints

The sections below document earlier stages on September 19. Their statements about inactive production, unresolved PDFs or missing configuration applied at those stages and are superseded by the current operation above and the activation document.

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

### All-school export implementation, September 19, 2026

`scripts/archive/snapshot-reader.mjs` prepares an internal, server-only reader for 25 core record tables. It uses a dedicated connection and a read-only repeatable-read transaction, verifies the reviewed column/type inventory in `core-schema.json`, and aggregates entire datasets without pagination or active-student filters. Decimal strings preserve bigint identities. It explicitly excludes live classroom/job-card join codes. `row_security=off` makes incomplete RLS-filtered reads fail; it does not grant or bypass access. This reader requires separately provisioned and reviewed database read access; it is not exposed as an RPC or end-user route.

The generated projection was executed against Gltg staging with only aggregate counts returned: 3 schools, 5 student rows, 8 gradebooks, 9 Tower history rows, 5 classroom submissions and 1 job-card submission. No record contents were exported by that check. The real database connection adapter and worker are not configured.

`school-bundle.mjs` reconciles source counts and school inventory, checks duplicate identities and school/book/student relationships, separates school packages, and preserves all core grade revisions and inactive students. Attachments require an explicit inventory, immutable source version, exact byte count and SHA-256 digest. The reader leaves attachment fields unresolved rather than assuming zero files. Recovery requires an independently protected expected bundle digest and the expected school/export identities, then rechecks the dataset manifest and relationships. It returns structured records and bytes; it never executes restored SQL or trusts archived filesystem paths.

These packages are deliberately labeled **core-records-only**. Course/term and rubric context, historical audit events, private-file discovery and transfer, readable transcripts, independent receipt protection, job scheduling/status, and actual database restore still need implementation and verification. Unit-tested JSON recovery is not a full database restore or proof of production retention. The existing synthetic cloud probe is separate and has not uploaded these school bundles.

Read-only readiness checks found no unlinked classroom/job-card students in production and 3 inactive students that must be retained. The official finalization tables were subsequently installed in production through PR 72. Staging has 5 classroom submissions and 1 job-card submission without canonical student links; an all-staging package must remain incomplete until those legacy records are reconciled. Do not silently drop them, guess links, or modify live student identities to satisfy a test.

Validation: 18 bundle tests, 5 reader tests and the original 10 synthetic AWS tests. Tests cover school separation, inactive students, all grade revisions, correction history, mismatched relationships, duplicate/truncated records, missing datasets, unresolved students, forbidden join codes, missing/corrupt/version-changed attachments, schema drift, transactional rollback, and trusted-receipt verification. No new database objects, access grants, production uploads, schedules or deletions were made by this implementation.

### Live final-grade dependency verified

Production commit `8f883206f5adc74d1c7c7ef35207f7899be2e397` was published in Netlify deploy `6aae99422df84f00083b45bf` at `2026-09-19T14:17:23.684Z`. The approved `gradebook_finalization_release` migration installed the final-grade table and protected functions. Direct authenticated inserts/updates and anonymous reads/RPC execution are denied; RLS and the immutable-history trigger are enabled.

Signed-in staging tests saved a 90% shop final, corrected it to 85%, and preserved both versions. A 67.5% theory final appeared alongside the shop final in Student record. Another synthetic student showed no finalized grades. Live LTG verification confirmed final-review controls load, incomplete course requirements disable finalization, Student record reads the production history, and no browser errors were recorded. Production finalization count remained zero: no real student grades were finalized by these checks.

This release satisfies the final-grade database dependency; it does not activate the independent archive or complete certificate delivery. No Codespaces, repositories, branches or deployment resources were deleted.

