# SENSE Passport Lab — Proposed Data Model

This is the prototype contract to preserve when the feature is eventually moved into LTG.

## Student credential record

```text
sense_credential_record
- student_id
- program_id
- sense_level
- aws_registration_status
- aws_candidate_id
- aws_enrollment_date
- completion_submission_status
- admin_notes
```

The credential record should belong to the **student + program**, not to one semester or one course section. This allows the record to continue across multiple linked course pairs and semesters.

## Module record

```text
sense_module
- module_code
- module_name
- category (foundation | compulsory | optional-process)
- passing_exam_score
- requires_qualification
```

## Competency record

```text
sense_competency
- module_code
- competency_code
- competency_label
- source_standard
- source_section
```

## Student competency evidence

```text
student_sense_competency
- student_id
- competency_code
- status
- date_verified
- verified_by
- evidence_reference
- notes
```

Allowed prototype status progression:

```text
Not Started -> Introduced -> Practicing -> Competent -> Verified
```

`Verified` should be instructor-controlled in the production implementation.

## Knowledge exams

```text
sense_exam_attempt
- student_id
- module_code
- attempt_number
- score
- test_date
- instructor_id
- passed
- retraining_required
- retraining_completed_at
- retraining_verified_by
```

Rules represented in the lab:

- Maximum three attempts.
- If attempts 1 and 2 fail, retraining must be confirmed before attempt 3.
- Module 2 pass threshold = 100%.
- Other tracked Level I knowledge exams = 75%.

## Performance qualification definition

```text
sense_qualification_definition
- qualification_code
- sense_test_number
- module_code
- process
- test_type
- material
- position
- swps_reference
```

## Student performance qualification

```text
student_sense_qualification
- student_id
- qualification_code
- result (Not Started | Pass | Fail)
- test_date
- instructor_id
- notes
- evidence_reference
```

## Course / gradebook connection later

Academic grade data should remain course-specific:

```text
student -> semester -> course pair -> course grade
```

AWS SENSE evidence should remain program-specific:

```text
student -> welding program -> AWS SENSE Level I credential record
```

A lab assignment may feed both systems. Example:

```text
WLD 110 lab rubric result
    -> academic gradebook score
    -> if instructor verifies AWS criterion, student_sense_competency evidence
```

The systems should be linked, not collapsed into one table.

## Integration guardrails

1. AWS SENSE completion status must never be inferred solely from attendance.
2. An academic passing grade must not automatically create an AWS verified competency.
3. AWS qualification Pass/Fail must require instructor/test-supervisor confirmation.
4. AWS registration/submission fields are administrative records, not proof that AWS accepted a credential unless confirmed from the official AWS system.
5. Source-standard version must be stored so a future AWS revision can coexist with historical student records.
6. Full copyrighted AWS publications, SWPS pages, and test drawings should not be embedded in the product without appropriate rights. Store structured references instead.
