# LTG Staging Environment

## Purpose

`Gltg` is the isolated LTG staging Supabase project used for QA before any change is promoted to the live `beta genco` project.

- Staging Supabase ref: `ezlvivmeneefiiwqwgqd`
- Production Supabase ref: `qsmvgyyaemjmklceyikr`
- Netlify Deploy Previews are pinned to staging by `netlify.toml`.
- Production deploy configuration is not overridden by `netlify.toml`.

## Safety rules

1. Do not copy production student, instructor, payroll, attendance, or invitation data into staging.
2. Use synthetic schools, users, students, and course data for QA.
3. Do not place service-role keys, secret keys, Resend keys, or cron secrets in the repository.
4. Do not point a Deploy Preview at `beta genco`.
5. Do not merge a staging-certified database migration into `main` until production promotion is explicitly approved.

## Attendance email worker

The `send-attendance-reports` Edge Function is deployed in staging with the same source as production. It uses a custom `x-attendance-cron-secret` check before processing queued reports.

Staging intentionally does **not** contain these mail-delivery secrets yet:

- `attendance_cron_secret`
- `resend_api_key`
- `attendance_from_email`

Without those values the worker cannot send attendance email. This is intentional until a staging-only sender/test recipient policy is configured.

## Browser/Auth staging checklist

Before invitation, password-reset, or email-confirmation QA in a Netlify Deploy Preview:

- Supabase Auth Site URL must be appropriate for the staging browser environment.
- The Netlify Deploy Preview URL must be allowed in Supabase Auth Redirect URLs.
- Password-reset and account-setup redirects must remain inside the staging preview.
- Never use a production student/instructor email address for staging Auth testing.

## Current security posture

Staging QA has validated cross-school isolation for Planner, Attendance, Live Classroom, Live Job Card, Reports, Account Management, Training Mode, Time Clock/Payroll, and Platform Owner controls.

Anonymous execution is intentionally limited to the four student join/submit RPCs used by Live Classroom and Live Job Card. Other privileged RPCs require authenticated role checks and/or school/owner authorization inside the function.

Supabase Security Advisor still reports leaked-password protection as disabled at the Auth project-setting level. Enable it before external staging users are invited if the project plan supports the feature.

## Production promotion rule

A staging fix is not a production fix until all of the following are true:

1. migration is committed to source control;
2. CI passes;
3. Deploy Preview passes applicable QA;
4. production impact is reviewed;
5. production promotion is explicitly approved;
6. post-deploy verification succeeds.
