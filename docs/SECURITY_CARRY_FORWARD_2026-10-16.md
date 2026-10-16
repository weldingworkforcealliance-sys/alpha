# Security carry-forward into Teaching View staging

Source: [PCCC security readiness hardening, PR #111](https://github.com/weldingworkforcealliance-sys/alpha/pull/111), branch `security/pccc-readiness-20260925`, revision `628c95f0a7aee58b7f5ef3a40ebd7721cb8989dc` (open, unmerged when reviewed).

Target baseline: staging PR #141, revision `a223f5dbc110134cccc92d856e0c1354a6c7c95b`.

## Applied in this patch

- Browser MIME, referrer, device-permission, and framing protections through Next.js headers. Disable the framework identification header.
- Adapt the older `DENY` framing rule to `SAMEORIGIN` and `frame-ancestors 'self'`: `app/tower/workspace.tsx` embeds `/tower-ui/index.html`. Blocking all frames would break that workflow.
- Limit CSP to frame ancestry, object embedding, and base URL protection. Do not introduce unvalidated script/style/connection restrictions that could interrupt Next.js or Supabase.
- Add a high/critical dependency audit gate to the existing pull-request CI, with no automatic dependency upgrades.
- Add configuration regression coverage and real HTTP header assertions to the existing route smoke test.

## Preserve newer protections

The current build already verifies session claims before protected routes, disables caching for session responses, rejects external post-login destinations, and requires an enrolled authenticator during password recovery when AAL2 is needed. Keep those changes rather than replacing them with the older branch's authentication files.

## Still requires separate work

- Mandatory MFA enrollment and database AAL2 enforcement are not enabled by this patch. Recovery compatibility and instructor enrollment must be validated first. Client-side navigation alone is not a database authorization boundary.
- Do not copy the old anonymous demo RPC revocations: later migrations restored demo access and disabled the Data API MFA hook in an emergency. Evaluate individual functions and their current grants before changing them.
- CodeQL and scheduled Dependabot configuration need a repository-settings/default-setup check before activation. This patch adds only the existing-CI dependency audit.
- Repository protection, leaked-password protection, retention, and broader database authorization were not freshly audited here. This is a targeted carry-forward, not a complete security certification.

## Deployment boundaries

Staging only. No production deployment, database migration, data edits, or FABTECH QR changes. Production rollout remains subject to the user's final approval.

## Baseline verification before this patch

CI run 38903964454 passed for the exact target baseline: 67 test files / 676 tests, TypeScript, lint, migration guard, archive recovery checks, Next.js build, and route smoke checks. The deployed preview passed public/protected route checks, and all 28 required staging grading functions/grants were present. A fresh local full-suite rerun was interrupted without a result; signed-in browser checks were blocked by browser tooling. Neither is reported as passed.
