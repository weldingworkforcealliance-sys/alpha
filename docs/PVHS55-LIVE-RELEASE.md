# PVHS 55-day live release

Authorized by the user on October 28, 2026: “push to live version use dates u have.”

This release is based on the current production branch, not the divergent staging branch. It adds four shared 55-day lesson masters and eight separate B/C sections. Existing approved, locked syllabus authorities, night guides, WLD 105/110 classes and student records are preserved.

## Schedule

- WLD 114/115: December 21, 2026–March 22, 2027; instructional block 2.
- WLD 120/150: March 23–June 16, 2027; instructional block 3.
- Each course has 55 scheduled student days. B: 08:30–09:30 / 09:30–11:30. C: 11:30–12:30 / 12:30–14:30.
- WLD 120 QC: April 27, May 11, May 25. WLD 150 bend review: May 12.
- Early-dismissal and exam days are included as authorized dates; actual available minutes remain unconfirmed. No attendance, delivered time, grade or competence is inferred.

## Data boundary

`scripts/pvhs55-live-sql.mjs` generates bounded insert-only batches and a separate activation transaction. Every batch fingerprints existing rows in its touched tables and aborts on an unexpected modification. Imports reuse approved curriculum authority and protected outcomes; they do not insert or alter institutional syllabi, credits or outcomes.

The new sections remain draft until all 440 calendar rows pass timing and curriculum checks. `curriculum/pvhs55/link-cohorts.sql` continues each cohort's existing theory/lab instructor assignments and reporting configuration, creating four new attendance pairs without copying student rosters. Enrollment is intentionally empty. No email/report is sent by this release.

The signoff migration scopes all new operations to the eight new section codes and PCCC school. Authenticated assigned instructors or authorized school reviewers can record append-only observations. CNC authorization is machine/operation-specific. QC30 requires a current QC20; QC40 requires a current QC30. Upstream replacement invalidates downstream releases. Failed/invalid bend tests cannot release a checkpoint. Pending grades remain unscored; signoffs never create academic grades. Future scheduled dates and holds block lesson delivery.

## Verification

Staging rehearsals verified instructor permissions, cross-section isolation, evidence requirements, stale-review rejection, CNC revocation, QC sequencing/invalidation, bend retest history, inactive-enrollment revocation, immutable history, pending-score rejection and preserved assessment attempts. Synthetic student fixtures rolled back.

All 220 lesson bodies, 440 assigned dates, 60/120-minute allocations and approved outcome links were checked. The production import uses the existing compliance view and deferred constraints. The staging fixture needed missing course pairs and two WLD 114 outcomes brought into line with production; no such institutional changes were made in production.

The application checks cover migration filenames, TypeScript, lint and 740 tests. Release-page checks verify 220 dated lessons and local links. Dependency updates retain production-only features while bringing Next.js, Vite, Vitest and the affected undici dependency to patched releases.

Signed-in browser/visual checks remain pending by the user's earlier instruction. This does not claim that those checks passed.

## Source limits retained

The supplied DOCX sequence is preserved. The earlier long planner chat remains unrecovered. WLD 114's supplied syllabus lists 2 credits versus 1 in an archive; this release does not change registrar credits. WLD 150 archival description/corequisite labels and the night WLD 120/150 23-versus-24 meeting discrepancy remain unresolved. Instructor-authored rubric details remain labeled in the planners. Installed-machine procedures and authorized Academy references require instructor verification before use.

## Release operations

Apply only the new signoff migration; do not replay the repository's historical migrations. Generate/import the bounded curriculum batches, validate, link the new cohort pairs, and activate only this release's section codes. The application source must be merged into the existing production branch so a later Git deployment retains the release.
