create unique index if not exists instructor_notes_day_completion_unique_idx
  on public.instructor_notes (instructor_id, section_id, planner_day_id)
  where note_type = 'day_completion';

create table if not exists public.instructor_day_note_reviews (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  note_id uuid not null unique references public.instructor_notes(id) on delete cascade,
  decision text not null check (decision in ('acknowledged','planner_follow_up','formal_curriculum_review')),
  review_notes text,
  reviewed_by uuid not null references auth.users(id) on delete restrict,
  reviewed_at timestamptz not null default now()
);

alter table public.instructor_day_note_reviews enable row level security;

drop policy if exists instructor_day_note_reviews_select on public.instructor_day_note_reviews;
create policy instructor_day_note_reviews_select
on public.instructor_day_note_reviews for select to authenticated
using (public.is_platform_owner() or public.can_manage_school(school_id));

grant select on public.instructor_day_note_reviews to authenticated;

create or replace function public.sync_completed_day_instructor_note()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_school_id uuid;
  v_note_text text;
begin
  if new.delivery_status <> 'completed' or new.instructor_id is null then
    return new;
  end if;

  v_note_text := nullif(btrim(coalesce(new.deviation_summary, '')), '');

  if nullif(btrim(coalesce(new.follow_up_notes, '')), '') is not null then
    v_note_text := concat_ws(E'\n\n', v_note_text, 'Follow-up: ' || btrim(new.follow_up_notes));
  elsif new.follow_up_needed and v_note_text is null then
    v_note_text := 'Follow-up needed.';
  end if;

  if v_note_text is null then
    return new;
  end if;

  select pd.school_id into v_school_id
  from public.planner_days pd
  where pd.id = new.planner_day_id
    and pd.section_id = new.section_id;

  if v_school_id is null then
    return new;
  end if;

  insert into public.instructor_notes (
    school_id, section_id, planner_day_id, instructor_id,
    note_type, note_text, visibility, guide_segment_id, math_segment_id
  ) values (
    v_school_id, new.section_id, new.planner_day_id, new.instructor_id,
    'day_completion', v_note_text, 'shared', null, null
  )
  on conflict (instructor_id, section_id, planner_day_id)
    where note_type = 'day_completion'
  do update set
    note_text = excluded.note_text,
    visibility = 'shared';

  return new;
end;
$$;

drop trigger if exists planner_delivery_sync_instructor_note on public.planner_day_delivery;
create trigger planner_delivery_sync_instructor_note
after insert or update of delivery_status, deviation_summary, follow_up_needed, follow_up_notes
on public.planner_day_delivery
for each row execute function public.sync_completed_day_instructor_note();

create or replace function public.review_day_completion_note(
  p_note_id uuid,
  p_decision text,
  p_review_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_school_id uuid;
  v_review_id uuid;
begin
  if p_decision not in ('acknowledged','planner_follow_up','formal_curriculum_review') then
    raise exception 'Invalid review decision';
  end if;

  select school_id into v_school_id
  from public.instructor_notes
  where id = p_note_id
    and note_type = 'day_completion'
    and visibility = 'shared';

  if v_school_id is null then
    raise exception 'Shared day-completion note not found';
  end if;

  if not (public.is_platform_owner() or public.can_manage_school(v_school_id)) then
    raise exception 'School administrator access required';
  end if;

  insert into public.instructor_day_note_reviews (
    school_id, note_id, decision, review_notes, reviewed_by
  ) values (
    v_school_id,
    p_note_id,
    p_decision,
    nullif(btrim(coalesce(p_review_notes,'')),''),
    auth.uid()
  )
  on conflict (note_id)
  do update set
    decision = excluded.decision,
    review_notes = excluded.review_notes,
    reviewed_by = excluded.reviewed_by,
    reviewed_at = now()
  returning id into v_review_id;

  perform public.write_audit_event(
    v_school_id,
    'day_completion_note_reviewed',
    'instructor_day_note_review',
    v_review_id,
    jsonb_build_object('note_id', p_note_id, 'decision', p_decision)
  );

  return v_review_id;
end;
$$;

revoke all on function public.review_day_completion_note(uuid,text,text) from public, anon;
grant execute on function public.review_day_completion_note(uuid,text,text) to authenticated;

insert into public.instructor_notes (
  school_id, section_id, planner_day_id, instructor_id,
  note_type, note_text, visibility, guide_segment_id, math_segment_id
)
select
  pd.school_id,
  pdd.section_id,
  pdd.planner_day_id,
  pdd.instructor_id,
  'day_completion',
  concat_ws(
    E'\n\n',
    nullif(btrim(coalesce(pdd.deviation_summary,'')),''),
    case
      when nullif(btrim(coalesce(pdd.follow_up_notes,'')), '') is not null
        then 'Follow-up: ' || btrim(pdd.follow_up_notes)
      when pdd.follow_up_needed and nullif(btrim(coalesce(pdd.deviation_summary,'')), '') is null
        then 'Follow-up needed.'
      else null
    end
  ),
  'shared',
  null,
  null
from public.planner_day_delivery pdd
join public.planner_days pd
  on pd.id = pdd.planner_day_id
 and pd.section_id = pdd.section_id
where pdd.delivery_status = 'completed'
  and pdd.instructor_id is not null
  and (
    nullif(btrim(coalesce(pdd.deviation_summary,'')), '') is not null
    or nullif(btrim(coalesce(pdd.follow_up_notes,'')), '') is not null
    or pdd.follow_up_needed
  )
on conflict (instructor_id, section_id, planner_day_id)
  where note_type = 'day_completion'
do update set
  note_text = excluded.note_text,
  visibility = 'shared';
