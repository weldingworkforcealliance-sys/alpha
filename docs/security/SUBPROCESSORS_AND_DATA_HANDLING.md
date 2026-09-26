# LTG PCCC Data Handling and Subprocessor Register

## Data-owner model

PCCC is the owner/controller of PCCC education and institutional records placed in LTG. LTG processes those records only to provide the authorized institutional service and must not use PCCC student records for advertising, sale, unrelated profiling or unrelated model training.

## Confirmed service providers

| Provider | Function | Expected data exposure | Review requirement |
| --- | --- | --- | --- |
| Supabase | database, Auth, RLS/Data API, storage, Edge Functions | primary LTG student/employee/application data | security/privacy terms, region, encryption, access controls, incident obligations, deletion/export |
| Netlify | web hosting/deployment | web request/account/network metadata; application bundles | hosting security, logs, access control, incident obligations |
| Resend | transactional attendance/operational email | attendance report recipient and message content, including student attendance data when sent | FERPA/data-processing review, retention, incident obligations, permitted use |
| AWS | retained archive | archived student/institutional record bundles and generated PDFs | IAM, encryption, versioning/Object Lock, retention/disposition, incident obligations |
| GitHub | source control/CI | source and synthetic test data only; no student records | repository privacy, access control, branch protection, secret scanning |

## Source-code rule

Real student records, class rosters, student IDs, grades, attendance exports, certificates, passwords, service-role keys, email-provider keys and other production secrets must not be committed to GitHub.

Operational staff email addresses should be configuration data rather than source literals whenever practical.

## Required PCCC agreement terms

The executed agreement/DPA should establish:

- permitted purpose and institutional control of records;
- confidentiality and least-privilege personnel access;
- FERPA-compatible school-official/service-provider obligations as applicable;
- no sale, advertising use or unrelated reuse;
- approved subprocessors and change notification;
- security safeguards and vulnerability management;
- incident notification and cooperation;
- records export/return;
- retention, legal hold and verified disposal;
- audit/evidence rights appropriate to the service;
- requirements that survive termination where records remain under a lawful retention or hold.

## New vendor rule

No new vendor may receive PCCC student or employee data until its data flow, purpose, security role, retention behavior and contractual status are recorded and approved.
