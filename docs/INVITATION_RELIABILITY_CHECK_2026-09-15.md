# Invitation reliability check — September 15, 2026

## Scope

Development GitHub main and Supabase Gltg (`ezlvivmeneefiiwqwgqd`). This work does not deploy production or alter database schema, accounts, or memberships. The database authorization test used a transaction that was rolled back.

## Confirmed issues addressed

- Account creation followed by failed school invitation preparation now explains that the login exists and that the invitation outcome must be checked. Retrying Invite New User reuses an existing account only when the lookup explicitly reports no school membership. It calls the invitation RPC, preserving INVITED status; it does not call the active-membership RPC.
- Successful invitation creation, school access updates, and accepted setup-email requests retain their success notice when only the follow-up refresh fails. The error identifies the failed refresh and discourages repeating a completed action.
- A successful password update followed by failed membership activation now explains that the password was saved and directs the user to sign in with it to retry activation.
- Failed invitation/recovery code exchanges no longer fall through to an existing session and display a verified state. Session and Account Setup user-lookup errors are checked.
- The shared formatter suppresses the SDK's technical PKCE code-verifier guidance and uses the page's recovery message.

## Verification

- Regression tests execute the actual page handlers for partial completion, retry without duplicate signup, preservation of INVITED status, refresh failures, invalid/expired verification responses, rejected requests, and successful completion.
- The full local suite passed with 266 tests. TypeScript, lint, and the migration filename guard passed after incorporating concurrent curriculum/orientation changes through `3d4011b511033142c840900f2ef3f38876fb60d2`.
- A local development browser connected to Gltg displayed the unchanged invalid-credentials guidance, safe invalid-invitation and invalid-recovery guidance, and login redirects preserving `/accounts` and `/accounts/diagnostics` destinations.
- On Gltg, anonymous users have no EXECUTE privilege on the three admin account RPCs. Under the actual authenticated database role, a synthetic identity with no management membership was denied by lookup, invitation preparation, and active-membership addition. This transaction rolled back.
- The deployed permission helpers check the current membership role and ACTIVE status on each request. Page state is not the authorization boundary.

## Verification still requiring a test account

An authenticated browser success path, a real invitation email lifecycle, and revocation during an open authenticated browser session were not exercised. These need a disposable Gltg test account and controlled test email recipient. No real invitation or recovery email was sent by this check. Unit tests and database-role checks do not substitute for this end-to-end verification.

## Remaining raw-error candidates

A scoped text search found 68 candidate occurrences in 22 files. These are review locations, not 68 validated vulnerabilities; some may already receive intentional application messages. Review each error source before changing its handling.

- `app/agenda/page.tsx`
- `app/attendance/admin/page.tsx`
- `app/attendance/attendance-workspace.tsx`
- `app/attendance/corrections/page.tsx`
- `app/attendance/history/page.tsx`
- `app/classroom/planner/page.tsx`
- `app/dashboard-punch-clock.tsx`
- `app/owner/page.tsx`
- `app/planner/page.tsx`
- `app/reports/page.tsx`
- `app/resources/page.tsx`
- `app/review-queue/day-completion-review.tsx`
- `app/review-queue/page.tsx`
- `app/school/page.tsx`
- `app/school-active-today-employees.tsx`
- `app/student-display/[guideDayId]/page.tsx`
- `app/time-clock/page.tsx`
- `app/time-clock/payroll/page.tsx`
- `app/training/page.tsx`
- `app/training/report/[id]/page.tsx`
- `app/training/session/[id]/school/page.tsx`
- `app/training/session/[id]/teacher/page.tsx`
