# NJCWWA Employer Outreach Automation

Google Apps Script automation for the **NJCWWA Employer Outreach & Lead System**.

## Locked resources

- Google account: `weldingworkforcealliance@gmail.com`
- Spreadsheet ID: `1I0uFNU_tjFAiBLuXbOWZrR91WpeF7Mwbsg070XRGPG0`
- Spreadsheet title: `NJCWWA Employer Outreach & Lead System`
- Daily new-employer target: **100**
- Daily total cap: **100**

The code refuses to run under any Gmail account other than `weldingworkforcealliance@gmail.com`.

## Safety model

Live sending requires all three Configuration values:

```text
Campaign Enabled = Yes
Test Mode = No
Live Launch Authorized = Yes
```

A valid physical mailing address is also required before live sending. While `Test Mode = Yes`, every recipient must be in `Test Recipient Allowlist`.

No trigger is installed automatically by this repository. No live email is sent merely by pushing the code.

## Project files

- `Config.gs` — account locks, configuration, time windows, safety checks
- `SheetStore.gs` — header-driven Sheet reads and writes
- `Templates.gs` — merge tags and MIME construction
- `SendQueue.gs` — queue building, controlled batches, daily limits
- `ReplyScanner.gs` — Gmail thread scanning and body decoding
- `LeadProcessor.gs` — reply ingestion and dispatch
- `ReplyClassifier.gs` — intent classification
- `ReplyExtractor.gs` — structured hiring-detail extraction
- `LeadWriter.gs` — lead, opportunity, and task writes
- `Suppression.gs` — unsubscribe, bounce, and Gmail-label handling
- `Triggers.gs` — manual trigger installation and follow-up scheduling
- `Verification.gs` — non-sending setup verification
- `Tests.gs` — controlled test and cleanup functions
- `appsscript.json` — V8 runtime, Gmail API v1, and least-necessary scopes

## Version 2026-10-04.3: 100/100 pre-launch correction

Daily new outreach target and daily total automated cap are both 100. Values above 100 are clamped to 100; missing, nonnumeric, nonpositive, or fractional values fall back to 100. Verification requires effective values of exactly 100/100 and Campaign Enabled = No, Test Mode = Yes, Live Launch Authorized = No. It sends no email and installs no triggers.

Automatic follow-ups remain disabled (Maximum Follow-Ups = 0). Batches remain 10 messages, 45 minutes apart, within 9:30 AM–4:30 PM America/New_York. No larger makeup batches are permitted after missed days. The existing campaign date bounds remain in place. Incoming replies do not consume outgoing send quota; outbound replies remain subject to Google limits.

The existing 250-row queue was prepared at 50 per weekday and has not been expanded or approved by this correction. Before any future launch, reconcile the queue with the 100-per-business-day plan and complete the pipeline test. Sending remains disabled; no triggers are installed. The confirmed physical mailing address is preserved in the Configuration sheet.

## Local checks

Requires Node.js 20 or newer.

```bash
npm run check
```

The local tests do not contact Google. They load the `.gs` files into a mocked Apps Script environment and verify:

- syntax for every `.gs` file
- Alliance-account guard
- required Sheet structure
- reply parsing for county, job type, openings, entry-level status, pay, shift, certification, phone, and hiring date
- lead and job-opportunity creation
- sequence stopping after a genuine reply
- unsubscribe suppression
- live-sending safety gates

## Create and push the Apps Script project with clasp

Google's `clasp` tool requires Node.js 20 or newer. This repository pins the command examples to `@google/clasp@3.4.1`.

### 1. Enable Apps Script API access

While signed into `weldingworkforcealliance@gmail.com`, open:

```text
https://script.google.com/home/usersettings
```

Turn **Google Apps Script API** on.

### 2. Log in with the Alliance account

From this folder:

```bash
npx @google/clasp@3.4.1 login
```

Select only:

```text
weldingworkforcealliance@gmail.com
```

Verify the authorization:

```bash
npx @google/clasp@3.4.1 show-authorized-user
```

Do not commit `.clasprc.json` or paste its contents into chat.

### 3. Create a fresh standalone Apps Script project

Use one of the bootstrap scripts:

```powershell
./tools/bootstrap-clasp.ps1
```

```bash
bash tools/bootstrap-clasp.sh
```

The script creates a standalone project named `NJCWWA Employer Outreach Automation`, runs all checks, pushes the source, and opens the Apps Script editor.

### 4. Authorize and verify in Apps Script

Run `verifyAllianceSetup` and approve permissions only for `weldingworkforcealliance@gmail.com`.

Expected safety state:

```text
Campaign Enabled: No
Test Mode: Yes
Live Launch Authorized: No
Verification result: PASS
```

## Controlled pipeline test

Keep the safety state unchanged. Run:

```text
createTestQueueRecord
sendOnePipelineTest
```

Reply in the same thread with the sample response in the test email, then run:

```text
scanEmployerReplies
verifyPipelineTestResults
```

Logic-only alternatives:

```text
processSyntheticPipelineTestReply
processSyntheticUnsubscribeTest
verifyPipelineTestResults
```

Clean test rows with `removeNJCWWATestData`.

## Queue preparation

`buildNextOutreachQueue` creates up to 120 **Ready for Review** first-touch records and prioritizes contacts marked `PUBLIC EMAIL CONFIRMED`. It does not approve or send them.

## Triggers

Do not install triggers until the complete pipeline test passes. `installNJCWWATriggers` creates the outreach, reply-scan, and maintenance triggers. Remove them with `removeNJCWWATriggers`.

## Quota and deliverability limits

The Gmail API does not bypass Gmail account limits or anti-abuse systems. The internal 100-message cap is a safety ceiling, not a promise that Google will permit every message. Begin with one allowlisted test, then a controlled 10-message employer test before authorizing the 100-per-business-day campaign.
