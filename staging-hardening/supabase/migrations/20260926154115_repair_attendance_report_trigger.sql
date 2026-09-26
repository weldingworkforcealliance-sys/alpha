-- Gltg staging only. Restore the schema expected by the installed finalization function.
alter table public.attendance_pairs
add column report_trigger text not null default 'finalization'
constraint attendance_pairs_report_trigger_check check (report_trigger in ('initial_complete','finalization'));

