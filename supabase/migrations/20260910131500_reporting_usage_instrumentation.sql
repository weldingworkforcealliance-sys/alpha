-- LTG Reporting & Analytics instrumentation and live-period hardening
-- 2026-09-10

begin;

create index if not exists analytics_events_actor_created_idx
  on public.analytics_events (actor_user_id, created_at desc);

create or replace function public.capture_ltg_table_analytics_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row jsonb := to_jsonb(new);
  v_school_id uuid;
  v_actor_user_id uuid;
  v_session_id uuid;
  v_metadata jsonb;
begin
  if nullif(v_row->>'school_id', '') is not null then
    v_school_id := (v_row->>'school_id')::uuid;
  elsif tg_table_name = 'classroom_submissions'
        and nullif(v_row->>'classroom_session_id', '') is not null then
    v_session_id := (v_row->>'classroom_session_id')::uuid;
    select cs.school_id into v_school_id
    from public.classroom_sessions cs
    where cs.id = v_session_id;
  end if;

  if nullif(v_row->>'instructor_id', '') is not null then
    v_actor_user_id := (v_row->>'instructor_id')::uuid;
  elsif nullif(v_row->>'reviewed_by', '') is not null then
    v_actor_user_id := (v_row->>'reviewed_by')::uuid;
  end if;

  v_metadata := jsonb_build_object(
    'source', 'table_trigger',
    'table', tg_table_name
  );

  if v_row ? 'status' then
    v_metadata := v_metadata || jsonb_build_object('status', v_row->>'status');
  end if;

  if v_row ? 'assessment_slug' then
    v_metadata := v_metadata || jsonb_build_object('assessment_slug', v_row->>'assessment_slug');
  end if;

  insert into public.analytics_events (
    school_id,
    actor_user_id,
    event_type,
    entity_type,
    entity_id,
    data_scope,
    metadata,
    created_at
  ) values (
    v_school_id,
    v_actor_user_id,
    tg_argv[0],
    tg_table_name,
    new.id,
    'usage',
    v_metadata,
    coalesce(
      case
        when nullif(v_row->>'submitted_at', '') is not null then (v_row->>'submitted_at')::timestamptz
        when nullif(v_row->>'started_at', '') is not null then (v_row->>'started_at')::timestamptz
        when nullif(v_row->>'created_at', '') is not null then (v_row->>'created_at')::timestamptz
        else null
      end,
      now()
    )
  );

  return new;
end;
$$;

revoke all on function public.capture_ltg_table_analytics_event() from public, anon, authenticated;

drop trigger if exists trg_analytics_classroom_session_started on public.classroom_sessions;
create trigger trg_analytics_classroom_session_started
after insert on public.classroom_sessions
for each row execute function public.capture_ltg_table_analytics_event('live_classroom_session_started');

drop trigger if exists trg_analytics_classroom_submission on public.classroom_submissions;
create trigger trg_analytics_classroom_submission
after insert on public.classroom_submissions
for each row execute function public.capture_ltg_table_analytics_event('live_classroom_submission');

drop trigger if exists trg_analytics_job_card_session_started on public.job_card_sessions;
create trigger trg_analytics_job_card_session_started
after insert on public.job_card_sessions
for each row execute function public.capture_ltg_table_analytics_event('job_card_session_started');

drop trigger if exists trg_analytics_job_card_submission on public.job_card_submissions;
create trigger trg_analytics_job_card_submission
after insert on public.job_card_submissions
for each row execute function public.capture_ltg_table_analytics_event('job_card_submission');

drop trigger if exists trg_analytics_instructor_note on public.instructor_notes;
create trigger trg_analytics_instructor_note
after insert on public.instructor_notes
for each row execute function public.capture_ltg_table_analytics_event('instructor_note_saved');

-- Backfill module usage events that predate these triggers. These events are
-- intentionally minimal and exclude student names, answer bodies, and note text.
insert into public.analytics_events (
  school_id, actor_user_id, event_type, entity_type, entity_id, data_scope, metadata, created_at
)
select cs.school_id, cs.instructor_id, 'live_classroom_session_started', 'classroom_sessions', cs.id,
       'usage', jsonb_build_object('source','historical_backfill','assessment_slug',cs.assessment_slug), cs.started_at
from public.classroom_sessions cs
where not exists (
  select 1 from public.analytics_events e
  where e.event_type='live_classroom_session_started' and e.entity_type='classroom_sessions' and e.entity_id=cs.id
);

insert into public.analytics_events (
  school_id, actor_user_id, event_type, entity_type, entity_id, data_scope, metadata, created_at
)
select cs.school_id, null, 'live_classroom_submission', 'classroom_submissions', sub.id,
       'usage', jsonb_build_object('source','historical_backfill'), sub.submitted_at
from public.classroom_submissions sub
join public.classroom_sessions cs on cs.id=sub.classroom_session_id
where not exists (
  select 1 from public.analytics_events e
  where e.event_type='live_classroom_submission' and e.entity_type='classroom_submissions' and e.entity_id=sub.id
);

insert into public.analytics_events (
  school_id, actor_user_id, event_type, entity_type, entity_id, data_scope, metadata, created_at
)
select js.school_id, js.instructor_id, 'job_card_session_started', 'job_card_sessions', js.id,
       'usage', jsonb_build_object('source','historical_backfill'), js.started_at
from public.job_card_sessions js
where not exists (
  select 1 from public.analytics_events e
  where e.event_type='job_card_session_started' and e.entity_type='job_card_sessions' and e.entity_id=js.id
);

insert into public.analytics_events (
  school_id, actor_user_id, event_type, entity_type, entity_id, data_scope, metadata, created_at
)
select sub.school_id, null, 'job_card_submission', 'job_card_submissions', sub.id,
       'usage', jsonb_build_object('source','historical_backfill'), sub.submitted_at
from public.job_card_submissions sub
where not exists (
  select 1 from public.analytics_events e
  where e.event_type='job_card_submission' and e.entity_type='job_card_submissions' and e.entity_id=sub.id
);

insert into public.analytics_events (
  school_id, actor_user_id, event_type, entity_type, entity_id, data_scope, metadata, created_at
)
select n.school_id, n.instructor_id, 'instructor_note_saved', 'instructor_notes', n.id,
       'usage', jsonb_build_object('source','historical_backfill','note_type',n.note_type), n.created_at
from public.instructor_notes n
where not exists (
  select 1 from public.analytics_events e
  where e.event_type='instructor_note_saved' and e.entity_type='instructor_notes' and e.entity_id=n.id
);

create or replace function public.track_ltg_page_view(p_path text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_school_id uuid;
  v_membership_count integer;
begin
  if v_user_id is null then
    return;
  end if;

  if p_path is null or length(p_path) > 240 or p_path !~ '^/' then
    return;
  end if;

  select count(distinct sm.school_id), min(sm.school_id)
    into v_membership_count, v_school_id
  from public.school_memberships sm
  where sm.user_id = v_user_id
    and sm.status = 'active';

  if v_membership_count <> 1 then
    v_school_id := null;
  end if;

  insert into public.analytics_events (
    school_id,
    actor_user_id,
    event_type,
    entity_type,
    entity_id,
    data_scope,
    metadata
  ) values (
    v_school_id,
    v_user_id,
    'page_view',
    'route',
    null,
    'usage',
    jsonb_build_object('path', p_path, 'source', 'web_app')
  );
end;
$$;

revoke all on function public.track_ltg_page_view(text) from public, anon;
grant execute on function public.track_ltg_page_view(text) to authenticated;

-- Harden the authenticated wrapper so in-progress weekly/monthly/quarterly/yearly
-- views only treat instructional days through today as due. It also adds real
-- analytics-event counts to the usage block.
create or replace function public.get_ltg_reporting_summary(
  p_school_id uuid,
  p_start_date date,
  p_end_date date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_summary jsonb;
  v_timezone text;
  v_effective_end date;
  v_due_scheduled integer := 0;
  v_missing_due integer := 0;
  v_analytics_events integer := 0;
  v_page_views integer := 0;
  v_live_classroom_events integer := 0;
  v_job_card_events integer := 0;
begin
  if not public.can_view_ltg_reports(p_school_id) then
    raise exception 'Not authorized to view this school report.';
  end if;

  v_summary := public.ltg_reporting_summary_internal(p_school_id, p_start_date, p_end_date);
  v_timezone := coalesce(v_summary->>'timezone', 'America/New_York');
  v_effective_end := least(p_end_date, (now() at time zone v_timezone)::date);

  select count(*) into v_due_scheduled
  from public.planner_days pd
  where pd.school_id = p_school_id
    and pd.scheduled_date between p_start_date and v_effective_end;

  select count(*) into v_missing_due
  from public.planner_days pd
  where pd.school_id = p_school_id
    and pd.scheduled_date between p_start_date and v_effective_end
    and not exists (
      select 1
      from public.planner_day_delivery dd
      where dd.planner_day_id = pd.id
        and dd.delivery_status = 'completed'
    );

  select
    count(*),
    count(*) filter (where e.event_type = 'page_view'),
    count(*) filter (where e.event_type like 'live_classroom_%'),
    count(*) filter (where e.event_type like 'job_card_%')
  into v_analytics_events, v_page_views, v_live_classroom_events, v_job_card_events
  from public.analytics_events e
  where e.school_id = p_school_id
    and (e.created_at at time zone v_timezone)::date between p_start_date and v_effective_end;

  v_summary := jsonb_set(v_summary, '{instruction,scheduled_days}', to_jsonb(v_due_scheduled), true);
  v_summary := jsonb_set(v_summary, '{instruction,missing_completed_days}', to_jsonb(v_missing_due), true);
  v_summary := jsonb_set(v_summary, '{data_quality,scheduled_days_without_completion}', to_jsonb(v_missing_due), true);
  v_summary := jsonb_set(
    v_summary,
    '{usage}',
    coalesce(v_summary->'usage', '{}'::jsonb) || jsonb_build_object(
      'analytics_events', v_analytics_events,
      'page_views', v_page_views,
      'live_classroom_events', v_live_classroom_events,
      'job_card_events', v_job_card_events
    ),
    true
  );
  v_summary := jsonb_set(v_summary, '{period,effective_end}', to_jsonb(v_effective_end), true);

  return v_summary;
end;
$$;

revoke all on function public.get_ltg_reporting_summary(uuid, date, date) from public, anon;
grant execute on function public.get_ltg_reporting_summary(uuid, date, date) to authenticated;

create or replace function public.get_ltg_platform_reporting_summary(
  p_start_date date,
  p_end_date date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_schools jsonb;
begin
  if not public.is_platform_owner() then
    raise exception 'Platform owner access required.';
  end if;

  if p_start_date is null or p_end_date is null or p_end_date < p_start_date then
    raise exception 'Invalid reporting period.';
  end if;

  select coalesce(
    jsonb_agg(public.get_ltg_reporting_summary(s.id, p_start_date, p_end_date) order by s.name),
    '[]'::jsonb
  )
  into v_schools
  from public.schools s
  where coalesce(s.status, 'active') <> 'archived';

  return jsonb_build_object(
    'scope', 'platform',
    'period', jsonb_build_object('start', p_start_date, 'end', p_end_date),
    'school_count', jsonb_array_length(v_schools),
    'schools', v_schools
  );
end;
$$;

revoke all on function public.get_ltg_platform_reporting_summary(date, date) from public, anon;
grant execute on function public.get_ltg_platform_reporting_summary(date, date) to authenticated;

create or replace function public.generate_ltg_report_snapshot(
  p_school_id uuid,
  p_period_type text,
  p_period_label text,
  p_start_date date,
  p_end_date date
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_scope text;
  v_payload jsonb;
  v_revision integer;
  v_report_id uuid;
begin
  if nullif(btrim(p_period_type), '') is null
     or nullif(btrim(p_period_label), '') is null
     or p_start_date is null
     or p_end_date is null
     or p_end_date < p_start_date then
    raise exception 'Reporting period and labels are required.';
  end if;

  if p_school_id is null then
    if not public.is_platform_owner() then
      raise exception 'Platform owner access required.';
    end if;
    v_scope := 'platform';
    v_payload := public.get_ltg_platform_reporting_summary(p_start_date, p_end_date);
  else
    if not public.can_manage_school(p_school_id) then
      raise exception 'School administrator or program lead access required to save reports.';
    end if;
    v_scope := 'school';
    v_payload := public.get_ltg_reporting_summary(p_school_id, p_start_date, p_end_date);
  end if;

  select coalesce(max(r.revision), 0) + 1
    into v_revision
  from public.ltg_report_snapshots r
  where r.report_scope = v_scope
    and r.school_id is not distinct from p_school_id
    and r.period_type = btrim(p_period_type)
    and r.period_start = p_start_date
    and r.period_end = p_end_date;

  insert into public.ltg_report_snapshots (
    school_id, report_scope, period_type, period_label, period_start, period_end,
    revision, status, payload, generated_by
  ) values (
    p_school_id, v_scope, btrim(p_period_type), btrim(p_period_label), p_start_date,
    p_end_date, v_revision, 'draft', v_payload, auth.uid()
  ) returning id into v_report_id;

  insert into public.audit_log (
    school_id, user_id, action, entity_type, entity_id, details
  ) values (
    p_school_id, auth.uid(), 'ltg_report_snapshot_generated', 'ltg_report_snapshot',
    v_report_id,
    jsonb_build_object(
      'scope', v_scope, 'period_type', btrim(p_period_type),
      'period_label', btrim(p_period_label), 'period_start', p_start_date,
      'period_end', p_end_date, 'revision', v_revision
    )
  );

  return v_report_id;
end;
$$;

revoke all on function public.generate_ltg_report_snapshot(uuid, text, text, date, date) from public, anon;
grant execute on function public.generate_ltg_report_snapshot(uuid, text, text, date, date) to authenticated;

commit;
