-- Support multiple independently viewable reference drawings in Live Classroom.
-- Additive only: assessment questions, curriculum, and approved outcomes are unchanged.

create table if not exists public.assessment_reference_assets (
  assessment_slug text not null references public.assessment_modules(slug) on delete cascade,
  asset_key text not null,
  title text not null,
  image_url text not null,
  original_image_url text,
  notes text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (assessment_slug, asset_key)
);

create index if not exists assessment_reference_assets_order_idx
  on public.assessment_reference_assets(assessment_slug, sort_order, asset_key);

alter table public.assessment_reference_assets enable row level security;
revoke all on table public.assessment_reference_assets from anon, authenticated;

create or replace function public.get_classroom_assessment(p_join_code text)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  s public.classroom_sessions;
  payload jsonb;
begin
  select * into s
  from public.classroom_sessions
  where join_code=upper(trim(p_join_code))
    and status='active'
    and expires_at>now();

  if s.id is null then
    raise exception 'This class code is invalid or the session has ended';
  end if;

  select jsonb_build_object(
    'session',jsonb_build_object(
      'session_id',s.id,
      'session_name','Live Welding Class',
      'assessment_title',m.title,
      'question_count',count(q.id),
      'expected_students',s.expected_students,
      'instructions',m.instructions,
      'allow_team_members',m.allow_team_members,
      'reference_title',m.reference_title,
      'reference_image_url',m.reference_image_url,
      'reference_body',m.reference_body,
      'reference_assets',coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'key',a.asset_key,
            'title',a.title,
            'image_url',a.image_url,
            'original_image_url',a.original_image_url,
            'notes',a.notes
          ) order by a.sort_order,a.asset_key
        )
        from public.assessment_reference_assets a
        where a.assessment_slug=m.slug
      ),'[]'::jsonb),
      'show_student_score',m.show_student_score
    ),
    'questions',coalesce(
      jsonb_agg(
        jsonb_build_object(
          'key',q.question_key,
          'number',q.question_number,
          'type',q.question_type,
          'text',q.question_text,
          'domain',q.domain,
          'options',q.options
        )
        order by q.question_number
      ),
      '[]'::jsonb
    )
  )
  into payload
  from public.assessment_modules m
  join public.assessment_questions q on q.assessment_slug=m.slug
  where m.slug=s.assessment_slug
  group by
    m.slug,m.title,m.instructions,m.allow_team_members,
    m.reference_title,m.reference_image_url,m.reference_body,
    m.show_student_score;

  return payload;
end
$$;

grant execute on function public.get_classroom_assessment(text) to anon, authenticated;
