# LTG Full-Stack Security, Architecture, Performance, and Maintainability Audit

Date: 2026-09-14
Branch audited: `main`
Database audited: development/test Supabase project `Gltg`
Production scope: **not modified by this audit pass**

## Executive summary

LTG is structurally sound enough for continued beta development, but it has accumulated the predictable debt of a rapidly built operational platform: large client components, a wide PostgreSQL RPC surface, a growing global CSS stack, and several database access patterns that need to be tightened deliberately rather than rewritten wholesale.

No obvious catastrophic issue was found in the audited development branch: no committed service-role credential, no trivially unauthenticated administrative page, no direct SQL-string construction in application code, and no user-controlled `dangerouslySetInnerHTML` use. The highest-value improvements in this pass focused on anonymous RPC hardening, redirect safety, response headers, join-code entropy, public demo abuse controls, error-message leakage, and hot authorization indexes.

The largest remaining security concern is not a confirmed exploit but **surface area**: many authenticated PostgreSQL `SECURITY DEFINER` functions remain exposed as intentional application RPCs. Each must continue to be classified and tested rather than mass-revoked or mass-altered.

---

# 1. Architecture and structure

## A1. Root layout is a broad client boundary

**Severity:** Medium

**File:** `app/layout.tsx`

The root layout begins with:

```ts
'use client';
```

It also owns route classification, navigation state, theme bootstrap, sidebar rendering, usage tracking, dashboard punch-clock mounting, attendance alerts, cohort workspace state, teacher identity, and other global UI concerns.

### Impact

This broad client boundary increases hydration work and couples unrelated features to one root component. It also makes server-component adoption harder because almost the entire application shell is already below a client boundary.

### Recommendation

Do not convert this in one large beta-era rewrite. Introduce a server `app/layout.tsx` and move interactive concerns into a smaller `AppShellClient` component incrementally. Preserve route-specific body classes and existing CSS selectors during the transition.

Target shape:

```tsx
// app/layout.tsx, server component
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppShellClient>{children}</AppShellClient>
      </body>
    </html>
  );
}
```

The first migration should move only navigation open/close and `usePathname()` logic. Do not combine this work with visual redesign.

---

## A2. Large page modules mix data access, permissions, UI state, and rendering

**Severity:** Medium

Representative files:

- `app/attendance/history/page.tsx`
- `app/agenda/page.tsx`
- `app/accounts/page.tsx`
- `app/attendance/attendance-workspace.tsx`
- `app/time-clock/page.tsx`
- `app/planner/page.tsx`

Several of these files are roughly 20-35 KB and perform database reads, authorization checks, formatting, workflow state, mutation handling, and rendering in one module.

### Impact

This increases regression risk and makes isolated tests difficult. A future change to presentation can accidentally disturb data-loading logic, which is a particularly expensive hobby in attendance/payroll software.

### Recommendation

Split by **workflow boundary**, not by arbitrary component size:

```text
feature/
  data.ts            // Supabase reads/RPC wrappers
  mutations.ts       // writes/RPC mutations
  types.ts
  useFeatureState.ts // client orchestration
  components/
```

Start with Attendance History and Accounts because they combine sensitive authorization/data behavior with large UI modules.

---

## A3. Tenant skin infrastructure is now dormant but remains in the repository

**Severity:** Low

Historical files include:

- `app/tenant-skin-provider.tsx`
- `lib/skin-registry.ts`
- PCCC/clinical skin CSS assets

The live development shell no longer imports or mounts tenant skin runtime code. This was verified by regression tests.

### Recommendation

Keep these files dormant until a future theming effort has an approved design system. Do not reintroduce skin CSS into the root layout without visual regression coverage.

---

# 2. Security audit

## S1. Post-login redirect validation accepted too broad a class of encoded paths

**Severity before fix:** Medium

**File:** `lib/auth-routes.ts`
**Function:** `safePostLoginRoute`

Previous protection rejected obvious external URLs and `//` paths, but did not explicitly reject encoded slash/backslash tricks or malformed percent-encoding.

### Fix applied

The function now rejects:

- external absolute URLs
- protocol-relative URLs
- raw backslashes
- encoded and double-encoded slash/backslash tricks
- control characters
- malformed percent sequences

Regression coverage: `tests/auth-routes.test.ts`.

---

## S2. Baseline browser response hardening was incomplete

**Severity before fix:** Medium

**File:** `netlify.toml`

### Fix applied

The deployment configuration now defines:

```toml
X-Content-Type-Options = "nosniff"
X-Frame-Options = "DENY"
Referrer-Policy = "strict-origin-when-cross-origin"
Permissions-Policy = "camera=(), microphone=(), geolocation=()"
Strict-Transport-Security = "max-age=31536000; includeSubDomains"
```

Regression coverage: `tests/security-headers.test.ts`.

### Remaining work

A Content Security Policy should be introduced only after inventorying framework scripts, Supabase connections, images, QR/data URLs, and any external resources. A guessed CSP during beta is more likely to break the product than secure it.

---

## S3. Anonymous `SECURITY DEFINER` RPCs required deterministic search paths

**Severity before fix:** Medium

Relevant RPCs include:

- `public.get_classroom_assessment(text)`
- demo classroom create/connect/read/submit/result RPCs
- job-card anonymous read/submit RPCs

The live classroom and job-card write paths were already substantially hardened. The classroom read RPC and demo RPC chain still used `search_path=public` in parts of the development schema.

### Fix applied

Migrations:

- `20260914230000_harden_classroom_read_search_path.sql`
- `20260914234000_harden_anonymous_demo_classroom.sql`
- `20260914234500_harden_demo_cleanup_helper.sql`

The relevant elevated functions now use:

```sql
set search_path = ''
```

and fully qualified object references.

The anonymous Live Classroom read payload continues to omit `correct_answer` and `accepted_answers`.

### Important context

`anon`, `authenticated`, and `PUBLIC` currently do **not** have `CREATE` privilege on the `public` schema in Gltg. This reduces practical search-path hijacking risk, but an empty search path remains better defense in depth for elevated functions.

---

## S4. Anonymous demo endpoints allowed excessive resource consumption

**Severity before fix:** Medium

Public demo access is intentional, but anonymous callers could create many sessions and grow participant/submission data with few database-side bounds.

### Fix applied

Migrations:

- `20260914234000_harden_anonymous_demo_classroom.sql`
- `20260915000500_bound_demo_session_creation.sql`

Controls now include:

- maximum 60 participants per demo session
- maximum answer JSON size of 65,536 bytes
- maximum individual answer length of 2,000 characters
- maximum 30 newly created demo sessions per minute
- maximum 200 active demo sessions
- advisory transaction lock around session-creation capacity checks

The public demo remains account-free.

---

## S5. Join-code entropy was unnecessarily low for anonymous workflows

**Severity before fix:** Medium

New Live Classroom and Job Card codes were six hexadecimal characters, approximately 16.7 million possible values.

### Fix applied

Migration: `20260914235500_strengthen_live_join_code_entropy.sql`

New codes are eight hexadecimal characters, approximately 4.29 billion possibilities. Existing six-character active codes remain valid because lookup functions treat join codes as text rather than enforcing length.

Demo session codes were also moved to eight characters.

---

## S6. Shared UI error formatting could expose PostgreSQL diagnostics

**Severity before fix:** Medium

**File:** `lib/format-error.ts`

The previous formatter tried `message`, `details`, `hint`, `error_description`, then serialized the raw error object. Supabase/PostgreSQL `details` and `hint` fields can expose constraint names, table names, and schema diagnostics.

### Fix applied

The formatter now:

- preserves intentional application/RPC messages
- maps common database codes to user-safe text
- suppresses raw PostgreSQL `details` and `hint`
- suppresses common technical schema/constraint errors
- no longer serializes unknown raw error objects into the UI

Regression coverage: `tests/format-error.test.ts`.

---

## S7. No application-level route error boundary existed

**Severity before fix:** Low/Medium

### Fix applied

Added `app/error.tsx`.

The boundary:

- gives the user Retry and Dashboard recovery paths
- does not render raw error messages/stacks
- logs technical metadata to the console
- may display the Next error digest as a support reference

Regression coverage: `tests/error-boundary.test.ts`.

---

## S8. Attendance report worker uses service-role access and needed tighter external-call controls

**Severity before fix:** Medium

**File:** `supabase/functions/send-attendance-reports/index.ts`

Existing strengths:

- service-role key is server-side only
- caller must provide a cron secret
- secret is verified by database RPC
- attendance content is HTML-escaped
- Resend requests use idempotency keys

### Fix applied

- recipient safety cap: 20
- external request timeout: 15 seconds
- recipient sends are concurrent instead of strictly serial
- existing idempotency scheme retained

### Follow-up recommendation

If recipient lists grow materially, replace full `Promise.all` fan-out with a small concurrency pool (for example 4-5) to avoid provider burst-rate limits.

---

## S9. Supabase leaked-password protection is disabled

**Severity:** Medium

Gltg's Supabase Security Advisor reports leaked-password protection disabled.

Reference: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

### Recommendation

Enable leaked-password protection in Supabase Auth settings for development and then production after validation. The currently connected database tool does not expose the Auth project-setting mutation, so this was not changed by SQL.

---

## S10. Public signup is an architectural dependency of account invitation

**Severity:** Medium design risk

**File:** `app/accounts/page.tsx`

Account Management creates an isolated browser Supabase client and performs:

```ts
signupClient.auth.signUp({
  email,
  password: temporaryPassword,
  options: { emailRedirectTo: `${window.location.origin}/account-setup` }
})
```

The page generates the temporary password with `crypto.getRandomValues`, which is good. The subsequent school association is protected by administrative RPC authorization.

However, this architecture requires public Supabase signup to remain available. UI authorization does not prevent an external actor from calling the project's public Auth signup endpoint directly if project settings allow it.

### Recommended redesign

Move invitation/account creation to a protected server or edge function using server-only administrative credentials, then disable unrestricted public signup. Keep school membership assignment in audited database RPCs.

Do not perform this migration casually during the live beta. It changes the account lifecycle and requires invitation-flow regression testing.

---

## S11. Large authenticated `SECURITY DEFINER` surface remains

**Severity:** Medium, ongoing review

Supabase Security Advisor reports many authenticated-executable `SECURITY DEFINER` functions. Many are intentional application APIs, including attendance, planner, reporting, owner/admin, training, and classroom workflows.

Sampled functions correctly enforce role/ownership checks, including:

- `get_assessment_answer_key`
- `admin_lookup_user_by_email`
- `owner_update_school_membership`
- `record_owner_password_reset_request`

### Recommendation

Maintain a registry of exposed RPCs with:

```text
function
caller roles
security definer/invoker
required authorization check
anonymous? yes/no
search_path hardened? yes/no
test coverage
```

Do not blindly revoke all advisor warnings. That would remove the application's API along with the risk.

---

# 3. Performance audit

## P1. Hot authorization indexes were missing for user-first lookups

**Severity before fix:** Medium

Existing indexes favored `(school_id,user_id)` and `(section_id,instructor_id)`, while common authorization paths begin with the current user/instructor.

### Fix applied

Migration: `20260914232000_optimize_hot_membership_indexes_and_branding_rls.sql`

Added:

```sql
create index school_memberships_user_status_idx
  on public.school_memberships(user_id, status, school_id);

create index section_instructors_instructor_active_idx
  on public.section_instructors(instructor_id, active, section_id);
```

The database advisor's unindexed-FK count dropped from 84 to 82. More importantly, these indexes match actual authentication/authorization access patterns rather than merely satisfying a lint counter.

---

## P2. Branding RLS re-evaluated auth functions per row

**Severity before fix:** Low/Medium

Supabase Performance Advisor reported `auth_rls_initplan` for `branding_profiles_select_member`.

### Fix applied

The policy now uses scalar subselects:

```sql
(select public.is_platform_owner())
...
sm.user_id = (select auth.uid())
```

The advisor warning disappeared after migration.

---

## P3. Do not blindly add the remaining foreign-key indexes

**Severity:** Advisory

The Supabase advisor still reports many unindexed foreign keys. Some referenced tables are low-volume, archival, or already have useful leading indexes for LTG's actual query patterns.

### Recommendation

Use `pg_stat_user_indexes`, `EXPLAIN (ANALYZE, BUFFERS)`, and slow-query evidence before adding more indexes. Each index has write/storage cost.

The audit intentionally did **not** add dozens of lint-driven indexes.

---

## P4. Core screens still use wildcard teaching-section reads

**Severity:** Medium

Files:

- `app/planner/page.tsx`
- `app/dashboard/page.tsx`
- `app/agenda/page.tsx`

Pattern:

```ts
supabase.from('current_teaching_sections').select('*')
```

Other LTG screens already request explicit columns.

### Recommendation

Replace wildcard selects with explicit contracts. For example, Planner currently needs approximately:

```text
school_id,section_id,section_name,section_code,course_code,course_name,
cohort_name,current_planner_day_number,planner_day_id,scheduled_date,
guide_day_id,planner_day_title,manual_hold,hold_reason,completed_at
```

This reduces payload coupling and protects these screens when the database view gains columns.

This was **not** patched in this pass because these are large, high-traffic beta pages and the current repository connector only offers full-file replacement rather than a safe small diff edit.

---

## P5. Attendance report worker still performs per-report database retrieval

**Severity:** Low now, Medium at larger scale

For each claimed report the worker fetches session, pair, records, then students.

At current class sizes and a claim limit of 25, this is acceptable. At multi-school scale, batch session/pair/student retrieval across all claimed queue rows in one worker invocation.

---

# 4. Code quality and maintainability

## Q1. Error handling is inconsistent across pages

**Severity:** Medium

LTG now has a safer shared `formatError`, but several large pages still use local error extraction such as:

```ts
err instanceof Error ? err.message : String(err)
```

### Recommendation

Adopt `lib/format-error.ts` for user-facing errors across sensitive pages, while logging the raw object separately for diagnostics.

Prioritize:

- Account Setup
- Account Management
- Time Clock
- Attendance Corrections
- Agenda

---

## Q2. Authorization checks are duplicated between UI and database

**Severity:** Low/Medium maintainability risk

Client pages often compute role options or visibility, while RPCs correctly perform the actual enforcement.

### Recommendation

Treat UI authorization only as presentation. Keep database RPC/RLS checks authoritative. Extract reusable capability helpers where the UI needs consistent feature visibility, but never use those helpers as the security boundary.

---

## Q3. Global CSS remains a major maintenance hotspot

**Severity:** Medium

The root layout imports many global override layers. Historical skin layers have now been removed from runtime, which reduces the immediate problem.

### Recommendation

Consolidate incrementally into semantic token/base/component layers. Do not perform another one-shot visual rewrite during beta. Add screenshot/visual regression coverage before structural CSS consolidation.

---

## Q4. Browser-level authenticated end-to-end testing is still missing

**Severity:** High for release confidence

Current CI provides TypeScript, ESLint, Vitest, production Next build, migration filename validation, and public-route smoke testing. These are valuable but do not verify a real authenticated browser flow.

### Recommendation

Add Playwright (or equivalent) against Gltg staging for a small critical path suite:

1. instructor login
2. select teaching section
3. open/start planner day
4. take attendance
5. create Live Classroom session
6. anonymous student joins/submits
7. instructor sees result
8. clock in/out
9. admin attendance history

This is the strongest remaining test investment for LTG.

---

# 5. Verification completed during this audit

- Full GitHub CI passed on `main` after the improvement batch.
- Anonymous demo session creation/read/connect smoke-tested under the actual PostgreSQL `anon` role.
- New demo join code verified at 8 characters under `anon` role.
- Live Classroom and Job Card generator output verified at 8 characters.
- Gltg Supabase security and performance advisors rerun after migrations.
- `branding_profiles` RLS init-plan warning cleared.
- No create privilege on `public` schema for `anon`, `authenticated`, or `PUBLIC`.

---

# 6. Priority queue

## P0 before broader external rollout

1. Enable Supabase leaked-password protection.
2. Add authenticated browser E2E tests for critical LTG workflows.
3. Redesign account invitation so public Auth signup can eventually be disabled.
4. Continue classifying externally callable `SECURITY DEFINER` RPCs.

## P1 engineering cleanup

1. Replace wildcard `current_teaching_sections.select('*')` on Planner/Dashboard/Agenda.
2. Split large Attendance/Accounts/Agenda modules by workflow boundary.
3. Move toward a server root layout with a smaller client app shell.
4. Standardize user-facing errors on the sanitized formatter.
5. Add query-plan-driven indexes only where measured traffic justifies them.

## P2 later

1. Incremental global CSS consolidation.
2. CSP rollout after dependency/resource inventory.
3. Remove truly unused historical skin code only after rollback value expires.

---

# 7. Overall engineering assessment

**Security:** materially improved; no critical exploit confirmed in this pass, but RPC surface still deserves continued review.

**Architecture:** functional and coherent, but client-heavy and increasingly monolithic in high-traffic pages.

**Performance:** healthy at current beta scale; biggest risks are future scaling patterns rather than present failure. Targeted database tuning has begun.

**Maintainability:** acceptable for beta, with several large modules and global styling layers now becoming the main source of regression risk.

**Release posture:** keep current changes on `main` + Gltg until staging validation is complete. Production should receive a deliberate, reviewed promotion rather than an automatic branch sync.
