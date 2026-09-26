-- Only for Gltg ezlvivmeneefiiwqwgqd. Removes the synthetic 20260926 fixture.
begin;
set local lock_timeout='3s';
set local statement_timeout='15s';
do $guard$ begin
if not exists(select 1 from public.course_guides where id='92600000-0000-4000-8000-000000000001' and version_label='staging-20260926' and guide_name='STAGING SAMPLE - Tower theory planner') then raise exception 'Fixture identity mismatch'; end if;
if exists(select 1 from public.planner_day_delivery where planner_day_id in ('92600000-0000-4000-8000-000000000031','92600000-0000-4000-8000-000000000032')) or exists(select 1 from public.section_progress where id='92600000-0000-4000-8000-000000000003' and (current_planner_day_number<>1 or started_at is not null or completed_at is not null or last_advanced_at is not null or manual_hold)) then raise exception 'Fixture has test activity; preserve and review it before rollback'; end if;
if (select count(*) from public.course_guide_days where guide_id='92600000-0000-4000-8000-000000000001')<>2 or (select count(*) from public.course_guide_day_resources where source_id='92600000-0000-4000-8000-000000000002')<>2 then raise exception 'Fixture dependencies changed; review before rollback'; end if;
end $guard$;
delete from public.section_progress where id='92600000-0000-4000-8000-000000000003';
delete from public.planner_days where id in ('92600000-0000-4000-8000-000000000031','92600000-0000-4000-8000-000000000032');
delete from public.course_guide_day_resources where id in ('92600000-0000-4000-8000-000000000021','92600000-0000-4000-8000-000000000022');
delete from public.course_guide_day_segments where id in ('92600000-0000-4000-8000-000000000111','92600000-0000-4000-8000-000000000112','92600000-0000-4000-8000-000000000121','92600000-0000-4000-8000-000000000122');
delete from public.course_guide_days where id in ('92600000-0000-4000-8000-000000000011','92600000-0000-4000-8000-000000000012');
delete from public.resource_sources where id='92600000-0000-4000-8000-000000000002';
delete from public.course_guides where id='92600000-0000-4000-8000-000000000001';
commit;
