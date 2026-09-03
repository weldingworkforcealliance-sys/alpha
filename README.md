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
  - Attendance reporting and CSV export
  - Manager corrections with retained audit history
  - School-scoped row-level security
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
A user only sees teaching sections and school data allowed by Supabase RLS and assignments. Platform Owner access remains governed by the database policies. Time-clock punches are written through authenticated RPCs and server timestamps rather than editable client-side timestamps.
