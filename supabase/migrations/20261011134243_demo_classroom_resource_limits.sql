-- Bound only the public demonstration store. Real school records are untouched.
begin;
create schema if not exists private;
create table private.demo_creation_budget (
 singleton boolean primary key default true check(singleton),
 window_started_at timestamptz not null,
 writes integer not null
);
alter table private.demo_creation_budget enable row level security;
revoke all on private.demo_creation_budget from public,anon,authenticated;
insert into private.demo_creation_budget values(true,clock_timestamp(),0);
alter table public.demo_classroom_sessions
 add column write_window_started_at timestamptz not null default clock_timestamp(),
 add column writes_in_window integer not null default 0;
-- Existing temporary sessions must obey the same absolute lifetime as new ones.
update public.demo_classroom_sessions set expires_at=least(expires_at,created_at+interval '2 hours');

create function private.reserve_demo_participant_write(p_session uuid,p_name text)
returns void language plpgsql security definer set search_path='' as $$
declare s public.demo_classroom_sessions; t timestamptz;
begin
 select * into s from public.demo_classroom_sessions where id=p_session for update;
 t:=clock_timestamp();
 if s.id is null or s.expires_at<=t or s.created_at+interval '2 hours'<=t then
  raise exception 'This demo class session has expired';
 end if;
 if not exists(select 1 from public.demo_classroom_participants where session_id=s.id and student_name=p_name)
    and (select count(*) from public.demo_classroom_participants where session_id=s.id)>=60 then
  raise exception 'This demo class has reached its 60 participant capacity';
 end if;
 -- 60 participants heartbeat every 15 seconds; reserve room for joins and submissions.
 if s.write_window_started_at>t-interval '1 minute' and s.writes_in_window>=600 then
  raise exception 'This demo class is busy. Please try again in a minute';
 end if;
 update public.demo_classroom_sessions set
  write_window_started_at=case when s.write_window_started_at<=t-interval '1 minute' then t else s.write_window_started_at end,
  writes_in_window=case when s.write_window_started_at<=t-interval '1 minute' then 1 else s.writes_in_window+1 end
 where id=s.id;
end $$;
revoke all on function private.reserve_demo_participant_write(uuid,text) from public,anon,authenticated;


create or replace function public.cleanup_demo_classroom_sessions()
returns void
language sql
security definer
set search_path=public
as $$
  delete from public.demo_classroom_sessions where expires_at <= clock_timestamp() or created_at+interval '2 hours'<=clock_timestamp();
$$;

create or replace function public.create_demo_classroom_session(
  p_activity_key text,
  p_title text,
  p_course_code text,
  p_day_number integer
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_id uuid;
  v_token uuid;
  v_code text;
  budget private.demo_creation_budget;
  t timestamptz;
begin
  select * into budget from private.demo_creation_budget where singleton for update;
  t:=clock_timestamp();
  perform public.cleanup_demo_classroom_sessions();
  if budget.window_started_at>t-interval '1 minute' and budget.writes>=20 then
    raise exception 'Demo creation is busy. Please try again in a minute';
  end if;
  if (select count(*) from public.demo_classroom_sessions)>=100 then
    raise exception 'The demo is at capacity. Please try again later';
  end if;
  update private.demo_creation_budget set
   window_started_at=case when budget.window_started_at<=t-interval '1 minute' then t else budget.window_started_at end,
   writes=case when budget.window_started_at<=t-interval '1 minute' then 1 else budget.writes+1 end where singleton;

  if p_activity_key is null or p_activity_key not in ('preclass_math','blueprint_day1') then
    raise exception 'This demo activity is not available';
  end if;
  if not exists (
    select 1 from public.assessment_modules
    where slug=p_activity_key and active
  ) then
    raise exception 'This demo activity is not configured';
  end if;
  if coalesce(p_day_number,0) < 1 then
    raise exception 'Invalid demo day';
  end if;

  if char_length(coalesce(p_title,''))>180 or char_length(coalesce(p_course_code,''))>40 then
    raise exception 'Demo title or course code is too long';
  end if;

  loop
    v_code := upper(substr(encode(extensions.gen_random_bytes(6),'hex'),1,6));
    exit when not exists(select 1 from public.demo_classroom_sessions where join_code=v_code);
  end loop;

  insert into public.demo_classroom_sessions(
    join_code,activity_key,title,course_code,day_number
  ) values (
    v_code,p_activity_key,left(coalesce(nullif(trim(p_title),''),'Live Classroom Activity'),180),
    left(coalesce(nullif(trim(p_course_code),''),'DEMO'),40),p_day_number
  )
  returning id,instructor_token into v_id,v_token;

  return jsonb_build_object(
    'session_id',v_id,
    'instructor_token',v_token,
    'join_code',v_code,
    'expires_in_minutes',30
  );
end
$$;

create or replace function public.connect_demo_classroom_student(
  p_join_code text,
  p_student_name text
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  s public.demo_classroom_sessions;
  v_name text;
begin
  perform public.cleanup_demo_classroom_sessions();
  if char_length(coalesce(p_student_name,''))>100 then raise exception 'Student name is too long'; end if;
  if char_length(coalesce(p_join_code,''))>32 then raise exception 'Invalid demo class code'; end if;
  v_name := trim(coalesce(p_student_name,''));
  if length(v_name) < 2 then raise exception 'Student name is required'; end if;

  select * into s
  from public.demo_classroom_sessions
  where join_code=upper(trim(p_join_code))
    and expires_at>clock_timestamp() for update;
  if s.id is null then raise exception 'This demo class code is invalid or has expired'; end if;

  perform private.reserve_demo_participant_write(s.id,v_name);

  insert into public.demo_classroom_participants(session_id,student_name)
  values(s.id,v_name)
  on conflict(session_id,student_name)
  do update set last_seen_at=now();

  update public.demo_classroom_sessions
  set last_activity_at=clock_timestamp(),expires_at=least(clock_timestamp()+interval '30 minutes',created_at+interval '2 hours')
  where id=s.id;

  return jsonb_build_object('session_id',s.id,'connected',true);
end
$$;

create or replace function public.submit_demo_classroom_assessment(
  p_join_code text,
  p_student_name text,
  p_answers jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  s public.demo_classroom_sessions;
  q record;
  v_name text;
  total integer:=0;
  correct integer:=0;
  normalized text;
  domains jsonb:='{}'::jsonb;
  domain_row jsonb;
begin
  perform public.cleanup_demo_classroom_sessions();
  if char_length(coalesce(p_student_name,''))>100 then raise exception 'Student name is too long'; end if;
  if char_length(coalesce(p_join_code,''))>32 then raise exception 'Invalid demo class code'; end if;
  v_name := trim(coalesce(p_student_name,''));
  if length(v_name)<2 then raise exception 'Student name is required'; end if;
  if jsonb_typeof(p_answers) is distinct from 'object' then raise exception 'Every question must be answered'; end if;

  if octet_length(p_answers::text)>65536 then raise exception 'Assessment response is too large'; end if;
  if exists(select 1 from jsonb_each(p_answers) a where jsonb_typeof(a.value)<>'string' or char_length(a.value #>> '{}')>2000) then
    raise exception 'Answers must be text of at most 2000 characters';
  end if;

  select * into s
  from public.demo_classroom_sessions
  where join_code=upper(trim(p_join_code))
    and expires_at>clock_timestamp()
  for update;
  if s.id is null then raise exception 'This demo class session has expired'; end if;

  for q in
    select * from public.assessment_questions
    where assessment_slug=s.activity_key
    order by question_number
  loop
    total:=total+1;
    if not (p_answers ? q.question_key)
       or length(trim(coalesce(p_answers->>q.question_key,'')))=0 then
      raise exception 'Every question must be answered';
    end if;

    normalized:=lower(trim(p_answers->>q.question_key));
    domain_row:=coalesce(domains->q.domain,jsonb_build_object('correct',0,'total',0));
    domain_row:=jsonb_set(domain_row,'{total}',to_jsonb((domain_row->>'total')::int+1));

    if (q.question_type='mc' and upper(normalized)=upper(q.correct_answer))
       or (
         q.question_type='text'
         and exists (
           select 1 from jsonb_array_elements_text(coalesce(q.accepted_answers,'[]'::jsonb)) a
           where lower(trim(a))=normalized
         )
       ) then
      correct:=correct+1;
      domain_row:=jsonb_set(domain_row,'{correct}',to_jsonb((domain_row->>'correct')::int+1));
    end if;
    domains:=jsonb_set(domains,array[q.domain],domain_row,true);
  end loop;

  if (select count(*) from jsonb_object_keys(p_answers))<>total then
    raise exception 'Every question must be answered';
  end if;

  perform private.reserve_demo_participant_write(s.id,v_name);

  insert into public.demo_classroom_participants(session_id,student_name)
  values(s.id,v_name)
  on conflict(session_id,student_name)
  do update set last_seen_at=now();

  insert into public.demo_classroom_submissions(
    session_id,student_name,answers,score,possible_score,domain_scores,submitted_at
  ) values (
    s.id,v_name,p_answers,correct,total,domains,now()
  )
  on conflict(session_id,student_name)
  do update set
    answers=excluded.answers,
    score=excluded.score,
    possible_score=excluded.possible_score,
    domain_scores=excluded.domain_scores,
    submitted_at=excluded.submitted_at;

  update public.demo_classroom_sessions
  set last_activity_at=clock_timestamp(),expires_at=least(clock_timestamp()+interval '30 minutes',created_at+interval '2 hours')
  where id=s.id;

  return jsonb_build_object(
    'score',correct,
    'possible_score',total,
    'percent',round(100.0*correct/greatest(total,1))
  );
end
$$;

commit;
