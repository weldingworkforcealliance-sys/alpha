# FABTECH 2026: printed QR compatibility and Teaching View v2 rollout guard

**Status: BLOCKED awaiting original standalone FABTECH source and ability to update its Netlify branch deployment. DO NOT MERGE PR #137 OR REPUBLISH A GENERIC DEMO AS THE QR TARGET.**

## Physical cards: immutable entry point

Decoded directly from the printed card photograph on 2026-10-14:

`https://dashboard-functional-20260929--livingtguide.netlify.app/demo/welding/session/`

This exact host + path + trailing slash must remain operational. Do not ask for QR reprints or substitute `ltgeducation.com/demo/welding` or `deploy-preview-137--livingtguide.netlify.app/demo/welding/ux-lab`.

## Existing full-demo release

The deployed QR host belongs to the **livingtguide** Netlify site (`c042bc07-fa6f-426d-8256-ceffee86f5cb`).

- Netlify deployment ID: `6abeb05f71f4ec00da359f4c`
- Context: `branch-deploy`
- Branch/alias: `dashboard-functional-20260929`
- Original release date: October 1, 2026
- Deploy title: `Demo only: return existing original-school members to five-day planner`
- Deployment was **ready** when checked October 14, 2026
- `commit_ref` is null; the old source branch does not exist in the connected GitHub repository `weldingworkforcealliance-sys/alpha`.

Historical working source identified in prior FABTECH work:

`C:\Users\weldi\Documents\Codex\2026-10-01\task\demo-shop-grading`

Original session UI is in `app/demo/welding/session/session.tsx`. This **is not** the public generic 5-day `app/demo/welding/page.tsx` in the connected GitHub repo.

## Approved requested change

Port the **Teaching View v2 presentation/navigation** from PR #137 (staging A/B experiment) to the *existing original FABTECH session implementation*, without replacing its underlying workflows.

Preserve, at minimum:
- QR scan → original landing / 60-second overview → email verification → code-based entry
- existing visitor session rules, access checks, cleanup, and privacy boundaries
- entire planner/agenda/day progression and protected curriculum behavior
- student attendance and paired closeout
- actual shop grading, grading tower, outcomes and certification/evidence tracking
- Live Classroom assessment, QR join, submissions, review and job cards
- reports, school/instructor panels, punch clock, workforce time records and progress
- original visitor URLs, session deep links, and FABTECH branding

Adopt layout improvements:
- fewer duplicate navigation and class/day panels
- compact course selection in the header
- Grading beside Start, Attendance and Complete Day
- Punch In/Out (separate employee clock) visibly in sidebar, with mobile access
- prominent lesson objectives/safety/teaching steps
- supplementary preparation/math/coaching/resources and notes collapsible/on demand
- responsive phone navigation, minimal clutter

**Do not substitute the illustrative 5-criterion browser-local sample grade from the UX lab for the original full demo grading and qualification logic.**

## Release gates

1. Open the standalone original project locally in Work/desktop; inspect its existing routes, auth, content, grading, APIs, and build/deploy scripts.
2. Back up the original QR branch deployment and source. Record a rollback point.
3. Port v2 layout with minimal underlying behavioral edits, preserving the original full feature set.
4. Run typecheck, lint, integration tests, and complete two-visitor end-to-end demo in isolated data.
5. Test on desktop + phone: QR URL, signup/code flow, video, all navigation, attendance, grading, classroom QR, job cards, reporting, clock, progression, and expiry.
6. Only after passing checks, redeploy the **same Netlify branch alias** `dashboard-functional-20260929` so printed cards resolve to the updated experience, with no QR modification.
7. Verify the exact QR URL after publishing and ensure rollback to `6abeb05f71f4ec00da359f4c` is available.

## Current limitation

The connected GitHub repository contains the v2 experiment but **not** the standalone original FABTECH source. The available Netlify connector can inspect deploys but cannot create/replace this manual branch deploy. Publishing the generic GitHub demo would not satisfy QR or feature-preservation requirements.

**Do not claim this QR deployment was upgraded until the actual manual branch deploy is replaced and tested.**
