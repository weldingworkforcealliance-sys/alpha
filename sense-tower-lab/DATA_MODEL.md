# AWS SENSE Tower Lab v2 — Data Model

## Separation of records

Academic evidence:

```text
student
  -> course / semester
  -> lab assignment
  -> attempt 1 / attempt 2
  -> rubric scores
  -> official academic grade
```

AWS SENSE evidence:

```text
student
  -> welding program
  -> SENSE Level I record
  -> module
  -> competency / exam / qualification
```

The UI may display them together in the Passport, but the records remain distinct.

## Lab assignment

```text
lab_assignment
- id
- name
- process
- position
- electrode
- type (position | project)
```

## Lab grading record

```text
student_lab_grade
- student_id
- assignment_id
- attempt_1
- attempt_2
- official_attempt
```

## Lab attempt

```text
lab_attempt
- consistency_score
- defects_score
- procedure_score
- restarts_score
- bead_size_score
- visible_defect_tags[]
- quick_comment_tags[]
- notes
- started_at
- completed_at
```

System-derived:
- raw_score
- adjusted_score = raw_score * 0.95
- critical_defect_present
- automatic_F_on_attempt_1
- attempt_2_defect_zero_override
- superseded status

## SENSE competency queue

```text
student_sense_competency
- student_id
- module_id
- competency_id
- status
- verified_date
- verified_by
```

Status progression:
`Not Started -> Introduced -> Practicing -> Competent -> Verified`

## Guardrails

1. Attempt 2 does not replace Attempt 1 until Attempt 2 is complete.
2. Attempt 1 critical defect is not deleted; diagnostic rubric evidence remains visible.
3. Attempt 2 crack/lack-of-fusion rule zeros only the Weld Defects category.
4. Academic grade never automatically creates AWS Verified.
5. Academic grade never automatically creates AWS qualification Pass.
6. AWS qualification Pass remains a deliberate instructor/test-supervisor action.
7. Daily instructors should not have to configure assignments while grading.


## Four-digit weld test identity

Each student is assigned one persistent four-digit weld test ID for qualification and future destructive-test certificate records.

```text
student_weld_test_identity
- student_id
- weld_test_id CHAR(4) UNIQUE
- issued_at
- retired_at (nullable)
```

Rules:

1. IDs begin at `0000` and increment to the next unused value.
2. IDs are stored as four-character strings so leading zeroes are preserved.
3. No two students may hold the same ID.
4. Once an ID has been issued, it is reserved and cannot be reassigned to another student.
5. Once the system assigns the ID to a student, it is immutable. Instructors and administrators cannot edit or replace it through the normal application workflow.
6. The identifier is student-level, not qualification-position-level, so the same ID follows the student across groove positions, backing/no-backing categories, and future destructive-test certificate generation.
7. This ID is an internal PCCC/LTG testing identifier and must not be represented as an AWS-issued credential number.
