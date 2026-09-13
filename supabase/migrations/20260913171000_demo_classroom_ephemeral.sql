-- Public demo Live Classroom: isolated, temporary, cross-device sessions.
-- Demo records never join to schools, sections, users, attendance, payroll, or live classroom sessions.
-- Sessions expire after 30 minutes of real demo inactivity and are removed opportunistically.

create table if not exists public.demo_classroom_sessions (
  id uuid primary key default gen_random_uuid(),
  instructor_token uuid not null default gen_random_uuid(),
  join_code text not null unique,
  activity_key text not null references public.assessment_modules(slug) on delete restrict,
  title text not null,
  course_code text not null,
  day_number integer not null check (day_number > 0),
  created_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 minutes')
);

create table if not exists public.demo_classroom_participants (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.demo_classroom_sessions(id) on delete cascade,
  student_name text not null,
  connected_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique(session_id, student_name)
);

create table if not exists public.demo_classroom_submissions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.demo_classroom_sessions(id) on delete cascade,
  student_name text not null,
  answers jsonb not null,
  score integer not null,
  possible_score integer not null,
  domain_scores jsonb not null default '{}'::jsonb,
  submitted_at timestamptz not null default now(),
  unique(session_id, student_name)
);

create index if not exists demo_classroom_sessions_expires_idx
  on public.demo_classroom_sessions(expires_at);
create index if not exists demo_classroom_participants_session_idx
  on public.demo_classroom_participants(session_id);
create index if not exists demo_classroom_submissions_session_idx
  on public.demo_classroom_submissions(session_id);

alter table public.demo_classroom_sessions enable row level security;
alter table public.demo_classroom_participants enable row level security;
alter table public.demo_classroom_submissions enable row level security;

revoke all on public.demo_classroom_sessions from anon, authenticated;
revoke all on public.demo_classroom_participants from anon, authenticated;
revoke all on public.demo_classroom_submissions from anon, authenticated;

create or replace function public.cleanup_demo_classroom_sessions()
returns void
language sql
security definer
set search_path=public
as $$
  delete from public.demo_classroom_sessions where expires_at <= now();
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
begin
  perform public.cleanup_demo_classroom_sessions();

  if p_activity_key not in ('preclass_math','blueprint_day1') then
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

create or replace function public.get_demo_classroom_assessment(p_join_code text)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  s public.demo_classroom_sessions;
  payload jsonb;
begin
  perform public.cleanup_demo_classroom_sessions();

  select * into s
  from public.demo_classroom_sessions
  where join_code=upper(trim(p_join_code))
    and expires_at>now();

  if s.id is null then
    raise exception 'This demo class code is invalid or has expired';
  end if;

  select jsonb_build_object(
    'session',jsonb_build_object(
      'session_id',s.id,
      'join_code',s.join_code,
      'activity_key',s.activity_key,
      'title',s.title,
      'course_code',s.course_code,
      'day_number',s.day_number,
      'expires_at',s.expires_at,
      'question_count',count(q.id)
    ),
    'questions',coalesce(
      jsonb_agg(
        jsonb_build_object(
          'key',q.question_key,
          'number',q.question_number,
          'type',q.question_type,
          'text',q.question_text,
          'domain',q.domain,
          'options',q.options
        ) order by q.question_number
      ),
      '[]'::jsonb
    )
  ) into payload
  from public.assessment_questions q
  where q.assessment_slug=s.activity_key;

  return payload;
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
  v_name := left(trim(coalesce(p_student_name,'')),100);
  if length(v_name) < 2 then raise exception 'Student name is required'; end if;

  select * into s
  from public.demo_classroom_sessions
  where join_code=upper(trim(p_join_code))
    and expires_at>now();
  if s.id is null then raise exception 'This demo class code is invalid or has expired'; end if;

  insert into public.demo_classroom_participants(session_id,student_name)
  values(s.id,v_name)
  on conflict(session_id,student_name)
  do update set last_seen_at=now();

  update public.demo_classroom_sessions
  set last_activity_at=now(),expires_at=now()+interval '30 minutes'
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
  v_name := left(trim(coalesce(p_student_name,'')),100);
  if length(v_name)<2 then raise exception 'Student name is required'; end if;
  if jsonb_typeof(p_answers)<>'object' then raise exception 'Every question must be answered'; end if;

  select * into s
  from public.demo_classroom_sessions
  where join_code=upper(trim(p_join_code))
    and expires_at>now()
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
  set last_activity_at=now(),expires_at=now()+interval '30 minutes'
  where id=s.id;

  return jsonb_build_object(
    'score',correct,
    'possible_score',total,
    'percent',round(100.0*correct/greatest(total,1))
  );
end
$$;

create or replace function public.get_demo_classroom_results(
  p_session_id uuid,
  p_instructor_token uuid
)
returns jsonb
language plpgsql
security definer
stable
set search_path=public
as $$
declare
  s public.demo_classroom_sessions;
  payload jsonb;
begin
  select * into s
  from public.demo_classroom_sessions
  where id=p_session_id
    and instructor_token=p_instructor_token
    and expires_at>now();
  if s.id is null then raise exception 'Demo session not found or expired'; end if;

  select jsonb_build_object(
    'session',jsonb_build_object(
      'session_id',s.id,
      'join_code',s.join_code,
      'activity_key',s.activity_key,
      'title',s.title,
      'course_code',s.course_code,
      'day_number',s.day_number,
      'created_at',s.created_at,
      'last_activity_at',s.last_activity_at,
      'expires_at',s.expires_at
    ),
    'participants',coalesce((
      select jsonb_agg(jsonb_build_object(
        'student_name',p.student_name,
        'connected_at',p.connected_at,
        'last_seen_at',p.last_seen_at
      ) order by p.connected_at)
      from public.demo_classroom_participants p
      where p.session_id=s.id
    ),'[]'::jsonb),
    'submissions',coalesce((
      select jsonb_agg(jsonb_build_object(
        'submission_id',sub.id,
        'student_name',sub.student_name,
        'score',sub.score,
        'possible_score',sub.possible_score,
        'percent',round(100.0*sub.score/greatest(sub.possible_score,1)),
        'domain_scores',sub.domain_scores,
        'submitted_at',sub.submitted_at
      ) order by sub.submitted_at desc)
      from public.demo_classroom_submissions sub
      where sub.session_id=s.id
    ),'[]'::jsonb)
  ) into payload;

  return payload;
end
$$;

create or replace function public.get_demo_classroom_submission_report(
  p_submission_id uuid,
  p_instructor_token uuid
)
returns jsonb
language plpgsql
security definer
stable
set search_path=public
as $$
declare
  payload jsonb;
begin
  select jsonb_build_object(
    'submission',jsonb_build_object(
      'id',sub.id,
      'student_name',sub.student_name,
      'score',sub.score,
      'possible_score',sub.possible_score,
      'percent',round(100.0*sub.score/greatest(sub.possible_score,1)),
      'submitted_at',sub.submitted_at,
      'domain_scores',sub.domain_scores,
      'assessment_title',m.title
    ),
    'questions',jsonb_agg(jsonb_build_object(
      'key',q.question_key,
      'number',q.question_number,
      'domain',q.domain,
      'text',q.question_text,
      'options',q.options,
      'student_answer',sub.answers->>q.question_key,
      'correct_answer',q.correct_answer,
      'is_correct',case
        when q.question_type='mc' then upper(trim(coalesce(sub.answers->>q.question_key,'')))=upper(q.correct_answer)
        else exists(
          select 1 from jsonb_array_elements_text(coalesce(q.accepted_answers,'[]'::jsonb)) a
          where lower(trim(a))=lower(trim(coalesce(sub.answers->>q.question_key,'')))
        )
      end,
      'explanation',q.explanation
    ) order by q.question_number)
  ) into payload
  from public.demo_classroom_submissions sub
  join public.demo_classroom_sessions s on s.id=sub.session_id
  join public.assessment_modules m on m.slug=s.activity_key
  join public.assessment_questions q on q.assessment_slug=s.activity_key
  where sub.id=p_submission_id
    and s.instructor_token=p_instructor_token
    and s.expires_at>now()
  group by sub.id,sub.student_name,sub.score,sub.possible_score,sub.submitted_at,sub.domain_scores,m.title;

  if payload is null then raise exception 'Demo submission not found or expired'; end if;
  return payload;
end
$$;

create or replace function public.end_demo_classroom_session(
  p_session_id uuid,
  p_instructor_token uuid
)
returns boolean
language plpgsql
security definer
set search_path=public
as $$
begin
  delete from public.demo_classroom_sessions
  where id=p_session_id and instructor_token=p_instructor_token;
  return found;
end
$$;

revoke execute on function public.cleanup_demo_classroom_sessions() from public,anon,authenticated;
revoke execute on function public.create_demo_classroom_session(text,text,text,integer) from public,anon,authenticated;
revoke execute on function public.get_demo_classroom_assessment(text) from public,anon,authenticated;
revoke execute on function public.connect_demo_classroom_student(text,text) from public,anon,authenticated;
revoke execute on function public.submit_demo_classroom_assessment(text,text,jsonb) from public,anon,authenticated;
revoke execute on function public.get_demo_classroom_results(uuid,uuid) from public,anon,authenticated;
revoke execute on function public.get_demo_classroom_submission_report(uuid,uuid) from public,anon,authenticated;
revoke execute on function public.end_demo_classroom_session(uuid,uuid) from public,anon,authenticated;

grant execute on function public.create_demo_classroom_session(text,text,text,integer) to anon,authenticated;
grant execute on function public.get_demo_classroom_assessment(text) to anon,authenticated;
grant execute on function public.connect_demo_classroom_student(text,text) to anon,authenticated;
grant execute on function public.submit_demo_classroom_assessment(text,text,jsonb) to anon,authenticated;
grant execute on function public.get_demo_classroom_results(uuid,uuid) to anon,authenticated;
grant execute on function public.get_demo_classroom_submission_report(uuid,uuid) to anon,authenticated;
grant execute on function public.end_demo_classroom_session(uuid,uuid) to anon,authenticated;
