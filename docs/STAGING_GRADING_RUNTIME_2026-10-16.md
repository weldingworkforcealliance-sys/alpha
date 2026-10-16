# Grading runtime synchronization — staging only

The WLD 105 grading tower reported that `ensure_wld105_gradebook_setup(p_gradebook_id)` was missing from the schema cache. Inspection confirmed the function and its fabrication/homework tables were absent, rather than merely cached incorrectly. The preview frontend was ahead of the isolated staging database. The current WLD 110 decision endpoint and grade correction endpoint were also missing.

Applied the following existing repository migrations together to **ezlvivmeneefiiwqwgqd only**, under the recorded migration name `staging_sync_grading_runtime_october_2026`, then requested a PostgREST schema reload:

- `20261007214209_wld105_fabrication_grade_tower.sql`
- `20261007214356_wld105_fabrication_fk_indexes.sql`
- `20261007221648_wld105_binary_aws_homework.sql`
- `20261009212549_wld110_assignment_selection.sql`
- `20261010120625_wld110_instructor_decision.sql`
- `20261011134827_grade_correction_guards.sql`

No new grading rules were invented. The current repository's rubric logic, homework rules, history guards and permissions are retained. SQL transaction wrappers were removed from the combined payload so it could be applied as one managed migration. No production migration or deployment was performed.

Verification:

- All 65 focused tests passed, including new executable SQL tests for WLD 105 setup, weighting, fabrication attempts, homework corrections, unauthorized access and RLS. These run on a disposable local database with synthetic records, not real students.
- TypeScript and targeted lint passed.
- All seven newly restored instructor endpoints have the expected named arguments, authenticated execution grants and no anonymous execution grant.
- The read-only `supabase/verify-grading-runtime.sql` check returned zero missing endpoints across 28 grading functions.
- The staging HTTP endpoint resolves the exact setup function/argument name and rejects a signed-out request with `42501`, rather than the previous missing-function error.
- Before/after fingerprints match for gradebook attempts and revisions, Tower records, WLD 110 attempts, completions and progress, and finalizations. The new nullable decision field on historical shop attempts is excluded from the comparison; no historical scores or records were changed.
- Signed-in browser acceptance remains with the instructor; no real student grade was entered by the agent.

Release acceptance must check deployed database compatibility as well as frontend build/tests. Do not replay these migrations against production blindly; inspect its existing migration/schema state first. PR #141 stays a draft pending explicit production approval.
