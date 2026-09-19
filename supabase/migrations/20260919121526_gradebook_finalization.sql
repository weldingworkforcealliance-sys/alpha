-- Final grades use the user-approved weights. Existing assessment history is unchanged.
create table public.gradebook_finalizations (
 id uuid primary key default gen_random_uuid(),
 gradebook_id uuid not null references public.gradebooks(id),
 student_id uuid not null references public.attendance_students(id),
 snapshot jsonb not null, source_fingerprint text not null,
 reason text not null check(length(trim(reason))>0),
 finalized_by uuid not null, finalized_at timestamptz not null default now(),
 unique(gradebook_id,student_id,source_fingerprint)
);
create index gradebook_finalizations_student_idx on public.gradebook_finalizations(student_id);
create index gradebook_finalizations_book_student_idx on public.gradebook_finalizations(gradebook_id,student_id,finalized_at desc);
alter table public.gradebook_finalizations enable row level security;
revoke all on public.gradebook_finalizations from anon,authenticated;
grant select on public.gradebook_finalizations to authenticated;
create policy finalization_read on public.gradebook_finalizations for select to authenticated using(public.can_access_gradebook(gradebook_id));
create trigger finalizations_immutable before update or delete on public.gradebook_finalizations for each row execute function public.reject_gradebook_history_mutation();

create function public.preview_gradebook_final(p_gradebook_id uuid,p_student_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_role text; v_rows jsonb; v_categories jsonb; v_blockers integer; v_grade numeric; v_result jsonb;
begin
 if auth.uid() is null or not public.can_access_gradebook(p_gradebook_id) then raise insufficient_privilege using message='Gradebook access denied'; end if;
 if not exists(select 1 from public.gradebook_students where gradebook_id=p_gradebook_id and student_id=p_student_id) then raise exception 'Student is not in this gradebook'; end if;
 select case when s.course_id=p.lab_course_id then 'lab' when s.course_id=p.theory_course_id then 'theory' end into v_role
 from public.gradebooks g join public.sections s on s.id=g.section_id join public.gradebook_course_pairs p on p.id=g.course_pair_id where g.id=p_gradebook_id;
 if v_role is null then raise exception 'Configure the theory/shop course pair first'; end if;
 with chosen as (
 select i.id,i.title,c.code as category,c.active,a.id as attempt_id,a.revision_id,a.status_code,a.score,a.possible_score
 from public.gradebook_items i join public.gradebook_categories c on c.id=i.category_id
 left join lateral (
  select la.* from public.gradebook_latest_attempts la
  where la.gradebook_id=p_gradebook_id and la.student_id=p_student_id and la.item_id=i.id
  and (coalesce(i.assessment_slug,'') not like 'tower:%' or exists(select 1 from public.tower_effective_grades t where t.attempt_id=la.id))
  order by la.attempted_at desc,la.id desc limit 1
 ) a on true where i.gradebook_id=p_gradebook_id
 ) select coalesce(jsonb_agg(to_jsonb(chosen) order by id),'[]'::jsonb) into v_rows from chosen;
 with policy as (
 select * from (values ('weld_performance',75),('shop_projects',25)) p(code,weight) where v_role='lab'
 union all select * from (values ('theory_assessments',50),('fabrication_projects',25),('homework',25)) p(code,weight) where v_role='theory'
 ), rows as (
 select * from jsonb_to_recordset(v_rows) as x(category text,status_code text,score numeric,possible_score numeric,active boolean)
 ), totals as (
 select p.code,p.weight,count(r.category) as items,
 count(*) filter(where r.category is not null and (r.active is not true or r.status_code is null or r.status_code not in ('graded','missing','excused') or (r.status_code in ('graded','missing') and (r.possible_score is null or r.possible_score<=0)) or (r.status_code='graded' and r.score is null))) as unresolved,
 sum(case when r.status_code='missing' then 0 when r.status_code='graded' then r.score end) as earned,
 sum(case when r.status_code in ('graded','missing') then r.possible_score end) as possible
 from policy p left join rows r on r.category=p.code group by p.code,p.weight
 ) select jsonb_agg(jsonb_build_object('code',code,'weight',weight,'items',items,'unresolved',unresolved,'average',case when possible>0 then round(earned/possible*100,2) end) order by code),
 sum(unresolved+case when possible is null or possible<=0 then 1 else 0 end),
 round(sum(case when possible>0 then earned/possible*weight end),1)
 into v_categories,v_blockers,v_grade from totals;
 -- An item in an unweighted category must never silently disappear from a final.
 select v_blockers+count(*) into v_blockers from jsonb_array_elements(v_rows) r where not exists(select 1 from jsonb_array_elements(v_categories) c where c->>'code'=r->>'category');
 v_result:=jsonb_build_object('policyVersion','ltg-final-v1','role',v_role,'passingScore',65,'categories',v_categories,'items',v_rows,'blockers',v_blockers,'ready',v_blockers=0,'grade',case when v_blockers=0 then v_grade end);
 return v_result||jsonb_build_object('fingerprint',md5(v_result::text));
end $$;
revoke all on function public.preview_gradebook_final(uuid,uuid) from public,anon;
grant execute on function public.preview_gradebook_final(uuid,uuid) to authenticated;

create function public.finalize_gradebook_student(p_gradebook_id uuid,p_student_id uuid,p_fingerprint text,p_reason text) returns uuid
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
 insert into public.gradebook_finalizations(gradebook_id,student_id,snapshot,source_fingerprint,reason,finalized_by)
 values(p_gradebook_id,p_student_id,v_snapshot,p_fingerprint,p_reason,auth.uid()) on conflict(gradebook_id,student_id,source_fingerprint) do nothing returning id into v_id;
 if v_id is null then select id into v_id from public.gradebook_finalizations where gradebook_id=p_gradebook_id and student_id=p_student_id and source_fingerprint=p_fingerprint; end if;
 return v_id;
end $$;
revoke all on function public.finalize_gradebook_student(uuid,uuid,text,text) from public,anon;
grant execute on function public.finalize_gradebook_student(uuid,uuid,text,text) to authenticated;
