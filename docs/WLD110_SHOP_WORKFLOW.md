# WLD 110 SMAW shop workflow

This change is based on the active LTG product branch,
`product/standalone-mainline-2026-09-11` at `8460c36`, which contains
the existing Tower and gradebook integration. The repository's `main` branch
does not yet contain those dependencies.

## Instructor and student operation

Open **WLD 110 Shop**, the WLD 110 gradebook's **Shop board**, or lab grading
inside the planner. The board uses the existing class enrollment and instructor
authorization. Requested checks appear first, oldest first.

**Grade weld** opens five categories, each starting at Good:
Straightness, Placement, Execution, Consistency / Workmanship, and Weld Size /
Profile. Excellent = 20, Good = 18, Acceptable = 16, Needs Work = 12.
The displayed and saved total is out of 100. Needs Work alone expands that
category's optional deficiency tags. A normal Good weld needs only Save grade.

The instructor evaluates the physical weld with the existing LTG sizer before
saving. Its original guidance and choices were moved unchanged from Tower into
`lib/weld-sizer.ts`; Tower and the shop now consume that shared reference.
No new tolerance table, bead-count rule, or automatic measurement system was
introduced. Each formal attempt retains the sizer reference version and optional
measurement/inspection note.

**Practice / coach** saves a current focus and clears a check request without
creating an attempt or grade. After a successful coaching save, the form is replaced
by that student's named QR card and saved practice focus. The student scans it
to open their personal shop card immediately. **Student QR** also opens the card
directly from a roster row, with open/copy link fallbacks.

QR images are generated locally in the browser. A student's existing link is
reused within the current board session, including later coaching saves. The
first issuance in a new session replaces their previous link. If QR preparation
fails, coaching remains saved and **Retry student QR** retries only the QR step. The card shows the
assignment, electrode, coupon, practice/check status, focus, latest grade,
last completed competency grade, and next assignment.

## Qualification and academic records

- Weld 1 is the original graded baseline, as specified in the approved rule.
- A later weld completes the competency only when every category is at least
  Acceptable and its total is at least Weld 1's total.
- An unsuccessful second or later weld does not replace that baseline.
- The competency grade is the mean of Weld 1 and the first qualifying later weld.
  For example, 86, 82, 90 results in 88 using Welds 1 and 3.
- Every formal attempt is immutable and retained, including unsuccessful attempts.
- The save, completion, gradebook posting, queue removal, and advancement are one
  database transaction. Save IDs make network retries idempotent; row locks and
  revisions reject stale concurrent grading.

Progression is Flat E6010 → Flat E7018 → 2F E6010 → 2F E7018 →
3F vertical-up E6010 → 3F E7018 → 4F E6010 → 4F E7018 →
advanced 2G E7018 with backing. Every electrode is 1/8 in.
The specified flat and cruciform coupon dimensions appear on the student card.

All eight core competency items are created in the existing
`weld_performance` category. Incomplete items remain unresolved for the existing
course-finalization checks. Only completed competency averages post academic
scores, not practice or each retry. Advanced 2G is recorded as enrichment and
does not add a required gradebook item. The existing 75% weld-performance / 25%
shop-project course weighting, passing threshold, finalization workflow,
curriculum, and outcomes are unchanged.

Existing Tower records are preserved. Prior generic Tower rubrics cannot be
silently converted into electrode-specific qualifying demonstrations. At review
time, the production WLD 110 books had no Tower graded attempts to reconcile.

## Pacing and access

The 23-night guide is an instructional benchmark, independent of advancement.
At six recorded instructional meetings in a position, the board shows a pacing
review. It excludes orientation, future dates, and elapsed non-class days.
The position clock spans both electrodes and resets on a position change.
Coaching never advances a student.

New tables have RLS and no direct browser write privileges. Instructor RPCs
repeat section, course, and current enrollment checks. Personal student links
use two random UUIDs, expire after 120 days, and are stored as hashes in a private
table. The browser removes the link fragment after retaining it in tab session
storage. Student RPCs expose only that student's shop record, omit instructor
identity, and allow only a check request. Revocation, expiration, and withdrawal
prevent further access.

## Deployment and validation

Apply the five `wld110_shop_*` migrations in filename order, then enable
`NEXT_PUBLIC_WLD110_SHOP_ENABLED=true` in the target app environment. Filenames
match the versions recorded by the staging Supabase migration service.
Deploy previews enable the feature against Gltg staging. Production activation
follows the migration and archive recovery checks below.

The archive worker now includes `wld110_shop_progress`, `wld110_shop_attempts`,
and `wld110_shop_completions` in its reviewed inventory and read-only grants.
New v2 school archives retain all 28 core datasets, including failed attempts
and completion references. Recovery continues to accept original v1 archives
with their original 25 datasets; it never invents shop history for older files.
Private student access tokens remain excluded. Before production activation,
pin the tested worker revision and verify a complete production backup/recovery.
The existing Friday schedule, destination, retention, and monitoring stay intact.

Archive validation includes a fixed archive generated by the previous worker,
77 local tests, and two additional real PostgreSQL drills in GitHub CI. The
synthetic drill restores every 86 / 82 / 90 attempt and its 88 completion grade,
including inactive students, while rejecting mixed-school or broken references.

- Unit and component tests: `npm test`.
- TypeScript, lint, migration filenames: `npm run check`.
- Database integration: `supabase/wld110-shop-test.sql`, staging only. It creates
  synthetic fixtures and rolls back. Covers full nine-step progression, exact
  scores, baseline comparisons, third attempts, Needs Work, history, idempotency,
  stale saves, queue, pacing, gradebook posting, advanced enrichment, unauthorized
  access, and withdrawal.
- Existing Tower tests verify the shared sizer still has exactly its original
  guidance and score choices.
- Supabase advisors: the new reference indexes are present. The private token
  table intentionally has RLS with no client policies or direct table grants.

## Verified September 19, 2026

The 157 unit/component tests, TypeScript, lint, migration filenames, optimized
build, and public/protected route smoke checks passed. The staging database
integration script passed without retaining its fixtures.

A real signed-in browser test against staging verified a student check request,
instructor queue, conditional deficiency tags, the 86 → 82 → 90 retry sequence,
the 88 competency score in both views after reload, and all nine competencies.
The completed record contained 19 attempts, nine completions, and eight posted
core grades. Phone layout, visible default Good selections, and final completion
screens passed without browser errors. The explicitly approved temporary
instructor accounts, class, students, grades, and links were removed and absence
was verified. Screenshots contain synthetic students only.
