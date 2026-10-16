-- Connections and session ownership must not outlive school authorization.
-- Preserve existing connected/active-session semantics and owner access.
create or replace function public.is_training_session_member(check_training_session_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $function$
  select auth.uid() is not null and exists (
    select 1
    from public.training_session_members tsm
    join public.training_sessions ts on ts.id = tsm.training_session_id
    where tsm.training_session_id = check_training_session_id
      and tsm.user_id = auth.uid()
      and tsm.connected = true
      and ts.status = 'active'
      and (public.is_platform_owner() or public.is_school_member(ts.school_id))
  );
$function$;

create or replace function public.can_manage_training_session(check_training_session_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $function$
  select auth.uid() is not null and (
    public.is_platform_owner()
    or exists (
      select 1 from public.training_sessions ts
      where ts.id = check_training_session_id
        and (
          public.can_manage_school(ts.school_id)
          or (ts.created_by = auth.uid() and public.is_school_member(ts.school_id))
        )
    )
  );
$function$;

