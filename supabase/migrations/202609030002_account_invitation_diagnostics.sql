create or replace function public.admin_lookup_user_by_email(
  p_school_id uuid,
  p_email text
)
returns jsonb
language plpgsql
security definer
set search_path = 'public'
as $function$
declare
  v_user_id uuid;
  v_email text;
  v_display_name text;
  v_membership_id uuid;
  v_membership_role public.app_school_role;
  v_membership_status public.membership_status;
  v_created_at timestamptz;
  v_invited_at timestamptz;
  v_confirmation_sent_at timestamptz;
  v_email_confirmed_at timestamptz;
  v_confirmed_at timestamptz;
  v_last_sign_in_at timestamptz;
  v_account_stage text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not (
    public.is_platform_owner()
    or public.can_manage_school(p_school_id)
  ) then
    raise exception 'School management access required';
  end if;

  if nullif(trim(p_email), '') is null then
    raise exception 'Email address is required';
  end if;

  select
    au.id,
    au.email,
    au.created_at,
    au.invited_at,
    au.confirmation_sent_at,
    au.email_confirmed_at,
    au.confirmed_at,
    au.last_sign_in_at
  into
    v_user_id,
    v_email,
    v_created_at,
    v_invited_at,
    v_confirmation_sent_at,
    v_email_confirmed_at,
    v_confirmed_at,
    v_last_sign_in_at
  from auth.users au
  where lower(au.email) = lower(trim(p_email))
  limit 1;

  if v_user_id is null then
    return jsonb_build_object(
      'exists', false,
      'account_stage', 'not_created'
    );
  end if;

  select display_name
  into v_display_name
  from public.profiles
  where id = v_user_id;

  select
    sm.id,
    sm.role,
    sm.status
  into
    v_membership_id,
    v_membership_role,
    v_membership_status
  from public.school_memberships sm
  where sm.school_id = p_school_id
    and sm.user_id = v_user_id
  limit 1;

  v_account_stage := case
    when v_last_sign_in_at is not null
      and v_membership_status = 'active'::public.membership_status
      then 'active'
    when v_email_confirmed_at is not null or v_confirmed_at is not null
      then 'email_confirmed'
    when v_confirmation_sent_at is not null
      then 'email_sent'
    else 'account_created'
  end;

  return jsonb_build_object(
    'exists', true,
    'user_id', v_user_id,
    'email', v_email,
    'display_name', v_display_name,
    'membership_exists', v_membership_id is not null,
    'membership_id', v_membership_id,
    'membership_role', v_membership_role,
    'membership_status', v_membership_status,
    'auth_created_at', v_created_at,
    'auth_invited_at', v_invited_at,
    'confirmation_sent_at', v_confirmation_sent_at,
    'email_confirmed_at', v_email_confirmed_at,
    'confirmed_at', v_confirmed_at,
    'last_sign_in_at', v_last_sign_in_at,
    'account_stage', v_account_stage
  );
end;
$function$;

revoke all on function public.admin_lookup_user_by_email(uuid, text) from public;
revoke all on function public.admin_lookup_user_by_email(uuid, text) from anon;
grant execute on function public.admin_lookup_user_by_email(uuid, text) to authenticated;
