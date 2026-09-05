# LTG Attendance — Deferred Batch Deployment

Status: prepared for a future combined LTG release. Do not deploy this module separately and do not apply it to the live Supabase project until the other approved changes are ready.

Prepared branch: `attendance-module-review`

Prepared baseline: merged with LTG `main` at `313658b68550d3a1c45b1fa111508104a455b131`

Attendance merge commit: `516b2a54d44126c39228f10cbbde1311ca57720a`

## What belongs to this deployment unit

- Instructor attendance page and navigation
- End-of-pair attendance confirmation from the LTG planner
- School-admin class-pair configuration and bulk student roster import
- Shared enrollment across linked course sections
- Standard and PVHS attendance modes
- Attendance history, corrections, notes, audit records, and RLS
- PVHS report queue and 30-minute email worker
- Attendance database migration and review documentation

## Combine with other changes

1. Create the final batch branch from the latest `main`.
2. Merge `attendance-module-review` and the other approved change branches into it.
3. Resolve conflicts in favor of the latest shared LTG services while preserving the attendance check around `complete_current_planner_day`.
4. Confirm the final batch still contains `supabase/migrations/202609050005_student_attendance_module.sql` and `supabase/functions/send-attendance-reports/index.ts`.
5. Run the complete validation set once against the combined result.

Because `main` can continue changing, being current at the time this manifest was written does not replace the final merge-and-test cycle.

## Required deployment order

1. Take or verify a current Supabase backup.
2. Test all pending migrations together in a disposable or staging Supabase environment.
3. Run Supabase Security and Performance Advisors and resolve new findings.
4. Apply the combined database migrations to production.
5. Deploy `send-attendance-reports` with gateway JWT verification disabled. The worker requires its own `x-attendance-cron-secret` header.
6. Set `RESEND_API_KEY`, `ATTENDANCE_FROM_EMAIL`, and `ATTENDANCE_CRON_SECRET` as server-side secrets.
7. Store the report-worker URL and matching cron secret in Supabase Vault, then schedule the worker once per minute.
8. Deploy the combined LTG web application.
9. Configure the PVHS recipient from School Administration and send a controlled test using non-real student data.
10. Enable PVHS attendance only after the test report arrives at the approved address.

The database migration must be active before the new web application. Otherwise, the planner cannot call the attendance requirement function when an instructor selects **Complete Day**.

## One final validation cycle

Run these checks against the combined batch:

- TypeScript check
- Next.js production build
- PostgreSQL migration parse and clean migration application
- Supabase RLS and cross-school access tests
- Deno check for the report worker
- WLD 105 completion without an attendance prompt
- WLD 110 completion with required paired-day attendance
- WLD 205 completion without an attendance prompt
- WLD 210 completion with required paired-day attendance
- Standard attendance finalization without an email job
- PVHS finalization with one report queued for 30 minutes later
- Mobile instructor and school-admin review

## Go/no-go gate

Proceed only when:

- The final batch is based on the latest `main`.
- All combined tests pass.
- The migration succeeds in staging.
- School-admin and instructor test accounts have correct access.
- The approved PVHS recipient and sender are confirmed.
- A controlled PVHS test email is received.

## Safe rollback

- If the web interface fails, restore the previous LTG web release while leaving attendance data intact.
- If email delivery fails, disable PVHS email settings and the attendance cron job; do not delete attendance records.
- Do not reverse the attendance migration after real student attendance has been recorded. Correct forward with a new migration instead.

## Deferred items

- No GitHub push has been made for this attendance branch.
- No live Supabase migration has been applied.
- No report worker or cron job has been deployed.
- No PVHS address, sender, or email-provider credentials have been configured.
