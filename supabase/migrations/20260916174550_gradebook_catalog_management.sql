-- School managers can extend the catalog without a semester ceiling or new code.
create function public.configure_gradebook_course_pair(p_level_id uuid,p_semester_number integer,
 p_semester_name text,p_pair_name text,p_theory_course_id uuid,p_lab_course_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_school uuid; v_semester uuid; v_pair uuid;
begin
 select school_id into v_school from public.program_levels where id=p_level_id;
 if auth.uid() is null or v_school is null or not public.can_manage_school(v_school)
 then raise exception 'School management access required' using errcode='42501'; end if;
 insert into public.program_semesters(level_id,semester_number,semester_name)
 values(p_level_id,p_semester_number,p_semester_name)
 on conflict(level_id,semester_number) do update set semester_name=excluded.semester_name returning id into v_semester;
 insert into public.gradebook_course_pairs(semester_id,pair_name,theory_course_id,lab_course_id)
 values(v_semester,p_pair_name,p_theory_course_id,p_lab_course_id)
 on conflict(semester_id,theory_course_id,lab_course_id) do update set pair_name=excluded.pair_name returning id into v_pair;
 return v_pair;
end $$;
revoke all on function public.configure_gradebook_course_pair(uuid,integer,text,text,uuid,uuid) from public,anon;
grant execute on function public.configure_gradebook_course_pair(uuid,integer,text,text,uuid,uuid) to authenticated;

create function public.assign_gradebook_course_pair(p_gradebook_id uuid,p_course_pair_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_school uuid; v_current uuid;
begin
 select s.school_id,g.course_pair_id into v_school,v_current from public.gradebooks g
 join public.sections s on s.id=g.section_id where g.id=p_gradebook_id for update of g;
 if auth.uid() is null or v_school is null or not public.can_manage_school(v_school)
 then raise exception 'School management access required' using errcode='42501'; end if;
 if v_current is distinct from p_course_pair_id and exists(select 1 from public.gradebook_attempts where gradebook_id=p_gradebook_id)
 then raise exception 'A gradebook with attempts cannot be reassigned; preserve its academic history'; end if;
 update public.gradebooks set course_pair_id=p_course_pair_id where id=p_gradebook_id;
end $$;
revoke all on function public.assign_gradebook_course_pair(uuid,uuid) from public,anon;
grant execute on function public.assign_gradebook_course_pair(uuid,uuid) to authenticated;

-- Roster is immediately visible even before the first refresh; retained rows survive withdrawal.
create view public.gradebook_roster with(security_invoker=true) as
 with current_enrollment as (
   select gradebook_id,student_id,bool_or(active) active from public.gradebook_enrollment_source group by gradebook_id,student_id
 ), members as (
   select gradebook_id,student_id from current_enrollment
   union select gradebook_id,student_id from public.gradebook_students
 )
 select m.gradebook_id,m.student_id,s.display_name,coalesce(e.active,false) active
 from members m join public.attendance_students s on s.id=m.student_id
 left join current_enrollment e on e.gradebook_id=m.gradebook_id and e.student_id=m.student_id;
revoke all on public.gradebook_roster from anon,authenticated;
grant select on public.gradebook_roster to authenticated;

-- Keep catalog/section identity stable once evidence exists, including service-side edits.
create function public.guard_gradebook_academic_history() returns trigger language plpgsql set search_path = '' as $$ begin
 if tg_table_name='gradebooks' then
   if new.course_pair_id is distinct from old.course_pair_id and exists(select 1 from public.gradebook_attempts where gradebook_id=old.id)
   then raise exception 'Cannot remap a gradebook with recorded attempts'; end if;
 elsif tg_table_name='gradebook_course_pairs' then
   if (new.semester_id,new.theory_course_id,new.lab_course_id) is distinct from (old.semester_id,old.theory_course_id,old.lab_course_id)
   then raise exception 'Academic course pair identity is immutable; create a new pair'; end if;
 elsif tg_table_name='program_semesters' then
   if (new.level_id,new.semester_number) is distinct from (old.level_id,old.semester_number)
   then raise exception 'Semester identity is immutable; create a new semester'; end if;
 end if;
 return new;
end $$;
create trigger preserve_gradebook_mapping before update on public.gradebooks for each row execute function public.guard_gradebook_academic_history();
create trigger preserve_course_pair_identity before update on public.gradebook_course_pairs for each row execute function public.guard_gradebook_academic_history();
create trigger preserve_semester_identity before update on public.program_semesters for each row execute function public.guard_gradebook_academic_history();
revoke all on function public.guard_gradebook_academic_history() from public,anon,authenticated;
