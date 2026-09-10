# LTG Stabilization Release Notes — 2026-09-10

This release is a hardening pass, not a feature release.

### Database security

Direct anonymous/authenticated execution was removed from internal training-report helpers, agenda-time recalculation helpers, trigger helpers, and retired Connected Classroom v1 RPCs. Normal higher-level LTG workflows continue through their existing guarded functions.

### Database housekeeping

Two redundant non-unique indexes were removed because unique indexes on the same ordered columns already provide lookup coverage and uniqueness enforcement.

Expired Connected Classroom and Training Mode rows found during the audit were closed in the live beta database. Historical attendance data and the existing unfinalized attendance session were intentionally preserved.

### QA

A regression test was added to keep the hardening migration intact. A repeatable stabilization QA checklist and release gate were documented for future large changes.

### Deliberately not changed

No approved curriculum or outcomes were altered. No attendance history was deleted. No attendance session was auto-finalized. No large CSS refactor was included in this release because visual-layer consolidation needs its own regression-protected pass.
