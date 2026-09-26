-- STAGING ONLY: Gltg ezlvivmeneefiiwqwgqd. No function bodies or authority checks changed.
do $guard$
declare r record;
begin
for r in select * from (values
('public.mark_all_attendance(uuid,text)','e596090a2a3b139303dbb2b1496cd321'),
('public.reset_attendance_session(uuid)','14ba4e092621013638c91ac0e315c127'),
('public.set_attendance_record(uuid,uuid,text,text,text[],text)','860e3d24c8ad9d28ec00ea30e0a65916')
) x(signature,expected_hash)
loop
if md5(pg_get_functiondef(r.signature::regprocedure)) <> r.expected_hash then raise exception 'Function drift: %',r.signature; end if;
if has_function_privilege('anon',r.signature,'EXECUTE') then raise exception 'Unexpected anonymous grant: %',r.signature; end if;
end loop;
end $guard$;
grant execute on function public.mark_all_attendance(uuid,text) to authenticated;
grant execute on function public.set_attendance_record(uuid,uuid,text,text,text[],text) to authenticated;
grant execute on function public.reset_attendance_session(uuid) to authenticated;


