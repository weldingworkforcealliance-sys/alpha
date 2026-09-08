-- Complete paired-attendance roster isolation hardening.
-- 1) Draft sessions reconcile only active pair enrollments.
-- 2) Bulk marking and individual edits cannot touch inactive roster rows.
-- 3) Finalization requires every active student, removes stale pair rows, and
--    leaves attendance_records as the immutable finalized roster snapshot used
--    by the delayed PVHS email worker.

create or replace function public.open_attendance_session(
  p_section_id uuid,
  p_attendance_date date default current_date
)
returns table(session_id uuid,pair_id uuid,pair_name text,attendance_mode text,is_completion_section boolean,finalized boolean)
language plpgsql security definer set search_path=''
as $$
declare
  v_pair public.attendance_pairs%rowtype;
  v_session_id uuid;
  v_status text;
begin
  select * into v_pair
  from public.attendance_pairs
  where active=true
    and (primary_section_id=p_section_id or completion_section_id=p_section_id)
  order by created_at limit 1;
  if v_pair.id is null then raise exception 'No attendance pair is configured for this section'; end if;
  if not (public.is_platform_owner() or public.is_school_instructional_staff(v_pair.school_id)) then raise exception 'Active instructional staff access required'; end if;

  insert into public.attendance_sessions as ses
    (school_id,pair_id,attendance_date,attendance_mode,status,taken_at,taken_by,report_recipient)
  values
    (v_pair.school_id,v_pair.id,p_attendance_date,v_pair.attendance_mode,'draft',now(),auth.uid(),v_pair.report_email)
  on conflict on constraint attendance_sessions_pair_id_attendance_date_key
  do update set updated_at=now()
  returning ses.id,ses.status into v_session_id,v_status;

  if v_status<>'finalized' then
    insert into public.attendance_records (school_id,session_id,student_id)
    select e.school_id,v_session_id,e.student_id
    from public.attendance_pair_enrollments e
    join public.attendance_students stu on stu.id=e.student_id
    where e.pair_id=v_pair.id and e.active=true and stu.active=true
    on conflict on constraint attendance_records_session_id_student_id_key do nothing;

    update public.attendance_records ar
    set completion_confirmed=false
    where ar.session_id=v_session_id
      and not exists (
        select 1 from public.attendance_pair_enrollments e
        join public.attendance_students stu on stu.id=e.student_id
        where e.pair_id=v_pair.id and e.student_id=ar.student_id
          and e.active=true and stu.active=true
      );
  end if;

  return query select v_session_id,v_pair.id,v_pair.pair_name,v_pair.attendance_mode,
    p_section_id=v_pair.completion_section_id,v_status='finalized';
end;
$$;

create or replace function public.mark_all_attendance(
  p_session_id uuid,
  p_status text default 'present'
)
returns integer
language plpgsql security definer set search_path=public
as $$
declare
  v_school_id uuid;
  v_session_status text;
  v_pair_id uuid;
  v_count integer;
begin
  select school_id,status,pair_id into v_school_id,v_session_status,v_pair_id
  from public.attendance_sessions where id=p_session_id;
  if v_school_id is null then raise exception 'Attendance session not found'; end if;
  if not (public.is_platform_owner() or public.is_school_instructional_staff(v_school_id)) then raise exception 'Active instructional staff access required'; end if;
  if v_session_status='finalized' then raise exception 'Finalized attendance cannot be edited'; end if;
  if p_status not in ('present','absent','late','excused') then raise exception 'Unsupported attendance status'; end if;

  update public.attendance_records ar
  set initial_status=p_status,updated_by=auth.uid()
  where ar.session_id=p_session_id
    and exists (
      select 1 from public.attendance_pair_enrollments e
      join public.attendance_students stu on stu.id=e.student_id
      where e.pair_id=v_pair_id and e.student_id=ar.student_id
        and e.active=true and stu.active=true
    );
  get diagnostics v_count=row_count;
  return v_count;
end;
$$;

create or replace function public.set_attendance_record(
  p_session_id uuid,
  p_student_id uuid,
  p_initial_status text default null,
  p_final_status text default null,
  p_completion_flags text[] default '{}'::text[],
  p_notes text default null
)
returns void
language plpgsql security definer set search_path=public
as $$
declare
  v_school_id uuid;
  v_status text;
  v_pair_id uuid;
begin
  select school_id,status,pair_id into v_school_id,v_status,v_pair_id
  from public.attendance_sessions where id=p_session_id;
  if v_school_id is null then raise exception 'Attendance session not found'; end if;
  if not (public.is_platform_owner() or public.is_school_instructional_staff(v_school_id)) then raise exception 'Active instructional staff access required'; end if;
  if v_status='finalized' then raise exception 'Finalized attendance cannot be edited from the instructor screen'; end if;
  if not exists (
    select 1 from public.attendance_pair_enrollments e
    join public.attendance_students stu on stu.id=e.student_id
    where e.pair_id=v_pair_id and e.student_id=p_student_id
      and e.active=true and stu.active=true
  ) then raise exception 'Student is not active in this attendance pair'; end if;
  if p_initial_status is not null and p_initial_status not in ('present','absent','late','excused') then raise exception 'Unsupported initial attendance status'; end if;
  if p_final_status is not null and p_final_status not in ('present','absent','late','excused','left_early','partial') then raise exception 'Unsupported final attendance status'; end if;
  if not coalesce(p_completion_flags,'{}'::text[]) <@ array['unprepared','left_early','disappeared','other']::text[] then raise exception 'Unsupported completion flag'; end if;

  update public.attendance_records
  set initial_status=p_initial_status,final_status=p_final_status,
      completion_flags=coalesce(p_completion_flags,'{}'::text[]),
      notes=nullif(btrim(coalesce(p_notes,'')),''),updated_by=auth.uid()
  where session_id=p_session_id and student_id=p_student_id;
  if not found then raise exception 'Attendance record not found'; end if;
end;
$$;

create or replace function public.finalize_attendance_session(
  p_session_id uuid,
  p_section_id uuid,
  p_general_notes text default null
)
returns void
language plpgsql security definer set search_path=public
as $$
declare
  v_session public.attendance_sessions%rowtype;
  v_pair public.attendance_pairs%rowtype;
  v_missing integer;
  v_removed integer:=0;
begin
  select * into v_session from public.attendance_sessions where id=p_session_id for update;
  if v_session.id is null then raise exception 'Attendance session not found'; end if;
  select * into v_pair from public.attendance_pairs where id=v_session.pair_id;
  if v_pair.id is null then raise exception 'Attendance pair not found'; end if;
  if p_section_id<>v_pair.completion_section_id then raise exception 'Attendance is finalized at the end of the configured completion course'; end if;
  if not (public.is_platform_owner() or public.is_school_instructional_staff(v_session.school_id)) then raise exception 'Active instructional staff access required'; end if;
  if v_session.status='finalized' then return; end if;

  select count(*) into v_missing
  from public.attendance_pair_enrollments e
  join public.attendance_students stu on stu.id=e.student_id and stu.active=true
  left join public.attendance_records ar on ar.session_id=p_session_id and ar.student_id=e.student_id
  where e.pair_id=v_pair.id and e.active=true
    and (ar.id is null or ar.initial_status is null);
  if v_missing>0 then raise exception 'Attendance status is required for every active student before finalizing'; end if;

  delete from public.attendance_records ar
  where ar.session_id=p_session_id
    and not exists (
      select 1 from public.attendance_pair_enrollments e
      join public.attendance_students stu on stu.id=e.student_id
      where e.pair_id=v_pair.id and e.student_id=ar.student_id
        and e.active=true and stu.active=true
    );
  get diagnostics v_removed=row_count;

  update public.attendance_records ar
  set final_status=coalesce(ar.final_status,ar.initial_status),completion_confirmed=true,updated_by=auth.uid()
  where ar.session_id=p_session_id and ar.initial_status is not null;

  update public.attendance_sessions
  set status='finalized',finalized_at=now(),finalized_by=auth.uid(),
      instructor_notes=nullif(btrim(coalesce(p_general_notes,'')),''),
      report_recipient=coalesce(report_recipient,v_pair.report_email)
  where id=p_session_id;

  if v_pair.attendance_mode='pvhs' then
    if nullif(btrim(coalesce(v_pair.report_email,'')),'') is null then raise exception 'PVHS report email is not configured'; end if;
    insert into public.attendance_report_queue (school_id,session_id,recipient_email,run_after,status)
    values (v_session.school_id,p_session_id,v_pair.report_email,now()+make_interval(mins=>v_pair.report_delay_minutes),'pending')
    on conflict (session_id) do update
      set recipient_email=excluded.recipient_email,run_after=excluded.run_after,
          status=case when public.attendance_report_queue.status='sent' then 'sent' else 'pending' end,last_error=null;
  end if;

  perform public.write_audit_event(v_session.school_id,'attendance_finalized','attendance_session',p_session_id,
    jsonb_build_object('pair_id',v_pair.id,'attendance_date',v_session.attendance_date,
      'mode',v_pair.attendance_mode,'report_queued',v_pair.attendance_mode='pvhs',
      'stale_roster_rows_removed',v_removed));
end;
$$;

-- Conservative historical cleanup of clearly stale blank rows only.
delete from public.attendance_records ar
using public.attendance_sessions ses
where ses.id=ar.session_id and ses.status='finalized'
  and ar.initial_status is null and ar.final_status is null
  and cardinality(coalesce(ar.completion_flags,'{}'::text[]))=0
  and ar.notes is null
  and not exists (
    select 1 from public.attendance_pair_enrollments e
    join public.attendance_students stu on stu.id=e.student_id
    where e.pair_id=ses.pair_id and e.student_id=ar.student_id
      and e.active=true and stu.active=true
  );