# LTG contact and demo inquiries — production release

## Production completion — November 12, 2026

The production release was explicitly authorized after staging acceptance. This section supersedes the historical staging-only statements below.

- PR #148 merged as `581140d4f9a2a2230f3d8d54b816bd2572b091f9`. Final production rebuild commit: `23e8e4a3acba02bd92d8c9df9664d7c3e5d54680` (no code changes).
- Current published Netlify deploy: `6af61472aba16aace3d5f62e`, published 2026-11-12 19:33:56 UTC. Public page: https://ltgeducation.com/contact.
- Applied the additive contact migration to production `qsmvgyyaemjmklceyikr`; all three new tables have RLS. Anonymous table reads/submission RPC and authenticated email-field edits are denied.
- Added production-scoped contact service credential, independent random signing secret, domain-restricted sending-only Resend credential, sender/recipient and canonical origin. Existing non-contact settings were compared before/after and are unchanged; preview settings remain separate.
- Initial production notification failed because Netlify's read API returned a masked credential, which was copied. Replaced only the production contact Resend setting with a dedicated valid credential and rebuilt. The original saved inquiry was retried through the signed-in owner UI successfully.
- Live browser submission confirmed persistence and demo preselection. Test inquiry `6becaa3e-76a9-40b1-8ec7-a1c70d795d77` is clearly labeled “Release verification — Not a real prospect”, remains New, and has notification status sent. Resend confirmed delivery to the requested recipient at 19:34:26 UTC; provider ID `01a1d141-162d-7b4e-ac0f-4300da6250b5`.
- Signed-in production owner pipeline displayed the inquiry. Signed-in attendance, time-clock, and gradebook pages returned HTTP 200 without an application-error page. Anonymous redirects for these protected routes match the pre-release baseline. No operational form was submitted.
- Targeted regression run: 22 files / 168 tests passed (contact, attendance, time clock, grading). Operational application files, package dependencies and Netlify routing configuration have no changes versus the previous production baseline.
- Production record counts before migration and after deployment: attendance_records 1,027; timeclock_entries 141; gradebook_attempts 86. No operational records were changed by release work.
- Existing Supabase dashboard warning: billing grace period has ended and requests can stop if quota is exhausted. Billing was not changed. Existing production platform-owner membership was preserved.

The remaining sections retain staging evidence and rollout history.

Production baseline: `b71725be67df5e693cdd4b39a4b71d068b4c58c4` on `product/standalone-mainline-2026-09-11`.
Feature branch: `feature/contact-leads-20261112`.

## Included

- Homepage navigation demo button (including mobile), post-beta CTA, footer contact link.
- Public `/contact` with name, institution, title, work email, phone, department, inquiry type, message, referral answer, source page, referrer, and five UTM fields. Demo links preselect the demonstration inquiry.
- `/owner/admin/prospective-schools`: owner-only paginated pipeline, all six requested statuses, full inquiry details, notes, conflict detection, change history, notification status and manual retry.
- Additive migration for leads, rate limits, and change history. No changes to existing operational tables or workers.

## Security and reliability

Public clients cannot insert or read lead tables or execute the submission RPC. The website validates and bounds request bodies, checks origin, uses a honeypot and a signed token with a minimum age and one-hour lifetime, then invokes a service-role-only database transaction. That transaction serializes duplicate submissions and enforces five inquiries per IP fingerprint per hour. IP addresses are HMAC-hashed; raw addresses are not saved. Old rate-limit buckets are pruned on submission. Netlify's `x-nf-client-connection-ip` is used instead of trusting `X-Forwarded-For`; deployments on another host need an equivalent trusted-IP adapter.

Only existing platform owners can read leads/history and update status/notes under RLS. Other fields cannot be edited by authenticated clients. A private trigger timestamps changes and records their actor. Existing sign-in and MFA middleware protects the owner page and notification retry route. Contact routes are exact public-route exceptions; no public prefix exception was added.

Inquiries are committed before Resend is called. Missing email configuration or provider failure marks the saved lead as failed; interrupted sends remain pending. Owners can retry in the pipeline. Initial sends and retries use the same provider idempotency key (provider retention is 24 hours). Status “sent” means accepted by Resend, not proof of inbox delivery. This release does not install an automatic retry scheduler or delivery webhook. If a retry occurs after the provider's idempotency window following an ambiguous result, first check the provider logs to avoid a duplicate email.

## Staging setup

Staging project: `ezlvivmeneefiiwqwgqd` (Gltg). Migration applied only here; rollback-only hosted persistence test passed. No production migration was applied.

Netlify project: `livingtguide` (`c042bc07-fa6f-426d-8256-ceffee86f5cb`). Deploy-preview database settings already point to Gltg. New settings must be scoped to **deploy-preview**, with **Builds and Functions** scopes:

| Setting | Staging state |
| --- | --- |
| `CONTACT_NOTIFICATION_EMAIL` | Configured as `corvenmor@gmail.com` |
| `CONTACT_FROM_EMAIL` | Configured as `LTG <notifications@mail.communityweldingworkforcealliance.org>`; this sending domain is verified in Resend |
| `CONTACT_SIGNING_SECRET` | Random secret configured |
| `CONTACT_SUPABASE_SERVICE_ROLE_KEY` | Configured as a secret for Gltg only; persistence verified |
| `CONTACT_RESEND_API_KEY` | Configured as a secret, sending-only and restricted to the verified domain; delivery verified |
| `CONTACT_SITE_ORIGIN` | `https://deploy-preview-148--livingtguide.netlify.app`; set the matching public origin for any other preview or future production deployment |

The user supplied the Gltg secret through Netlify. Both credentials are secret, scoped to deploy-preview only and Builds/Functions. Never put either secret in a `NEXT_PUBLIC_` variable or commit it. Email subjects are prefixed `[STAGING]`. Netlify rewrites the internal request origin, so the server validates against CONTACT_SITE_ORIGIN rather than caller-supplied forwarding headers.

## Acceptance before production

1. Complete staging credentials and redeploy the preview.
2. Submit a synthetic inquiry through the browser; verify all fields and attribution in the owner pipeline and confirm receipt at the designated inbox.
3. Change every pipeline status, add notes, verify history, and exercise notification retry.
4. Confirm a signed-in non-owner cannot read or update leads and cannot trigger notification retries.
5. Inspect desktop and mobile layouts and rerun public/protected-route smoke checks.
6. Review the diff and test results before authorizing any production release. Production needs the additive migration and its own server/email settings; do not promote a staging artifact containing staging database settings.

Production website, existing email workers, attendance, grading, payroll, and punch-clock code/configuration were not modified by this work.

## Verification results — November 12, 2026

- Draft PR: https://github.com/weldingworkforcealliance-sys/alpha/pull/148
- Staging preview: https://deploy-preview-148--livingtguide.netlify.app/contact?interest=demo
- Optimized Next.js/Turbopack build passed locally and Netlify preview build succeeded.
- Full existing plus contact suite: 82 files / 774 tests passed on the final full run. Five additional form and notification tests passed separately (779 passing tests across those runs). An earlier concurrent run hit an existing planner timing failure; isolated baseline and final full rerun passed. No planner files were changed.
- TypeScript, repository-wide ESLint, migration filename guard, and diff whitespace checks passed.
- Real PostgreSQL-compatible permission tests cover anonymous denial, non-owner isolation, owner-only stage/notes updates, immutable contact details, audit history, duplicate handling, and rate limiting.
- Hosted staging transaction saved a synthetic inquiry and rolled it back; zero leads remained. Hosted grants confirm anonymous read/RPC denial and no authenticated email-edit privilege.
- Preview HTTP smoke checks: homepage/contact return 200; missing-credential contact API returns 503 without accepting an inquiry; owner pipeline/retry route and attendance/time-clock/gradebook redirect anonymous visitors to login.
- Initial browser access was blocked; this was resolved using an isolated Chrome test browser. See completed browser acceptance below.
- Supabase's advisor reports RLS with no policies on `contact_rate_limits`: intentional server-only storage with all public/authenticated grants revoked and service-role access only. Existing unrelated staging advisor findings were left unchanged.

## Completed hosted acceptance after credential setup

Deployed application commit: `634e0bd729e0824279d6902f742e09fb28853937`; Netlify deploy `6af60c2c0ad011cb7670e3e9` succeeded.

- Contact API challenge and actual POST succeeded (HTTP 200) through the deployed staging application. One synthetic lead remains clearly labeled “Synthetic Test School — Not a Real Lead” for review; ID `c4d2a537-a3c6-4660-8115-da338b030054`.
- All submitted contact/institution/inquiry/attribution fields were read back correctly from Gltg. Status is New, notification status sent.
- Resend confirms **delivered** to the designated inbox at November 12, 2026, 1:59 PM Eastern. Subject: `[STAGING] New LTG inquiry`. Provider email ID: `01a1d120-b836-7bba-95b8-73e23550ac86`.
- Repeating the identical POST returned success without a second lead or second notification.
- Hosted rejection tests passed: cross-origin 403, unsigned 400, oversized 413; honeypot returned success without persisting a lead.
- Hosted owner-role transaction exercised all six pipeline stages and notes, producing six audit records before rollback. The synthetic lead remains New; test-only pipeline changes were rolled back.
- The origin correction passed 23 focused validation/API/notification tests and lint. Earlier full-suite and build results above remain applicable; Netlify rebuilt the final application successfully.

## Completed browser acceptance

- Used an existing staging owner's one-time session in an isolated Chrome browser. No password or account permissions were changed. The user's password-reset loop is not a dependency for these tests and was not represented as repaired.
- Desktop and 390px phone contact layouts reviewed. Corrected public-route classification so the contact page has no instructor sidebar, operational widgets, or conflicting dark workspace styles.
- Homepage Request a Demo navigation reaches the contact form with LTG demonstration selected. Mobile navigation, CTA, and footer links are present.
- Submitted all form fields through the phone layout; confirmation displayed and persisted institution/contact/attribution data verified. Synthetic browser inquiry notification delivered at 19:20:30 UTC; Resend ID `01a1d134-54d3-7807-a2b0-49e66d39d5c4`.
- Signed-in owner UI saved every pipeline stage, persisted notes after reload, displayed all six audit transitions, and filtered New/Closed correctly. The original synthetic lead was returned to New.
- Exercised notification retry from the owner UI by marking only the synthetic browser inquiry failed; retry succeeded using the original provider idempotency key.
- Signed-in non-owner could read zero lead rows, update zero rows, and received HTTP 403 from notification retry. Anonymous owner/attendance/time-clock/gradebook routes still redirect to login.
- Fixed the lead detail background to follow the workspace theme. The new lead administration route has its own Back to Administration link and omits the teaching sidebar/widgets, which otherwise obstructed phone interactions. Existing operational routes retain their layout behavior.
- Latest focused suite: 5 files / 30 tests passed. TypeScript and changed-file ESLint passed; preview builds passed.

Production has not been deployed, migrated, or configured by this work. The live Netlify deploy remains `6aecb5eb6e84b91eeacae2f6`. Release requires applying the additive contact migration to the production project, configuring the production-scoped contact service/email/signing/origin settings, and building from the approved branch with production database settings. Do not promote a preview artifact containing staging settings. There are no missing staging credentials.

Final application commit: 48347c1; staging deploy 6af6123578d3a5fa1fe67bf0 is ready. Phone owner controls were visually reviewed at 390px, showed no horizontal overflow, and saved a stage change through the UI. Both synthetic inquiries remain clearly labeled; no real prospects were modified.

