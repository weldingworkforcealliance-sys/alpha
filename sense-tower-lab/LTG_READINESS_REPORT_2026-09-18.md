# Welding Record Tower — Full Core Test & LTG Readiness Report

Date: 2026-09-18

## Result

**Core test status: PASS**

- Runtime / state / grading / record tests: **57 / 57 passed**
- Event-handler + static UI contract tests: **12 / 12 passed**
- LTG / gradebook schema compatibility checks: **16 / 16 passed**
- **Total: 85 / 85 passed**

No production LTG data, Supabase tables, attendance records, or real student PII were modified by this test.

## Runtime coverage

### Boot and rendering

Passed:

- v5 state initializes.
- demo roster initializes.
- stable LTG student identity exists on each record.
- four-digit Weld Test IDs initialize sequentially.
- every major view renders:
  - Tower Home
  - Lab Grade Tower
  - Course Records
  - Competency Tower
  - Knowledge Exam Tower
  - Qualification Tower
  - Destructive Tests
  - Student Passport
  - Admin / Readiness

### Level I project matrix

Passed:

- 79 welding-position projects.
- 7 cutting-project shells.
- Level I weld assignments map to WLD 110 academic shop grading.
- groove qualifications include Backing and No Backing.
- Level I qualification records map to WLD 110.
- source-position restrictions remain intact.

### Academic shop grading

Passed:

- perfect 100 raw rubric = 95.0% course grade.
- Attempt 1 critical defect = automatic F / Retest.
- incomplete Attempt 2 does not replace Attempt 1.
- completed Attempt 2 replaces Attempt 1 even when lower.
- Attempt 2 critical-defect maximum remains 76.0%.
- qualification Pass/Fail never becomes numeric shop-grade points.
- real five-tap instructor event flow completes and auto-saves.
- Next Student queue advances.
- Attempt 2 remains locked until Attempt 1 completion.

### Four-digit Weld Test ID

Passed:

- first assignment is 0000.
- sequential allocation.
- no duplicates.
- 17-student welding roster allocates 0000–0016 correctly.
- imported duplicate IDs are repaired.
- 0000–9999 exhaustion fails safely.
- displayed ID is read-only.
- Save/render does not alter the ID.
- once issued, UI exposes no edit path.

The production LTG design uses a database sequence + UNIQUE constraint + immutable trigger rather than relying on browser allocation.

### Course-record architecture

Passed:

- WLD 105 and WLD 110 remain separate academic records.
- WLD 205 and WLD 210 remain separate academic records.
- there is no combined semester grade.
- WLD 105 includes planner-linked fabrication-project items.
- WLD 110 numeric evidence comes from Lab Grade Tower weld grades only.
- WLD 210 does not accidentally inherit WLD 110 grades.
- future theory/shop course pairs can be added through course data without a new code branch.
- future shop assignments can map to a new course ID.
- destructive-test shop-course selector reads the data-driven course catalog.

### Qualification records

Passed:

- Pass/Fail is separate from academic grade.
- Backing / No Backing groove categories render.
- qualification records carry course identity in the LTG bridge.
- qualification result does not alter WLD 110 numeric grade.

### Destructive tests

Passed:

- sequential DT record numbers.
- permanent student LTG identity retained.
- immutable Weld Test ID retained.
- course ID + course code retained.
- Pass/Fail retained separately from numeric grades.
- passing tests become certificate-ready.
- failed tests cannot create a certificate.
- certificate creation is idempotent in the standalone flow.
- destructive-test UI exposes no Edit/Delete controls.

### Certificate records

Passed:

- certificate record generated only from passing destructive test.
- certificate stores a snapshot of:
  - stable student ID
  - Weld Test ID
  - destructive-test ID
  - course
  - process
  - material
  - position
  - backing category
  - method
  - result
  - date
  - inspector
- certificate preview points back to the immutable destructive-test record.

### Persistence / upgrades

Passed:

- standalone state saves as v5.
- v4 state upgrades to v5.
- legacy weld assignments receive WLD 110 course mapping.
- missing permanent-record structures are backfilled.
- missing stable LTG identity is backfilled.
- invalid state falls back safely.

### LTG bridge contract

Passed:

- stable LTG student IDs exported.
- immutable Weld Test IDs exported.
- planner project records stay separate from shop grades.
- shop records expose idempotent source keys.
- numeric shop grade records identify course.
- automatic F is **not silently converted into a number**.
- automatic F is exported as:
  - `gradebookWriteReady: false`
  - `academicOverride: "F"`
  - `officialScore: null`
- qualification Pass/Fail exports independently.
- destructive tests export.
- certificate snapshots export.
- Admin / Readiness can export the normalized LTG bridge JSON.

## Existing LTG gradebook compatibility

The gradebook foundation branch already provides the right academic backbone:

- program / level / semester / course-pair records;
- separate theory and lab/shop gradebooks;
- stable student UUID enrollment;
- theory assessment imports;
- custom gradebook categories/items;
- multiple attempts;
- append-only grade revisions;
- no theory/shop averaging;
- future positive-number semesters without a hard-coded ceiling.

The Tower now aligns with that model instead of attempting to replace it.

### Integration extension prepared

`sense-tower-lab/LTG_INTEGRATION_DRAFT.sql` is a **review-only SQL draft**, intentionally outside `supabase/migrations`.

It prepares:

- idempotent planner/Tower source keys for gradebook items;
- idempotent external attempt keys;
- race-safe four-digit Weld Test ID sequence;
- immutable student Weld Test IDs;
- permanent Pass/Fail qualification table;
- permanent destructive-test table;
- certificate snapshot/version table;
- append-only final course-grade revision table;
- RLS read boundaries using existing gradebook authorization;
- update/delete rejection on permanent welding evidence.

The draft ends in `ROLLBACK` and grants no direct production writes.

## Current LTG integration status

### Ready at the basic core

**Yes.**

The Tower is now structurally ready to become an LTG subsystem because:

1. student identity has an explicit LTG key;
2. academic records are course-aware;
3. future course pairs are data-driven;
4. theory/project grades and shop grades remain separate;
5. qualifications are Pass/Fail only;
6. destructive tests are permanent standalone evidence;
7. certificates are generated from stored test snapshots;
8. permanent IDs are immutable;
9. data can be exported through a normalized LTG bridge;
10. database integration boundaries are drafted around the existing gradebook model.

### Not ready for a production merge yet

These items are intentional blockers, not failed tests:

1. **Gradebook branch reconciliation**
   - Current `main` does not contain the gradebook-foundation files.
   - `feature/gradebook-foundation-2026-09-17` is heavily diverged from current `main`.
   - The gradebook foundation must be reconciled onto current LTG before Tower database integration.

2. **Automatic Attempt 1 F numeric policy**
   - Tower correctly treats a critical Attempt 1 as F.
   - The user has not defined what numeric value, if any, that F contributes to WLD 110/210 final-grade arithmetic when no Attempt 2 replaces it.
   - The bridge therefore blocks numeric write rather than guessing.

3. **Official course-final calculation**
   - WLD 105/110 and 205/210 are separate grades.
   - Category weights / final arithmetic have not been approved.
   - Storage/finalization architecture is ready, but the system must not invent the calculation.

4. **Production write RPCs**
   - Draft schema deliberately grants no direct writes.
   - Security-definer RPCs must be reviewed and tested against current production/staging RLS before migration.

5. **Final destructive-test method catalog**
   - Test method remains controlled free text in the prototype.
   - A formal catalog can be added when program rules are approved.

6. **Final certificate rendering**
   - Certificate data record is ready.
   - Branded PDF/certificate layout, reissue workflow, signatures, and rendered-file storage remain future work.

7. **Visual browser QA**
   - Static responsive CSS and render contracts passed.
   - This test did not replace a real instructor desktop/tablet/mobile usability session.

## Branch condition

At test time:

- `lab/aws-sense-tower-v2` is diverged from `main`, but the draft PR remains GitHub-mergeable.
- Direct production merge is **not recommended**.
- Integration should start from current `main`, bring forward/reconcile the gradebook foundation, then port the Tower core through the LTG bridge contract rather than merging the historical lab branch wholesale.

## Recommendation

The next engineering stage should be an **LTG integration branch**, not another redesign of the standalone Tower.

That integration branch should:

1. reconcile the current gradebook foundation with current `main`;
2. install the Tower as an authenticated LTG feature;
3. map live roster UUIDs to immutable Weld Test IDs;
4. write WLD 105/205 planner items into theory gradebooks;
5. write WLD 110/210 shop attempts into their own gradebooks;
6. store Pass/Fail qualifications outside numeric grade arithmetic;
7. add permanent destructive-test / certificate tables;
8. run staging RLS and end-to-end instructor tests before any production deployment.
