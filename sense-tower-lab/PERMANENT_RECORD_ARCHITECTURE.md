# Permanent Welding Academic + Qualification Record Architecture

Date: 2026-09-18

This document defines how the existing LTG gradebook foundation should connect to the standalone Welding Record Tower without combining separate course grades.

## Governing course rule

There is **no combined semester grade**.

Each course owns its own permanent academic grade:

- WLD 105 = theory, classroom assessments, math/blueprint work, and fabrication projects assigned through the planner.
- WLD 110 = shop weld grades and shop projects.
- WLD 205 = Level II theory, classroom assessments, and planner-assigned fabrication/projects.
- WLD 210 = Level II shop weld grades and shop projects.
- Future linked course pairs use the same theory-course / shop-course pattern without redesigning the record system.

Qualification, destructive-test, and certificate results are **Pass / Fail records only**. They do not add points to or subtract points from the numeric WLD 110/210 course grade.

## Reuse the existing gradebook foundation

The already-built gradebook foundation should remain the academic system of record.

Existing production-gradebook structures already provide:

- one gradebook per active section;
- program / level / semester / course-pair mapping;
- separate theory and lab/shop books;
- linked-course display without averaging theory and lab;
- roster reuse from current enrollment;
- theory-assessment import by stable student UUID;
- custom categories and custom gradebook items;
- append-only attempts and revision history;
- correction reasons instead of overwriting prior scores;
- historical access after section inactivity.

The Welding Record Tower should **write shop academic grades into the WLD 110 / WLD 210 gradebooks**, not create a second academic-grade database.

### WLD 105 / WLD 205

Theory-side gradebooks receive:

1. existing Live Classroom / classroom assessment imports;
2. math / blueprint / theory assessments;
3. fabrication-project items generated from planner project assignments;
4. future course-specific graded work.

Planner-linked fabrication projects should create gradebook items under a category such as `fabrication_projects`. The planner is the assignment source; the gradebook is the permanent academic record.

### WLD 110 / WLD 210

Shop-side gradebooks receive numeric academic evidence from the Lab Grade Tower:

1. weld-position grades;
2. shop projects;
3. Attempt 1 / Attempt 2 official academic result;
4. future shop assignments.

The Tower UI remains the fast instructor entry interface. Once an attempt becomes official, the result maps into the existing gradebook attempt/revision model.

Qualification Pass/Fail must **not** be stored as numeric academic points.

## Course finalization

The gradebook foundation deliberately does not invent final-grade arithmetic. That remains correct.

A future course-finalization layer should store:

```text
gradebook_course_finalizations
- id
- gradebook_id
- official_final_grade
- finalized_at
- finalized_by
- calculation_rule_version
- note
```

Corrections should append a new finalization revision rather than overwrite the prior final.

WLD 105 and WLD 110 final grades remain independent.
WLD 205 and WLD 210 final grades remain independent.

## Immutable Weld Test ID

Each student receives one four-digit Weld Test ID:

`0000`, `0001`, `0002`, ...

Rules:

1. Assigned automatically by the system.
2. Unique.
3. Preserves leading zeroes.
4. Once assigned, it cannot be edited or replaced.
5. Once issued, it cannot be reused for another student.
6. Follows the student across shop courses, qualifications, destructive tests, and certificate history.
7. It is an internal program test identifier, not an AWS-issued credential number.

## Qualification records

Qualification records are separate permanent Pass/Fail evidence:

```text
weld_position_qualifications
- id
- student_id
- weld_test_id
- course_gradebook_id
- process
- material
- joint_family
- backing_category
- position
- result          -- Pass / Fail
- tested_at
- recorded_by
- note
```

Groove weld tracking uses two PCCC categories:

- Backing
- No Backing

The qualification record remains separate from official AWS SENSE performance-test records.

## Destructive-test ledger

Each destructive test receives its own immutable record number:

`DT-000001`, `DT-000002`, ...

A destructive-test record belongs to a student and references the student's immutable Weld Test ID.

```text
weld_destructive_tests
- id
- destructive_test_number UNIQUE
- student_id
- weld_test_id
- course_gradebook_id
- process
- material
- joint_family
- backing_category
- position
- test_method
- overall_result  -- Pass / Fail
- test_date
- inspector
- notes
- recorded_at
- recorded_by
```

Normal UI does not edit or delete a recorded destructive test.

Corrections use a separate append-only revision table.

## Certificate records

Certificates are generated **from passing destructive-test records**.

A certificate stores an immutable snapshot of the source test data at issuance:

```text
weld_test_certificates
- id
- certificate_number UNIQUE
- destructive_test_id
- version
- issued_at
- issued_by
- snapshot_json
- rendered_file_reference
- supersedes_certificate_id
```

The certificate snapshot includes at minimum:

- student name;
- Weld Test ID;
- destructive-test number;
- course;
- process;
- material;
- position;
- backing / no backing;
- test method;
- result;
- test date;
- inspector.

A reissued certificate creates a new version and retains the old certificate.

## Instructor-facing workflow

The complexity stays underneath.

### Theory / project course
Planner -> assignment -> existing gradebook -> permanent course record.

### Shop course
Lab Grade Tower -> numeric shop result -> WLD 110/210 gradebook -> permanent course record.

### Qualification
Qualification Tower -> Pass/Fail permanent record.

### Destructive test
Destructive Test Tower -> Pass/Fail permanent test record -> passing result becomes certificate-ready.

### Certificate
Generate from destructive-test snapshot -> preserve certificate version permanently.

## Standalone prototype boundary

The standalone lab now demonstrates this architecture in browser-local test data.

It does not yet write to the production gradebook tables, create production qualification/destructive-test tables, or generate the final designed PDF certificate.

Production integration should occur only after the instructor workflow and course grading rules are approved.
