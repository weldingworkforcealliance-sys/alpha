-- Shared lab coaching is independent of Tower rubric data and grading revisions.
-- Existing table-level archive reads automatically retain these additive columns.
alter table public.tower_records add column lab_coaching jsonb not null default '{"revision":0,"focus":[],"note":"","history":[]}'::jsonb;
alter table public.tower_records add column lab_requested_at timestamptz;
create table private.lab_student_links (
 gradebook_id uuid not null, student_id uuid not null,
 token_hash text not null unique, expires_at timestamptz not null, issued_by uuid not null,
 primary key(gradebook_id,student_id),
 foreign key(gradebook_id,student_id) references public.tower_records(gradebook_id,student_id)
);
alter table private.lab_student_links enable row level security;
revoke all on private.lab_student_links from public,anon,authenticated;

create function private.lab_coaching_snapshot(p_book uuid,p_student uuid) returns jsonb
language sql security definer set search_path='' as $$
 select jsonb_build_object(
  'student_id',r.student_id,'display_name',r.display_name,'course_code',b.course_code,'section_name',b.section_name,
  'revision',coalesce((t.lab_coaching->>'revision')::integer,0),
  'assignment_id',t.lab_coaching->>'assignment_id',
  'assignment',case when a.id is null then null else jsonb_build_object('name',a.definition->>'name',
    'process',a.definition->>'process','position',a.definition->>'position','electrode',a.definition->>'electrode') end,
  'focus',coalesce(t.lab_coaching->'focus','[]'::jsonb),'note',coalesce(t.lab_coaching->>'note',''),
  'saved_at',t.lab_coaching->>'saved_at','requested_at',t.lab_requested_at
 )
 from public.gradebook_roster r join public.gradebook_directory b on b.id=r.gradebook_id
 left join public.tower_records t on t.gradebook_id=r.gradebook_id and t.student_id=r.student_id
 left join public.tower_assignments a on a.id=t.lab_coaching->>'assignment_id' and (a.gradebook_id is null or a.gradebook_id=r.gradebook_id)
 where r.gradebook_id=p_book and r.student_id=p_student
$$;

create function private.lab_coaching_open(p_book uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 perform public.tower_assert_access(p_book);
 return coalesce((select jsonb_agg(private.lab_coaching_snapshot(p_book,r.student_id) order by r.display_name)
  from public.gradebook_roster r join public.gradebook_enrollment_source e on e.gradebook_id=r.gradebook_id and e.student_id=r.student_id and e.active
  where r.gradebook_id=p_book),'[]'::jsonb);
end $$;

create function private.lab_coaching_save(p_book uuid,p_student uuid,p_revision integer,p_save_id uuid,p_assignment text,p_focus text[],p_note text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare existing jsonb; prior jsonb; entry jsonb; revision integer;
begin
 perform public.tower_assert_access(p_book,p_student);
 if p_save_id is null or p_revision is null or p_revision<0 or p_focus is null or cardinality(p_focus)>12
  or exists(select 1 from unnest(p_focus) x where x is null or length(trim(x)) not between 1 and 80)
  or p_note is null or length(p_note)>500 then raise exception 'Check the coaching fields'; end if;
 if not exists(select 1 from public.tower_assignments where id=p_assignment and (gradebook_id is null or gradebook_id=p_book)) then
  raise exception 'Choose an assignment from this lab'; end if;
 insert into public.tower_records(gradebook_id,student_id) values(p_book,p_student) on conflict do nothing;
 select lab_coaching into existing from public.tower_records where gradebook_id=p_book and student_id=p_student for update;
 select value into prior from jsonb_array_elements(existing->'history') where value->>'save_id'=p_save_id::text;
 if prior is not null then
  if prior->>'assignment_id' is distinct from p_assignment or prior->'focus' is distinct from to_jsonb(p_focus)
   or prior->>'note' is distinct from trim(p_note) then raise exception 'Retry the same coaching save'; end if;
  return private.lab_coaching_snapshot(p_book,p_student);
 end if;
 revision:=(existing->>'revision')::integer;
 if revision<>p_revision then raise serialization_failure using message='Coaching changed. Close this form and reload before editing.'; end if;
 entry:=jsonb_build_object('revision',revision+1,'save_id',p_save_id,'assignment_id',p_assignment,
  'focus',to_jsonb(p_focus),'note',trim(p_note),'saved_at',now(),'saved_by',auth.uid());
 update public.tower_records set lab_coaching=entry||jsonb_build_object('history',(existing->'history')||jsonb_build_array(entry)),
  lab_requested_at=null where gradebook_id=p_book and student_id=p_student;
 return private.lab_coaching_snapshot(p_book,p_student);
end $$;

create function private.lab_issue_link(p_book uuid,p_student uuid) returns text
language plpgsql security definer set search_path='' as $$
declare token text:=gen_random_uuid()::text||gen_random_uuid()::text;
begin
 perform public.tower_assert_access(p_book,p_student);
 insert into public.tower_records(gradebook_id,student_id) values(p_book,p_student) on conflict do nothing;
 insert into private.lab_student_links values(p_book,p_student,encode(extensions.digest(token,'sha256'),'hex'),now()+interval '120 days',auth.uid())
 on conflict(gradebook_id,student_id) do update set token_hash=excluded.token_hash,expires_at=excluded.expires_at,issued_by=excluded.issued_by;
 return token;
end $$;

create function private.lab_student(p_token text,p_request boolean,p_revision integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare link private.lab_student_links; coaching jsonb;
begin
 if p_token is null or length(p_token)<>72 then raise insufficient_privilege using message='Student link is invalid or expired'; end if;
 select l.* into link from private.lab_student_links l
 join public.gradebook_enrollment_source e on e.gradebook_id=l.gradebook_id and e.student_id=l.student_id and e.active
 join public.gradebook_directory b on b.id=l.gradebook_id and b.course_role='lab' and b.section_status='active'
 where l.token_hash=encode(extensions.digest(p_token,'sha256'),'hex') and l.expires_at>now();
 if not found then raise insufficient_privilege using message='Student link is invalid or expired'; end if;
 if p_request then
  select lab_coaching into coaching from public.tower_records where gradebook_id=link.gradebook_id and student_id=link.student_id for update;
  if coaching->>'assignment_id' is null or (coaching->>'revision')::integer is distinct from p_revision then
   raise exception 'Your assignment changed. Refresh your shop card.'; end if;
  update public.tower_records set lab_requested_at=coalesce(lab_requested_at,now())
   where gradebook_id=link.gradebook_id and student_id=link.student_id;
 end if;
 return private.lab_coaching_snapshot(link.gradebook_id,link.student_id);
end $$;

create function private.lab_check_handled(p_book uuid,p_student uuid,p_requested_at timestamptz) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 perform public.tower_assert_access(p_book,p_student);
 update public.tower_records set lab_requested_at=null where gradebook_id=p_book and student_id=p_student and lab_requested_at=p_requested_at;
 return private.lab_coaching_snapshot(p_book,p_student);
end $$;

create function public.open_lab_coaching(p_gradebook_id uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.lab_coaching_open(p_gradebook_id) $$;
create function public.save_lab_coaching(p_gradebook_id uuid,p_student_id uuid,p_revision integer,p_save_id uuid,p_assignment_id text,p_focus text[],p_note text) returns jsonb
 language sql security invoker set search_path='' as $$ select private.lab_coaching_save(p_gradebook_id,p_student_id,p_revision,p_save_id,p_assignment_id,p_focus,p_note) $$;
create function public.issue_lab_student_link(p_gradebook_id uuid,p_student_id uuid) returns text language sql security invoker set search_path='' as $$ select private.lab_issue_link(p_gradebook_id,p_student_id) $$;
create function public.read_lab_student(p_token text) returns jsonb language sql security invoker set search_path='' as $$ select private.lab_student(p_token,false,null) $$;
create function public.request_lab_check(p_token text,p_revision integer) returns jsonb language sql security invoker set search_path='' as $$ select private.lab_student(p_token,true,p_revision) $$;
create function public.mark_lab_check_handled(p_gradebook_id uuid,p_student_id uuid,p_requested_at timestamptz) returns jsonb
 language sql security invoker set search_path='' as $$ select private.lab_check_handled(p_gradebook_id,p_student_id,p_requested_at) $$;

revoke all on function private.lab_coaching_snapshot(uuid,uuid),private.lab_coaching_open(uuid),
 private.lab_coaching_save(uuid,uuid,integer,uuid,text,text[],text),private.lab_issue_link(uuid,uuid),
 private.lab_student(text,boolean,integer),private.lab_check_handled(uuid,uuid,timestamptz),
 public.open_lab_coaching(uuid),public.save_lab_coaching(uuid,uuid,integer,uuid,text,text[],text),
 public.issue_lab_student_link(uuid,uuid),public.read_lab_student(text),public.request_lab_check(text,integer),
 public.mark_lab_check_handled(uuid,uuid,timestamptz) from public,anon,authenticated;
grant execute on function private.lab_coaching_open(uuid),private.lab_coaching_save(uuid,uuid,integer,uuid,text,text[],text),
 private.lab_issue_link(uuid,uuid),private.lab_check_handled(uuid,uuid,timestamptz),
 public.open_lab_coaching(uuid),public.save_lab_coaching(uuid,uuid,integer,uuid,text,text[],text),
 public.issue_lab_student_link(uuid,uuid),public.mark_lab_check_handled(uuid,uuid,timestamptz) to authenticated;
grant execute on function private.lab_student(text,boolean,integer),public.read_lab_student(text),public.request_lab_check(text,integer) to anon,authenticated;
