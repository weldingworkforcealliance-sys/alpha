-- Gltg staging only. This migration cannot be promoted unchanged.
do $$ begin
 if not exists(select 1 from public.schools where name='PVHS 55-day REVIEW 20261027') then
  raise exception 'Staging review school is required';
 end if;
end $$;

create table private.pvhs55_signoff_events (
 id uuid primary key default gen_random_uuid(),
 sequence_number bigint generated always as identity unique,
 school_id uuid not null references public.schools(id),
 section_id uuid not null references public.sections(id),
 student_id uuid not null references public.attendance_students(id),
 gate text not null check(gate in('cnc','qc20','qc30','qc40','bend31')),
 work_scope text not null check(length(btrim(work_scope)) between 1 and 200),
 decision text not null check(decision in('release','hold','revoke')),
 evidence_reference text not null,
 criteria_reference text not null,
 observation text not null,
 criterion_results jsonb not null,
 bend_result text check(bend_result in('passed','failed','invalid')),
 expires_at timestamptz,
 previous_id uuid references private.pvhs55_signoff_events(id),
 prerequisite_id uuid references private.pvhs55_signoff_events(id),
 recorded_by uuid not null references auth.users(id),
 recorded_at timestamptz not null default clock_timestamp()
);
create index pvhs55_signoff_stream on private.pvhs55_signoff_events(section_id,student_id,work_scope,gate,sequence_number desc);
alter table private.pvhs55_signoff_events enable row level security;
revoke all on private.pvhs55_signoff_events from public,anon,authenticated;

create function private.pvhs55_signoff_immutable() returns trigger
language plpgsql set search_path='' as $$ begin
 raise exception 'Signoff history is immutable; append a new review';
end $$;
create trigger pvhs55_signoff_immutable before update or delete on private.pvhs55_signoff_events
for each row execute function private.pvhs55_signoff_immutable();
revoke all on function private.pvhs55_signoff_immutable() from public,anon,authenticated;

create function private.pvhs55_signoff_allowed(p_section uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(
  select 1 from public.sections s join public.schools sc on sc.id=s.school_id
  where s.id=p_section and sc.name='PVHS 55-day REVIEW 20261027'
  and (public.can_review_instruction(s.school_id) or (
   public.is_school_instructional_staff(s.school_id) and exists(
    select 1 from public.section_instructors si where si.section_id=s.id
    and si.school_id=s.school_id and si.instructor_id=auth.uid() and si.active
   )))
 );
$$;
revoke all on function private.pvhs55_signoff_allowed(uuid) from public,anon,authenticated;

-- A release remains valid only while it is the latest review and its exact
-- prerequisite release is still current. Re-release cannot resurrect old QC work.
create function private.pvhs55_signoff_effective(p_event uuid) returns boolean
language plpgsql stable set search_path='' as $$
declare e private.pvhs55_signoff_events; latest uuid;
begin
 select * into e from private.pvhs55_signoff_events where id=p_event;
 if not found or e.decision<>'release' or (e.expires_at is not null and e.expires_at<=now()) then return false; end if;
 select id into latest from private.pvhs55_signoff_events
 where section_id=e.section_id and student_id=e.student_id and work_scope=e.work_scope and gate=e.gate
 order by sequence_number desc limit 1;
 if latest<>e.id then return false; end if;
 if e.gate in('qc30','qc40') then
  if e.prerequisite_id is null then return false; end if;
  return private.pvhs55_signoff_effective(e.prerequisite_id);
 end if;
 return true;
end $$;
revoke all on function private.pvhs55_signoff_effective(uuid) from public,anon,authenticated;

create function private.pvhs55_signoff_catalog() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Instructor login required' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object(
  'id',s.id,'name',s.section_name,'course',c.course_code,'status',s.status,
  'held',coalesce(sp.manual_hold,true),'students',coalesce((
   select jsonb_agg(jsonb_build_object('id',st.id,'name',st.display_name,'active',st.active and exists(
    select 1 from public.gradebook_enrollment_source en join public.gradebooks gb on gb.id=en.gradebook_id
    where gb.section_id=s.id and en.student_id=st.id and en.active)) order by st.display_name)
   from public.attendance_students st where st.school_id=s.school_id and (
    exists(select 1 from public.gradebook_enrollment_source en join public.gradebooks gb on gb.id=en.gradebook_id
     where gb.section_id=s.id and en.student_id=st.id and en.active)
    or exists(select 1 from private.pvhs55_signoff_events e where e.section_id=s.id and e.student_id=st.id)
   )), '[]'::jsonb)) order by s.section_name)
 from public.sections s join public.courses c on c.id=s.course_id
 left join public.section_progress sp on sp.section_id=s.id
 where private.pvhs55_signoff_allowed(s.id) and c.course_code in('WLD 114','WLD 120','WLD 150')), '[]'::jsonb);
end $$;

create function private.pvhs55_signoff_read(p_section uuid,p_student uuid,p_scope text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare enrolled boolean; available boolean;
begin
 if not private.pvhs55_signoff_allowed(p_section) then raise exception 'Assigned instructor or school reviewer required' using errcode='42501'; end if;
 if p_scope is null or length(btrim(p_scope)) not between 1 and 200 then raise exception 'Name the machine or job scope'; end if;
 select exists(select 1 from public.gradebook_enrollment_source e join public.gradebooks g on g.id=e.gradebook_id
  where g.section_id=p_section and e.student_id=p_student and e.active) into enrolled;
 if not enrolled and not exists(select 1 from private.pvhs55_signoff_events where section_id=p_section and student_id=p_student) then
  raise exception 'Student is not enrolled in this section' using errcode='42501';
 end if;
 select exists(select 1 from public.sections s join public.section_progress sp on sp.section_id=s.id
  where s.id=p_section and s.status='active' and not sp.manual_hold
  and exists(select 1 from public.planner_days pd where pd.section_id=s.id
   and pd.planner_day_number=sp.current_planner_day_number and pd.scheduled_date is not null and pd.scheduled_date<=private.school_local_date(s.school_id))) into available;
 return jsonb_build_object('enrolled',enrolled,'instruction_available',available,
  'history',coalesce((select jsonb_agg(to_jsonb(e)||jsonb_build_object(
   'instructor_name',coalesce(p.display_name,'Instructor'),'release_valid',enrolled and private.pvhs55_signoff_effective(e.id),
   'can_proceed',available and enrolled and private.pvhs55_signoff_effective(e.id)) order by e.sequence_number desc)
   from private.pvhs55_signoff_events e left join public.profiles p on p.id=e.recorded_by
   where e.section_id=p_section and e.student_id=p_student and e.work_scope=btrim(p_scope)),'[]'::jsonb));
end $$;

create function private.pvhs55_signoff_record(
 p_section uuid,p_student uuid,p_scope text,p_gate text,p_decision text,
 p_evidence text,p_criteria text,p_observation text,p_results jsonb,
 p_bend_result text default null,p_expires_at timestamptz default null,p_expected_previous uuid default null
) returns uuid language plpgsql security definer set search_path='' as $$
declare sc uuid; code text; prev uuid; prerequisite uuid; result uuid; enrolled boolean; r jsonb;
begin
 if not private.pvhs55_signoff_allowed(p_section) then raise exception 'Assigned instructor or school reviewer required' using errcode='42501'; end if;
 select s.school_id,c.course_code into sc,code from public.sections s join public.courses c on c.id=s.course_id where s.id=p_section;
 if p_gate is null or not ((code='WLD 114' and p_gate='cnc') or (code='WLD 120' and p_gate in('qc20','qc30','qc40')) or (code='WLD 150' and p_gate='bend31')) then
  raise exception 'Gate does not belong to this course';
 end if;
 if p_decision is null or p_decision not in('release','hold','revoke') then raise exception 'Choose release, hold or revoke'; end if;
 if p_scope is null or length(btrim(p_scope)) not between 1 and 200 then raise exception 'Name the machine or job scope'; end if;
 p_scope:=btrim(p_scope);
 if p_evidence is null or length(btrim(p_evidence)) not between 3 and 4000 or p_criteria is null or length(btrim(p_criteria)) not between 3 and 4000
 or p_observation is null or length(btrim(p_observation)) not between 3 and 4000 then raise exception 'Evidence, acceptance reference and observation are required'; end if;
 if p_results is null or jsonb_typeof(p_results)<>'array' then raise exception 'Criterion observations are required'; end if;
 if jsonb_array_length(p_results) not between 1 and 30 or octet_length(p_results::text)>30000 then raise exception 'Provide 1–30 concise criterion observations'; end if;
 for r in select value from jsonb_array_elements(p_results) loop
  if jsonb_typeof(r)<>'object' or coalesce(jsonb_typeof(r->'met'),'')<>'boolean'
   or coalesce(jsonb_typeof(r->'criterion'),'')<>'string' or length(btrim(coalesce(r->>'criterion',''))) not between 1 and 1000
   or coalesce(jsonb_typeof(r->'required'),'')<>'string' or length(btrim(coalesce(r->>'required',''))) not between 1 and 1000
   or coalesce(jsonb_typeof(r->'observed'),'')<>'string' or length(btrim(coalesce(r->>'observed',''))) not between 1 and 1000
  then raise exception 'Each criterion needs a name, requirement, observation and explicit met decision'; end if;
  if p_decision='release' and (r->>'met')::boolean is not true then raise exception 'Unmet criteria prevent release'; end if;
 end loop;
 if p_gate='bend31' then
  if p_bend_result is null or p_bend_result not in('passed','failed','invalid') then raise exception 'Record the bend-test result'; end if;
  if p_decision='release' and p_bend_result<>'passed' then raise exception 'A failed or invalid bend test cannot be released'; end if;
 elsif p_bend_result is not null then raise exception 'Bend result belongs only to bend review'; end if;
 if p_expires_at is not null and (p_gate<>'cnc' or p_expires_at<=now()) then raise exception 'Expiry must be a future CNC authorization expiry'; end if;
 -- Serializes this student's entire job chain, including concurrent upstream revocation.
 perform pg_advisory_xact_lock(hashtextextended(p_section::text||':'||p_student::text||':'||p_scope,0));
 select id into prev from private.pvhs55_signoff_events where section_id=p_section and student_id=p_student and work_scope=p_scope and gate=p_gate
 order by sequence_number desc limit 1;
 if prev is distinct from p_expected_previous then raise exception 'Another review changed this gate. Reload before signing.' using errcode='40001'; end if;
 select exists(select 1 from public.gradebook_enrollment_source e join public.gradebooks g on g.id=e.gradebook_id
  join public.attendance_students st on st.id=e.student_id and st.school_id=sc
  where g.section_id=p_section and e.student_id=p_student and e.active) into enrolled;
 if not enrolled and (p_decision='release' or prev is null) then raise exception 'Active enrollment in this section is required' using errcode='42501'; end if;
 if p_decision='revoke' and prev is null then raise exception 'There is no previous signoff to revoke'; end if;
 if p_decision='release' and p_gate in('qc30','qc40') then
  select id into prerequisite from private.pvhs55_signoff_events
  where section_id=p_section and student_id=p_student and work_scope=p_scope and gate=case p_gate when 'qc30' then 'qc20' else 'qc30' end
  order by sequence_number desc limit 1;
  if prerequisite is null or not private.pvhs55_signoff_effective(prerequisite) then raise exception 'The previous QC gate requires a current release for this student and job'; end if;
 end if;
 insert into private.pvhs55_signoff_events(school_id,section_id,student_id,gate,work_scope,decision,
 evidence_reference,criteria_reference,observation,criterion_results,bend_result,expires_at,previous_id,prerequisite_id,recorded_by)
 values(sc,p_section,p_student,p_gate,p_scope,p_decision,btrim(p_evidence),btrim(p_criteria),btrim(p_observation),p_results,p_bend_result,p_expires_at,prev,prerequisite,auth.uid()) returning id into result;
 return result;
end $$;

revoke all on function private.pvhs55_signoff_catalog() from public,anon,authenticated;
revoke all on function private.pvhs55_signoff_read(uuid,uuid,text) from public,anon,authenticated;
revoke all on function private.pvhs55_signoff_record(uuid,uuid,text,text,text,text,text,text,jsonb,text,timestamptz,uuid) from public,anon,authenticated;
grant execute on function private.pvhs55_signoff_catalog(),private.pvhs55_signoff_read(uuid,uuid,text),private.pvhs55_signoff_record(uuid,uuid,text,text,text,text,text,text,jsonb,text,timestamptz,uuid) to authenticated;

-- Invoker wrappers expose only the three checked operations, never the ledger table.
create function public.pvhs55_signoff_catalog() returns jsonb language sql security invoker set search_path='' as $$ select private.pvhs55_signoff_catalog(); $$;
create function public.pvhs55_signoff_read(p_section uuid,p_student uuid,p_scope text) returns jsonb language sql security invoker set search_path='' as $$ select private.pvhs55_signoff_read(p_section,p_student,p_scope); $$;
create function public.pvhs55_signoff_record(p_section uuid,p_student uuid,p_scope text,p_gate text,p_decision text,p_evidence text,p_criteria text,p_observation text,p_results jsonb,p_bend_result text default null,p_expires_at timestamptz default null,p_expected_previous uuid default null)
returns uuid language sql security invoker set search_path='' as $$ select private.pvhs55_signoff_record(p_section,p_student,p_scope,p_gate,p_decision,p_evidence,p_criteria,p_observation,p_results,p_bend_result,p_expires_at,p_expected_previous); $$;
revoke all on function public.pvhs55_signoff_catalog(),public.pvhs55_signoff_read(uuid,uuid,text),public.pvhs55_signoff_record(uuid,uuid,text,text,text,text,text,text,jsonb,text,timestamptz,uuid) from public,anon,authenticated;
grant execute on function public.pvhs55_signoff_catalog(),public.pvhs55_signoff_read(uuid,uuid,text),public.pvhs55_signoff_record(uuid,uuid,text,text,text,text,text,text,jsonb,text,timestamptz,uuid) to authenticated;
