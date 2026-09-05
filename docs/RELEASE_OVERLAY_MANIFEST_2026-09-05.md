# Release overlay manifest

The combined LTG release should overlay only the approved planner and attendance files onto the current `main` tree. All unrelated files come from current `main`.

## Planner overlay
- app/components/planner/PlannerTeachingConsole.tsx
- app/components/planner/PlannerTeachingConsole.module.css
- app/planner/page.tsx
- app/student-display/[guideDayId]/page.tsx
- app/layout.tsx
- app/cohort-workspace-bar.tsx
- app/teacher-identity-bar.tsx
- app/planner-utility-nav-links.tsx
- app/training/session/[id]/teacher/page.tsx

## Attendance overlay
- app/attendance/page.tsx
- app/attendance/admin/page.tsx
- app/attendance/attendance.module.css
- supabase/migrations/20260905143000_student_attendance_module.sql
- supabase/migrations/20260905143100_attendance_report_worker_claim.sql
- supabase/functions/send-attendance-reports/index.ts

## Release docs
- docs/RELEASE_GLOBAL_PLANNER_ATTENDANCE_2026-09-05.md
- docs/BRANCH_SYNC_PLAN_2026-09-05.md
- docs/RELEASE_OVERLAY_MANIFEST_2026-09-05.md