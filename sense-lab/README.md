# AWS SENSE Level I Passport Lab

Standalone prototype for testing a digital AWS SENSE Level I competency, exam, qualification, and completion-readiness record **before any integration into LTG**.

## Isolation rules

- This prototype is not routed into LTG.
- It does not use LTG authentication, Supabase, attendance, course grades, or production data.
- It lives only under `sense-lab/` on branch `lab/aws-sense-passport-v1`.
- Prototype data is stored only in the browser's `localStorage` unless the tester explicitly exports JSON.
- The included roster is fictional demo data.

## How to test

Open `sense-lab/index.html` in a modern browser, or serve the folder with any simple static web server.

Examples:

```bash
cd sense-lab
python -m http.server 8080
```

Then visit `http://localhost:8080`.

## Current prototype features

- Program dashboard
- Test roster with add/delete controls
- Per-student AWS SENSE Level I Passport
- Module competency tracking using five internal states:
  - Not Started
  - Introduced
  - Practicing
  - Competent
  - Verified
- Level I knowledge-exam records
  - Safety pass threshold: 100%
  - Other tracked knowledge-exam pass thresholds: 75%
  - Up to three attempts
  - Third attempt blocked until retraining is confirmed after two failed attempts
- Level I workmanship / welder-performance qualification tracker for Tests 1–9
- Partial-completion eligibility calculation
- Full-completion eligibility calculation
- AWS administrative tracking fields
- JSON export/import for rapid prototype editing and testing

## Credential logic represented

For this prototype, partial completion is computed from:

1. completion of compulsory Modules 2, 3, 8, and 9; and
2. completion of at least one welding-process module from Modules 4, 5, 6, or 7.

Full completion requires all four compulsory modules and all four welding-process modules.

A module is treated as complete only when its prototype competency items are verified, its required knowledge exam is passed, and any associated Level I workmanship/performance qualification records are marked Pass.

Module 1 Occupational Orientation is tracked as a foundation module but is not part of this prototype's partial/full completion calculation because AWS QC10:2017 section 6.1.3 explicitly lists Modules 2, 3, 8, and 9 as the compulsory modules for that registration-status rule.

## Source basis

The prototype structure was derived from the user's supplied copies of:

- AWS QC10:2017, *Specification for Qualification and Certification of SENSE Level I—Entry Welders*
- AWS EG2.0:2017, *Guide for the Training of Welding Personnel: SENSE Level I—Entry Welders*
- AWS EG2.0:2017 Supplement, *SENSE Level I—Entry Welder Training Performance Testing Procedures*

The application stores structured requirements and references. It intentionally does **not** embed or redistribute the full AWS publications, SWPS documents, or copyrighted test drawings.

## Not yet included

- Real authentication
- Real PCCC student roster
- LTG gradebook integration
- AWS API / SENSE portal integration
- Supabase persistence
- File/photo evidence uploads
- Instructor signatures
- Formal audit log
- PDF report generation
- Level II

Those should be added only after the workflow and screen design are validated in this isolated lab.
