# LTG Data Retention and Disposition Standard

## Principle

LTG does not set PCCC's public-record retention periods. PCCC remains the records owner and determines the applicable New Jersey DORES record series and any litigation, audit, accreditation, grant, employment or other holds.

LTG must be technically capable of retaining, exporting, placing approved holds on and disposing of records according to that mapping.

## Required classification before PCCC sign-off

| LTG record class | Examples | Retention authority / disposition rule |
| --- | --- | --- |
| Academic record | final grades, final course record, qualification/certification history | PCCC-approved NJ DORES series; do not auto-delete until mapped |
| Attendance record | daily student attendance, corrections, finalized reports | PCCC-approved NJ DORES series |
| Assessment/lab evidence | submissions, attempts, destructive tests, rubric history | PCCC-approved academic/instructional record series |
| Student identity/roster | name, institutional student ID, enrollment link | PCCC-approved student-record series |
| Employee/time record | clock entries, payroll-support reports, corrections | PCCC HR/financial records series |
| Instructor implementation note | planner delivery notes and approved changes | PCCC instructional/administrative records series |
| Security/audit record | audit events, security alerts, access investigations | approved security/administrative schedule and incident hold rules |
| Transactional delivery record | email queue, retry/error metadata | shortest operational period compatible with troubleshooting and audit needs |
| Ephemeral classroom session | join codes, temporary live session state | short operational retention unless incorporated into an academic record |
| Backup/archive copy | copies of the above | must inherit the underlying record class; backup must not defeat lawful disposition |

## Current archive gap

The current AWS retained archive applies Object Lock legal hold to every uploaded object. That protects integrity but prevents ordinary scheduled disposition.

Before final PCCC approval:

1. Map LTG datasets to approved PCCC/NJ record series.
2. Distinguish permanent/long-retention academic records from temporary operational records.
3. Replace generic indefinite holds with record-class retention or another PCCC-approved archival process.
4. Preserve the ability to apply litigation/audit/security holds when required.
5. Ensure destruction covers primary data, derived exports and eligible backup/archive copies.
6. Keep disposition evidence without retaining the disposed student content itself.

## Destruction control

Deletion must be authorized, logged and designed so disposed personal information cannot reasonably be reconstructed from ordinary LTG systems. Destruction must never be initiated solely because an application account is disabled; record ownership and retention are separate from account lifecycle.

## Contract termination

PCCC must be able to export its records in a usable format. After verified return/export and expiration of required retention/hold periods, LTG must dispose of PCCC data from systems and eligible backup copies under the approved disposition process and retain non-content evidence that the disposition occurred.
