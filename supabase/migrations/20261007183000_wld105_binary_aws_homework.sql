-- WLD 105 AWS homework checklist.
-- Four binary chapter completions, each worth 12.5 course points.
-- Pending remains non-penalizing until the final scheduled instructional day.

create table public.wld105_homework_events (
  id uuid primary key default gen_random_uuid(),
  gradebook_id uuid not null references public.gradebooks(id) on delete restrict,
  student_id uuid not null references public.attendance_students(id) on delete restrict,
  chapter_code text not null check (chapter_code in (
    'fundamental_smaw','ofc','welding_joint_design','weld_symbols'
  )),
  status text not null check (status in ('complete','pending')),
  completed_on date,
  note text not null default '',
  recorded_by uuid not null,
  recorded_at timestamptz not null default now(),
  foreign key (gradebook_id, student_id)
    references public.gradebook_students(gradebook_id, student_id) on delete restrict,
  check (
    (status='complete' and completed_on is not null)
    or (status='pending' and completed_on is null)
  )
);

create index wld105_homework_events_lookup_idx
  on public.wld105_homework_events(gradebook_id, student_id, chapter_code, recorded_at desc, id desc);
create index wld105_homework_events_student_fk_idx
  on public.wld105_homework_events(student_id);

alter table public.wld105_homework_events enable row level security;
revoke all on public.wld105_homework_events from anon, authenticated;
grant select on public.wld105_homework_events to authenticated;
create policy wld105_homework_events_read
on public.wld105_homework_events for select to authenticated
using (public.can_access_gradebook(gradebook_id));

-- Seed the four required AWS homework items into every WLD 105 theory gradebook.
insert into public.gradebook_items(gradebook_id, category_id, title, assessment_slug)
select gd.id, c.id, h.title, 'homework:'||h.code
from public.gradebook_directory gd
join public.gradebook_categories c
  on c.gradebook_id=gd.id and c.code='homework'
cross join (values
  ('fundamental_smaw','Fundamental SMAW'),
  ('ofc','OFC'),
  ('welding_joint_design','Welding Joint Design'),
  ('weld_symbols','Weld Symbols')
) as h(code,title)
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
    raise exception 'WLD 105 grade tower is only available for WLD 105 theory-family gradebooks';
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

  insert into public.gradebook_items(gradebook_id,category_id,title,assessment_slug)
  select p_gradebook_id,c.id,h.title,'homework:'||h.code
  from public.gradebook_categories c
  cross join (values
    ('fundamental_smaw','Fundamental SMAW'),
    ('ofc','OFC'),
    ('welding_joint_design','Welding Joint Design'),
    ('weld_symbols','Weld Symbols')
  ) as h(code,title)
  where c.gradebook_id=p_gradebook_id and c.code='homework'
  on conflict(gradebook_id,assessment_slug) do update
  set title=excluded.title,category_id=excluded.category_id;
end;
$$;

revoke all on function public.ensure_wld105_gradebook_setup(uuid) from public,anon;
grant execute on function public.ensure_wld105_gradebook_setup(uuid) to authenticated;

create or replace function public.record_wld105_homework_status(
  p_gradebook_id uuid,
  p_student_id uuid,
  p_chapter_code text,
  p_complete boolean,
  p_completed_on date default null,
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
  v_final_day date;
  v_local_today date := (now() at time zone 'America/New_York')::date;
  v_completed_on date;
begin
  perform public.ensure_wld105_gradebook_setup(p_gradebook_id);

  if p_chapter_code not in ('fundamental_smaw','ofc','welding_joint_design','weld_symbols') then
    raise exception 'Unknown WLD 105 homework chapter';
  end if;

  if not exists (
    select 1 from public.gradebook_students
    where gradebook_id=p_gradebook_id and student_id=p_student_id and active
  ) then
    raise exception 'Student is not actively enrolled';
  end if;

  select max(pd.scheduled_date) into v_final_day
  from public.gradebooks g
  join public.planner_days pd on pd.section_id=g.section_id
  where g.id=p_gradebook_id;

  if v_final_day is null then
    raise exception 'Final instructional day is not configured for this section';
  end if;

  if p_complete then
    v_completed_on := coalesce(p_completed_on,v_local_today);
    if v_completed_on > v_local_today then
      raise exception 'Homework completion date cannot be in the future';
    end if;
    if v_completed_on > v_final_day then
      raise exception 'Homework completed after the final instructional day does not earn course credit';
    end if;
  else
    v_completed_on := null;
  end if;

  select id into v_item
  from public.gradebook_items
  where gradebook_id=p_gradebook_id
    and assessment_slug='homework:'||p_chapter_code;

  if v_item is null then
    raise exception 'Homework item is not configured';
  end if;

  select a.id into v_attempt
  from public.gradebook_attempts a
  where a.gradebook_id=p_gradebook_id
    and a.item_id=v_item
    and a.student_id=p_student_id
    and a.source_submission_id is null
  order by a.attempted_at desc,a.id desc
  limit 1;

  if v_attempt is null then
    v_attempt := public.record_gradebook_attempt(
      p_gradebook_id,v_item,p_student_id,
      case when p_complete then 'graded' else 'ungraded' end,
      case when p_complete then 100 else null end,
      case when p_complete then 100 else null end,
      case when p_complete then 'AWS homework completed' else 'AWS homework pending' end,
      null
    );
  else
    perform public.record_gradebook_attempt(
      p_gradebook_id,v_item,p_student_id,
      case when p_complete then 'graded' else 'ungraded' end,
      case when p_complete then 100 else null end,
      case when p_complete then 100 else null end,
      coalesce(nullif(trim(p_note),''),
        case when p_complete then 'AWS homework corrected to complete' else 'AWS homework corrected to pending' end),
      v_attempt
    );
  end if;

  insert into public.wld105_homework_events(
    gradebook_id,student_id,chapter_code,status,completed_on,note,recorded_by
  ) values (
    p_gradebook_id,p_student_id,p_chapter_code,
    case when p_complete then 'complete' else 'pending' end,
    v_completed_on,coalesce(p_note,''),auth.uid()
  );

  return jsonb_build_object(
    'chapter_code',p_chapter_code,
    'status',case when p_complete then 'complete' else 'pending' end,
    'completed_on',v_completed_on,
    'final_day',v_final_day,
    'course_points',case when p_complete then 12.5 else 0 end
  );
end;
$$;

revoke all on function public.record_wld105_homework_status(uuid,uuid,text,boolean,date,text) from public,anon;
grant execute on function public.record_wld105_homework_status(uuid,uuid,text,boolean,date,text) to authenticated;

create or replace function public.get_wld105_homework_status(p_gradebook_id uuid)
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_result jsonb;
  v_final_day date;
  v_today date := (now() at time zone 'America/New_York')::date;
begin
  if not public.can_access_gradebook(p_gradebook_id) then
    raise exception 'Gradebook access denied' using errcode='42501';
  end if;

  select max(pd.scheduled_date) into v_final_day
  from public.gradebooks g
  join public.planner_days pd on pd.section_id=g.section_id
  where g.id=p_gradebook_id;

  with chapters as (
    select * from (values
      ('fundamental_smaw','Fundamental SMAW',1),
      ('ofc','OFC',2),
      ('welding_joint_design','Welding Joint Design',3),
      ('weld_symbols','Weld Symbols',4)
    ) as h(code,label,sort_order)
  ),
  latest as (
    select distinct on (e.student_id,e.chapter_code)
      e.student_id,e.chapter_code,e.status,e.completed_on,e.recorded_at
    from public.wld105_homework_events e
    where e.gradebook_id=p_gradebook_id
    order by e.student_id,e.chapter_code,e.recorded_at desc,e.id desc
  ),
  rows as (
    select r.student_id,r.display_name,r.active,
      c.code chapter_code,c.label chapter_label,c.sort_order,
      case
        when l.status='complete' and l.completed_on<=v_final_day then 'complete'
        when v_final_day is not null and v_today>v_final_day then 'incomplete'
        else 'pending'
      end status,
      case when l.status='complete' and l.completed_on<=v_final_day then l.completed_on end completed_on,
      case when l.status='complete' and l.completed_on<=v_final_day then 12.5 else 0 end course_points
    from public.gradebook_roster r
    cross join chapters c
    left join latest l on l.student_id=r.student_id and l.chapter_code=c.code
    where r.gradebook_id=p_gradebook_id
  ),
  students as (
    select student_id,max(display_name) display_name,bool_or(active) active,
      count(*) filter(where status='complete') completed_count,
      count(*) filter(where status='pending') pending_count,
      count(*) filter(where status='incomplete') incomplete_count,
      sum(course_points) earned_course_points,
      jsonb_agg(jsonb_build_object(
        'code',chapter_code,'label',chapter_label,'status',status,
        'completed_on',completed_on,'course_points',course_points
      ) order by sort_order) chapters
    from rows
    group by student_id
  )
  select jsonb_build_object(
    'final_day',v_final_day,
    'deadline_passed',coalesce(v_today>v_final_day,false),
    'chapter_value',12.5,
    'students',coalesce(jsonb_agg(to_jsonb(students) order by display_name),'[]'::jsonb)
  ) into v_result from students;

  return v_result;
end;
$$;

revoke all on function public.get_wld105_homework_status(uuid) from public,anon;
grant execute on function public.get_wld105_homework_status(uuid) to authenticated;

create or replace function public.get_wld105_grade_tower(p_gradebook_id uuid)
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_result jsonb;
  v_final_day date;
  v_today date := (now() at time zone 'America/New_York')::date;
begin
  if not public.can_access_gradebook(p_gradebook_id) then
    raise exception 'Gradebook access denied' using errcode='42501';
  end if;

  select max(pd.scheduled_date) into v_final_day
  from public.gradebooks g
  join public.planner_days pd on pd.section_id=g.section_id
  where g.id=p_gradebook_id;

  with latest_grade as (
    select a.id,a.student_id,a.item_id,a.attempted_at,c.code category_code,
      case when r.possible_score>0 then 100*r.score/r.possible_score end percent_score
    from public.gradebook_attempts a
    join public.gradebook_items i on i.id=a.item_id and i.gradebook_id=a.gradebook_id
    join public.gradebook_categories c on c.id=i.category_id and c.gradebook_id=i.gradebook_id
    join public.gradebook_revisions r on r.gradebook_id=a.gradebook_id and r.attempt_id=a.id
    where a.gradebook_id=p_gradebook_id
      and r.status_code='graded'
      and r.possible_score>0
      and c.code in ('theory_assessments','fabrication')
      and not exists (
        select 1 from public.gradebook_revisions newer
        where newer.gradebook_id=r.gradebook_id and newer.attempt_id=r.attempt_id and newer.id>r.id
      )
  ),
  per_item as (
    select distinct on(student_id,item_id)
      student_id,item_id,category_code,percent_score
    from latest_grade
    order by student_id,item_id,
      case when category_code='fabrication' then percent_score end desc nulls last,
      attempted_at desc,id desc
  ),
  grade_avgs as (
    select student_id,
      avg(percent_score) filter(where category_code='theory_assessments') classroom_avg,
      avg(percent_score) filter(where category_code='fabrication') fabrication_avg
    from per_item group by student_id
  ),
  latest_homework as (
    select distinct on (e.student_id,e.chapter_code)
      e.student_id,e.chapter_code,e.status,e.completed_on
    from public.wld105_homework_events e
    where e.gradebook_id=p_gradebook_id
    order by e.student_id,e.chapter_code,e.recorded_at desc,e.id desc
  ),
  homework as (
    select r.student_id,
      count(*) filter(where lh.status='complete' and lh.completed_on<=v_final_day) completed_count
    from public.gradebook_roster r
    cross join (values
      ('fundamental_smaw'),('ofc'),('welding_joint_design'),('weld_symbols')
    ) h(code)
    left join latest_homework lh on lh.student_id=r.student_id and lh.chapter_code=h.code
    where r.gradebook_id=p_gradebook_id
    group by r.student_id
  ),
  rows as (
    select r.student_id,r.display_name,r.active,
      h.completed_count homework_completed_count,
      4-h.completed_count homework_remaining_count,
      round(h.completed_count*25.0,2) homework_avg,
      round(h.completed_count*12.5,2) homework_course_points,
      (h.completed_count=4 or (v_final_day is not null and v_today>v_final_day)) homework_locked,
      round(a.classroom_avg,2) classroom_avg,
      round(a.fabrication_avg,2) fabrication_avg,
      round(
        (
          case when h.completed_count=4 or (v_final_day is not null and v_today>v_final_day)
            then (h.completed_count*25.0)*0.50 else 0 end
          + coalesce(a.classroom_avg*0.25,0)
          + coalesce(a.fabrication_avg*0.25,0)
        ) /
        nullif(
          (case when h.completed_count=4 or (v_final_day is not null and v_today>v_final_day) then 0.50 else 0 end)
          + (case when a.classroom_avg is not null then 0.25 else 0 end)
          + (case when a.fabrication_avg is not null then 0.25 else 0 end),
          0
        ),2
      ) current_grade
    from public.gradebook_roster r
    left join grade_avgs a on a.student_id=r.student_id
    left join homework h on h.student_id=r.student_id
    where r.gradebook_id=p_gradebook_id
    order by r.display_name
  )
  select jsonb_build_object(
    'weights',jsonb_build_object('homework',50,'live_classroom',25,'fabrication',25),
    'homework_chapter_value',12.5,
    'final_day',v_final_day,
    'deadline_passed',coalesce(v_today>v_final_day,false),
    'students',coalesce(jsonb_agg(to_jsonb(rows)),'[]'::jsonb)
  ) into v_result from rows;

  return v_result;
end;
$$;

revoke all on function public.get_wld105_grade_tower(uuid) from public,anon;
grant execute on function public.get_wld105_grade_tower(uuid) to authenticated;
