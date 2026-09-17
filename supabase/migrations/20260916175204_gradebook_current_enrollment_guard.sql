-- A roster can change while an instructor has a gradebook open. Recheck current
-- enrollment when creating a manual attempt; corrections and historical imports remain valid.
create function public.validate_gradebook_current_enrollment() returns trigger
language plpgsql set search_path = '' as $$ begin
 if new.source_submission_id is null and not exists (
   select 1 from public.gradebook_enrollment_source e
   where e.gradebook_id=new.gradebook_id and e.student_id=new.student_id and e.active
 ) then raise exception 'Student is not actively enrolled; refresh the gradebook roster'; end if;
 return new;
end $$;
create trigger validate_gradebook_current_enrollment before insert on public.gradebook_attempts
 for each row execute function public.validate_gradebook_current_enrollment();
revoke all on function public.validate_gradebook_current_enrollment() from public,anon,authenticated;
