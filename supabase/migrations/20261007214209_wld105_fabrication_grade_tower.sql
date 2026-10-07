-- WLD 105 fabrication grading and weighted theory tower.
-- Adds rubric evidence without duplicating Live Classroom submissions.

create table public.gradebook_category_weights (
  gradebook_id uuid not null references public.gradebooks(id) on delete restrict,
  category_code text not null check (category_code ~ '^[a-z][a-z0-9_]*$'),
  weight_percent numeric not null check (weight_percent > 0 and weight_percent <= 100),
  primary key (gradebook_id, category_code)
);

alter table public.gradebook_category_weights enable row level security;
revoke all on public.gradebook_category_weights from anon, authenticated;
grant select on public.gradebook_category_weights to authenticated;
create policy gradebook_category_weights_read
on public.gradebook_category_weights for select to authenticated
using (public.can_access_gradebook(gradebook_id));

create table public.wld105_fabrication_attempts (
  id uuid primary key default gen_random_uuid(),
  gradebook_id uuid not null references public.gradebooks(id) on delete restrict,
  gradebook_attempt_id uuid not null unique,
  student_id uuid not null references public.attendance_students(id) on delete restrict,
  project_code text not null check (project_code in ('m','dice','n','tube_cube')),
  attempt_number integer not null check (attempt_number between 1 and 2),
  layout_score numeric,
  layout_na boolean not null default false,
  prep_score numeric,
  prep_na boolean not null default false,
  fitup_score numeric,
  fitup_na boolean not null default false,
  welding_score numeric,
  welding_na boolean not null default false,
  finish_score numeric,
  finish_na boolean not null default false,
  earned_score numeric not null,
  possible_score numeric not null check (possible_score > 0),
  percent_score numeric not null check (percent_score >= 0 and percent_score <= 100),
  note text not null default '',
  recorded_by uuid not null,
  recorded_at timestamptz not null default now(),
  foreign key (gradebook_id, gradebook_attempt_id)
    references public.gradebook_attempts(gradebook_id, id) on delete restrict,
  foreign key (gradebook_id, student_id)
    references public.gradebook_students(gradebook_id, student_id) on delete restrict,
  unique (gradebook_id, student_id, project_code, attempt_number),
  check (
    (layout_na and layout_score is null) or
    (not layout_na and layout_score between 0 and 20)
  ),
  check (
    (prep_na and prep_score is null) or
    (not prep_na and prep_score between 0 and 20)
  ),
  check (
    (fitup_na and fitup_score is null) or
    (not fitup_na and fitup_score between 0 and 20)
  ),
  check (
    (welding_na and welding_score is null) or
    (not welding_na and welding_score between 0 and 20)
  ),
  check (
    (finish_na and finish_score is null) or
    (not finish_na and finish_score between 0 and 20)
  )
);

create index wld105_fabrication_gradebook_student_idx
  on public.wld105_fabrication_attempts(gradebook_id, student_id, project_code);

alter table public.wld105_fabrication_attempts enable row level security;
revoke all on public.wld105_fabrication_attempts from anon, authenticated;
grant select on public.wld105_fabrication_attempts to authenticated;
create policy wld105_fabrication_attempts_read
on public.wld105_fabrication_attempts for select to authenticated
using (public.can_access_gradebook(gradebook_id));

-- WLD 105 theory books use one authoritative gradebook:
-- 50% AWS/homework, 25% existing Live Classroom, 25% fabrication.
insert into public.gradebook_categories(gradebook_id, code, label, active)
select gd.id, x.code, x.label, true
from public.gradebook_directory gd
cross join (values
  ('homework','AWS / Homework'),
  ('fabrication','Fabrication Projects')
) as x(code,label)
where gd.course_role='theory' and gd.course_code='WLD 105'
on conflict (gradebook_id,code) do update
set label=excluded.label, active=true;

update public.gradebook_categories c
set label='Live Classroom'
from public.gradebook_directory gd
where gd.id=c.gradebook_id
  and gd.course_role='theory'
  and gd.course_code='WLD 105'
  and c.code='theory_assessments';

insert into public.gradebook_category_weights(gradebook_id, category_code, weight_percent)
select gd.id, x.category_code, x.weight_percent
from public.gradebook_directory gd
cross join (values
  ('homework',50::numeric),
  ('theory_assessments',25::numeric),
  ('fabrication',25::numeric)
) as x(category_code,weight_percent)
where gd.course_role='theory' and gd.course_code='WLD 105'
on conflict (gradebook_id,category_code) do update
set weight_percent=excluded.weight_percent;

insert into public.gradebook_items(gradebook_id, category_id, title, assessment_slug)
select gd.id, c.id, p.title, 'fabrication:'||p.code
from public.gradebook_directory gd
join public.gradebook_categories c
  on c.gradebook_id=gd.id and c.code='fabrication'
cross join (values
  ('m','M Fabrication Project'),
  ('dice','Dice Fabrication Project'),
  ('n','N Fabrication Project'),
  ('tube_cube','Tube Cube Fabrication Project')
) as p(code,title)
where gd.course_role='theory' and gd.course_code='WLD 105'
on conflict (gradebook_id,assessment_slug) do update
set title=excluded.title, category_id=excluded.category_id;

create or replace function public.ensure_wld105_gradebook_setup(p_gradebook_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.can_access_gradebook(p_gradebook_id) then
    raise exception 'Gradebook access denied' using errcode='42501';
  end if;
  if not exists (
    select 1 from public.gradebook_directory
    where id=p_gradebook_id and course_role='theory' and course_code='WLD 105'
  ) then
    raise exception 'Fabrication grading is only available for WLD 105 theory-family gradebooks';
  end if;

  insert into public.gradebook_categories(gradebook_id,code,label,active)
  values
    (p_gradebook_id,'homework','AWS / Homework',true),
    (p_gradebook_id,'fabrication','Fabrication Projects',true)
  on conflict(gradebook_id,code) do update set label=excluded.label,active=true;

  update public.gradebook_categories
  set label='Live Classroom'
  where gradebook_id=p_gradebook_id and code='theory_assessments';

  insert into public.gradebook_category_weights(gradebook_id,category_code,weight_percent)
  values
    (p_gradebook_id,'homework',50),
    (p_gradebook_id,'theory_assessments',25),
    (p_gradebook_id,'fabrication',25)
  on conflict(gradebook_id,category_code) do update set weight_percent=excluded.weight_percent;

  insert into public.gradebook_items(gradebook_id,category_id,title,assessment_slug)
  select p_gradebook_id,c.id,p.title,'fabrication:'||p.code
  from public.gradebook_categories c
  cross join (values
    ('m','M Fabrication Project'),
    ('dice','Dice Fabrication Project'),
    ('n','N Fabrication Project'),
    ('tube_cube','Tube Cube Fabrication Project')
  ) as p(code,title)
  where c.gradebook_id=p_gradebook_id and c.code='fabrication'
  on conflict(gradebook_id,assessment_slug) do update
  set title=excluded.title,category_id=excluded.category_id;
end;
$$;

revoke all on function public.ensure_wld105_gradebook_setup(uuid) from public,anon;
grant execute on function public.ensure_wld105_gradebook_setup(uuid) to authenticated;

create or replace function public.record_wld105_fabrication_grade(
  p_gradebook_id uuid,
  p_student_id uuid,
  p_project_code text,
  p_attempt_number integer,
  p_layout_score numeric default null,
  p_layout_na boolean default false,
  p_prep_score numeric default null,
  p_prep_na boolean default false,
  p_fitup_score numeric default null,
  p_fitup_na boolean default false,
  p_welding_score numeric default null,
  p_welding_na boolean default false,
  p_finish_score numeric default null,
  p_finish_na boolean default false,
  p_note text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item uuid;
  v_attempt uuid;
  v_earned numeric := 0;
  v_possible numeric := 0;
  v_percent numeric := 0;
begin
  perform public.ensure_wld105_gradebook_setup(p_gradebook_id);

  if p_project_code not in ('m','dice','n','tube_cube') then
    raise exception 'Unknown fabrication project';
  end if;
  if p_attempt_number not between 1 and 2 then
    raise exception 'Fabrication projects allow attempts 1 and 2';
  end if;
  if exists (
    select 1 from public.wld105_fabrication_attempts
    where gradebook_id=p_gradebook_id and student_id=p_student_id
      and project_code=p_project_code and attempt_number=p_attempt_number
  ) then
    raise exception 'That fabrication attempt is already recorded; preserve the original and use the other attempt';
  end if;
  if not exists (
    select 1 from public.gradebook_students
    where gradebook_id=p_gradebook_id and student_id=p_student_id and active
  ) then
    raise exception 'Student is not actively enrolled';
  end if;

  if p_layout_na then
    if p_layout_score is not null then raise exception 'Layout cannot have both a score and N/A'; end if;
  elsif p_layout_score is null or p_layout_score < 0 or p_layout_score > 20 then
    raise exception 'Layout score must be 0-20 or N/A';
  else v_earned:=v_earned+p_layout_score; v_possible:=v_possible+20; end if;

  if p_prep_na then
    if p_prep_score is not null then raise exception 'Preparation cannot have both a score and N/A'; end if;
  elsif p_prep_score is null or p_prep_score < 0 or p_prep_score > 20 then
    raise exception 'Preparation score must be 0-20 or N/A';
  else v_earned:=v_earned+p_prep_score; v_possible:=v_possible+20; end if;

  if p_fitup_na then
    if p_fitup_score is not null then raise exception 'Fit-up cannot have both a score and N/A'; end if;
  elsif p_fitup_score is null or p_fitup_score < 0 or p_fitup_score > 20 then
    raise exception 'Fit-up score must be 0-20 or N/A';
  else v_earned:=v_earned+p_fitup_score; v_possible:=v_possible+20; end if;

  if p_welding_na then
    if p_welding_score is not null then raise exception 'Welding cannot have both a score and N/A'; end if;
  elsif p_welding_score is null or p_welding_score < 0 or p_welding_score > 20 then
    raise exception 'Welding score must be 0-20 or N/A';
  else v_earned:=v_earned+p_welding_score; v_possible:=v_possible+20; end if;

  if p_finish_na then
    if p_finish_score is not null then raise exception 'Finish cannot have both a score and N/A'; end if;
  elsif p_finish_score is null or p_finish_score < 0 or p_finish_score > 20 then
    raise exception 'Finish score must be 0-20 or N/A';
  else v_earned:=v_earned+p_finish_score; v_possible:=v_possible+20; end if;

  if v_possible <= 0 then raise exception 'At least one rubric criterion must be scored'; end if;
  v_percent := round(100*v_earned/v_possible,2);

  select id into v_item from public.gradebook_items
  where gradebook_id=p_gradebook_id and assessment_slug='fabrication:'||p_project_code;
  if v_item is null then raise exception 'Fabrication project is not configured'; end if;

  v_attempt := public.record_gradebook_attempt(
    p_gradebook_id,v_item,p_student_id,'graded',v_earned,v_possible,
    coalesce(nullif(trim(p_note),''),'Fabrication rubric attempt '||p_attempt_number),null
  );

  insert into public.wld105_fabrication_attempts(
    gradebook_id,gradebook_attempt_id,student_id,project_code,attempt_number,
    layout_score,layout_na,prep_score,prep_na,fitup_score,fitup_na,
    welding_score,welding_na,finish_score,finish_na,
    earned_score,possible_score,percent_score,note,recorded_by
  ) values (
    p_gradebook_id,v_attempt,p_student_id,p_project_code,p_attempt_number,
    p_layout_score,p_layout_na,p_prep_score,p_prep_na,p_fitup_score,p_fitup_na,
    p_welding_score,p_welding_na,p_finish_score,p_finish_na,
    v_earned,v_possible,v_percent,coalesce(p_note,''),auth.uid()
  );

  return jsonb_build_object(
    'attempt_id',v_attempt,'earned',v_earned,'possible',v_possible,'percent',v_percent
  );
end;
$$;

revoke all on function public.record_wld105_fabrication_grade(
  uuid,uuid,text,integer,numeric,boolean,numeric,boolean,numeric,boolean,numeric,boolean,numeric,boolean,text
) from public,anon;
grant execute on function public.record_wld105_fabrication_grade(
  uuid,uuid,text,integer,numeric,boolean,numeric,boolean,numeric,boolean,numeric,boolean,numeric,boolean,text
) to authenticated;

create or replace function public.get_wld105_grade_tower(p_gradebook_id uuid)
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if not public.can_access_gradebook(p_gradebook_id) then
    raise exception 'Gradebook access denied' using errcode='42501';
  end if;

  with latest as (
    select a.id,a.student_id,a.item_id,a.attempted_at,c.code category_code,
      case when r.possible_score>0 then 100*r.score/r.possible_score end percent_score
    from public.gradebook_attempts a
    join public.gradebook_items i on i.id=a.item_id and i.gradebook_id=a.gradebook_id
    join public.gradebook_categories c on c.id=i.category_id and c.gradebook_id=i.gradebook_id
    join public.gradebook_revisions r on r.gradebook_id=a.gradebook_id and r.attempt_id=a.id
    where a.gradebook_id=p_gradebook_id
      and r.status_code='graded'
      and r.possible_score>0
      and not exists (
        select 1 from public.gradebook_revisions newer
        where newer.gradebook_id=r.gradebook_id and newer.attempt_id=r.attempt_id and newer.id>r.id
      )
  ),
  per_item as (
    select distinct on(student_id,item_id)
      student_id,item_id,category_code,percent_score
    from latest
    order by student_id,item_id,
      case when category_code='fabrication' then percent_score end desc nulls last,
      attempted_at desc,id desc
  ),
  avgs as (
    select student_id,
      avg(percent_score) filter(where category_code='homework') homework_avg,
      avg(percent_score) filter(where category_code='theory_assessments') classroom_avg,
      avg(percent_score) filter(where category_code='fabrication') fabrication_avg
    from per_item group by student_id
  ),
  rows as (
    select r.student_id,r.display_name,r.active,
      round(a.homework_avg,2) homework_avg,
      round(a.classroom_avg,2) classroom_avg,
      round(a.fabrication_avg,2) fabrication_avg,
      round(
        (
          coalesce(a.homework_avg*0.50,0)+
          coalesce(a.classroom_avg*0.25,0)+
          coalesce(a.fabrication_avg*0.25,0)
        ) /
        nullif(
          (case when a.homework_avg is not null then 0.50 else 0 end)+
          (case when a.classroom_avg is not null then 0.25 else 0 end)+
          (case when a.fabrication_avg is not null then 0.25 else 0 end),0
        ),2
      ) current_grade
    from public.gradebook_roster r
    left join avgs a on a.student_id=r.student_id
    where r.gradebook_id=p_gradebook_id
    order by r.display_name
  )
  select jsonb_build_object(
    'weights',jsonb_build_object('homework',50,'live_classroom',25,'fabrication',25),
    'students',coalesce(jsonb_agg(to_jsonb(rows)),'[]'::jsonb)
  ) into v_result from rows;

  return v_result;
end;
$$;

revoke all on function public.get_wld105_grade_tower(uuid) from public,anon;
grant execute on function public.get_wld105_grade_tower(uuid) to authenticated;
