-- LTG stabilization: scope instructor attendance mutations to the class pair they
-- are assigned to teach or are actively covering. School instructional management
-- and Platform Owners retain school-wide oversight.

begin;

create schema if not exists private;

create or replace function private.attendance_can_manage_pair(
  p_pair_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user_id is not null and exists (
    select 1
    from public.attendance_pairs ap
    where ap.id = p_pair_id
      and (
        exists (
          select 1
          from public.platform_owners po
          where po.user_id = p_user_id
        )
        or exists (
          select 1
          from public.school_memberships sm
          where sm.school_id = ap.school_id
            and sm.user_id = p_user_id
            and sm.status = 'active'::public.membership_status
            and (
              sm.role in (
                'school_admin'::public.app_school_role,
                'program_lead'::public.app_school_role,
                'lead_instructor'::public.app_school_role
              )
              or (
                sm.role = 'instructor'::public.app_school_role
                and (
                  exists (
                    select 1
                    from public.section_instructors si
                    where si.school_id = ap.school_id
                      and si.instructor_id = p_user_id
                      and si.active = true
                      and si.section_id in (ap.primary_section_id, ap.completion_section_id)
                  )
                  or exists (
                    select 1
                    from public.planner_day_delivery pdd
                    where pdd.school_id = ap.school_id
                      and pdd.instructor_id = p_user_id
                      and pdd.delivery_status in ('in_progress','started')
                      and pdd.section_id in (ap.primary_section_id, ap.completion_section_id)
                  )
                )
              )
            )
        )
      )
  );
$$;

revoke all on function private.attendance_can_manage_pair(uuid, uuid)
  from public, anon, authenticated;
grant execute on function private.attendance_can_manage_pair(uuid, uuid)
  to service_role;

create or replace function public.open_attendance_session(
  p_section_id uuid,
  p_attendance_date date default current_date
)
returns table(
  session_id uuid,
  pair_id uuid,
  pair_name text,
  attendance_mode text,
  is_completion_section boolean,
  finalized boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pair public.attendance_pairs%rowtype;
  v_session_id uuid;
  v_status text;
  v_calendar_start date;
  v_calendar_end date;
begin
  select * into v_pair
  from public.attendance_pairs
  where active = true
    and (primary_section_id = p_section_id or completion_section_id = p_section_id)
  order by created_at
  limit 1;

  if v_pair.id is null then
    raise exception 'No attendance pair is configured for this section';
  end if;

  if not private.attendance_can_manage_pair(v_pair.id, auth.uid()) then
    raise exception 'Assigned instructor, active coverage, or school management access required';
  end if;

  select sc.start_date, sc.end_date
    into v_calendar_start, v_calendar_end
  from public.section_calendars sc
  where sc.section_id = p_section_id
  order by sc.created_at desc
  limit 1;

  if v_calendar_start is not null and p_attendance_date < v_calendar_start then
    raise exception 'Attendance cannot be opened before the class start date (%)', v_calendar_start;
  end if;

  if v_calendar_end is not null and p_attendance_date > v_calendar_end then
    raise exception 'Attendance cannot be opened after the class end date (%)', v_calendar_end;
  end if;

  insert into public.attendance_sessions as ses
    (school_id,pair_id,attendance_date,attendance_mode,status,taken_at,taken_by,report_recipient)
  values
    (v_pair.school_id,v_pair.id,p_attendance_date,v_pair.attendance_mode,'draft',now(),auth.uid(),v_pair.report_email)
  on conflict on constraint attendance_sessions_pair_id_attendance_date_key
  do update set updated_at = now()
  returning ses.id,ses.status into v_session_id,v_status;

  if v_status <> 'finalized' then
    insert into public.attendance_records (school_id,session_id,student_id)
    select e.school_id,v_session_id,e.student_id
    from public.attendance_pair_enrollments e
    join public.attendance_students stu on stu.id=e.student_id
    where e.pair_id=v_pair.id
      and e.active=true
      and stu.active=true
      and e.created_at::date <= p_attendance_date
    on conflict on constraint attendance_records_session_id_student_id_key do nothing;

    update public.attendance_records ar
    set completion_confirmed=false
    where ar.session_id=v_session_id
      and ar.initial_status is null
      and not exists (
        select 1
        from public.attendance_pair_enrollments e
        join public.attendance_students stu on stu.id=e.student_id
        where e.pair_id=v_pair.id
          and e.student_id=ar.student_id
          and e.active=true
          and stu.active=true
          and e.created_at::date <= p_attendance_date
      );
  end if;

  return query select
    v_session_id,
    v_pair.id,
    v_pair.pair_name,
    v_pair.attendance_mode,
    p_section_id=v_pair.completion_section_id,
    v_status='finalized';
end;
$$;

create or replace function public.attendance_completion_requirement(
  p_section_id uuid,
  p_attendance_date date default current_date
)
returns table(
  attendance_required boolean,
  pair_id uuid,
  session_id uuid,
  finalized boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pair public.attendance_pairs%rowtype;
  v_session_id uuid;
  v_status text;
begin
  select * into v_pair
  from public.attendance_pairs
  where active=true
    and completion_section_id=p_section_id
  order by created_at
  limit 1;

  if v_pair.id is null then
    return query select false,null::uuid,null::uuid,true;
    return;
  end if;

  if not private.attendance_can_manage_pair(v_pair.id, auth.uid()) then
    raise exception 'Assigned instructor, active coverage, or school management access required';
  end if;

  select id,status into v_session_id,v_status
  from public.attendance_sessions
  where pair_id=v_pair.id
    and attendance_date=p_attendance_date;

  return query select true,v_pair.id,v_session_id,coalesce(v_status='finalized',false);
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
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_school_id uuid;
  v_status text;
  v_pair_id uuid;
begin
  select school_id,status,pair_id into v_school_id,v_status,v_pair_id
  from public.attendance_sessions
  where id=p_session_id;

  if v_school_id is null then raise exception 'Attendance session not found'; end if;
  if not private.attendance_can_manage_pair(v_pair_id, auth.uid()) then
    raise exception 'Assigned instructor, active coverage, or school management access required';
  end if;
  if v_status='finalized' then raise exception 'Finalized attendance cannot be edited from the instructor screen'; end if;

  if not exists (
    select 1
    from public.attendance_pair_enrollments e
    join public.attendance_students stu on stu.id=e.student_id
    where e.pair_id=v_pair_id
      and e.student_id=p_student_id
      and e.active=true
      and stu.active=true
  ) then
    raise exception 'Student is not active in this attendance pair';
  end if;

  if p_initial_status is not null and p_initial_status not in ('present','absent','late','excused') then
    raise exception 'Unsupported initial attendance status';
  end if;
  if p_final_status is not null and p_final_status not in ('present','absent','late','excused','left_early','partial') then
    raise exception 'Unsupported final attendance status';
  end if;
  if not coalesce(p_completion_flags,'{}'::text[]) <@ array['unprepared','left_early','disappeared','other']::text[] then
    raise exception 'Unsupported completion flag';
  end if;

  update public.attendance_records
  set initial_status=p_initial_status,
      final_status=p_final_status,
      completion_flags=coalesce(p_completion_flags,'{}'::text[]),
      notes=nullif(btrim(coalesce(p_notes,'')),''),
      updated_by=auth.uid()
  where session_id=p_session_id
    and student_id=p_student_id;

  if not found then raise exception 'Attendance record not found'; end if;
end;
$$;

create or replace function public.mark_all_attendance(
  p_session_id uuid,
  p_status text default 'present'
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_school_id uuid;
  v_session_status text;
  v_pair_id uuid;
  v_count integer;
begin
  select school_id,status,pair_id into v_school_id,v_session_status,v_pair_id
  from public.attendance_sessions
  where id=p_session_id;

  if v_school_id is null then raise exception 'Attendance session not found'; end if;
  if not private.attendance_can_manage_pair(v_pair_id, auth.uid()) then
    raise exception 'Assigned instructor, active coverage, or school management access required';
  end if;
  if v_session_status='finalized' then raise exception 'Finalized attendance cannot be edited'; end if;
  if p_status not in ('present','absent','late','excused') then raise exception 'Unsupported attendance status'; end if;

  update public.attendance_records ar
  set initial_status=p_status,
      updated_by=auth.uid()
  where ar.session_id=p_session_id
    and exists (
      select 1
      from public.attendance_pair_enrollments e
      join public.attendance_students stu on stu.id=e.student_id
      where e.pair_id=v_pair_id
        and e.student_id=ar.student_id
        and e.active=true
        and stu.active=true
    );
  get diagnostics v_count=row_count;
  return v_count;
end;
$$;

create or replace function public.reset_attendance_session(
  p_session_id uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.attendance_sessions%rowtype;
  v_count integer := 0;
begin
  select * into v_session
  from public.attendance_sessions
  where id = p_session_id
  for update;

  if v_session.id is null then raise exception 'Attendance session not found'; end if;
  if not private.attendance_can_manage_pair(v_session.pair_id, auth.uid()) then
    raise exception 'Assigned instructor, active coverage, or school management access required';
  end if;
  if v_session.status = 'finalized' then
    raise exception 'Finalized attendance cannot be reset from the instructor screen';
  end if;

  if exists (
    select 1
    from public.attendance_report_queue q
    where q.session_id = p_session_id
      and q.status = 'sent'
  ) then
    raise exception 'Attendance cannot be reset after a report has been sent';
  end if;

  update public.attendance_records
  set initial_status = null,
      final_status = null,
      completion_flags = '{}'::text[],
      completion_confirmed = false,
      notes = null,
      updated_by = auth.uid(),
      updated_at = now()
  where session_id = p_session_id;
  get diagnostics v_count = row_count;

  update public.attendance_sessions
  set instructor_notes = null,
      updated_at = now()
  where id = p_session_id;

  delete from public.attendance_report_queue
  where session_id = p_session_id
    and status in ('pending','failed');

  perform public.write_audit_event(
    v_session.school_id,
    'attendance_reset',
    'attendance_session',
    p_session_id,
    jsonb_build_object(
      'pair_id', v_session.pair_id,
      'attendance_date', v_session.attendance_date,
      'records_cleared', v_count,
      'status', 'draft'
    )
  );

  return v_count;
end;
$$;

create or replace function public.finalize_attendance_session(
  p_session_id uuid,
  p_section_id uuid,
  p_general_notes text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.attendance_sessions%rowtype;
  v_pair public.attendance_pairs%rowtype;
  v_missing integer;
  v_removed integer:=0;
begin
  select * into v_session
  from public.attendance_sessions
  where id=p_session_id
  for update;
  if v_session.id is null then raise exception 'Attendance session not found'; end if;

  select * into v_pair
  from public.attendance_pairs
  where id=v_session.pair_id;
  if v_pair.id is null then raise exception 'Attendance pair not found'; end if;

  if p_section_id<>v_pair.completion_section_id then
    raise exception 'Attendance is finalized at the end of the configured completion course';
  end if;
  if not private.attendance_can_manage_pair(v_pair.id, auth.uid()) then
    raise exception 'Assigned instructor, active coverage, or school management access required';
  end if;
  if v_session.status='finalized' then return; end if;

  select count(*) into v_missing
  from public.attendance_pair_enrollments e
  join public.attendance_students stu on stu.id=e.student_id and stu.active=true
  left join public.attendance_records ar on ar.session_id=p_session_id and ar.student_id=e.student_id
  where e.pair_id=v_pair.id
    and e.active=true
    and e.created_at::date <= v_session.attendance_date
    and (ar.id is null or ar.initial_status is null);

  if v_missing>0 then
    raise exception 'Attendance status is required for every student enrolled by the attendance date before finalizing';
  end if;

  delete from public.attendance_records ar
  where ar.session_id=p_session_id
    and ar.initial_status is null
    and not exists (
      select 1
      from public.attendance_pair_enrollments e
      join public.attendance_students stu on stu.id=e.student_id
      where e.pair_id=v_pair.id
        and e.student_id=ar.student_id
        and e.active=true
        and stu.active=true
        and e.created_at::date <= v_session.attendance_date
    );
  get diagnostics v_removed=row_count;

  update public.attendance_records ar
  set final_status=coalesce(ar.final_status,ar.initial_status),
      completion_confirmed=true,
      updated_by=auth.uid()
  where ar.session_id=p_session_id
    and ar.initial_status is not null;

  update public.attendance_sessions
  set status='finalized',
      finalized_at=now(),
      finalized_by=auth.uid(),
      instructor_notes=nullif(btrim(coalesce(p_general_notes,'')),''),
      report_recipient=coalesce(report_recipient,v_pair.report_email)
  where id=p_session_id;

  if v_pair.attendance_mode='pvhs' then
    if nullif(btrim(coalesce(v_pair.report_email,'')),'') is null then
      raise exception 'PVHS report email is not configured';
    end if;

    insert into public.attendance_report_queue
      (school_id,session_id,recipient_email,run_after,status)
    values
      (v_session.school_id,p_session_id,v_pair.report_email,now()+make_interval(mins=>v_pair.report_delay_minutes),'pending')
    on conflict (session_id) do update
      set recipient_email=excluded.recipient_email,
          run_after=excluded.run_after,
          status=case when public.attendance_report_queue.status='sent' then 'sent' else 'pending' end,
          last_error=null;
  end if;

  perform public.write_audit_event(
    v_session.school_id,
    'attendance_finalized',
    'attendance_session',
    p_session_id,
    jsonb_build_object(
      'pair_id',v_pair.id,
      'attendance_date',v_session.attendance_date,
      'mode',v_pair.attendance_mode,
      'report_queued',v_pair.attendance_mode='pvhs',
      'stale_roster_rows_removed',v_removed
    )
  );
end;
$$;

revoke all on function public.open_attendance_session(uuid,date) from public,anon;
revoke all on function public.attendance_completion_requirement(uuid,date) from public,anon;
revoke all on function public.set_attendance_record(uuid,uuid,text,text,text[],text) from public,anon;
revoke all on function public.mark_all_attendance(uuid,text) from public,anon;
revoke all on function public.reset_attendance_session(uuid) from public,anon;
revoke all on function public.finalize_attendance_session(uuid,uuid,text) from public,anon;

grant execute on function public.open_attendance_session(uuid,date) to authenticated,service_role;
grant execute on function public.attendance_completion_requirement(uuid,date) to authenticated,service_role;
grant execute on function public.set_attendance_record(uuid,uuid,text,text,text[],text) to authenticated,service_role;
grant execute on function public.mark_all_attendance(uuid,text) to authenticated,service_role;
grant execute on function public.reset_attendance_session(uuid) to authenticated,service_role;
grant execute on function public.finalize_attendance_session(uuid,uuid,text) to authenticated,service_role;

commit;
