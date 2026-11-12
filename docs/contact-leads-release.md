# LTG contact and demo inquiries — staged release

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
| `CONTACT_SUPABASE_SERVICE_ROLE_KEY` | Missing: supply the Gltg server credential, never the production key |
| `CONTACT_RESEND_API_KEY` | Missing: supply a sending key authorized for the verified domain |

The connected Supabase tools provide database access but not server API credentials; local Supabase CLI is not authenticated. The application deliberately disables submission while its database credential is missing. Never put either secret in a `NEXT_PUBLIC_` variable or commit it. After setting credentials, rebuild the preview. Email subjects are prefixed `[STAGING]` there.

## Acceptance before production

1. Complete staging credentials and redeploy the preview.
2. Submit a synthetic inquiry through the browser; verify all fields and attribution in the owner pipeline and confirm receipt at the designated inbox.
3. Change every pipeline status, add notes, verify history, and exercise notification retry.
4. Confirm a signed-in non-owner cannot read or update leads and cannot trigger notification retries.
5. Inspect desktop and mobile layouts and rerun public/protected-route smoke checks.
6. Review the diff and test results before authorizing any production release. Production needs the additive migration and its own server/email settings; do not promote a staging artifact containing staging database settings.

Production website, existing email workers, attendance, grading, payroll, and punch-clock code/configuration were not modified by this work.
