# LTG PCCC Security Readiness Program

**Status:** Active remediation  
**Production branch:** `product/standalone-mainline-2026-09-11`  
**Security branch:** `security/pccc-readiness-20260925`

## Purpose

This file is the technical control map for institutional review of the Living Teacher Guide (LTG). It distinguishes controls already implemented from controls that still require rollout, vendor configuration, contractual approval, or independent testing.

## Data handled by LTG

LTG may process education records and institutional operational records including:

- student roster identity and institutional IDs;
- attendance, assessment submissions, grades, lab attempts and certifications;
- instructor notes related to class delivery;
- instructor and employee identity, time-clock and payroll-support records;
- account identity, authorization roles and audit events.

No payment-card data, Social Security numbers, banking credentials, medical records or government identity documents are intended LTG data types. If a future feature requires one of those categories, it must undergo a new security/privacy review before collection.

## Current architecture

| Layer | Provider | Purpose | Student/employee data |
| --- | --- | --- | --- |
| Web hosting | Netlify | LTG web application | Requests/telemetry may contain account and network metadata |
| Database/Auth/Storage | Supabase | Primary application data, authentication, RLS, API and controlled assets | Yes |
| Transactional email | Resend | Attendance and operational notification email | Yes, where attendance reports are transmitted |
| Retained archive | AWS S3 | Student-record archive and recovery evidence | Yes |
| Source/CI | GitHub | Source control and automated testing | Must not contain student records |

## Implemented technical controls

- TLS through managed production hosting.
- HSTS, clickjacking protection, MIME sniffing protection, referrer restrictions and browser permissions restrictions in Netlify configuration.
- Production/staging Supabase separation.
- Row Level Security on application data with school, instructor, management and gradebook access predicates.
- Role-aware `SECURITY DEFINER` functions with explicit authorization checks and hardened search paths for reviewed privileged workflows.
- Obsolete anonymous demo-classroom RPC execution revoked.
- Live anonymous student RPCs limited to the Connected Classroom / Job Card use cases and retained as explicit exceptions.
- Application audit log with normal client write/delete access withheld.
- Server-only credentials excluded from browser configuration and source.
- Scheduled dependency monitoring through Dependabot.
- npm vulnerability audit and CodeQL static analysis workflow.
- MFA TOTP enrollment/challenge UI.
- Feature-gated Data API AAL2 enforcement hook.
- Production AAL2 enforcement installed but disabled pending staff enrollment.
- Staging AAL2 enforcement enabled for rollout testing.
- Archive destination checks for versioning, public access blocking, encryption, Object Lock and exact-version integrity verification.
- Isolated PostgreSQL recovery testing for retained record bundles.

## Open institutional blockers

### 1. Production MFA rollout

Current production users must enroll TOTP MFA before the production feature flag is enabled. The rollout must include recovery/support procedures and a verified break-glass administrative process.

### 2. Supabase compromised-password protection

Leaked-password protection is currently reported disabled by Supabase Security Advisor. Enable it in the production and staging Auth configuration and retain evidence.

### 3. Game/application infrastructure separation

Twinlane/Corvu Mor services currently share the production Supabase project used by LTG. Even where tables are isolated, unrelated public game endpoints increase the shared attack surface. Move game services, tables and server credentials to a separate project before final institutional sign-off.

### 4. Source repository separation and branch protection

The current repository is public and also contains unrelated game development. LTG should move to a private repository or otherwise be separated into a private institutional source boundary. The production branch is not currently protected by a GitHub branch protection/ruleset. Require pull requests, passing CI/security checks and controlled administrative bypass.

### 5. Records retention and archive disposition

The retained archive currently applies indefinite legal holds to archived objects. LTG must map each record class to the retention/disposition schedule approved for PCCC and New Jersey public records. Indefinite retention must not be the generic default for every record type.

### 6. Full operational disaster recovery

The current archive recovery verifies retained application records and files in an isolated database. It does not by itself reconstruct Supabase Auth accounts, RLS configuration, project settings, Edge Functions and the full operational production environment. Define RTO/RPO with PCCC and perform a full service recovery exercise.

### 7. Vendor/subprocessor review and contracts

Complete institutional review of Supabase, Netlify, Resend, AWS and any other processor that receives PCCC data. Contract terms must address permitted use, confidentiality, incident reporting, retention/deletion, subprocessors and return/export at termination.

### 8. External security testing

Complete an independent penetration test or equivalent qualified external assessment after architectural remediation and before final PCCC production approval.

## Evidence required for final sign-off

- clean CI and CodeQL results;
- clean or dispositioned Supabase Security Advisor findings;
- MFA enrollment coverage report and AAL2 enforcement evidence;
- access-control/RLS test results;
- subprocessor list and contract/DPA evidence;
- approved retention mapping;
- incident-response tabletop evidence;
- operational restore evidence;
- vulnerability/patch-management record;
- external penetration-test report and remediation closure;
- final architecture and data-flow diagram.

## Change rule

Security controls must be introduced through staging first when the control can affect authentication, authorization, data access, email delivery, records retention or recovery. Production enforcement may be enabled only after a tested rollback path exists.
