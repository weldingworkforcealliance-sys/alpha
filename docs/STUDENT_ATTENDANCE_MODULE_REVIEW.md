# LTG Student Attendance Module — Review Build

Status: isolated local build only. Not pushed to GitHub, not applied to Supabase, and not deployed to LTG.

Deployment plan: hold this module for a combined LTG release and follow `docs/ATTENDANCE_BATCH_DEPLOYMENT.md` so migrations, the report worker, and the web application are tested and deployed once in the correct order.

## What the review build includes

### Instructor attendance

- Instructors see only attendance groups they are assigned to through at least one linked LTG section.
- One attendance roster covers every section in the linked class pair.
- When an instructor selects **Complete Day** for the designated final section—normally WLD 110 or WLD 210—LTG requires an attendance confirmation before the planner day can close.
- Completing WLD 105 or WLD 205 does not show the pair-attendance prompt.
- **Completed Full Pair Day — Present** counts the student present for the entire linked pair.
- Status choices: Unmarked, Present, Absent, Tardy, Excused, Left Early, and Not Scheduled.
- Tardy and Left Early records can include an arrival or departure time.
- Instructors can confirm everyone completed the full day, then change only the exceptions.
- Each student supports a freeform factual note plus quick notes for Unprepared, Left Early, Missing PPE/materials, and **Left class area / could not be located**.
- Drafts can be saved before finalization.
- Attendance cannot be finalized while any student is Unmarked.
- A sent report is locked. A school administrator must reopen it and give a reason before a correction.

### School administrator tools

- Create any number of attendance groups/class pairs.
- Link two or more existing LTG sections to a group. Current examples are WLD 105/110 and WLD 205/210; no course codes are hard-coded.
- Choose which linked section triggers the end-of-pair confirmation, so future class pairs work without a code change.
- Choose Standard College Attendance or PVHS Daily Email Attendance for each group.
- Paste a full student roster at once.
- Supported roster formats:
  - `Last, First`
  - `First Last`
  - Spreadsheet columns: `Student ID | Last Name | First Name | Email`
- Preview and validate pasted rows before import.
- Automatically enroll each imported student in every section linked to the group.
- Configure and change the authorized PVHS report email and up to five optional CC addresses.
- Review attendance finalization, report queue, delivery, failure, recipient, and correction status.
- Reopen attendance with a required correction reason.

### PVHS daily email workflow

1. The instructor opens the roster and marks each student.
2. Draft saves do not start the email timer.
3. The instructor selects **Finalize Attendance**.
4. The system creates one report job due 30 minutes after finalization.
5. Corrections saved during that 30-minute window are included in the scheduled report; the timer does not restart.
6. A scheduled server function claims due jobs without duplicate processing and sends the report.
7. Success or failure is recorded. Failed deliveries retry with a delay, up to five attempts.
8. After a report is sent, a correction requires school-admin reopening. The next finalized revision is labeled as a corrected report.

The email includes school, date, class group, linked courses, status totals, the student roster, arrival/departure details, and notes. It is labeled as a confidential student attendance record.

## Data design

The module uses a shared student identity rather than making a separate student copy for every course.

| Area | Purpose |
| --- | --- |
| `attendance_groups` | Defines the paired/multi-section class and its attendance type |
| `attendance_group_sections` | Links the group to WLD sections |
| `students` | School-level student identity |
| `attendance_group_students` | Active roster for the linked group |
| `student_section_enrollments` | Automatic registration in every linked section |
| `attendance_sessions` | One attendance event per group and date |
| `attendance_records` | One status per rostered student for that event |
| `attendance_record_audit` | Before/after history for every change |
| `attendance_email_settings` | School-admin-controlled PVHS recipient configuration |
| `attendance_report_deliveries` | Idempotent report queue, retry, and delivery evidence |

All new public tables have Row Level Security. Front-end users receive read-only table grants; writes happen through permission-checked database functions. School data is isolated by `school_id`. Email credentials remain server-side and are never exposed to the browser.

## Files added or changed

- `app/attendance/page.tsx` — instructor attendance screen
- `app/attendance/attendance.module.css` — responsive instructor styling
- `app/attendance-confirmation-modal.tsx` — required end-of-pair confirmation and student notes
- `app/attendance-confirmation-modal.module.css` — responsive confirmation modal styling
- `app/dashboard/page.tsx` — checks for and completes required attendance before closing the designated planner day
- `app/school/attendance/page.tsx` — school-admin class pair, roster, email, and report screen
- `app/school/attendance/school-attendance.module.css` — responsive admin styling
- `app/attendance-nav-link.tsx` — permission-aware LTG navigation entry
- `app/layout.tsx` — adds the attendance navigation component
- `lib/attendance.ts` — shared attendance types, labels, date helper, and roster parser
- `supabase/migrations/202609050005_student_attendance_module.sql` — tables, indexes, RLS, audit, enrollment, and report queue functions
- `supabase/functions/send-attendance-reports/index.ts` — secure report worker and email formatter
- `supabase/functions/deno.json` — Edge Function type configuration
- `tsconfig.json` — keeps Deno Edge Function files out of the Next.js browser build check

## Deployment requirements — intentionally not performed

Before integration, the migration must be tested against a disposable Supabase branch or local database that contains the current LTG base schema. Then:

1. Apply the attendance migration.
2. Deploy `send-attendance-reports` with gateway JWT verification disabled; the function has its own required `x-attendance-cron-secret` check.
3. Set server secrets: `RESEND_API_KEY`, `ATTENDANCE_FROM_EMAIL`, and `ATTENDANCE_CRON_SECRET`. Supabase provides the function's URL and service-role environment values.
4. Store the function URL and matching cron secret in Supabase Vault.
5. Schedule a Supabase Cron job every minute to POST to the function. A job due 30 minutes after finalization is therefore sent at the first scheduler run at or after the 30-minute mark.
6. Verify the sending domain and use an approved school-facing sender address.
7. Run the acceptance tests below with non-real sample students before any live roster import.

## Acceptance tests required before LTG integration

| Test | Expected result |
| --- | --- |
| School admin creates WLD 105/110 group | One group links both sections |
| School admin selects WLD 110 as confirmation section | WLD 105 completes normally; WLD 110 requires paired-day attendance |
| School admin imports 20 pasted names | 20 student identities, group roster entries, and two section enrollments per student |
| Same roster imported again | No duplicate roster membership or section enrollment |
| Same-name student without a unique ID is ambiguous | Import returns an actionable error instead of silently merging |
| WLD 105/110 instructor opens attendance | Instructor sees the shared paired roster |
| Unassigned instructor opens group | Access is denied |
| Instructor finalizes with Unmarked students | Finalization is blocked |
| Instructor confirms full day for a student | Student is Present for the complete WLD 105/110 or WLD 205/210 pair |
| Instructor records an exception | Status, time when applicable, and factual note are retained for the paired day |
| Instructor finalizes Standard attendance | Saved with no email job |
| Instructor finalizes PVHS attendance | One job is due exactly 30 minutes after finalization |
| Instructor edits within the 30-minute window | Scheduled report contains the correction and no duplicate job is created |
| Two report workers run together | `SKIP LOCKED` prevents duplicate claims |
| Email provider fails | Error is logged and retry is scheduled, stopping after five attempts |
| Report has been sent | Instructor editing is blocked |
| School admin reopens sent report | Reason is audited; next finalization creates a corrected revision |
| User from another school queries records | No rows are returned / access is denied |
| Mobile viewport | Status controls, notes, summary, and finalization remain usable |

## Recommended additions

### High priority for the first live attendance release

1. **Missing-attendance alert:** notify the instructor and school admin when a scheduled class has no finalized attendance after a school-configured deadline.
2. **No-class calendar handling:** distinguish school closure, holiday, field trip, and canceled class from student absence.
3. **CSV and printable report export:** allow school admins to download date-range, student, group, and attendance-percentage reports.
4. **Delivery test button:** send a clearly labeled test email before the PVHS recipient is activated.
5. **Roster withdrawal/transfer controls:** retain history while removing a student from future attendance sheets and linked sections.
6. **Attendance dashboard:** show daily completion status, consecutive absences, excessive tardiness, and students needing follow-up.

### Good second-phase additions

1. Connect the shared student roster to Connected Classroom assessments so students select or securely identify their existing student record instead of typing names differently each time.
2. Add school-defined attendance codes while preserving a standard reporting category underneath.
3. Add substitute-instructor access with a start/end date instead of permanent section access.
4. Allow an additional authorized partner-school recipient by group when one school serves more than one high-school partner.
5. Add optional instructor reminders on phone/desktop, but do not automatically mark students.
6. Add QR-assisted check-in only as an instructor review aid. Student self-check-in should never become the final official attendance record because another student could check someone in.

## Decisions still needing user approval

- Whether “Excused” is the final wording or whether PVHS requires specific codes such as medical, school activity, or parent reported.
- Whether PVHS wants every status listed or only absences/tardies in the emailed report.
- The authorized PVHS report address and approved sender address.

## Verification completed in the isolated copy

- Next.js/TypeScript check passed.
- Next.js production build passed using non-secret placeholder Supabase build variables.
- PostgreSQL migration passed a PostgreSQL grammar parse.
- An isolated PostgreSQL-compatible smoke test passed class-pair creation, final-section prompt selection, first-section bypass, two-section automatic enrollment, bulk roster import, attendance roster creation, finalization, finalized-session detection, one-job PVHS email queuing, unassigned-user denial, and RLS record isolation.
- Roster parser passed checks for `Last, First`, `First Last`, spreadsheet-tab input, Student ID retention, email handling, and invalid single-name rejection.
- Live-Supabase migration behavior and real email delivery remain intentionally unexecuted because this review build was not connected or applied to the active project.
