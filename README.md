# Living Teacher Planner Frontend v0.1

First connected frontend milestone for the Living Teacher Planner beta.

## Included
- Supabase browser client
- Email/password login
- Authenticated dashboard
- Reads `current_teaching_sections`
- Displays PVHS B/C current planner day
- Start Today RPC
- Complete Day RPC
- Responsive browser-first UI
- Rule #1 protected-curriculum reminder

## Environment
The included `.env.local` contains only the Supabase Project URL and publishable browser key. It contains no secret/service-role key.

## Run
```bash
npm install
npm run dev
```
Then open http://localhost:3000

## Important
A user only sees teaching sections allowed by Supabase RLS and assignments. The Platform Owner account can see cross-school data according to the database policies already created.