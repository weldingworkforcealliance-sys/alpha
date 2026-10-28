# PVHS signoff staging review

Staging only. Do not merge or promote to production without separate approval. SQL files require the isolated PVHS 55-day REVIEW 20261027 school and have already been applied only to Gltg staging.

Adds instructor-controlled per-student CNC authorization, WLD120 QC gates at days 20/30/40, and WLD150 day31 bend-test attempts. Evidence and criteria are mandatory. History is append-only. Upstream QC holds invalidate downstream releases. No lesson completion or pending assessment automatically awards a grade.

All 440 review section days remain undated; eight sections remain draft and manually held. Existing student records are unchanged. Synthetic integration fixtures were rolled back.

Validation before publication: 281 repository tests, 38 curriculum/source checks, typecheck, targeted ESLint, migration filename checks and complete Next build passed. Database role/workflow integration checks passed; fingerprints of all 106 public tables unchanged. Hosted visual review remains pending.

Unresolved calendar/source issues: WLD114 credit discrepancy (syllabus 2 versus archive 1); WLD120/150 night schedules 23 versus archive24; WLD150 archival description mislabeled WLD120. Dates must not be inferred from these sources.
