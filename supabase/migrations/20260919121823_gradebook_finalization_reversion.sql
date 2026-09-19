alter table public.gradebook_finalizations add column revision bigint generated always as identity;
do $$ declare c record; begin for c in select conname from pg_constraint where conrelid='public.gradebook_finalizations'::regclass and contype='u' loop execute format('alter table public.gradebook_finalizations drop constraint %I',c.conname);end loop;end $$;
create or replace function public.finalize_gradebook_student(p_gradebook_id uuid,p_student_id uuid,p_fingerprint text,p_reason text) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_snapshot jsonb; v_id uuid;
begin
 if auth.uid() is null or not public.can_access_gradebook(p_gradebook_id) then raise insufficient_privilege using message='Gradebook access denied'; end if;
 if length(trim(coalesce(p_reason,'')))=0 then raise exception 'A finalization or correction reason is required'; end if;
 if not exists(select 1 from public.gradebook_enrollment_source where gradebook_id=p_gradebook_id and student_id=p_student_id and active) then raise exception 'Student is not actively enrolled'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_gradebook_id::text||p_student_id::text,43));
 v_snapshot:=public.preview_gradebook_final(p_gradebook_id,p_student_id);
 if not (v_snapshot->>'ready')::boolean then raise exception 'Resolve missing grades, point values and empty categories before finalizing'; end if;
 if v_snapshot->>'fingerprint' is distinct from p_fingerprint then raise serialization_failure using message='Grades changed. Refresh and review the new total before finalizing'; end if;
 select id into v_id from public.gradebook_finalizations where gradebook_id=p_gradebook_id and student_id=p_student_id order by revision desc limit 1;
 if v_id is not null and exists(select 1 from public.gradebook_finalizations where id=v_id and source_fingerprint=p_fingerprint) then return v_id; end if;
 insert into public.gradebook_finalizations(gradebook_id,student_id,snapshot,source_fingerprint,reason,finalized_by)
 values(p_gradebook_id,p_student_id,v_snapshot,p_fingerprint,p_reason,auth.uid()) returning id into v_id;
 return v_id;
end $$;
revoke all on function public.finalize_gradebook_student(uuid,uuid,text,text) from public,anon;
grant execute on function public.finalize_gradebook_student(uuid,uuid,text,text) to authenticated;
