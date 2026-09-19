# Tower integration status — September 19, 2026

The integrated Gradebook/Tower is deployed to live LTG. This replaces the original pre-release checkpoint; full workflow sign-off is still pending for the items listed below.

## Released and previously verified

- PR #71: authorized Tower screens integrated with the existing gradebook, immutable Weld Test IDs, database-backed assessments, saved revisions, counted-attempt rules and permanent test/certificate snapshots.
- Critical-defect Attempt 1 counts as 0% unless replaced by completed Attempt 2. A completed Attempt 2 replaces Attempt 1 even if lower; critical-defect Attempt 2 has a 76% maximum.
- PR #72: protected official course finalization and retained final-grade history in Student record. Approved weights: shop 75% weld performance / 25% shop projects; theory 50% assessments / 25% fabrication projects / 25% homework; passing 65%. Required items must be graded or marked missing/excused before finalization.
- PRs #74 and #75: downloadable certificate PDF and the corrected private PCCC template, including student/test ID fields and Anthony Ruffino.
- PR #76: lab grading opens inside the planner below attendance.
- Archive worker: first live all-school backup and isolated record/file recovery passed in Actions run 35459272170, with independent administrator recovery and confirmed test-alert delivery. Weekly scheduling is enabled on default branch main: PR #79 changed it to Fridays at 22:00 America/New_York, starting September 25, 2026. See [archive activation](ARCHIVE_ACTIVATION.md).

The production deployment branch is `product/standalone-mainline-2026-09-11`; it is distinct from default branch `main`. Before archive release housekeeping, Netlify published commit `b19ef0a0d0cae7a63d1d91be427fcf1388e7238a`, including PR #76, and the production build passed.

## Validation evidence and limits

Initial Tower validation passed 111 tests across 28 files, TypeScript, targeted lint, migration filename checks and a production build. Synthetic database tests covered grade arithmetic, stale revisions, retry idempotency, lower Attempt 2 replacement, retained history, authorization and tenant isolation.

Subsequent signed-in staging final-grade tests saved and corrected a shop final while retaining both versions and displayed a theory final alongside it. Live checks verified review controls, incomplete-course blocking and Student record reads without finalizing real students' grades. The user confirmed PDF generation and approved the corrected certificate design. These are prior release checks, not a claim of a fresh complete browser walkthrough during housekeeping.

The approved Tower, finalization and private certificate database changes have been installed in production. Older statements that production was not migrated are obsolete.

## Remaining work

- Automatic certificate email delivery and verified certificate correction/reissue.
- Final instructor acceptance walkthrough of the complete live workflow.
- Observe the first scheduled archive run and overdue-alarm clearance; arrange storage funding or independent migration before free-plan exhaustion.
- Independently inspect and preserve all Codespace work before considering deletion.

The older default-main application build currently fails in `app/class-time-watchdog.tsx` with missing inferred object properties (Actions run 35455748414). The production branch already contains the typed-Map correction and passed its build. This unrelated default-main build failure does not mean the pinned archive worker failed.

## Codespace preservation audit

No Codespaces were deleted. On September 19 the GitHub UI showed:

| Codespace | Storage | State |
| --- | --- | --- |
| ubiquitous space zebra | 6.9 GB | main with a change indicator; editor start disabled by usage/budget limit |
| organic journey | 6.87 GB | main with a change indicator; editor start disabled by usage/budget limit |

Automatic deletion was turned OFF for both, honoring the owner's instruction to retain them until the full Gradebook/Tower workflow is functional and work is preserved. Their combined displayed storage remains about 13.77 GB; no storage saving is claimed.

The existing organic-journey export branch `codespace-organic-journey-qvp4qw99j7wvc4x9` was verified at `a5438194e1d51f32052c39d5b51180589d3fba3e`. A branch existing does not prove it includes all current workspace files. Neither Codespace's current files could be independently inspected while start was disabled.

GitHub offers an export-to-branch action, but blindly publishing unseen workspace files into this public repository is not an acceptable preservation check. Once access is available, inspect changed/untracked files and local commits, preserve appropriate source and private artifacts separately, compare required work with production, and only then reconsider cleanup. No budget increase or paid upgrade was performed.
