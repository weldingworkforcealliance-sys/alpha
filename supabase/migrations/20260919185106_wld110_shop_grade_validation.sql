create or replace function private.wld110_grade(p_book uuid,p_student uuid,p_id uuid,p_competency integer,
 p_revision integer,p_ratings jsonb,p_tags jsonb,p_sizer_note text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare progress public.wld110_shop_progress; first_weld public.wld110_shop_attempts;
 prior public.wld110_shop_attempts; k text; v integer; total integer:=0; acceptable boolean:=true;
 attempt_no integer; tag text; v_focus text[]:='{}'; grade numeric; item uuid; grade_attempt uuid;
begin
 perform private.wld110_assert(p_book,p_student);
 if p_id is null then raise exception 'Save identifier required'; end if;
 select * into progress from public.wld110_shop_progress where gradebook_id=p_book and student_id=p_student for update;
 if not found then raise exception 'Open the shop board first'; end if;
 select * into prior from public.wld110_shop_attempts where id=p_id;
 if found then
  if prior.gradebook_id<>p_book or prior.student_id<>p_student or prior.competency<>p_competency
   or prior.ratings is distinct from p_ratings or prior.tags is distinct from p_tags
   or prior.sizer_note is distinct from coalesce(p_sizer_note,'') then raise exception 'Save identifier already used'; end if;
  return private.wld110_snapshot(p_book,p_student);
 end if;
 if progress.revision is distinct from p_revision or progress.current_competency is distinct from p_competency then
  raise serialization_failure using message='This student changed. Reload before grading.';
 end if;
 if p_competency>=9 then raise exception 'All competencies are complete'; end if;
 if jsonb_typeof(p_ratings) is distinct from 'object' or
  (select count(*) from jsonb_object_keys(p_ratings))<>5 then raise exception 'Five category ratings required'; end if;
 if jsonb_typeof(p_tags) is distinct from 'object' or octet_length(p_tags::text)>4000 then raise exception 'Invalid deficiency tags'; end if;
 foreach k in array array['straightness','placement','execution','consistency','weldSize'] loop
  if jsonb_typeof(p_ratings->k) is distinct from 'number' or p_ratings->>k not in('12','16','18','20') then
   raise exception 'Choose Excellent, Good, Acceptable or Needs Work for every category';
  end if;
  v:=(p_ratings->>k)::integer; total:=total+v;
  if v=12 then acceptable:=false; end if;
 end loop;
 for k in select jsonb_object_keys(p_tags) loop
  if not p_ratings ? k or p_ratings->>k<>'12' or jsonb_typeof(p_tags->k) is distinct from 'array'
    or jsonb_array_length(p_tags->k)>12 then raise exception 'Tags apply only to Needs Work'; end if;
  for tag in select jsonb_array_elements_text(p_tags->k) loop
   if length(trim(tag)) not between 1 and 80 then raise exception 'Invalid deficiency tag'; end if;
   v_focus:=array_append(v_focus,tag);
  end loop;
 end loop;
 -- A category label remains useful feedback if no optional quick tag was chosen.
 foreach k in array array['straightness','placement','execution','consistency','weldSize'] loop
  if p_ratings->>k='12' and coalesce(jsonb_array_length(p_tags->k),0)=0 then v_focus:=array_append(v_focus,k); end if;
 end loop;
 select count(*)+1 into attempt_no from public.wld110_shop_attempts
  where gradebook_id=p_book and student_id=p_student and competency=p_competency;
 insert into public.wld110_shop_attempts(id,gradebook_id,student_id,competency,attempt_number,ratings,total,tags,sizer_note,recorded_by)
 values(p_id,p_book,p_student,p_competency,attempt_no,p_ratings,total,p_tags,coalesce(p_sizer_note,''),auth.uid());
 select * into first_weld from public.wld110_shop_attempts where gradebook_id=p_book and student_id=p_student
  and competency=p_competency and attempt_number=1;
 if attempt_no>1 and acceptable and total>=first_weld.total then
  grade:=(first_weld.total+total)/2.0;
  if p_competency<8 then
   select id into item from public.gradebook_items where gradebook_id=p_book and assessment_slug='wld110-shop:'||p_competency;
   if item is null then raise exception 'Open the shop board to prepare competency gradebook items'; end if;
   grade_attempt:=public.record_gradebook_attempt(p_book,item,p_student,'graded',grade,100,
    'WLD 110 competency: demonstrations 1 and '||attempt_no||'; all graded attempts retained in Shop history.');
  end if;
  insert into public.wld110_shop_completions(gradebook_id,student_id,competency,first_attempt_id,second_attempt_id,grade,gradebook_attempt_id)
   values(p_book,p_student,p_competency,first_weld.id,p_id,grade,grade_attempt);
  update public.wld110_shop_progress set current_competency=p_competency+1,revision=revision+1,
    requested_at=null,focus='{}',
    position_started_on=case when p_competency%2=1 then (now() at time zone 'America/New_York')::date else position_started_on end
   where gradebook_id=p_book and student_id=p_student;
 else
  if attempt_no>1 and total<first_weld.total then v_focus:=array_append(v_focus,'Match or improve Weld 1: '||first_weld.total||'%'); end if;
  update public.wld110_shop_progress set revision=revision+1,requested_at=null,focus=v_focus
   where gradebook_id=p_book and student_id=p_student;
 end if;
 return private.wld110_snapshot(p_book,p_student);
end $$;
