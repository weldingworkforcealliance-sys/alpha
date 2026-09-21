# LTG Monday production repair — 2026-09-21

Production: beta genco (`qsmvgyyaemjmklceyikr`). Source base: `74ffb2b6777a7ebefdc4dd3fd68d37f63c3793a9` on `product/standalone-mainline-2026-09-11`.

## Progress and attendance

The repair reconciled finalized instructional attendance and actual delivery history. The user explicitly confirmed completion of PVHS A WLD 205 Day 8, PVHS A WLD 210 Days 6–8, and PVHS C WLD 110 Days 6–8. Seven missing delivery rows were inserted as completed. Unknown actual dates, start/end timestamps, instructor identities, and instructional minutes remain null. Confirmation provenance is recorded on each delivery row and in the private database audit.

| Section | Before | After |
| --- | ---: | ---: |
| PVHS A WLD 205 | 8 | 9 |
| PVHS A WLD 210 | 6 | 9 |
| PVHS C WLD 110 | 6 | 9 |
| PVHS B WLD 110 | 8 | 8 |

PVHS B WLD 110 Day 8 remains pending by explicit user instruction. PVHS B and C theory were already on Day 9. B theory's active Monday timer was preserved.

The blank PCCC Day Level 2 September 19 draft and its one blank child attendance row were removed after a transaction guard verified no marks, notes, report, finalization, or actual delivery and a September 22 course start. The complete deleted records are retained in the database audit. The separate September 21 blank draft and September 22 preparation draft remain unchanged.

Day Level 2 has exactly one active enrolled student; both associated gradebooks contain that same student. No students were created or changed. Night orientation and its 11 attendance rows remain non-counting and unchanged. Both PCCC Day and Night course pairs remain at Day 1, September 22.

Existing historical delivery records, including lessons actually delivered on later dates and archived Day 5 starts, were retained. Curriculum, outcomes, guide days, segments, resources, planner dates, and orientation records matched their pre-repair fingerprints.

## Watchdog

Migration `20260921130703_class_watchdog_actual_delivery_date.sql` and `send-class-watchdog-reminders` version 2 are deployed.

- Detect started lessons using their actual Eastern delivery date even when their planner date is older.
- Detect unclosed scheduled classes at the due time independently of a stale current-day counter.
- Suppress a phantom next lesson after another lesson was completed on the actual class date.
- Restrict reminder eligibility to 30 minutes through just before 90 minutes after scheduled end.
- Revalidate at claim and immediately before sending; mark obsolete work cancelled.
- Deduplicate by section, scheduled end, event type, and recipient so a moved planner lesson can be reminded on a later actual date.
- Build attendance links from the actual scheduled-end date.
- Preserve worker secret authentication and service-role-only function access.

No cron schedules, curriculum, outcomes, or attendance finalization rules were changed.

## Validation

Transactional database regression fixtures passed, and their section/progress/delivery/queue fingerprints proved fixture rollback. Cases cover actual-date mismatch, early/expired windows, deduplication, late completion, stale counters, holds, claim eligibility, retry cancellation, pre-send resolution, and client-role denial.

Four worker tests passed using mocked email transport (no test emails): correct attendance date, cancellation after claim, revalidation failure, and invalid worker secret. Run with `node scripts/test-class-watchdog-worker.cjs`.

Production remained ACTIVE_HEALTHY with zero deadlocks. The 09:10 ET scheduled workers returned HTTP 200, claimed zero messages, and the attendance queue contained 25 sent reports with no failed/pending reports. Security advisor finding counts and details remained unchanged; existing advisories were outside this repair.

PVHS A's instructor-facing view was verified under Anthony's authenticated role: both courses return Day 9 for September 21, without holds. An already-open page must refresh; historical lesson browsing may require Back to Current Day.

## Audit and recovery

Database audit actions share `details.run_id = 'ltg-monday-repair-20260921'`. The data transaction created seven completion events, three progression events, one deletion event, and a summary event. The watchdog deployment has its own audit event.

Private local evidence includes pre-repair snapshots, original function definitions, the guarded repair SQL, results, and verification. Student data and deleted-row snapshots are intentionally kept out of this public repository. Undo must compare current records with the audited after state and stop if instruction has continued.
