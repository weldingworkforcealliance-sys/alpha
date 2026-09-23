-- Prepare the two additional PCCC Night Level 1 section pairs.
-- WLD 120/150 dates are provisional until PCCC posts Spring 2027 6A.
-- This creates no student enrollment or instructor assignment and does not
-- start a class. Existing WLD 105/110 records are untouched.

do $ltg$
declare
  school_key uuid := '08ccb452-83ab-482f-bb28-5576e02741b2';
  night_cohort uuid := '294a9f90-3876-4ae8-a7b0-896ce99a131b';
  academic_term uuid := 'd4b5845a-db1d-4b89-851b-3b5a8cbce7d7';
  course_record record;
  guide_record record;
  section_key uuid;
  first_section uuid;
  second_section uuid;
  level_key uuid;
  semester_key uuid;
  grade_pair_key uuid;
  book_key uuid;
  category_record record;
  candidate_date date;
  day_number integer;
  first_course_id uuid;
  second_course_id uuid;
begin
  if (select count(*) from public.course_curriculum cc
      join public.courses c on c.id=cc.course_id
      where c.school_id=school_key
        and c.course_code in ('WLD 114','WLD 115','WLD 120','WLD 150')
        and cc.version='2026-2027 additional Level 1 committee syllabus draft'
        and cc.status='approved') <> 4 then
    raise notice 'Additional Level 1 sections remain unreleased pending approved curriculum';
    return;
  end if;

  for course_record in
    select c.id course_id, c.course_code, c.school_id,
      case when c.course_code in ('WLD 114','WLD 115') then 22 else 24 end day_count,
      case when c.course_code in ('WLD 114','WLD 120') then 60 else 225 end day_minutes,
      case when c.course_code in ('WLD 114','WLD 120') then '17:00'::time else '18:00'::time end begins,
      case when c.course_code in ('WLD 114','WLD 120') then '18:00'::time else '21:45'::time end finishes,
      case when c.course_code in ('WLD 114','WLD 115') then '2026-11-09'::date else '2027-02-08'::date end first_date,
      case when c.course_code in ('WLD 114','WLD 115') then '2026-12-19'::date else '2027-03-20'::date end final_date
    from public.courses c
    where c.school_id = school_key and c.course_code in ('WLD 114','WLD 115','WLD 120','WLD 150')
  loop
    select g.id into strict guide_record
    from public.course_guides g
    where g.course_id = course_record.course_id
      and g.version_label = '2026-09-23-additional-L1-v1';

    select id into section_key from public.sections
    where school_id = school_key
      and section_code = 'PCCC-NIGHT-' || replace(course_record.course_code, ' ', '') || '-2627'
    limit 1;
    if section_key is null then
      insert into public.sections
        (school_id, course_id, section_name, section_code, start_date, end_date,
         status, cohort_id, term_id, planned_instructional_days,
         start_time, end_time, planned_minutes_per_day)
      values
        (school_key, course_record.course_id, 'PCCC Night - ' || course_record.course_code,
         'PCCC-NIGHT-' || replace(course_record.course_code, ' ', '') || '-2627',
         course_record.first_date, course_record.final_date, 'planned',
         night_cohort, academic_term, course_record.day_count,
         course_record.begins, course_record.finishes, course_record.day_minutes)
      returning id into section_key;
    else
      update public.sections
      set start_date = course_record.first_date, end_date = course_record.final_date,
          start_time = course_record.begins, end_time = course_record.finishes,
          planned_instructional_days = course_record.day_count,
          planned_minutes_per_day = course_record.day_minutes
      where id = section_key;
    end if;

    insert into public.section_progress (school_id, section_id, current_planner_day_number)
    values (school_key, section_key, 1)
    on conflict (section_id) do nothing;

    if not exists (select 1 from public.section_calendars where section_id = section_key) then
      insert into public.section_calendars
        (school_id, section_id, start_date, end_date, meeting_weekdays)
      values (school_key, section_key, course_record.first_date,
              course_record.final_date, array[1,2,3,4]);
    end if;

    if course_record.day_count = 22 then
      insert into public.section_calendar_exceptions
        (school_id, section_id, exception_date, exception_type, reason)
      values
        (school_key, section_key, '2026-11-25', 'closed', 'Thanksgiving recess'),
        (school_key, section_key, '2026-11-26', 'closed', 'Thanksgiving recess')
      on conflict (section_id, exception_date) do nothing;
    end if;

    day_number := 0;
    for candidate_date in
      select x::date from generate_series(course_record.first_date,
        course_record.final_date, interval '1 day') x
      where extract(isodow from x) between 1 and 4
        and not (course_record.day_count = 22 and x::date between '2026-11-25' and '2026-11-29')
      order by x
    loop
      day_number := day_number + 1;
      insert into public.planner_days
        (school_id, section_id, course_id, planner_day_number, scheduled_date,
         title, status, guide_day_id)
      select school_key, section_key, course_record.course_id, day_number,
             candidate_date, d.title, 'planned', d.id
      from public.course_guide_days d
      where d.guide_id = guide_record.id and d.planner_day_number = day_number
      on conflict (section_id, planner_day_number)
      do update set scheduled_date = excluded.scheduled_date,
                    guide_day_id = excluded.guide_day_id,
                    title = excluded.title;
    end loop;
    if day_number <> course_record.day_count then
      raise exception 'Wrong meeting count for %, found %', course_record.course_code, day_number;
    end if;

    select id into book_key from public.gradebooks where section_id = section_key limit 1;
    if book_key is null then
      insert into public.gradebooks (section_id) values (section_key) returning id into book_key;
    end if;
    for category_record in
      select * from (values
        ('WLD 114','safety_machine','Safety & Machine Operation Assessments'),
        ('WLD 114','academy_quizzes','Torchmate Academy Quizzes'),
        ('WLD 114','cad_projects','Torchmate CAD Project Series'),
        ('WLD 114','machine_practical','Machine Operation Practical Exam'),
        ('WLD 114','cnc_capstone','Final CNC-Cut Capstone Project'),
        ('WLD 115','gtaw','GTAW Skill Assessments'),
        ('WLD 115','gmaw','GMAW Skill Assessments'),
        ('WLD 115','fcaw','FCAW Skill Assessment'),
        ('WLD 115','attendance_conduct','Attendance & Shop Conduct'),
        ('WLD 120','blueprint_cut_list','Blueprint Packet and Cut List Accuracy'),
        ('WLD 120','cutting_tolerance','CNC/Manual Cutting and Tolerance'),
        ('WLD 120','welding_fitup','Welding Quality, Fit-Up, Distortion'),
        ('WLD 120','team_assembly','Team Assembly and Communication'),
        ('WLD 120','final_packet','Final Documentation and Presentation'),
        ('WLD 150','track_performance','Primary Track Welding Performance'),
        ('WLD 150','bend_test','Bend Test Plate and Results'),
        ('WLD 150','advanced_capstone','Advanced Fabrication Capstone'),
        ('WLD 150','professionalism','Professionalism, Safety, Attendance')
      ) as t(course_code, code, label)
      where t.course_code = course_record.course_code
    loop
      insert into public.gradebook_categories (gradebook_id, code, label)
      select book_key, category_record.code, category_record.label
      where not exists (
        select 1 from public.gradebook_categories
        where gradebook_id = book_key and code = category_record.code);
    end loop;
  end loop;

  select id into strict level_key from public.program_levels
  where level_name = 'Welding Level 1';
  insert into public.program_semesters (level_id, semester_number, semester_name)
  values (level_key, 2, 'Semester 2'), (level_key, 3, 'Semester 3')
  on conflict (level_id, semester_number) do nothing;

  for day_number in 2..3 loop
    select id into strict semester_key from public.program_semesters
    where level_id = level_key and semester_number = day_number;
    select id into strict first_course_id from public.courses
    where school_id = school_key and course_code = case day_number when 2 then 'WLD 114' else 'WLD 120' end;
    select id into strict second_course_id from public.courses
    where school_id = school_key and course_code = case day_number when 2 then 'WLD 115' else 'WLD 150' end;
    insert into public.gradebook_course_pairs
      (semester_id, pair_name, theory_course_id, lab_course_id)
    values
      (semester_key,
       case day_number when 2 then 'WLD 114 / WLD 115' else 'WLD 120 / WLD 150' end,
       first_course_id, second_course_id)
    on conflict (semester_id, theory_course_id, lab_course_id)
    do update set pair_name = excluded.pair_name
    returning id into grade_pair_key;
    update public.gradebooks b set course_pair_id = grade_pair_key
    from public.sections s
    where b.section_id = s.id
      and s.school_id = school_key
      and s.course_id in (first_course_id, second_course_id)
      and s.section_code like 'PCCC-NIGHT-%-2627';

    select id into strict first_section from public.sections
    where school_id = school_key and course_id = first_course_id
      and section_code like 'PCCC-NIGHT-%-2627';
    select id into strict second_section from public.sections
    where school_id = school_key and course_id = second_course_id
      and section_code like 'PCCC-NIGHT-%-2627';
    insert into public.attendance_pairs
      (school_id, pair_name, primary_section_id, completion_section_id,
       attendance_mode, report_delay_minutes, report_trigger, active)
    values
      (school_key,
       case day_number when 2 then 'PCCC Night · WLD 114/115' else 'PCCC Night · WLD 120/150' end,
       first_section, second_section, 'standard', 30, 'finalization', true)
    on conflict (school_id, primary_section_id, completion_section_id)
    do update set active = true;
  end loop;
end
$ltg$;
