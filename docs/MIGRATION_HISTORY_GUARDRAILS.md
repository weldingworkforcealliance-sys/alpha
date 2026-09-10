# Supabase Migration History Guardrails

## Why this exists

LTG has a small number of historical migration files that share the same filename version prefix. Those files have already been applied to beta genco under Supabase-generated execution versions. Renaming or replaying them casually could make an already-applied schema change appear new to deployment tooling.

The repository therefore treats those duplicate prefixes as historical exceptions, not a pattern to continue.

## Current grandfathered duplicate version groups

- `202609030009`
  - `202609030009_fix_classroom_session_expiration.sql`
  - `202609030009_rename_timeclock_adp_export_to_report_download.sql`
- `20260910190000`
  - `20260910190000_allow_assigned_instructor_complete_day.sql`
  - `20260910190000_harden_audit_write_surface.sql`
- `20260910193000`
  - `20260910193000_harden_job_card_section_authorization.sql`
  - `20260910193000_increase_attendance_report_worker_timeout.sql`

These filenames are frozen unless a deliberate migration-history reconciliation is performed against every deployed environment.

## Reconciled beta genco ledger mapping

Read-only verification against `supabase_migrations.schema_migrations` on 2026-09-10 confirmed that all six grandfathered files have corresponding applied migration names in beta genco:

| Repository file | Applied ledger version | Applied migration name |
| --- | --- | --- |
| `202609030009_fix_classroom_session_expiration.sql` | `20260903185605` | `fix_classroom_session_expiration` |
| `202609030009_rename_timeclock_adp_export_to_report_download.sql` | `20260903171958` | `rename_timeclock_adp_export_to_report_download` |
| `20260910190000_allow_assigned_instructor_complete_day.sql` | `20260910183759` | `allow_assigned_instructor_complete_day` |
| `20260910190000_harden_audit_write_surface.sql` | `20260910185318` | `harden_audit_write_surface` |
| `20260910193000_harden_job_card_section_authorization.sql` | `20260910192055` | `harden_job_card_section_authorization` |
| `20260910193000_increase_attendance_report_worker_timeout.sql` | `20260910192555` | `increase_attendance_report_worker_timeout` |

This confirms the collision is in repository filename prefixes, not duplicate application of the migrations in beta genco.

## Rules for new migrations

1. Every new migration must use a unique 12- or 14-digit version prefix followed by a snake_case name.
2. Never rename an already-applied migration merely to make the folder look cleaner.
3. Never copy an old migration to a new version and re-run it unless the SQL is explicitly designed and reviewed as an idempotent repair.
4. Schema changes go through a feature/stabilization branch, CI, preview validation when applicable, and then the normal merge/deploy flow.
5. Before applying a migration to beta genco, compare its intended effect with the current live schema and the `supabase_migrations.schema_migrations` ledger.
6. If repository history and the database ledger disagree, reconcile the discrepancy before continuing feature development. Do not guess.

## Automated enforcement

`npm run check:migrations` scans `supabase/migrations` and fails when:

- a filename does not follow the migration naming convention;
- a new duplicate version prefix appears; or
- one of the grandfathered duplicate groups changes unexpectedly.

CI runs this guard before TypeScript, lint, tests, and the production build.

## Deployment-history note

The database migration ledger records the version/name used at application time. Some historical LTG migrations were applied through managed tooling that generated execution-time version values rather than using the repository filename prefix verbatim. That is why repository filename cleanup must not be used as a substitute for migration-ledger reconciliation.
