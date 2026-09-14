-- Harden the intentionally anonymous demo classroom RPCs.
-- Demo access remains account-free, but SECURITY DEFINER functions use an
-- empty search path and public submissions are bounded to prevent trivial
-- resource exhaustion.

begin;

alter function public.create_demo_classroom_session(text,text,text,integer)
  set search_path = '';
alter function public.end_demo_classroom_session(uuid,uuid)
  set search_path = '';
alter function public.get_demo_classroom_assessment(text)
  set search_path = '';
alter function public.get_demo_classroom_results(uuid,uuid)
  set search_path = '';
alter function public.get_demo_classroom_submission_report(uuid,uuid)
  set search_path = '';

create or replace function public.connect_demo_classroom_student(
  p_join_code text,
  p_student_name text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.demo_classroom_sessions;
  v_name text;
begin
  perform public.cleanup_demo_classroom_sessions();
  v_name := left(trim(coalesce(p_student_name,'')),100);
  if length(v_name) < 2 then
    raise exception 'Student name is required';
  end if;

  select * into s
  from public.demo_classroom_sessions
  where join_code=upper(trim(p_join_code))
    and expires_at>now()
  for update;

  if s.id is null then
    raise exception 'This demo class code is invalid or has expired';
  end if;

  if not exists (
    select 1
    from public.demo_classroom_participants p
    where p.session_id=s.id and p.student_name=v_name
  ) and (
    select count(*) from public.demo_classroom_participants p where p.session_id=s.id
  ) >= 60 then
    raise exception 'This demo session has reached its participant limit';
  end if;

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
set search_path = ''
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
  if length(v_name)<2 then
    raise exception 'Student name is required';
  end if;
  if jsonb_typeof(p_answers)<>'object' then
    raise exception 'Every question must be answered';
  end if;
  if pg_column_size(p_answers) > 65536 then
    raise exception 'Answer payload is too large';
  end if;

  select * into s
  from public.demo_classroom_sessions
  where join_code=upper(trim(p_join_code))
    and expires_at>now()
  for update;

  if s.id is null then
    raise exception 'This demo class session has expired';
  end if;

  if not exists (
    select 1
    from public.demo_classroom_participants p
    where p.session_id=s.id and p.student_name=v_name
  ) and (
    select count(*) from public.demo_classroom_participants p where p.session_id=s.id
  ) >= 60 then
    raise exception 'This demo session has reached its participant limit';
  end if;

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
    if length(coalesce(p_answers->>q.question_key,'')) > 2000 then
      raise exception 'An answer is too long';
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

revoke all on function public.connect_demo_classroom_student(text,text)
  from public, anon, authenticated;
grant execute on function public.connect_demo_classroom_student(text,text)
  to anon, authenticated;

revoke all on function public.submit_demo_classroom_assessment(text,text,jsonb)
  from public, anon, authenticated;
grant execute on function public.submit_demo_classroom_assessment(text,text,jsonb)
  to anon, authenticated;

commit;
