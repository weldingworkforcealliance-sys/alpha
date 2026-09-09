-- LTG Nursing demonstration tenant seed
--
-- Deliberately stored outside supabase/migrations so it is never applied to
-- production merely by deploying the application. Run manually only in an
-- approved demo/test Supabase project.
--
-- Synthetic demonstration data only. This is not an approved, accredited,
-- or licensure-preparation nursing curriculum.

do $$
declare
  v_school uuid;
  v_program uuid;
  v_course uuid;
begin
  select id into v_school
  from schools
  where name = 'LTG Demonstration Institute'
  limit 1;

  if v_school is null then
    insert into schools(name, status)
    values ('LTG Demonstration Institute', 'active')
    returning id into v_school;
  end if;

  insert into school_branding(
    school_id,
    display_name,
    short_name,
    primary_color,
    secondary_color,
    accent_color,
    header_text,
    footer_text
  ) values (
    v_school,
    'LTG Demonstration Institute',
    'LTG Demo',
    '#0e6c88',
    '#f4f8fa',
    '#16865f',
    'Health Sciences Demonstration',
    'Synthetic training data only'
  )
  on conflict (school_id) do update set
    display_name = excluded.display_name,
    short_name = excluded.short_name,
    primary_color = excluded.primary_color,
    secondary_color = excluded.secondary_color,
    accent_color = excluded.accent_color,
    header_text = excluded.header_text,
    footer_text = excluded.footer_text;

  select id into v_program
  from programs
  where school_id = v_school
    and name = 'Nursing'
  limit 1;

  if v_program is null then
    insert into programs(school_id, name, status)
    values (v_school, 'Nursing', 'active')
    returning id into v_program;
  end if;

  select id into v_course
  from courses
  where school_id = v_school
    and program_id = v_program
    and course_code = 'NUR 101'
  limit 1;

  if v_course is null then
    insert into courses(
      school_id,
      program_id,
      course_code,
      course_name,
      status
    ) values (
      v_school,
      v_program,
      'NUR 101',
      'Fundamentals of Nursing Practice',
      'active'
    )
    returning id into v_course;
  end if;

  if not exists (
    select 1
    from sections
    where school_id = v_school
      and course_id = v_course
      and section_name = 'Nursing Demo Cohort A'
  ) then
    insert into sections(
      school_id,
      course_id,
      section_name,
      start_date,
      status
    ) values (
      v_school,
      v_course,
      'Nursing Demo Cohort A',
      '2026-09-09',
      'active'
    );
  end if;

  if not exists (
    select 1
    from course_curriculum
    where school_id = v_school
      and course_id = v_course
      and version = 'demo-1.0'
  ) then
    insert into course_curriculum(
      school_id,
      course_id,
      version,
      curriculum_text,
      approved_date,
      approval_authority,
      status,
      locked
    ) values (
      v_school,
      v_course,
      'demo-1.0',
      'Demonstration-only nursing course shell used to validate LTG multi-program architecture. Content is synthetic and is not an approved, accredited, or licensure-preparation nursing curriculum.',
      '2026-09-09',
      'LTG Demonstration Only',
      'approved',
      true
    );
  end if;
end $$;
