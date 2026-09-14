-- Keep the public demo account-free while bounding anonymous session creation.
-- This is a cost/resource guard, not user identity rate limiting.

begin;

create or replace function public.create_demo_classroom_session(
  p_activity_key text,
  p_title text,
  p_course_code text,
  p_day_number integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_token uuid;
  v_code text;
begin
  perform public.cleanup_demo_classroom_sessions();

  -- Serialize the tiny creation-critical section so parallel anonymous calls
  -- cannot all pass the same count checks at once.
  perform pg_advisory_xact_lock(hashtext('ltg_demo_session_creation'));

  if (
    select count(*)
    from public.demo_classroom_sessions
    where created_at > clock_timestamp() - interval '1 minute'
  ) >= 30 then
    raise exception 'The demo is receiving too many new sessions. Please try again shortly.';
  end if;

  if (
    select count(*)
    from public.demo_classroom_sessions
    where expires_at > clock_timestamp()
  ) >= 200 then
    raise exception 'The demo is temporarily at capacity. Please try again shortly.';
  end if;

  if p_activity_key not in ('preclass_math','blueprint_day1') then
    raise exception 'This demo activity is not available';
  end if;
  if not exists (
    select 1 from public.assessment_modules
    where slug=p_activity_key and active
  ) then
    raise exception 'This demo activity is not configured';
  end if;
  if coalesce(p_day_number,0) < 1 then
    raise exception 'Invalid demo day';
  end if;

  loop
    v_code := upper(substr(encode(extensions.gen_random_bytes(8),'hex'),1,8));
    exit when not exists(
      select 1 from public.demo_classroom_sessions where join_code=v_code
    );
  end loop;

  insert into public.demo_classroom_sessions(
    join_code,activity_key,title,course_code,day_number
  ) values (
    v_code,
    p_activity_key,
    left(coalesce(nullif(trim(p_title),''),'Live Classroom Activity'),180),
    left(coalesce(nullif(trim(p_course_code),''),'DEMO'),40),
    p_day_number
  )
  returning id,instructor_token into v_id,v_token;

  return jsonb_build_object(
    'session_id',v_id,
    'instructor_token',v_token,
    'join_code',v_code,
    'expires_in_minutes',30
  );
end
$$;

revoke all on function public.create_demo_classroom_session(text,text,text,integer)
  from public, anon, authenticated;
grant execute on function public.create_demo_classroom_session(text,text,text,integer)
  to anon, authenticated;

commit;
