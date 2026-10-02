# SENSE Passport Lab — Review / Test Plan

Use this before any LTG integration.

## 1. Roster behavior

- Add a fictional test student.
- Switch between students.
- Delete a test student.
- Refresh the browser and confirm records persist.
- Export JSON, reset demo data, then import the JSON and confirm the records return.

## 2. Competency workflow

For one student, move several competencies through:

`Not Started -> Introduced -> Practicing -> Competent -> Verified`

Confirm:

- module progress changes;
- the module is not marked complete until all **required** competencies are Verified;
- optional Module 8 hands-on items for mechanized OFC and CAC-A do not block Module 8 completion.

## 3. Knowledge exams

### Safety exam

- Enter 99. Confirm it fails.
- Enter 100. Confirm it passes.

### Three-attempt rule

On another module:

- enter a failing first score;
- enter a failing second score;
- confirm attempt 3 is blocked;
- mark retraining complete;
- record attempt 3.

## 4. Performance qualifications

For each process, test Pass / Fail changes and confirm the related module does not complete until all qualification records mapped to that process are Pass.

Qualification records represented in the prototype:

- Test 1 — GMAW-S
- Test 2 — GMAW Spray
- Test 3 — FCAW-G
- Test 4 — FCAW-S
- Test 5 — GTAW carbon steel
- Test 6 — GTAW stainless
- Test 7 — GTAW aluminum
- Test 8 — SMAW 2G
- Test 9 — SMAW 3G uphill

## 5. Partial-completion calculation

Confirm the student is **not** partial-completion eligible until:

- Modules 2, 3, 8, and 9 are complete; and
- at least one of Modules 4, 5, 6, or 7 is complete, including the applicable exam and qualification record(s).

## 6. Full-completion calculation

Confirm full-completion eligibility does not appear until all four compulsory modules and all four welding-process modules are complete.

## 7. Administrative tracking

Test:

- AWS registration status
- candidate/trainee ID
- enrollment date
- completion submission status
- administrative notes

Confirm changing these fields does not automatically change competency or qualification results.

## 8. Questions to resolve during prototype review

1. Should instructors record every key indicator, or should LTG surface only major checkpoints while retaining the full record underneath?
2. Should `Verified` require a PIN/signature or simply an authenticated instructor action?
3. Should performance qualifications allow photos, scanned bend-test sheets, or other evidence attachments?
4. Should the Training Achievement Record display instructor initials and trainee initials exactly as the AWS form does?
5. Should Module 8 knowledge exams be tracked as one module score or as separate unit tests when the current AWS system is confirmed?
6. Should academic lab-rubric scores ever suggest a SENSE competency for instructor approval, or should SENSE verification always start as a separate action?
7. What fields from the current 2026 AWS SENSE portal should be mirrored for administrative convenience?
8. Which Level I evidence should eventually appear in the student-facing Passport versus instructor/admin-only views?

## 9. Explicit non-goals for this lab

- No real student PII
- No AWS submission
- No production LTG data
- No attendance linkage
- No automatic credential award
- No claim that the prototype itself is an AWS record of certification
