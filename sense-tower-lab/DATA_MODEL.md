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
