# LTG Stabilization Change Log — 2026-09-10

- Created dedicated stabilization branch from current `main`.
- Added database hardening migration.
- Added regression test for the hardening migration.
- Added stabilization gate, QA checklist, findings, and release notes.
- Applied the same hardening migration to the live `beta genco` Supabase project.
- Verified direct authenticated access is removed from the targeted internal helpers while service-role execution remains available.
- Verified the unique replacement indexes remain after dropping their redundant non-unique twins.
- Closed two expired Connected Classroom session rows and two expired Training Mode session rows in the live beta database.
- Verified zero expired active classroom/training session rows remain immediately after cleanup.
