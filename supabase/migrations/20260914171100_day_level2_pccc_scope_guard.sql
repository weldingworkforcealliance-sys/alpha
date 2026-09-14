-- Guardrail for the Day Level II planner draft migration.
-- The preceding migration is intentionally authored for PCCC's WLD 205/210 catalog.
-- If the same course codes ever exist under another school before this migration is
-- applied in a cloned environment, remove any non-PCCC draft guides immediately.
-- Draft guides have no live section wiring at this stage.

begin;

delete from public.course_guides g
using public.courses c, public.schools s
where g.course_id = c.id
  and c.school_id = s.id
  and g.version_label = '2026-09-14-DAY-L2-23-v1'
  and c.course_code in ('WLD 205','WLD 210')
  and s.name <> 'Passaic County Community College';

commit;
