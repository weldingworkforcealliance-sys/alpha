alter table public.course_guides
  add column if not exists curriculum_authority_id uuid references public.course_curriculum(id) on delete restrict,
  add column if not exists time_authority_model text not null default 'ltg_section',
  add column if not exists authority_notes text;

update public.course_guides g
set curriculum_authority_id = cc.id,
    time_authority_model = 'ltg_section',
    authority_notes = coalesce(g.authority_notes,
      'Protected curriculum/outcomes come from the linked approved curriculum. Delivery minutes come from the LTG section time structure, not syllabus contact-hour fields.')
from public.course_curriculum cc
where cc.school_id = g.school_id
  and cc.course_id = g.course_id
  and cc.status = 'approved'
  and cc.locked = true
  and g.curriculum_authority_id is null
  and not exists (
    select 1 from public.course_curriculum cc2
    where cc2.school_id = g.school_id
      and cc2.course_id = g.course_id
      and cc2.status = 'approved'
      and cc2.locked = true
      and cc2.id <> cc.id
  );

alter table public.course_guides
  drop constraint if exists course_guides_time_authority_model_check;
alter table public.course_guides
  add constraint course_guides_time_authority_model_check
  check (time_authority_model = 'ltg_section');

create or replace function public.validate_course_guide_authority()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_ok boolean;
begin
  if new.curriculum_authority_id is null then
    return new;
  end if;

  select exists (
    select 1
    from public.course_curriculum cc
    where cc.id = new.curriculum_authority_id
      and cc.school_id = new.school_id
      and cc.course_id = new.course_id
      and cc.status = 'approved'
      and cc.locked = true
  ) into v_ok;

  if not v_ok then
    raise exception 'LTG curriculum authority must be an approved, locked curriculum record for the same school and course';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_course_guide_authority on public.course_guides;
create trigger validate_course_guide_authority
before insert or update of curriculum_authority_id, school_id, course_id
on public.course_guides
for each row execute function public.validate_course_guide_authority();

-- Repair the two actual live timing overages found by the LTG audit.
-- WLD 110 Night Day 1: OFC application was accidentally 50 minutes instead of the standing 5-minute block.
with target as (
  select d.id
  from public.course_guide_days d
  join public.course_guides g on g.id=d.guide_id
  join public.courses c on c.id=d.course_id
  where c.course_code='WLD 110'
    and g.guide_name='WLD 110 College Day/Night 23-Day Instructor Guide'
    and d.planner_day_number=1
)
update public.course_guide_day_segments s
set planned_minutes = case s.sequence_number when 2 then 5 else s.planned_minutes end,
    start_minute = case s.sequence_number when 1 then 0 when 2 then 25 when 3 then 30 when 4 then 160 else s.start_minute end,
    end_minute   = case s.sequence_number when 1 then 25 when 2 then 30 when 3 then 160 when 4 then 190 else s.end_minute end,
    updated_at = now()
where s.guide_day_id in (select id from target)
  and s.sequence_number between 1 and 4;

-- PVHS WLD 210 Day 10: preserve all activities but fit them into the LTG 120-minute WLD 210 block.
with target as (
  select d.id
  from public.course_guide_days d
  join public.course_guides g on g.id=d.guide_id
  join public.courses c on c.id=d.course_id
  where c.course_code='WLD 210'
    and g.guide_name='WLD 210 Master Instructor Guide - Level II - PVHS Bridge + 23-Day Core + Fabrication Extension'
    and d.planner_day_number=10
)
update public.course_guide_day_segments s
set planned_minutes = case s.sequence_number
      when 1 then 20 when 2 then 15 when 3 then 15 when 4 then 50 when 5 then 10 when 6 then 5 when 7 then 5
      else s.planned_minutes end,
    start_minute = case s.sequence_number
      when 1 then 0 when 2 then 20 when 3 then 35 when 4 then 50 when 5 then 100 when 6 then 110 when 7 then 115
      else s.start_minute end,
    end_minute = case s.sequence_number
      when 1 then 20 when 2 then 35 when 3 then 50 when 4 then 100 when 5 then 110 when 6 then 115 when 7 then 120
      else s.end_minute end,
    updated_at = now()
where s.guide_day_id in (select id from target)
  and s.sequence_number between 1 and 7;

create or replace view public.planner_day_compliance
with (security_invoker = true)
as
with segment_totals as (
  select d.id as guide_day_id,
         coalesce(sum(s.planned_minutes),0)::integer as segment_minutes
  from public.course_guide_days d
  left join public.course_guide_day_segments s on s.guide_day_id=d.id
  group by d.id
),
math_totals as (
  select d.id as guide_day_id,
         coalesce(max(m.planned_minutes),0)::integer as math_minutes
  from public.course_guide_days d
  left join public.course_guide_day_math m on m.guide_day_id=d.id
  group by d.id
),
outcome_checks as (
  select d.id as guide_day_id,
         count(gdo.id)::integer as mapped_outcomes,
         count(gdo.id) filter (
           where co.locked = true
             and co.curriculum_id = g.curriculum_authority_id
             and co.school_id = d.school_id
             and co.course_id = d.course_id
         )::integer as protected_outcomes
  from public.course_guide_days d
  join public.course_guides g on g.id=d.guide_id
  left join public.course_guide_day_outcomes gdo on gdo.guide_day_id=d.id
  left join public.course_outcomes co on co.id=gdo.outcome_id
  group by d.id
)
select p.id as planner_day_id,
       p.school_id,
       p.section_id,
       p.course_id,
       p.guide_day_id,
       p.planner_day_number,
       p.scheduled_date,
       c.course_code,
       s.section_name,
       g.guide_name,
       g.curriculum_authority_id,
       cc.version as curriculum_authority,
       cc.status as curriculum_record_status,
       cc.locked as curriculum_locked,
       g.time_authority_model,
       s.planned_minutes_per_day as ltg_time_authority_minutes,
       st.segment_minutes,
       mt.math_minutes,
       case
         when st.segment_minutes < s.planned_minutes_per_day
           then st.segment_minutes + mt.math_minutes
         else st.segment_minutes
       end as effective_planned_minutes,
       case
         when s.planned_minutes_per_day is null then 'NO_TIME_AUTHORITY'
         when (case when st.segment_minutes < s.planned_minutes_per_day then st.segment_minutes + mt.math_minutes else st.segment_minutes end) = s.planned_minutes_per_day then 'PASS'
         when (case when st.segment_minutes < s.planned_minutes_per_day then st.segment_minutes + mt.math_minutes else st.segment_minutes end) > s.planned_minutes_per_day then 'OVER'
         else 'UNDER'
       end as timing_status,
       (case when st.segment_minutes < s.planned_minutes_per_day then st.segment_minutes + mt.math_minutes else st.segment_minutes end) - s.planned_minutes_per_day as timing_delta_minutes,
       oc.mapped_outcomes,
       oc.protected_outcomes,
       case
         when g.curriculum_authority_id is null then 'NO_AUTHORITY'
         when cc.status <> 'approved' or cc.locked is not true then 'UNPROTECTED_AUTHORITY'
         when oc.mapped_outcomes = 0 then 'NO_OUTCOME_LINKS'
         when oc.mapped_outcomes = oc.protected_outcomes then 'PASS'
         else 'OUTCOME_MISMATCH'
       end as curriculum_status
from public.planner_days p
join public.sections s on s.id=p.section_id
join public.courses c on c.id=p.course_id
join public.course_guide_days d on d.id=p.guide_day_id
join public.course_guides g on g.id=d.guide_id
left join public.course_curriculum cc on cc.id=g.curriculum_authority_id
left join segment_totals st on st.guide_day_id=d.id
left join math_totals mt on mt.guide_day_id=d.id
left join outcome_checks oc on oc.guide_day_id=d.id;

grant select on public.planner_day_compliance to authenticated, service_role;

create or replace function public.enforce_ltg_planner_day_compliance()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_guide_day_id uuid;
  v_section_id uuid;
  v_bad record;
begin
  if tg_table_name = 'planner_days' then
    v_guide_day_id := coalesce(new.guide_day_id, old.guide_day_id);
    v_section_id := coalesce(new.section_id, old.section_id);
  elsif tg_table_name in ('course_guide_day_segments','course_guide_day_math') then
    v_guide_day_id := coalesce(new.guide_day_id, old.guide_day_id);
    v_section_id := null;
  elsif tg_table_name = 'sections' then
    v_section_id := coalesce(new.id, old.id);
    v_guide_day_id := null;
  end if;

  select * into v_bad
  from public.planner_day_compliance pc
  where (v_guide_day_id is null or pc.guide_day_id=v_guide_day_id)
    and (v_section_id is null or pc.section_id=v_section_id)
    and (pc.timing_status <> 'PASS' or pc.curriculum_status <> 'PASS')
  limit 1;

  if found then
    raise exception 'LTG planner compliance failed: course %, section %, day %, timing % (% min), curriculum %',
      v_bad.course_code, v_bad.section_name, v_bad.planner_day_number,
      v_bad.timing_status, v_bad.timing_delta_minutes, v_bad.curriculum_status;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists enforce_ltg_planner_day_on_planner_days on public.planner_days;
create constraint trigger enforce_ltg_planner_day_on_planner_days
after insert or update of guide_day_id, section_id, course_id on public.planner_days
deferrable initially deferred
for each row execute function public.enforce_ltg_planner_day_compliance();

drop trigger if exists enforce_ltg_planner_day_on_segments on public.course_guide_day_segments;
create constraint trigger enforce_ltg_planner_day_on_segments
after insert or update or delete on public.course_guide_day_segments
deferrable initially deferred
for each row execute function public.enforce_ltg_planner_day_compliance();

drop trigger if exists enforce_ltg_planner_day_on_math on public.course_guide_day_math;
create constraint trigger enforce_ltg_planner_day_on_math
after insert or update or delete on public.course_guide_day_math
deferrable initially deferred
for each row execute function public.enforce_ltg_planner_day_compliance();

drop trigger if exists enforce_ltg_section_time_authority on public.sections;
create constraint trigger enforce_ltg_section_time_authority
after update of planned_minutes_per_day on public.sections
deferrable initially deferred
for each row execute function public.enforce_ltg_planner_day_compliance();
