# AWS SENSE Tower Lab v2

Standalone prototype for testing the combined **AWS SENSE Tower + PCCC Lab Grade Tower** before any LTG integration.

## Core UX rule

The instructor should choose the item once, move student-to-student, tap the result, and move on.

Daily instructor screens must not expose the complexity of:
- grade math;
- attempt replacement logic;
- AWS completion calculations;
- critical-defect rules;
- credential-record architecture.

Those rules live underneath the interface.

## Tower structure

1. **Lab Grade Tower**
   - one assignment selected for the whole class;
   - five quick grading taps for a normal weld;
   - auto-save;
   - Next Student;
   - class progress;
   - gradebook overview;
   - Attempt 2 stays hidden until Attempt 1 is complete.

2. **SENSE Competency Tower**
   - one AWS competency selected for the whole class;
   - same student queue;
   - Not Started → Introduced → Practicing → Competent → Verified;
   - auto-save;
   - Next Student.

3. **Knowledge Exam Tower**
   - one exam selected;
   - student queue;
   - score entry;
   - pass threshold and attempt rules handled by the system.

4. **Performance Qualification Tower**
   - one SENSE test selected;
   - student queue;
   - Pass / Fail / Not Started;
   - qualification evidence stays separate from academic grades.

5. **Student Passport**
   - shows academic lab grades and SENSE progress together;
   - does not collapse them into one record.

6. **Admin / Readiness**
   - assignment setup;
   - AWS registration/submission tracking;
   - kept away from the daily instructor workflow.

## Isolation

- Branch: `lab/aws-sense-tower-v2`
- App path: `public/aws-sense-tower-lab/`
- No LTG routes changed.
- No production Supabase.
- No attendance linkage.
- No AWS submission.
- No real student PII.
- No deployment requested for this v2 build yet.
- Browser localStorage only.

## Academic grading rule

Five criteria are each worth 20 raw points:

1. Consistency
2. Weld Defects
3. Following Procedure
4. Restarts
5. Bead Size

Final grade = raw score × 0.95.

### Critical defects

Crack or lack of fusion:

- Attempt 1: automatic F; rubric is still completed for feedback.
- Attempt 2: Weld Defects is forced to 0/20; the other four criteria still count.
- If both defects exist, the defect category is still simply 0/20.
- Attempt 2 replaces Attempt 1 only when Attempt 2 is complete.

### Bead-size standard for the current 1/8-inch electrode rubric

- Minimum acceptable: 3/16 in.
- Target: 1/4 in.
- Maximum acceptable: 3/8 in.

## AWS boundary

PCCC academic grading and AWS SENSE verification are connected but separate.

A lab grade can support instructor judgment, but it does not automatically create an AWS `Verified` competency or a performance-qualification `Pass`.
