# AWS SENSE Tower Lab v2 — Test Plan

## A. Instructor speed test

Target workflow for one normal weld:
1. Select the assignment once.
2. Grade five criteria.
3. Tap optional quick comments if needed.
4. Tap Next Student.

Acceptance target:
- no manual math;
- no Save button;
- no repeated assignment selection;
- normal grade entry should be understandable without training notes.

## B. Attempt 1 critical defect

1. Open a student's Attempt 1.
2. Tag Crack.
3. Complete all five rubric criteria.
4. Confirm official result is F.
5. Confirm diagnostic raw/adjusted values remain visible.
6. Confirm Attempt 2 becomes available only after Attempt 1 rubric completion.

Repeat with Lack of Fusion.

## C. Attempt 2 replacement

1. Start Attempt 2.
2. Enter only three of five criteria.
3. Confirm Attempt 1 remains official.
4. Complete Attempt 2.
5. Confirm Attempt 2 replaces Attempt 1 even if the result is lower.
6. Confirm Attempt 1 remains visible historically.

## D. Attempt 2 critical defect

1. Tag Crack or Lack of Fusion.
2. Confirm Weld Defects is forced to 0/20.
3. Confirm other four categories remain gradeable.
4. Confirm maximum possible final grade is 76%.
5. Tag both Crack and Lack of Fusion and confirm no double deduction occurs.

## E. Gradebook overview

1. Grade multiple students.
2. Confirm the class matrix updates.
3. Confirm Attempt 2 grades are marked A2.
4. Click a matrix grade and confirm the correct student/assignment opens.

## F. Competency Tower

1. Select one AWS module and competency.
2. Move through the class with Next Student.
3. Confirm one-tap status updates auto-save.
4. Confirm Verified is not inferred from the lab grade.

## G. Knowledge Exam Tower

1. Select one exam.
2. Record results student-to-student.
3. Confirm Safety requires 100%.
4. Confirm other tracked exams use 75%.
5. Confirm Attempt 3 is blocked until retraining is confirmed after two failures.

## H. Qualification Tower

1. Select one SENSE performance test.
2. Mark students Pass / Fail.
3. Confirm the same queue behavior as grading.
4. Confirm Pass does not alter the academic lab grade.

## I. Usability review questions

- Can an instructor grade while standing in the shop with minimal typing?
- Are the quick labels immediately understandable?
- Are there any screens where the instructor must remember a rule the software could enforce?
- Is any information shown during grading that belongs in Admin instead?
- Does "Next Student" consistently behave the same way across all towers?
