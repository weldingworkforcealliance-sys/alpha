# Scoped attendance completion checkpoint — 26 September 2026
Gltg staging only. No production migration, deployment, or merge.

## Final implementation
The local preview now calls the existing class/date-scoped attendance RPCs for individual saves, mark-all, reset and finalization. Completion-course initial-status controls are disabled and bulk initial edits are hidden there. API error objects use the existing safe error formatter instead of rendering [object Object].

The prior temporary authenticated grants on the three legacy edit RPCs have been revoked again. Earlier attendance-edit-grants evidence is historical, superseded by this checkpoint. Staging already contained the scoped RPCs; the old preview did not use them. This discovered client/database drift is a deployment prerequisite: do not promote or merge until the scoped-function migration history is reconciled with the repository.

Added the missing attendance_pairs.report_trigger column with the repository's finalization default and allowed-value constraint. The installed finalization function referenced this absent column and failed with SQLSTATE 42703. Both staging pairs are standard mode. Existing report destinations were not changed.

## Verified
- Four simulated roles passed scoped reset, mark-all, correction and finalization, with zero queued reports. Transactions rolled back all test mutations.
- Unrelated-school access, stale dates, completion-course bulk initial edits and finalized edits denied. Anonymous scoped calls and authenticated legacy edit calls denied.
- Additive-column rollback and reapplication succeeded; scoped tests passed afterward.
- Browser saved a left-early exception and note, finalized both students, and displayed the persisted finalized record in History. One student present and one left early; no queued report.
- Build/typecheck passed. 275 application tests passed. Edited file lint passed.
- Broad smoke: 44 observations including eight known wrong-lab-fixture precondition errors; separate appropriate-fixture lab checks passed 8/8.

## Remaining
- History header shows 2 needs review for the test day with one exceptional student; inspect badge aggregation next.
- Four separate signed-in browser roles, manager corrections, report export, PVHS email isolation and delivery remain unverified.
- Scoped RPCs exist in staging but are absent from this downloaded source's migration files. Reconcile provenance before any promotion. This run never promotes.

## Rollback
For the added column, rollback/attendance-report-trigger.sql preserves customized settings by refusing to drop the column when values differ from the default. Dropping it restores the original finalization failure, so prefer forward repair. The client change can be reverted in Git, but the older client is incompatible with restricted legacy grants; do not restore it independently. The grant-only compatibility repair is superseded and should not be reapplied as the long-term solution.

