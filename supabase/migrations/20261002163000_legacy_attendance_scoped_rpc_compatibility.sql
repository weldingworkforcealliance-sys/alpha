-- Temporary compatibility bridge for browser builds that still call the
-- unscoped attendance RPCs. A successful open records the authenticated
-- user's current section/date. Legacy writes are then routed through the
-- directional section/date-scoped RPCs instead of bypassing them.
begin;

create table if not exists private.attendance_legacy_context (
  user_id uuid primary key,
  session_id uuid not null references public.attendance_sessions(id) on delete cascade,
  section_id uuid not null references public.sections(id) on delete cascade,
  attendance_date date not null,
  opened_at timestamptz not null default now()
);

revoke all on table private.attendance_legacy_context from public, anon, authenticated;

do $$
begin
  if to_regprocedure('private.open_attendance_session_core(uuid,date)') is null then
    if to_regprocedure('public.open_attendance_session(uuid,date)') is null then
      raise exception 'public.open_attendance_session(uuid,date) is missing';
    end if;
    execute 'alter function public.open_attendance_session(uuid,date) rename to open_attendance_session_core';
    execute 'alter function public.open_attendance_session_core(uuid,date) set schema private';
  end if;

  if to_regprocedure('private.set_attendance_record_core(uuid,uuid,text,text,text[],text)') is null then
    if to_regprocedure('public.set_attendance_record(uuid,uuid,text,text,text[],text)') is null then
      raise exception 'public.set_attendance_record(...) is missing';
    end if;
    execute 'alter function public.set_attendance_record(uuid,uuid,text,text,text[],text) rename to set_attendance_record_core';
    execute 'alter function public.set_attendance_record_core(uuid,uuid,text,text,text[],text) set schema private';
  end if;

  if to_regprocedure('private.mark_all_attendance_core(uuid,text)') is null then
    if to_regprocedure('public.mark_all_attendance(uuid,text)') is null then
      raise exception 'public.mark_all_attendance(uuid,text) is missing';
    end if;
    execute 'alter function public.mark_all_attendance(uuid,text) rename to mark_all_attendance_core';
    execute 'alter function public.mark_all_attendance_core(uuid,text) set schema private';
  end if;

  if to_regprocedure('private.reset_attendance_session_core(uuid)') is null then
    if to_regprocedure('public.reset_attendance_session(uuid)') is null then
      raise exception 'public.reset_attendance_session(uuid) is missing';
    end if;
    execute 'alter function public.reset_attendance_session(uuid) rename to reset_attendance_session_core';
    execute 'alter function public.reset_attendance_session_core(uuid) set schema private';
  end if;

  if to_regprocedure('private.finalize_attendance_session_core(uuid,uuid,text)') is null then
    if to_regprocedure('public.finalize_attendance_session(uuid,uuid,text)') is null then
      raise exception 'public.finalize_attendance_session(uuid,uuid,text) is missing';
    end if;
    execute 'alter function public.finalize_attendance_session(uuid,uuid,text) rename to finalize_attendance_session_core';
    execute 'alter function public.finalize_attendance_session_core(uuid,uuid,text) set schema private';
  end if;
end;
$$;

revoke all on function private.open_attendance_session_core(uuid,date) from public, anon, authenticated;
revoke all on function private.set_attendance_record_core(uuid,uuid,text,text,text[],text) from public, anon, authenticated;
revoke all on function private.mark_all_attendance_core(uuid,text) from public, anon, authenticated;
revoke all on function private.reset_attendance_session_core(uuid) from public, anon, authenticated;
revoke all on function private.finalize_attendance_session_core(uuid,uuid,text) from public, anon, authenticated;

create or replace function private.get_legacy_attendance_scope(p_session_id uuid)
returns table(section_id uuid, attendance_date date)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  select ctx.section_id, ctx.attendance_date
  from private.attendance_legacy_context ctx
  join public.attendance_sessions ses on ses.id = ctx.session_id
  join public.attendance_pairs pair on pair.id = ses.pair_id
  where ctx.user_id = auth.uid()
    and ctx.session_id = p_session_id
    and ctx.opened_at >= now() - interval '12 hours'
    and ctx.attendance_date = ses.attendance_date
    and pair.active = true
    and ctx.section_id in (pair.primary_section_id, pair.completion_section_id);

  if not found then
    raise exception 'Attendance class or date changed. Refresh attendance before saving.';
  end if;
end;
$$;

revoke all on function private.get_legacy_attendance_scope(uuid) from public, anon, authenticated;

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
  v_session_id uuid;
  v_pair_id uuid;
  v_pair_name text;
  v_attendance_mode text;
  v_is_completion_section boolean;
  v_finalized boolean;
begin
  select opened.session_id,
         opened.pair_id,
         opened.pair_name,
         opened.attendance_mode,
         opened.is_completion_section,
         opened.finalized
    into v_session_id,
         v_pair_id,
         v_pair_name,
         v_attendance_mode,
         v_is_completion_section,
         v_finalized
  from private.open_attendance_session_core(p_section_id, p_attendance_date) opened;

  if v_session_id is null then
    raise exception 'Attendance session could not be opened';
  end if;

  if auth.uid() is not null then
    insert into private.attendance_legacy_context as ctx
      (user_id, session_id, section_id, attendance_date, opened_at)
    values
      (auth.uid(), v_session_id, p_section_id, p_attendance_date, now())
    on conflict (user_id) do update
      set session_id = excluded.session_id,
          section_id = excluded.section_id,
          attendance_date = excluded.attendance_date,
          opened_at = excluded.opened_at;
  end if;

  return query
  select v_session_id,
         v_pair_id,
         v_pair_name,
         v_attendance_mode,
         v_is_completion_section,
         v_finalized;
end;
$$;

create or replace function public.set_section_attendance_record(
  p_session_id uuid,
  p_section_id uuid,
  p_attendance_date date,
  p_student_id uuid,
  p_initial_status text default null,
  p_final_status text default null,
  p_completion_flags text[] default '{}',
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_completion boolean;
  v_record public.attendance_records%rowtype;
begin
  v_completion := private.check_attendance_session_scope(
    p_session_id, p_section_id, p_attendance_date
  );

  select * into v_record
  from public.attendance_records
  where session_id = p_session_id
    and student_id = p_student_id;

  if v_record.id is null then
    raise exception 'Attendance record not found';
  end if;

  if v_completion then
    if v_record.initial_status is null then
      raise exception 'Save attendance in the primary course before completing the paired course';
    end if;
    perform private.set_attendance_record_core(
      p_session_id,
      p_student_id,
      v_record.initial_status,
      p_final_status,
      p_completion_flags,
      p_notes
    );
  else
    perform private.set_attendance_record_core(
      p_session_id,
      p_student_id,
      p_initial_status,
      v_record.final_status,
      v_record.completion_flags,
      v_record.notes
    );
  end if;
end;
$$;

create or replace function public.mark_all_section_attendance(
  p_session_id uuid,
  p_section_id uuid,
  p_attendance_date date,
  p_status text default 'present'
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.check_attendance_session_scope(
    p_session_id, p_section_id, p_attendance_date
  ) then
    raise exception 'Initial attendance must be saved in the primary course';
  end if;

  return private.mark_all_attendance_core(p_session_id, p_status);
end;
$$;

create or replace function public.reset_section_attendance(
  p_session_id uuid,
  p_section_id uuid,
  p_attendance_date date
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.check_attendance_session_scope(
    p_session_id, p_section_id, p_attendance_date
  ) then
    raise exception 'Initial attendance can only be reset in the primary course';
  end if;

  return private.reset_attendance_session_core(p_session_id);
end;
$$;

create or replace function public.finalize_section_attendance(
  p_session_id uuid,
  p_section_id uuid,
  p_attendance_date date,
  p_general_notes text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.check_attendance_session_scope(
    p_session_id, p_section_id, p_attendance_date
  ) then
    raise exception 'Attendance is finalized at the end of the configured completion course';
  end if;

  perform private.finalize_attendance_session_core(
    p_session_id, p_section_id, p_general_notes
  );
end;
$$;

create or replace function public.set_attendance_record(
  p_session_id uuid,
  p_student_id uuid,
  p_initial_status text default null,
  p_final_status text default null,
  p_completion_flags text[] default '{}',
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_section_id uuid;
  v_attendance_date date;
begin
  if coalesce(auth.role(), '') = 'service_role' then
    perform private.set_attendance_record_core(
      p_session_id,
      p_student_id,
      p_initial_status,
      p_final_status,
      p_completion_flags,
      p_notes
    );
    return;
  end if;

  select scope.section_id, scope.attendance_date
    into v_section_id, v_attendance_date
  from private.get_legacy_attendance_scope(p_session_id) scope;

  perform public.set_section_attendance_record(
    p_session_id,
    v_section_id,
    v_attendance_date,
    p_student_id,
    p_initial_status,
    p_final_status,
    p_completion_flags,
    p_notes
  );
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
  v_section_id uuid;
  v_attendance_date date;
begin
  if coalesce(auth.role(), '') = 'service_role' then
    return private.mark_all_attendance_core(p_session_id, p_status);
  end if;

  select scope.section_id, scope.attendance_date
    into v_section_id, v_attendance_date
  from private.get_legacy_attendance_scope(p_session_id) scope;

  return public.mark_all_section_attendance(
    p_session_id, v_section_id, v_attendance_date, p_status
  );
end;
$$;

create or replace function public.reset_attendance_session(p_session_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_section_id uuid;
  v_attendance_date date;
begin
  if coalesce(auth.role(), '') = 'service_role' then
    return private.reset_attendance_session_core(p_session_id);
  end if;

  select scope.section_id, scope.attendance_date
    into v_section_id, v_attendance_date
  from private.get_legacy_attendance_scope(p_session_id) scope;

  return public.reset_section_attendance(
    p_session_id, v_section_id, v_attendance_date
  );
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
  v_context_section_id uuid;
  v_attendance_date date;
begin
  if coalesce(auth.role(), '') = 'service_role' then
    perform private.finalize_attendance_session_core(
      p_session_id, p_section_id, p_general_notes
    );
    return;
  end if;

  select scope.section_id, scope.attendance_date
    into v_context_section_id, v_attendance_date
  from private.get_legacy_attendance_scope(p_session_id) scope;

  if v_context_section_id is distinct from p_section_id then
    raise exception 'Attendance class or date changed. Refresh attendance before finalizing.';
  end if;

  perform public.finalize_section_attendance(
    p_session_id, p_section_id, v_attendance_date, p_general_notes
  );
end;
$$;

revoke all on function public.open_attendance_session(uuid,date) from public, anon;
revoke all on function public.set_attendance_record(uuid,uuid,text,text,text[],text) from public, anon;
revoke all on function public.mark_all_attendance(uuid,text) from public, anon;
revoke all on function public.reset_attendance_session(uuid) from public, anon;
revoke all on function public.finalize_attendance_session(uuid,uuid,text) from public, anon;
revoke all on function public.set_section_attendance_record(uuid,uuid,date,uuid,text,text,text[],text) from public, anon;
revoke all on function public.mark_all_section_attendance(uuid,uuid,date,text) from public, anon;
revoke all on function public.reset_section_attendance(uuid,uuid,date) from public, anon;
revoke all on function public.finalize_section_attendance(uuid,uuid,date,text) from public, anon;

grant execute on function public.open_attendance_session(uuid,date) to authenticated, service_role;
grant execute on function public.set_attendance_record(uuid,uuid,text,text,text[],text) to authenticated, service_role;
grant execute on function public.mark_all_attendance(uuid,text) to authenticated, service_role;
grant execute on function public.reset_attendance_session(uuid) to authenticated, service_role;
grant execute on function public.finalize_attendance_session(uuid,uuid,text) to authenticated, service_role;
grant execute on function public.set_section_attendance_record(uuid,uuid,date,uuid,text,text,text[],text) to authenticated, service_role;
grant execute on function public.mark_all_section_attendance(uuid,uuid,date,text) to authenticated, service_role;
grant execute on function public.reset_section_attendance(uuid,uuid,date) to authenticated, service_role;
grant execute on function public.finalize_section_attendance(uuid,uuid,date,text) to authenticated, service_role;

commit;