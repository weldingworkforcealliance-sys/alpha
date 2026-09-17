-- Additive gradebook foundation. Never reads attendance marks or changes classroom submission RPCs.
create table public.program_semesters (
  id uuid primary key default gen_random_uuid(),
  level_id uuid not null references public.program_levels(id) on delete restrict,
  semester_number integer not null check (semester_number > 0),
  semester_name text not null check (length(trim(semester_name)) > 0),
  unique(level_id, semester_number)
);
create table public.gradebook_course_pairs (
  id uuid primary key default gen_random_uuid(),
  semester_id uuid not null references public.program_semesters(id) on delete restrict,
  pair_name text not null,
  theory_course_id uuid not null references public.courses(id) on delete restrict,
  lab_course_id uuid not null references public.courses(id) on delete restrict,
  check (theory_course_id <> lab_course_id),
  unique(semester_id, theory_course_id, lab_course_id)
);
create table public.gradebooks (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null unique references public.sections(id) on delete restrict,
  course_pair_id uuid references public.gradebook_course_pairs(id) on delete restrict,
  created_at timestamptz not null default now()
);
create index gradebooks_course_pair_idx on public.gradebooks(course_pair_id);
create index gradebook_course_pairs_theory_idx on public.gradebook_course_pairs(theory_course_id);
create index gradebook_course_pairs_lab_idx on public.gradebook_course_pairs(lab_course_id);

create table public.gradebook_students (
  gradebook_id uuid not null references public.gradebooks(id) on delete restrict,
  student_id uuid not null references public.attendance_students(id) on delete restrict,
  active boolean not null default true,
  enrolled_at timestamptz not null default now(),
  last_synced_at timestamptz not null default now(),
  primary key(gradebook_id,student_id)
);
create index gradebook_students_student_idx on public.gradebook_students(student_id);
create table public.gradebook_categories (
  id uuid primary key default gen_random_uuid(),
  gradebook_id uuid not null references public.gradebooks(id) on delete restrict,
  code text not null check (code ~ '^[a-z][a-z0-9_]*$'),
  label text not null check(length(trim(label)) > 0),
  active boolean not null default true,
  unique(gradebook_id,code), unique(gradebook_id,id)
);
create table public.gradebook_statuses (
  gradebook_id uuid not null references public.gradebooks(id) on delete restrict,
  code text not null check(code ~ '^[a-z][a-z0-9_]*$'),
  label text not null check(length(trim(label)) > 0),
  requires_score boolean not null default false,
  active boolean not null default true,
  primary key(gradebook_id,code)
);
create table public.gradebook_items (
  id uuid primary key default gen_random_uuid(),
  gradebook_id uuid not null references public.gradebooks(id) on delete restrict,
  category_id uuid not null,
  title text not null check(length(trim(title)) > 0),
  assessment_slug text,
  created_at timestamptz not null default now(),
  foreign key(gradebook_id,category_id) references public.gradebook_categories(gradebook_id,id) on delete restrict,
  unique(gradebook_id,assessment_slug), unique(gradebook_id,id)
);
create index gradebook_items_category_idx on public.gradebook_items(gradebook_id,category_id);
create table public.gradebook_attempts (
  id uuid primary key default gen_random_uuid(),
  gradebook_id uuid not null,
  item_id uuid not null,
  student_id uuid not null,
  attempted_at timestamptz not null default now(),
  source_submission_id uuid unique references public.classroom_submissions(id) on delete restrict,
  foreign key(gradebook_id,item_id) references public.gradebook_items(gradebook_id,id) on delete restrict,
  foreign key(gradebook_id,student_id) references public.gradebook_students(gradebook_id,student_id) on delete restrict,
  unique(gradebook_id,id)
);
create index gradebook_attempts_item_idx on public.gradebook_attempts(gradebook_id,item_id);
create index gradebook_attempts_student_idx on public.gradebook_attempts(gradebook_id,student_id);
create table public.gradebook_revisions (
  id bigint generated always as identity primary key,
  gradebook_id uuid not null,
  attempt_id uuid not null,
  status_code text not null,
  score numeric,
  possible_score numeric,
  status_label text not null,
  note text not null default '',
  recorded_by uuid,
  recorded_at timestamptz not null default now(),
  foreign key(gradebook_id,attempt_id) references public.gradebook_attempts(gradebook_id,id) on delete restrict,
  foreign key(gradebook_id,status_code) references public.gradebook_statuses(gradebook_id,code) on delete restrict,
  check ((score is null and possible_score is null) or
    (score is not null and possible_score is not null and score >= 0 and possible_score > 0 and score <= possible_score
     and score <> 'NaN'::numeric and possible_score <> 'NaN'::numeric
     and possible_score <> 'Infinity'::numeric))
);
create index gradebook_revisions_attempt_idx on public.gradebook_revisions(gradebook_id,attempt_id,id desc);
create index gradebook_revisions_status_idx on public.gradebook_revisions(gradebook_id,status_code);

-- Explicit section authorization, also used by the read-only views.
create function public.can_access_gradebook(p_gradebook_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.gradebooks g join public.sections s on s.id=g.section_id
    where g.id=p_gradebook_id and (public.can_manage_school(s.school_id)
      or public.is_section_instructor(s.school_id,s.id))
  );
$$;
revoke all on function public.can_access_gradebook(uuid) from public, anon;
grant execute on function public.can_access_gradebook(uuid) to authenticated;

-- Database-only writes for grades: clients cannot replace or delete history.
do $$ declare t text; begin
  foreach t in array array['gradebooks','gradebook_students','gradebook_categories','gradebook_statuses',
    'gradebook_items','gradebook_attempts','gradebook_revisions'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from anon, authenticated',t);
    execute format('grant select on public.%I to authenticated',t);
    execute format('create policy gradebook_read on public.%I for select to authenticated using (public.can_access_gradebook(%I))',
      t,case when t='gradebooks' then 'id' else 'gradebook_id' end);
  end loop;
end $$;
alter table public.program_semesters enable row level security;
alter table public.gradebook_course_pairs enable row level security;
revoke all on public.program_semesters,public.gradebook_course_pairs from anon,authenticated;
grant select on public.program_semesters,public.gradebook_course_pairs to authenticated;
create policy semester_read on public.program_semesters for select to authenticated using (
 exists(select 1 from public.program_levels l where l.id=level_id and public.is_school_member(l.school_id))
 or public.is_platform_owner());
create policy course_pair_read on public.gradebook_course_pairs for select to authenticated using (
 exists(select 1 from public.program_semesters s where s.id=semester_id));

-- Catalog relationships may only connect courses in the level's school and program.
create function public.validate_gradebook_pair() returns trigger
language plpgsql set search_path = '' as $$ begin
 if not exists(select 1 from public.program_semesters sm
   join public.program_levels l on l.id=sm.level_id
   join public.courses t on t.id=new.theory_course_id and t.school_id=l.school_id and t.program_id=l.program_id
   join public.courses b on b.id=new.lab_course_id and b.school_id=l.school_id and b.program_id=l.program_id
   where sm.id=new.semester_id) then raise exception 'Course pair must belong to the same school, program and level'; end if;
 return new;
end $$;
create trigger validate_gradebook_pair before insert or update on public.gradebook_course_pairs
 for each row execute function public.validate_gradebook_pair();

create function public.validate_gradebook() returns trigger language plpgsql set search_path = '' as $$ begin
 if tg_op='UPDATE' and new.section_id <> old.section_id then raise exception 'Gradebook section cannot change'; end if;
 if new.course_pair_id is not null and not exists (
   select 1 from public.sections s join public.courses c on c.id=s.course_id
   join public.gradebook_course_pairs p on p.id=new.course_pair_id and c.id in (p.theory_course_id,p.lab_course_id)
   join public.program_semesters sm on sm.id=p.semester_id
   join public.program_levels l on l.id=sm.level_id and l.school_id=s.school_id and l.program_id=c.program_id
   left join public.cohorts h on h.id=s.cohort_id
   where s.id=new.section_id and (h.level_id is null or h.level_id=l.id)
 ) then raise exception 'Section does not match gradebook course pair'; end if;
 return new;
end $$;
create trigger validate_gradebook before insert or update on public.gradebooks
 for each row execute function public.validate_gradebook();

-- Only current Semester 1 catalog data is seeded. More semesters are rows, never code branches.
insert into public.program_semesters(level_id,semester_number,semester_name)
 select distinct l.id,1,'Semester 1' from public.program_levels l
 join public.courses t on t.school_id=l.school_id and t.program_id=l.program_id
 join public.courses b on b.school_id=l.school_id and b.program_id=l.program_id
 where (l.level_code='L1' and t.course_code='WLD 105' and b.course_code='WLD 110')
 or (l.level_code='L2' and t.course_code='WLD 205' and b.course_code='WLD 210');
insert into public.gradebook_course_pairs(semester_id,pair_name,theory_course_id,lab_course_id)
 select sm.id,t.course_code||' / '||b.course_code,t.id,b.id
 from public.program_semesters sm join public.program_levels l on l.id=sm.level_id
 join public.courses t on t.school_id=l.school_id and t.program_id=l.program_id
 join public.courses b on b.school_id=l.school_id and b.program_id=l.program_id
 where (l.level_code='L1' and t.course_code='WLD 105' and b.course_code='WLD 110')
 or (l.level_code='L2' and t.course_code='WLD 205' and b.course_code='WLD 210');

create function public.initialize_section_gradebook() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_book uuid; v_pair uuid;
begin
 if new.status <> 'active' then return new; end if;
 select (array_agg(p.id))[1] into v_pair from public.gradebook_course_pairs p
 join public.program_semesters sm on sm.id=p.semester_id
 join public.program_levels l on l.id=sm.level_id and l.school_id=new.school_id
 left join public.cohorts h on h.id=new.cohort_id
 where new.course_id in (p.theory_course_id,p.lab_course_id)
 and (h.level_id is null or h.level_id=l.id) having count(*)=1;
 insert into public.gradebooks(section_id,course_pair_id) values(new.id,v_pair)
 on conflict(section_id) do nothing;
 return new;
end $$;
revoke all on function public.initialize_section_gradebook() from public,anon,authenticated;
create trigger initialize_section_gradebook after insert or update of status on public.sections
 for each row execute function public.initialize_section_gradebook();
insert into public.gradebooks(section_id,course_pair_id)
 select s.id,(select (array_agg(p.id))[1] from public.gradebook_course_pairs p
   join public.program_semesters sm on sm.id=p.semester_id
   join public.program_levels l on l.id=sm.level_id and l.school_id=s.school_id
   left join public.cohorts h on h.id=s.cohort_id
   where s.course_id in(p.theory_course_id,p.lab_course_id) and (h.level_id is null or h.level_id=l.id)
   having count(*)=1)
 from public.sections s where s.status='active';

-- Enrollment is shared identity data; attendance_records/sessions never participate.
create view public.gradebook_enrollment_source with(security_invoker=true) as
 select distinct g.id gradebook_id,st.id student_id,st.display_name,st.external_student_id,
   (e.active and st.active and p.active) active
 from public.gradebooks g join public.sections s on s.id=g.section_id
 join public.attendance_pairs p on s.id in(p.primary_section_id,p.completion_section_id) and p.school_id=s.school_id
 join public.attendance_pair_enrollments e on e.pair_id=p.id and e.school_id=p.school_id
 join public.attendance_students st on st.id=e.student_id and st.school_id=s.school_id;
revoke all on public.gradebook_enrollment_source from anon,authenticated;
grant select on public.gradebook_enrollment_source to authenticated;

-- Refresh is intentionally separate from live submission and attendance transactions.
-- It is safe to repeat, and imports only stable linked student UUIDs within the roster.
create function public.refresh_gradebook(p_gradebook_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_section uuid; v_theory boolean; v_imported integer := 0; v_unresolved integer := 0;
begin
 if not public.can_access_gradebook(p_gradebook_id) then raise exception 'Gradebook access denied' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_gradebook_id::text,0));
 select g.section_id,coalesce(s.course_id=p.theory_course_id,false) into v_section,v_theory
 from public.gradebooks g join public.sections s on s.id=g.section_id
 left join public.gradebook_course_pairs p on p.id=g.course_pair_id where g.id=p_gradebook_id;
 insert into public.gradebook_students(gradebook_id,student_id,active)
 select gradebook_id,student_id,bool_or(active) from public.gradebook_enrollment_source
 where gradebook_id=p_gradebook_id group by gradebook_id,student_id
 on conflict(gradebook_id,student_id) do update set active=excluded.active,last_synced_at=now();
 update public.gradebook_students gs set active=false,last_synced_at=now()
 where gs.gradebook_id=p_gradebook_id and gs.active and not exists (
   select 1 from public.gradebook_enrollment_source e where e.gradebook_id=gs.gradebook_id and e.student_id=gs.student_id and e.active);
 insert into public.gradebook_statuses(gradebook_id,code,label,requires_score)
 values(p_gradebook_id,'graded','Graded',true),(p_gradebook_id,'ungraded','Ungraded',false),
 (p_gradebook_id,'missing','Missing',false),(p_gradebook_id,'excused','Excused',false)
 on conflict do nothing;
 if v_theory then
   insert into public.gradebook_categories(gradebook_id,code,label)
   values(p_gradebook_id,'theory_assessments','Theory assessments') on conflict do nothing;
   insert into public.gradebook_items(gradebook_id,category_id,title,assessment_slug)
   select distinct p_gradebook_id,c.id,m.title,m.slug from public.classroom_sessions cs
   join public.assessment_modules m on m.slug=cs.assessment_slug
   join public.gradebook_categories c on c.gradebook_id=p_gradebook_id and c.code='theory_assessments'
   where cs.section_id=v_section on conflict(gradebook_id,assessment_slug) do nothing;
   with added as (
     insert into public.gradebook_attempts(gradebook_id,item_id,student_id,attempted_at,source_submission_id)
     select p_gradebook_id,i.id,sub.student_uuid,sub.submitted_at,sub.id
     from public.classroom_submissions sub join public.classroom_sessions cs on cs.id=sub.classroom_session_id
     join public.sections s on s.id=cs.section_id and s.school_id=cs.school_id
     join public.gradebook_items i on i.gradebook_id=p_gradebook_id and i.assessment_slug=cs.assessment_slug
     join public.gradebook_students gs on gs.gradebook_id=p_gradebook_id and gs.student_id=sub.student_uuid
     where cs.section_id=v_section and sub.possible_score>0 and sub.score between 0 and sub.possible_score
     on conflict(source_submission_id) do nothing returning *
   )
   insert into public.gradebook_revisions(gradebook_id,attempt_id,status_code,status_label,score,possible_score,note,recorded_by)
   select p_gradebook_id,a.id,'graded','Graded',sub.score,sub.possible_score,'Imported classroom assessment',auth.uid()
   from added a join public.classroom_submissions sub on sub.id=a.source_submission_id;
   get diagnostics v_imported = row_count;
   select count(*) into v_unresolved from public.classroom_submissions sub
   join public.classroom_sessions cs on cs.id=sub.classroom_session_id
   where cs.section_id=v_section and not exists(select 1 from public.gradebook_attempts a where a.source_submission_id=sub.id);
 end if;
 return jsonb_build_object('imported',v_imported,'unresolved',v_unresolved);
end $$;
revoke all on function public.refresh_gradebook(uuid) from public,anon;
grant execute on function public.refresh_gradebook(uuid) to authenticated;

create function public.record_gradebook_attempt(p_gradebook_id uuid,p_item_id uuid,p_student_id uuid,
 p_status_code text,p_score numeric default null,p_possible_score numeric default null,p_note text default '',p_attempt_id uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_attempt uuid; v_status public.gradebook_statuses;
begin
 if not public.can_access_gradebook(p_gradebook_id) then raise exception 'Gradebook access denied' using errcode='42501'; end if;
 select * into v_status from public.gradebook_statuses where gradebook_id=p_gradebook_id and code=p_status_code and active;
 if not found then raise exception 'Choose an active grade status'; end if;
 if v_status.requires_score and (p_score is null or p_possible_score is null) then raise exception 'This status requires a score'; end if;
 if p_attempt_id is null then
   if not exists(select 1 from public.gradebook_students where gradebook_id=p_gradebook_id and student_id=p_student_id and active)
   then raise exception 'Student is not actively enrolled'; end if;
   insert into public.gradebook_attempts(gradebook_id,item_id,student_id) values(p_gradebook_id,p_item_id,p_student_id) returning id into v_attempt;
 else
   select id into v_attempt from public.gradebook_attempts where id=p_attempt_id and gradebook_id=p_gradebook_id
     and item_id=p_item_id and student_id=p_student_id for update;
   if not found then raise exception 'Attempt does not belong to this student and item'; end if;
   if length(trim(coalesce(p_note,'')))=0 then raise exception 'A correction requires a reason'; end if;
 end if;
 insert into public.gradebook_revisions(gradebook_id,attempt_id,status_code,status_label,score,possible_score,note,recorded_by)
 values(p_gradebook_id,v_attempt,p_status_code,v_status.label,p_score,p_possible_score,coalesce(p_note,''),auth.uid());
 return v_attempt;
end $$;
revoke all on function public.record_gradebook_attempt(uuid,uuid,uuid,text,numeric,numeric,text,uuid) from public,anon;
grant execute on function public.record_gradebook_attempt(uuid,uuid,uuid,text,numeric,numeric,text,uuid) to authenticated;

-- Configurable categories/statuses are labels and workflow only: no invented weights or lab rubric.
create function public.configure_gradebook(p_gradebook_id uuid,p_kind text,p_code text,p_label text,
 p_active boolean default true,p_requires_score boolean default false) returns void
language plpgsql security definer set search_path = '' as $$ begin
 if not public.can_access_gradebook(p_gradebook_id) then raise exception 'Gradebook access denied' using errcode='42501'; end if;
 if p_kind='category' then
   insert into public.gradebook_categories(gradebook_id,code,label,active) values(p_gradebook_id,p_code,p_label,p_active)
   on conflict(gradebook_id,code) do update set label=excluded.label,active=excluded.active;
 elsif p_kind='status' then
   if p_code='graded' and (not p_active or not p_requires_score) then raise exception 'Imported graded status must remain score-bearing'; end if;
   insert into public.gradebook_statuses(gradebook_id,code,label,active,requires_score) values(p_gradebook_id,p_code,p_label,p_active,p_requires_score)
   on conflict(gradebook_id,code) do update set label=excluded.label,active=excluded.active,requires_score=excluded.requires_score;
 else raise exception 'Unknown configuration type'; end if;
end $$;
revoke all on function public.configure_gradebook(uuid,text,text,text,boolean,boolean) from public,anon;
grant execute on function public.configure_gradebook(uuid,text,text,text,boolean,boolean) to authenticated;
create function public.create_gradebook_item(p_gradebook_id uuid,p_category_id uuid,p_title text) returns uuid
language plpgsql security definer set search_path = '' as $$ declare v_id uuid; begin
 if not public.can_access_gradebook(p_gradebook_id) then raise exception 'Gradebook access denied' using errcode='42501'; end if;
 if not exists(select 1 from public.gradebook_categories where id=p_category_id and gradebook_id=p_gradebook_id and active)
 then raise exception 'Choose an active category'; end if;
 insert into public.gradebook_items(gradebook_id,category_id,title) values(p_gradebook_id,p_category_id,p_title) returning id into v_id;
 return v_id;
end $$;
revoke all on function public.create_gradebook_item(uuid,uuid,text) from public,anon;
grant execute on function public.create_gradebook_item(uuid,uuid,text) to authenticated;

create view public.gradebook_directory with(security_invoker=true) as
 select g.id,g.section_id,g.course_pair_id,g.created_at,s.section_name,s.status section_status,s.term_id,s.cohort_id,
 c.course_code,c.program_id,pr.name program_name,l.id level_id,l.level_name,sm.id semester_id,sm.semester_number,sm.semester_name,
 p.pair_name,case when c.id=p.theory_course_id then 'theory' when c.id=p.lab_course_id then 'lab' else 'unassigned' end course_role
 from public.gradebooks g join public.sections s on s.id=g.section_id join public.courses c on c.id=s.course_id
 join public.programs pr on pr.id=c.program_id
 left join public.gradebook_course_pairs p on p.id=g.course_pair_id
 left join public.program_semesters sm on sm.id=p.semester_id left join public.program_levels l on l.id=sm.level_id;
create view public.gradebook_latest_attempts with(security_invoker=true) as
 select a.*,r.id revision_id,r.status_code,r.status_label,r.score,r.possible_score,r.note,r.recorded_at,r.recorded_by
 from public.gradebook_attempts a join public.gradebook_revisions r on r.gradebook_id=a.gradebook_id and r.attempt_id=a.id
 where not exists(select 1 from public.gradebook_revisions newer where newer.gradebook_id=r.gradebook_id and newer.attempt_id=r.attempt_id and newer.id>r.id);
revoke all on public.gradebook_directory,public.gradebook_latest_attempts from anon,authenticated;
grant select on public.gradebook_directory,public.gradebook_latest_attempts to authenticated;

-- Guard history even against accidental service-side updates. Corrections append revisions.
create function public.reject_gradebook_history_mutation() returns trigger language plpgsql set search_path = '' as $$ begin
 raise exception 'Grade history is append-only; record a new revision';
end $$;
create trigger preserve_gradebook_attempts before update or delete on public.gradebook_attempts
 for each row execute function public.reject_gradebook_history_mutation();
create trigger preserve_gradebook_revisions before update or delete on public.gradebook_revisions
 for each row execute function public.reject_gradebook_history_mutation();
revoke all on function public.validate_gradebook_pair(),public.validate_gradebook(),public.reject_gradebook_history_mutation() from public,anon,authenticated;

