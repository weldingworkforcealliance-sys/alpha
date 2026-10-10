# Anthony WLD 205 staging review: isolation and lesson coverage

**Scope:** PR #127, LTG staging project Gltg (ezlvivmeneefiiwqwgqd).
**Production:** No deployment or database writes authorized by this review.

## Isolation

The pilot presentation preset is only eligible for:

- School: LTG Welding Demonstration School in staging, school ID `08ccb452-83ab-482f-bb28-5576e02741b2`.
- Course code: `WLD 205`.
- Section: `PCCC-DAY-L2-WLD205-2627`, section ID `310623e6-c518-47b5-b7a0-8a1887df226e`.

FABTECH 2026 workspaces reside in the same staging Supabase project but use *different* schools (school IDs `b905a2d8-4d5a-4f53-b052-0f69de04a7b6` and `39939e9a-4f2e-49d8-b5d4-f4c533249352`). Their duplicated human-readable course and section codes no longer enable the Anthony option.

Both the frontend selector and database RLS policies check the exact school/section IDs. The underlying curricula, grades, attendance, and production records are not rewritten by the presentation override.

## Database security QA

Performed in staging with transactional test inserts immediately rolled back:

- Authorized PCCC pilot staff account: insert passed.
- FABTECH instructor into its lookalike section: insert blocked by RLS.
- FABTECH instructor attempting to target the PCCC pilot section: insert blocked by RLS.
- PCCC staff account attempting to write a different WLD 205 section: insert blocked by RLS.
- Confirmed no test preference rows persisted.

## Day 1–30 curriculum-only staging coverage

Staging originally had only Days 1–5 from the versioned PCCC WLD 205 guide. For a complete *read-only course review*, 25 missing day schedules and approved course-guide records were copied from the matching live curriculum into this synthetic staging school. No student, instructor-account, payroll, timeclock, attendance, grades, class submissions, or invitations were copied.

The import ran as one transaction guarded by an exact school ID **and** the staging-only school name, so the script would refuse to run on the production PCCC school. These records were already present in the approved production guide; this does not authorize changes to the approved core.

Post-import check for the PCCC test section:

| Verification | Staging result |
|---|---:|
| Planner days | 30 |
| Linked guide days | 30 |
| Teaching segments | 97 |
| Resource references | 118 |
| Math lessons | 23 |
| Math segments | 92 |
| Day-to-outcome links | 79 |
| Distinct required outcomes (CLO1–CLO5) | 5 |
| Scheduled dates | September 22 to November 12, 2026 |

The two FABTECH lookalike PCCC-code sections retain **five** days each; the PVHS curriculum is not part of this import.

## Deployment gate

Run GitHub Actions and the Netlify Deploy Preview against Gltg staging. Verify instructor usability and confirm FABTECH routing is unchanged before any production approval. Keep PR #127 draft. The official Day 3 FreeCAD drawing still requires approval.
