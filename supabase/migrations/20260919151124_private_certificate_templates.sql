create schema if not exists certificate_private;
revoke all on schema certificate_private from public,anon;
grant usage on schema certificate_private to authenticated;
create table certificate_private.templates (
 school_id uuid primary key references public.schools(id),
 layout text not null check(layout='pccc-guided-bend-v2'),
 pdf bytea not null check(octet_length(pdf) between 100 and 2000000),
 created_at timestamptz not null default now()
);
alter table certificate_private.templates enable row level security;
revoke all on certificate_private.templates from public,anon,authenticated;

create function certificate_private.for_test(p_test_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_book uuid; v_school uuid; v_result jsonb;
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 select c.gradebook_id into v_book from public.tower_certificates c where c.test_id=p_test_id;
 if v_book is null or not coalesce(public.can_access_gradebook(v_book),false) then
  raise exception 'Record unavailable';
 end if;
 select s.school_id into v_school from public.gradebooks b join public.sections s on s.id=b.section_id where b.id=v_book;
 select jsonb_build_object('layout',t.layout,'pdf',encode(t.pdf,'base64')) into v_result
 from certificate_private.templates t where t.school_id=v_school;
 return v_result;
end $$;
revoke all on function certificate_private.for_test(uuid) from public,anon;
grant execute on function certificate_private.for_test(uuid) to authenticated;
create function public.certificate_template_for_test(p_test_id uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 select certificate_private.for_test(p_test_id)
$$;
revoke all on function public.certificate_template_for_test(uuid) from public,anon;
grant execute on function public.certificate_template_for_test(uuid) to authenticated;
