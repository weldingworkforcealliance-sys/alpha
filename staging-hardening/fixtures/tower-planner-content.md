# Tower planner staging fixture — 26 September 2026

Applied only to Gltg ezlvivmeneefiiwqwgqd and existing synthetic section 881d8372-445c-4e1b-bfb3-23c211334bf0 (TOWER-TH).

Before: selected class had no course guide, planner days or progress. Gltg contained zero guide resources and resource sources.
After: one clearly labeled sample guide, two guide/planner days (28–29 September), four 15-minute segments, two resource entries, one source, one initial progress row, and an openable original sample HTML worksheet. This is representative software-test content, not a restored production curriculum.

Scripts: fixtures/tower-planner-content.sql and rollback/tower-planner-content.sql. These are data-only scripts outside normal migrations. Use only the named staging project; the seed checks exact synthetic section identity and refuses an already-populated class. No schema, grants, RLS, auth or global hooks change. No real records or production content were copied.

The worksheet is public/staging-record-worksheet.html in the draft source. The running local preview was restarted to include it. Both resource URLs are same-origin paths. The hosted preview remains blocked separately.

Validation:
- Seed executed successfully in a rolled-back dry run, then committed.
- Cleanup SQL rehearsed inside a transaction that was rolled back, leaving all content present. It refuses started/completed planner activity and changed guide/resource counts. Review any subsequent edits/dependencies before removing fixtures; it is not a full backup.
- All four roles saw 2 guide days, 2 resources, 4 segments and 2 planner days with active test memberships and teaching assignments. Temporary memberships/assignments were rolled back.
- Existing 44 role observations matched the prior baseline, including expected lab-precondition rejections for the unrelated generic gradebook. Separate suitable lab fixtures passed all 8 Shop/Tower checks.
- Signed-in browser displayed the sample guide, agenda, coaching notes, calendar and worksheet.

Scope limitation: other staging courses are not populated by this fixture. No claim of full curriculum completeness or production parity. Start Today is subject to the sample schedule. No production promotion is authorized.
