-- WLD 110 operational workflow only. No curriculum, outcomes, weights, Tower
-- history, or weld-sizer tolerances are changed. Requires gradebook foundation.
begin;

create table public.wld110_shop_progress (
 gradebook_id uuid not null references public.gradebooks(id),
 student_id uuid not null references public.attendance_students(id),
 current_competency integer not null default 0 check(current_competency between 0 and 9),
 revision integer not null default 0, requested_at timestamptz,
 position_started_on date not null default (now() at time zone 'America/New_York')::date,
 focus text[] not null default '{}',
 primary key(gradebook_id,student_id)
);
create index wld110_progress_student_idx on public.wld110_shop_progress(student_id);
create table public.wld110_shop_attempts (
 id uuid primary key,
 gradebook_id uuid not null, student_id uuid not null,
 competency integer not null check(competency between 0 and 8),
 attempt_number integer not null check(attempt_number>0),
 ratings jsonb not null, total integer not null check(total between 60 and 100),
 tags jsonb not null default '{}',
 sizer_reference text not null default 'ltg-tower-bead-size-v1',
 sizer_note text not null default '' check(length(sizer_note)<=500),
 recorded_by uuid not null, recorded_at timestamptz not null default now(),
 foreign key(gradebook_id,student_id) references public.wld110_shop_progress,
 unique(gradebook_id,student_id,competency,attempt_number),
 unique(gradebook_id,student_id,competency,id)
);
create index wld110_attempt_student_idx on public.wld110_shop_attempts(student_id);
create table public.wld110_shop_completions (
 gradebook_id uuid not null, student_id uuid not null, competency integer not null,
 first_attempt_id uuid not null, second_attempt_id uuid not null,
 grade numeric not null check(grade between 60 and 100),
 gradebook_attempt_id uuid references public.gradebook_attempts(id),
 completed_at timestamptz not null default now(),
 primary key(gradebook_id,student_id,competency),
 foreign key(gradebook_id,student_id,competency,first_attempt_id)
   references public.wld110_shop_attempts(gradebook_id,student_id,competency,id),
 foreign key(gradebook_id,student_id,competency,second_attempt_id)
   references public.wld110_shop_attempts(gradebook_id,student_id,competency,id),
 check(first_attempt_id<>second_attempt_id)
);
create index wld110_completion_student_idx on public.wld110_shop_completions(student_id);
create index wld110_completion_grade_idx on public.wld110_shop_completions(gradebook_attempt_id);
create index wld110_completion_first_idx on public.wld110_shop_completions(first_attempt_id);
create index wld110_completion_second_idx on public.wld110_shop_completions(second_attempt_id);
-- Only hashes are stored. Personal links grant access to one active student's shop
-- card, never the class roster, grading functions, or other LTG records.
create table private.wld110_student_links (
 gradebook_id uuid not null, student_id uuid not null, token_hash text not null unique,
 expires_at timestamptz not null, issued_by uuid not null,
 primary key(gradebook_id,student_id),
 foreign key(gradebook_id,student_id) references public.wld110_shop_progress
);
alter table private.wld110_student_links enable row level security;
revoke all on private.wld110_student_links from public,anon,authenticated;

do $$ declare t text; begin
 foreach t in array array['wld110_shop_progress','wld110_shop_attempts','wld110_shop_completions'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
  execute format('create policy shop_instructor_read on public.%I for select to authenticated using(public.can_access_gradebook(gradebook_id))',t);
 end loop;
end $$;
create trigger wld110_attempt_immutable before update or delete on public.wld110_shop_attempts
 for each row execute function public.reject_gradebook_history_mutation();
create trigger wld110_completion_immutable before update or delete on public.wld110_shop_completions
 for each row execute function public.reject_gradebook_history_mutation();

create function private.wld110_assert(p_book uuid,p_student uuid default null) returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.can_access_gradebook(p_book) then
  raise insufficient_privilege using message='Assigned instructor access required';
 end if;
 if not exists(select 1 from public.gradebook_directory where id=p_book
  and course_code='WLD 110' and course_role='lab' and section_status='active') then
  raise exception 'Choose an active WLD 110 lab class';
 end if;
 if p_student is not null and not exists(select 1 from public.gradebook_enrollment_source
   where gradebook_id=p_book and student_id=p_student and active) then
  raise exception 'Student is not actively enrolled';
 end if;
end $$;

create function private.wld110_snapshot(p_book uuid,p_student uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
  'student_id',p.student_id,'display_name',r.display_name,'active',r.active,
  'current_competency',p.current_competency,'revision',p.revision,
  'requested_at',p.requested_at,'focus',p.focus,
  'position_meetings',(select count(distinct a.attendance_date)
   from public.gradebooks g join public.attendance_pairs pair
    on g.section_id in(pair.primary_section_id,pair.completion_section_id)
   join public.attendance_sessions a on a.pair_id=pair.id
   where g.id=p_book and a.counts_toward_attendance and a.status in('taken','finalized')
    and a.attendance_date between p.position_started_on and (now() at time zone 'America/New_York')::date),
  'attempts',coalesce((select jsonb_agg(to_jsonb(a)-'gradebook_id'-'student_id' order by a.competency,a.attempt_number)
    from public.wld110_shop_attempts a where a.gradebook_id=p_book and a.student_id=p_student),'[]'),
  'completions',coalesce((select jsonb_agg(to_jsonb(c)-'gradebook_id'-'student_id' order by c.competency)
    from public.wld110_shop_completions c where c.gradebook_id=p_book and c.student_id=p_student),'[]')
 )
 from public.wld110_shop_progress p join public.gradebook_roster r
 on r.gradebook_id=p.gradebook_id and r.student_id=p.student_id
 where p.gradebook_id=p_book and p.student_id=p_student
$$;

create function private.wld110_open(p_book uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare category uuid; names text[]:=array['Flat E6010','Flat E7018','2F E6010','2F E7018',
 '3F vertical-up E6010','3F vertical-up E7018','4F E6010','4F E7018']; i integer;
begin
 perform private.wld110_assert(p_book);
 perform public.refresh_gradebook(p_book);
 insert into public.wld110_shop_progress(gradebook_id,student_id)
 select p_book,student_id from public.gradebook_roster where gradebook_id=p_book and active on conflict do nothing;
 insert into public.gradebook_categories(gradebook_id,code,label) values(p_book,'weld_performance','Weld Performance') on conflict do nothing;
 select id into category from public.gradebook_categories where gradebook_id=p_book and code='weld_performance';
 -- Seed all eight core items, so unfinished competencies remain unresolved in the
 -- existing final-grade preview. Advanced 2G must not increase the required core.
 for i in 1..8 loop
  insert into public.gradebook_items(gradebook_id,category_id,title,assessment_slug)
   values(p_book,category,'WLD 110 · '||names[i],'wld110-shop:'||(i-1)) on conflict do nothing;
 end loop;
 return jsonb_build_object(
  'night',(select s.current_planner_day_number from public.gradebooks g
    join public.section_progress s on s.section_id=g.section_id where g.id=p_book),
  'students',coalesce((select jsonb_agg(private.wld110_snapshot(p_book,p.student_id) order by r.display_name)
    from public.wld110_shop_progress p join public.gradebook_roster r
     on r.gradebook_id=p.gradebook_id and r.student_id=p.student_id
    where p.gradebook_id=p_book),'[]'));
end $$;
create function public.open_wld110_shop(p_gradebook_id uuid) returns jsonb
language sql security invoker set search_path='' as $$ select private.wld110_open(p_gradebook_id) $$;

create function private.wld110_grade(p_book uuid,p_student uuid,p_id uuid,p_competency integer,
 p_revision integer,p_ratings jsonb,p_tags jsonb,p_sizer_note text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare progress public.wld110_shop_progress; first_weld public.wld110_shop_attempts;
 prior public.wld110_shop_attempts; k text; v integer; total integer:=0; acceptable boolean:=true;
 attempt_no integer; tag text; focus text[]:='{}'; grade numeric; item uuid; grade_attempt uuid;
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
   focus:=array_append(focus,tag);
  end loop;
 end loop;
 -- A category label remains useful feedback if no optional quick tag was chosen.
 foreach k in array array['straightness','placement','execution','consistency','weldSize'] loop
  if p_ratings->>k='12' and coalesce(jsonb_array_length(p_tags->k),0)=0 then focus:=array_append(focus,k); end if;
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
  if attempt_no>1 and total<first_weld.total then focus:=array_append(focus,'Match or improve Weld 1: '||first_weld.total||'%'); end if;
  update public.wld110_shop_progress set revision=revision+1,requested_at=null,focus=focus
   where gradebook_id=p_book and student_id=p_student;
 end if;
 return private.wld110_snapshot(p_book,p_student);
end $$;
create function public.grade_wld110_weld(p_gradebook_id uuid,p_student_id uuid,p_save_id uuid,
 p_competency integer,p_revision integer,p_ratings jsonb,p_tags jsonb default '{}',p_sizer_note text default '') returns jsonb
language sql security invoker set search_path='' as $$
 select private.wld110_grade(p_gradebook_id,p_student_id,p_save_id,p_competency,p_revision,p_ratings,p_tags,p_sizer_note)
$$;

create function private.wld110_practice(p_book uuid,p_student uuid,p_revision integer,p_focus text[]) returns jsonb
language plpgsql security definer set search_path='' as $$
declare progress public.wld110_shop_progress;
begin
 perform private.wld110_assert(p_book,p_student);
 if p_focus is null or cardinality(p_focus)>12 or exists(select 1 from unnest(p_focus) t where t is null or length(trim(t)) not between 1 and 80) then raise exception 'Invalid practice focus'; end if;
 select * into progress from public.wld110_shop_progress where gradebook_id=p_book and student_id=p_student for update;
 if not found or progress.revision is distinct from p_revision then raise serialization_failure using message='This student changed. Reload before coaching.'; end if;
 update public.wld110_shop_progress set requested_at=null,focus=p_focus,revision=revision+1
  where gradebook_id=p_book and student_id=p_student;
 return private.wld110_snapshot(p_book,p_student);
end $$;
create function public.coach_wld110_practice(p_gradebook_id uuid,p_student_id uuid,p_revision integer,p_focus text[]) returns jsonb
language sql security invoker set search_path='' as $$ select private.wld110_practice(p_gradebook_id,p_student_id,p_revision,p_focus) $$;

create function private.wld110_issue_link(p_book uuid,p_student uuid) returns text
language plpgsql security definer set search_path='' as $$
declare token text:=gen_random_uuid()::text||gen_random_uuid()::text;
begin
 perform private.wld110_assert(p_book,p_student);
 insert into private.wld110_student_links values(p_book,p_student,encode(extensions.digest(token,'sha256'),'hex'),now()+interval '120 days',auth.uid())
 on conflict(gradebook_id,student_id) do update set token_hash=excluded.token_hash,expires_at=excluded.expires_at,issued_by=excluded.issued_by;
 return token;
end $$;
create function public.issue_wld110_student_link(p_gradebook_id uuid,p_student_id uuid) returns text
language sql security invoker set search_path='' as $$ select private.wld110_issue_link(p_gradebook_id,p_student_id) $$;

create function private.wld110_student(p_token text,p_request boolean,p_competency integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare link private.wld110_student_links; progress public.wld110_shop_progress; result jsonb;
begin
 if p_token is null or length(p_token)<>72 then raise insufficient_privilege using message='Student link is invalid or expired'; end if;
 select l.* into link from private.wld110_student_links l
  join public.gradebook_enrollment_source r on r.gradebook_id=l.gradebook_id and r.student_id=l.student_id and r.active
  join public.gradebook_directory b on b.id=l.gradebook_id and b.section_status='active' and b.course_code='WLD 110'
  where l.token_hash=encode(extensions.digest(p_token,'sha256'),'hex') and l.expires_at>now();
 if not found then raise insufficient_privilege using message='Student link is invalid or expired'; end if;
 if p_request then
  select * into progress from public.wld110_shop_progress where gradebook_id=link.gradebook_id and student_id=link.student_id for update;
  if progress.current_competency is distinct from p_competency or progress.current_competency>=9 then raise exception 'Assignment changed. Refresh your shop card.'; end if;
  -- Duplicate taps retain the original queue time. The instructor revision does
  -- not change: a check request must not invalidate an in-flight grading form.
  update public.wld110_shop_progress set requested_at=coalesce(requested_at,now())
   where gradebook_id=link.gradebook_id and student_id=link.student_id;
 end if;
 result:=private.wld110_snapshot(link.gradebook_id,link.student_id);
 -- Student-facing responses contain no instructor identity.
 return result||jsonb_build_object('attempts',coalesce((select jsonb_agg(a-'recorded_by' order by (a->>'competency')::int,(a->>'attempt_number')::int)
  from jsonb_array_elements(result->'attempts') a),'[]'));
end $$;
create function public.read_wld110_student(p_token text) returns jsonb
language sql security invoker set search_path='' as $$ select private.wld110_student(p_token,false,null) $$;
create function public.request_wld110_check(p_token text,p_competency integer) returns jsonb
language sql security invoker set search_path='' as $$ select private.wld110_student(p_token,true,p_competency) $$;

-- Reuse the host application's private-schema RPC pattern. No table writes are
-- granted to browser roles. Anonymous execution is limited to token-scoped reads
-- and check requests; the private implementation repeats all authorization.
revoke all on function private.wld110_assert(uuid,uuid),private.wld110_snapshot(uuid,uuid),
 private.wld110_open(uuid),private.wld110_grade(uuid,uuid,uuid,integer,integer,jsonb,jsonb,text),
 private.wld110_practice(uuid,uuid,integer,text[]),private.wld110_issue_link(uuid,uuid),
 private.wld110_student(text,boolean,integer) from public,anon,authenticated;
grant usage on schema private to authenticated,anon;
grant execute on function private.wld110_open(uuid),private.wld110_grade(uuid,uuid,uuid,integer,integer,jsonb,jsonb,text),
 private.wld110_practice(uuid,uuid,integer,text[]),private.wld110_issue_link(uuid,uuid) to authenticated;
grant execute on function private.wld110_student(text,boolean,integer) to anon,authenticated;
revoke all on function public.open_wld110_shop(uuid),public.grade_wld110_weld(uuid,uuid,uuid,integer,integer,jsonb,jsonb,text),
 public.coach_wld110_practice(uuid,uuid,integer,text[]),public.issue_wld110_student_link(uuid,uuid),
 public.read_wld110_student(text),public.request_wld110_check(text,integer) from public,anon,authenticated;
grant execute on function public.open_wld110_shop(uuid),public.grade_wld110_weld(uuid,uuid,uuid,integer,integer,jsonb,jsonb,text),
 public.coach_wld110_practice(uuid,uuid,integer,text[]),public.issue_wld110_student_link(uuid,uuid) to authenticated;
grant execute on function public.read_wld110_student(text),public.request_wld110_check(text,integer) to anon,authenticated;
commit;
