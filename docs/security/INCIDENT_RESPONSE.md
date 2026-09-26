# LTG Security Incident Response Runbook

## Scope

This runbook covers suspected or confirmed compromise, unauthorized disclosure, alteration, deletion, loss or unavailable access involving LTG systems or PCCC-related data.

## Roles

- **LTG Security Owner:** accountable for technical containment, evidence preservation and vendor coordination.
- **PCCC Security/IT Contact:** designated by PCCC before institutional go-live.
- **PCCC Records/Privacy Contact:** designated by PCCC for education-record and public-record decisions.
- **Service Providers:** Supabase, Netlify, Resend, AWS and other approved subprocessors as applicable.

Contact names, phone numbers and escalation addresses must be maintained outside the public source repository.

## Severity

| Severity | Example |
| --- | --- |
| Critical | confirmed unauthorized access to student grades/attendance, stolen privileged credential, cross-school data exposure, destructive compromise |
| High | suspected privileged-account compromise, exposed secret with plausible access, significant outage or integrity failure |
| Medium | contained authorization defect with no evidence of data access, limited security control failure |
| Low | scanner finding or misconfiguration with no demonstrated exposure |

## First response

1. Preserve relevant logs, request IDs, timestamps, affected account IDs and deployed revision identifiers.
2. Do not place student records, credentials or raw sensitive logs into public GitHub issues.
3. Revoke or rotate affected credentials and sessions where compromise is plausible.
4. Disable affected endpoints/features when containment is safer than continued operation.
5. Preserve database and application evidence before destructive remediation where practical.
6. Notify the designated LTG Security Owner and PCCC contacts under the approved escalation procedure.
7. Open a restricted incident record containing facts, decisions, timeline and evidence references.

## Investigation questions

- What data categories were accessible?
- Which schools/sections/users were within scope?
- Was data read, changed, deleted or merely exposed?
- Which identity, token, API key, RPC or service performed the activity?
- When did access begin and end?
- Are audit and provider logs complete?
- Does the event trigger contractual, FERPA, New Jersey, FTC or other notice obligations?
- Are other tenants or systems exposed through the same credential or project?

## Containment

Containment may include session revocation, credential rotation, account suspension, RPC grant revocation, Edge Function disablement, RLS correction, temporary route disablement, database feature flags or provider-level access controls.

Production restoration must not occur until the exploited path is closed or formally risk-accepted by the accountable institutional owner.

## Notification

LTG must not invent a fixed legal notification deadline. Notice timing and recipients are determined by the facts, applicable law and the executed PCCC contract/DPA. Operationally, suspected high/critical events should be escalated internally immediately so PCCC can make required legal and institutional notification decisions without avoidable delay.

## Recovery

- verify patched access controls;
- rotate compromised credentials and revoke sessions;
- restore data from a verified source when required;
- validate school/tenant isolation;
- run targeted regression and security tests;
- monitor for recurrence;
- document the exact production revision and database state returned to service.

## Post-incident

A post-incident review must identify root cause, affected controls, remediation owner, due date and evidence of closure. Material incidents should trigger review of the risk assessment, vendor controls, monitoring and training.
