# Living Teacher Planner Frontend v0.1

Connected browser-first frontend for the Living Teacher Planner beta.

## Included
- Supabase browser client
- Email/password login
- Authenticated planner dashboard
- Reads `current_teaching_sections`
- Displays current planner day
- Start Today / Complete Day workflow
- Connected Classroom assessments
- Training Mode
- Employee Time Clock at `/time-clock`
  - Server-generated clock-in / clock-out timestamps
  - LTG-account self clocking
  - Manager kiosk clocking with employee PIN
  - Duplicate-punch protection
  - Employee-visible attendance history and weekly totals
  - Manager corrections with retained audit history
  - School-scoped row-level security
- Weekly Payroll Reports at `/time-clock/payroll`
  - School payroll roles generate or refresh a weekly report from the authoritative punch record
  - Employee-by-day hours, regular hours, overtime hours, totals, and punch drill-down
  - Open-shift, adjusted-entry, long-shift, and cross-midnight review support
  - Open shifts block payroll finalization
  - Finalization freezes the exact payroll snapshot used for that week
  - Cross-midnight hours are split across the correct local calendar days
  - Finalized CSV export for ADP entry / payroll processing, with export auditing
  - Platform Owner receives the same finalized report snapshot for archive and future analytics
- Responsive browser-first UI
- Rule #1 protected-curriculum reminder

## Environment
The browser application uses the Supabase Project URL and publishable browser key. It contains no secret/service-role key.

## Run
```bash
npm install
npm run dev
```
Then open http://localhost:3000.

## Validation
GitHub Actions runs `npm ci`, the TypeScript check, and a Next.js production build for main-branch pushes and pull requests.

## Important
A user only sees teaching sections and school data allowed by Supabase RLS and assignments. Platform Owner access remains governed by database policies. Time-clock punches are written once through authenticated RPCs and server timestamps rather than editable client-side timestamps. Employees read their own punch history, school payroll roles create and finalize weekly reports, and the Platform Owner reads the same finalized snapshot rather than a duplicate payroll record.

The current payroll CSV is a payroll-ready summary for ADP entry. A direct ADP-import layout should only be added after the school's exact ADP import template, employee identifier requirements, earning codes, and department/pay-code mappings are confirmed.
