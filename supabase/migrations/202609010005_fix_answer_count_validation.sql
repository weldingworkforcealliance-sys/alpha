-- Use PostgreSQL's supported JSONB key iterator for answer-count validation.

create or replace function public.submit_classroom_assessment(p_join_code text,p_student_name text,p_student_id text,p_answers jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare s public.classroom_sessions; q record; total integer:=0; correct integer:=0; normalized text; domains jsonb:='{}'::jsonb; domain_row jsonb;
begin
  if length(trim(p_student_name))<2 or length(trim(p_student_id))<1 then raise exception 'Student name and ID are required'; end if;
  select * into s from public.classroom_sessions where join_code=upper(trim(p_join_code)) and status='active' and expires_at>now() for update;
  if s.id is null then raise exception 'This class session has ended'; end if;
  if exists(select 1 from public.classroom_submissions where classroom_session_id=s.id and student_id=trim(p_student_id)) then raise exception 'This Student ID has already submitted'; end if;
  for q in select * from public.assessment_questions where assessment_slug=s.assessment_slug order by question_number loop
    total:=total+1; normalized:=lower(trim(coalesce(p_answers->>q.question_key,'')));
    domain_row:=coalesce(domains->q.domain,jsonb_build_object('correct',0,'total',0));
    domain_row:=jsonb_set(domain_row,'{total}',to_jsonb((domain_row->>'total')::int+1));
    if (q.question_type='mc' and upper(normalized)=upper(q.correct_answer)) or
       (q.question_type='text' and exists(select 1 from jsonb_array_elements_text(coalesce(q.accepted_answers,'[]'::jsonb)) a where lower(trim(a))=normalized)) then
      correct:=correct+1; domain_row:=jsonb_set(domain_row,'{correct}',to_jsonb((domain_row->>'correct')::int+1));
    end if;
    domains:=jsonb_set(domains,array[q.domain],domain_row,true);
  end loop;
  if jsonb_typeof(p_answers)<>'object'
     or (select count(*) from jsonb_object_keys(p_answers))<>total
  then raise exception 'Every question must be answered'; end if;
  insert into public.classroom_submissions(classroom_session_id,student_name,student_id,answers,score,possible_score,domain_scores)
  values(s.id,trim(p_student_name),trim(p_student_id),p_answers,correct,total,domains);
  return jsonb_build_object('score',correct,'possible_score',total,'percent',round(100.0*correct/greatest(total,1)));
end $$;

revoke execute on function public.submit_classroom_assessment(text,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.submit_classroom_assessment(text,text,text,jsonb) to anon, authenticated;
