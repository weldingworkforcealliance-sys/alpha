# AWS SENSE Tower v2 — Lab Execution Results

Date: 2026-09-18

Status: **PASS — logic and instructor interaction harness**

The exact `public/aws-sense-tower-lab/app.js` file from branch `lab/aws-sense-tower-v2` was executed in an isolated JavaScript test harness. The test did not touch LTG production, Supabase, attendance, or real student data.

## Core logic tests — 16/16 passed

- Demo roster initializes with 8 students.
- Perfect five-category rubric = 100 raw / 95.0% final.
- Attempt 1 crack = automatic F after rubric completion.
- Attempt 1 lack of fusion = automatic F after rubric completion.
- Incomplete Attempt 2 does not replace Attempt 1.
- Completed Attempt 2 replaces Attempt 1 even when lower.
- Attempt 2 with a critical defect has a maximum 76.0% final grade.
- Crack + lack of fusion does not double-deduct.
- Safety knowledge exam requires 100%.
- Other tracked Level I exams pass at 75%.
- Optional Module 8 hands-on competencies do not block required Module 8 verification.
- Academic lab grade does not auto-verify SENSE competency.
- Lab screen renders all five rubric criteria and Next Student.
- Competency Tower uses the same Next Student queue pattern.
- Qualification Tower uses the same Next Student queue pattern.
- Student Passport displays both SENSE progress and academic lab grades.

## Instructor event-handler tests — 8/8 passed

These tests exercised the same click handlers used by the prototype UI.

- Five rubric taps record scores, auto-save, complete the attempt, and calculate the official grade.
- Critical defect click changes completed Attempt 1 to F.
- Attempt 2 remains locked until Attempt 1 is complete.
- Starting Attempt 2 works after Attempt 1 completion.
- Attempt 2 critical defect automatically forces Weld Defects to 0/20.
- Next Student advances the grading queue and active student.
- Competency status click records Verified and date.
- Knowledge-exam handler blocks Attempt 3 until retraining is confirmed.
- Qualification Pass is recorded without changing the academic lab grade.

## Total

**24/24 automated lab checks passed.**

## Still required before LTG integration

This execution validates application logic and instructor-event behavior. It does **not** replace a visual browser usability review. Before any LTG merge:

1. Launch the standalone build in a real browser.
2. Review desktop and mobile layout.
3. Time an instructor grading a full simulated class.
4. Confirm button wording is understandable without instructions.
5. Review touch-target size for shop/tablet use.
6. Test accidental taps / back-navigation / refresh persistence.
7. Verify export/import with an actual downloaded JSON file.
8. Review whether the class gradebook overview is too dense on smaller screens.

No production release is authorized by this test.
