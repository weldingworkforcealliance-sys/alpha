-- Balance answer positions for WLD 205 PVHS bridge Live Classrooms without changing question content.
do $$
declare
  r record;
  pattern text;
  target text;
  correct_text text;
  distractors text[];
  rebuilt jsonb;
begin
  for r in
    select id, assessment_slug, question_number, options, correct_answer
    from public.assessment_questions
    where assessment_slug in (
      'wld205_pvhs_bridge_day2',
      'wld205_pvhs_bridge_day3',
      'wld205_pvhs_bridge_day4',
      'wld205_pvhs_bridge_day9'
    )
    order by assessment_slug, question_number
  loop
    pattern := case r.assessment_slug
      when 'wld205_pvhs_bridge_day2' then 'CADBBDACDBCADC'
      when 'wld205_pvhs_bridge_day3' then 'BDCADBCACDBADCB'
      when 'wld205_pvhs_bridge_day4' then 'DBACCADBADCBDAC'
      when 'wld205_pvhs_bridge_day9' then 'BDCACBDADCBACD'
    end;
    target := substr(pattern, r.question_number, 1);
    correct_text := r.options ->> r.correct_answer;

    select array_agg(e.value order by e.key)
      into distractors
    from jsonb_each_text(r.options) e
    where e.key <> r.correct_answer;

    rebuilt := case target
      when 'A' then jsonb_build_object('A',correct_text,'B',distractors[1],'C',distractors[2],'D',distractors[3])
      when 'B' then jsonb_build_object('A',distractors[1],'B',correct_text,'C',distractors[2],'D',distractors[3])
      when 'C' then jsonb_build_object('A',distractors[1],'B',distractors[2],'C',correct_text,'D',distractors[3])
      when 'D' then jsonb_build_object('A',distractors[1],'B',distractors[2],'C',distractors[3],'D',correct_text)
    end;

    update public.assessment_questions
    set options = rebuilt,
        correct_answer = target
    where id = r.id;
  end loop;
end $$;

do $$
declare
  bad_count integer;
begin
  select count(*) into bad_count
  from (
    select assessment_slug, count(distinct correct_answer) as distinct_answers
    from public.assessment_questions
    where assessment_slug in (
      'wld205_pvhs_bridge_day2',
      'wld205_pvhs_bridge_day3',
      'wld205_pvhs_bridge_day4',
      'wld205_pvhs_bridge_day9'
    )
    group by assessment_slug
    having count(distinct correct_answer) < 4
  ) x;

  if bad_count > 0 then
    raise exception 'WLD 205 PVHS bridge answer balancing verification failed';
  end if;
end $$;