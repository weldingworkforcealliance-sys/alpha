# Automatic instructor coverage model

Operational rule for the PCCC LTG beta:

- Active instructional staff may view every class at their school.
- Assigned instructors retain normal access to their sections.
- An active instructional staff member may cover another section without an admin reassignment.
- Starting an unassigned section makes that user the covering instructor for that planner day.
- The covering instructor may use agenda notes and complete that in-progress day.
- Duplicate starts remain blocked.
- Completion remains tied to the instructor who actually started the day, with school/program management and Platform Owner override.
- Coverage is recorded for audit/reporting and ends when the day is completed.
- Protected curriculum/outcomes are unchanged by coverage access.

## Status

Implemented in the production database on 2026-09-02. Rollback testing confirmed that Richard Genco, while not directly assigned to PVHS B WLD 105, could see all six PCCC beta sections, start PVHS B WLD 105 as the covering instructor, save an agenda-slot note during coverage, complete Day 1, and then lose temporary instructor status after completion. The test advanced to Day 2 inside the transaction and all test data/progress was rolled back afterward.

No additional Netlify deployment was required for the access model because the existing Planner and Agenda UI respond to the database views and permission functions.
