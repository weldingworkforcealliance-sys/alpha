-- Complete LTG class-connected testing with Blueprint Reading, live progress,
-- recoverable sessions, instructor answer keys, and individual reports.
-- Additive only: approved course curriculum and outcomes are not changed.

alter table public.assessment_modules
  add column if not exists instructions text,
  add column if not exists allow_team_members boolean not null default false;

alter table public.classroom_sessions
  add column if not exists expected_students integer not null default 17;

alter table public.classroom_sessions
  drop constraint if exists classroom_sessions_expected_students_check;
alter table public.classroom_sessions
  add constraint classroom_sessions_expected_students_check
  check (expected_students between 1 and 60);

alter table public.classroom_submissions
  add column if not exists team_members text;

create or replace function public.start_classroom_session_v2(
  p_section_id uuid,
  p_assessment_slug text default 'preclass_math',
  p_expected_students integer default 17
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  result_id uuid;
  target_school uuid;
begin
  if auth.uid() is null then
    raise exception 'Instructor login required';
  end if;
  if p_expected_students < 1 or p_expected_students > 60 then
    raise exception 'Expected students must be between 1 and 60';
  end if;

  select school_id into target_school from public.sections where id=p_section_id;
  if target_school is null then
    raise exception 'Class not found';
  end if;
  if not exists (
    select 1 from public.assessment_modules
    where slug=p_assessment_slug and active
  ) then
    raise exception 'Assessment is not available';
  end if;
  if not exists (
    select 1 from public.current_teaching_sections where section_id=p_section_id
  ) and not public.is_platform_owner() then
    raise exception 'You are not assigned to this class';
  end if;

  update public.classroom_sessions
     set status='ended', ended_at=now()
   where instructor_id=auth.uid()
     and section_id=p_section_id
     and status='active';

  insert into public.classroom_sessions(
    school_id,section_id,instructor_id,assessment_slug,join_code,expected_students
  )
  values(
    target_school,p_section_id,auth.uid(),p_assessment_slug,
    public.make_classroom_join_code(),p_expected_students
  )
  returning id into result_id;

  return result_id;
end
$$;

create or replace function public.list_assessment_modules_v2()
returns table(
  slug text,
  title text,
  description text,
  category text,
  estimated_minutes integer,
  question_count bigint,
  instructions text,
  allow_team_members boolean
)
language sql
security definer
stable
set search_path=public
as $$
  select
    m.slug,m.title,m.description,m.category,m.estimated_minutes,count(q.id),
    m.instructions,m.allow_team_members
  from public.assessment_modules m
  left join public.assessment_questions q on q.assessment_slug=m.slug
  where m.active
  group by
    m.slug,m.title,m.description,m.category,m.estimated_minutes,m.sort_order,
    m.instructions,m.allow_team_members
  order by m.sort_order,m.title
$$;

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
      'allow_team_members',m.allow_team_members
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
  group by m.title,m.instructions,m.allow_team_members;

  return payload;
end
$$;

create or replace function public.submit_classroom_assessment_v2(
  p_join_code text,
  p_student_name text,
  p_student_id text,
  p_team_members text,
  p_answers jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  s public.classroom_sessions;
  q record;
  total integer:=0;
  correct integer:=0;
  normalized text;
  domains jsonb:='{}'::jsonb;
  domain_row jsonb;
begin
  if length(trim(p_student_name))<2 or length(trim(p_student_id))<1 then
    raise exception 'Student name and ID are required';
  end if;
  if length(coalesce(p_team_members,''))>500 then
    raise exception 'Team member list is too long';
  end if;
  if jsonb_typeof(p_answers)<>'object' then
    raise exception 'Every question must be answered';
  end if;

  select * into s
  from public.classroom_sessions
  where join_code=upper(trim(p_join_code))
    and status='active'
    and expires_at>now()
  for update;

  if s.id is null then
    raise exception 'This class session has ended';
  end if;
  if exists (
    select 1 from public.classroom_submissions
    where classroom_session_id=s.id
      and student_id=trim(p_student_id)
  ) then
    raise exception 'This Student ID has already submitted';
  end if;

  for q in
    select * from public.assessment_questions
    where assessment_slug=s.assessment_slug
    order by question_number
  loop
    total:=total+1;
    if not (p_answers ? q.question_key)
       or length(trim(coalesce(p_answers->>q.question_key,'')))=0 then
      raise exception 'Every question must be answered';
    end if;

    normalized:=lower(trim(p_answers->>q.question_key));
    domain_row:=coalesce(
      domains->q.domain,
      jsonb_build_object('correct',0,'total',0)
    );
    domain_row:=jsonb_set(
      domain_row,'{total}',
      to_jsonb((domain_row->>'total')::int+1)
    );

    if (q.question_type='mc' and upper(normalized)=upper(q.correct_answer))
       or (
         q.question_type='text'
         and exists (
           select 1
           from jsonb_array_elements_text(
             coalesce(q.accepted_answers,'[]'::jsonb)
           ) a
           where lower(trim(a))=normalized
         )
       ) then
      correct:=correct+1;
      domain_row:=jsonb_set(
        domain_row,'{correct}',
        to_jsonb((domain_row->>'correct')::int+1)
      );
    end if;

    domains:=jsonb_set(domains,array[q.domain],domain_row,true);
  end loop;

  if (select count(*) from jsonb_object_keys(p_answers))<>total then
    raise exception 'Every question must be answered';
  end if;

  insert into public.classroom_submissions(
    classroom_session_id,student_name,student_id,team_members,
    answers,score,possible_score,domain_scores
  )
  values(
    s.id,trim(p_student_name),trim(p_student_id),
    nullif(trim(coalesce(p_team_members,'')),''),
    p_answers,correct,total,domains
  );

  return jsonb_build_object(
    'score',correct,
    'possible_score',total,
    'percent',round(100.0*correct/greatest(total,1))
  );
end
$$;

create or replace function public.get_classroom_submission_report(
  p_submission_id uuid
)
returns jsonb
language plpgsql
security definer
stable
set search_path=public
as $$
declare
  payload jsonb;
begin
  if auth.uid() is null then
    raise exception 'Instructor login required';
  end if;

  select jsonb_build_object(
    'submission',jsonb_build_object(
      'id',sub.id,
      'student_name',sub.student_name,
      'student_id',sub.student_id,
      'team_members',sub.team_members,
      'score',sub.score,
      'possible_score',sub.possible_score,
      'percent',round(100.0*sub.score/greatest(sub.possible_score,1)),
      'submitted_at',sub.submitted_at,
      'domain_scores',sub.domain_scores,
      'assessment_title',m.title
    ),
    'questions',jsonb_agg(
      jsonb_build_object(
        'key',q.question_key,
        'number',q.question_number,
        'domain',q.domain,
        'text',q.question_text,
        'options',q.options,
        'student_answer',sub.answers->>q.question_key,
        'correct_answer',q.correct_answer,
        'is_correct',
          case
            when q.question_type='mc'
              then upper(trim(coalesce(sub.answers->>q.question_key,'')))=upper(q.correct_answer)
            else exists(
              select 1
              from jsonb_array_elements_text(coalesce(q.accepted_answers,'[]'::jsonb)) a
              where lower(trim(a))=lower(trim(coalesce(sub.answers->>q.question_key,'')))
            )
          end,
        'explanation',q.explanation
      )
      order by q.question_number
    )
  )
  into payload
  from public.classroom_submissions sub
  join public.classroom_sessions s on s.id=sub.classroom_session_id
  join public.assessment_modules m on m.slug=s.assessment_slug
  join public.assessment_questions q on q.assessment_slug=s.assessment_slug
  where sub.id=p_submission_id
    and (s.instructor_id=auth.uid() or public.is_platform_owner())
  group by
    sub.id,sub.student_name,sub.student_id,sub.team_members,sub.score,
    sub.possible_score,sub.submitted_at,sub.domain_scores,m.title;

  if payload is null then
    raise exception 'Report not found or permission denied';
  end if;
  return payload;
end
$$;

create or replace function public.get_assessment_answer_key(
  p_assessment_slug text
)
returns jsonb
language plpgsql
security definer
stable
set search_path=public
as $$
declare
  payload jsonb;
begin
  if auth.uid() is null then
    raise exception 'Instructor login required';
  end if;
  if not public.is_platform_owner()
     and not exists(select 1 from public.current_teaching_sections) then
    raise exception 'Instructor assignment required';
  end if;

  select jsonb_build_object(
    'assessment',jsonb_build_object(
      'slug',m.slug,
      'title',m.title,
      'instructions',m.instructions
    ),
    'questions',coalesce(
      jsonb_agg(
        jsonb_build_object(
          'key',q.question_key,
          'number',q.question_number,
          'domain',q.domain,
          'text',q.question_text,
          'options',q.options,
          'correct_answer',q.correct_answer,
          'accepted_answers',q.accepted_answers,
          'explanation',q.explanation
        )
        order by q.question_number
      ),
      '[]'::jsonb
    )
  )
  into payload
  from public.assessment_modules m
  left join public.assessment_questions q on q.assessment_slug=m.slug
  where m.slug=p_assessment_slug and m.active
  group by m.slug,m.title,m.instructions;

  if payload is null then
    raise exception 'Assessment not found';
  end if;
  return payload;
end
$$;

revoke execute on function public.start_classroom_session_v2(uuid,text,integer)
  from public,anon,authenticated;
revoke execute on function public.list_assessment_modules_v2()
  from public,anon,authenticated;
revoke execute on function public.get_classroom_assessment(text)
  from public,anon,authenticated;
revoke execute on function public.submit_classroom_assessment_v2(text,text,text,text,jsonb)
  from public,anon,authenticated;
revoke execute on function public.get_classroom_submission_report(uuid)
  from public,anon,authenticated;
revoke execute on function public.get_assessment_answer_key(text)
  from public,anon,authenticated;

grant execute on function public.start_classroom_session_v2(uuid,text,integer)
  to authenticated;
grant execute on function public.list_assessment_modules_v2()
  to authenticated;
grant execute on function public.get_classroom_assessment(text)
  to anon,authenticated;
grant execute on function public.submit_classroom_assessment_v2(text,text,text,text,jsonb)
  to anon,authenticated;
grant execute on function public.get_classroom_submission_report(uuid)
  to authenticated;
grant execute on function public.get_assessment_answer_key(text)
  to authenticated;


insert into public.assessment_modules(
  slug,title,description,category,estimated_minutes,sort_order,version,
  active,instructions,allow_team_members
)
values(
  'blueprint_day1',
  'Blueprint Reading — Day 1 • Basic lines, views, notes, and dimensions',
  'Unit 1, pp. 1-7 • Unit 3, pp. 17-21 • Unit 4, pp. 22-37 | Line types, visible vs. hidden information, notes/specifications, and dimension reading.',
  'Blueprint Reading',
  20,
  20,
  143,
  true,
  'Unit 1, pp. 1-7 • Unit 3, pp. 17-21 • Unit 4, pp. 22-37 | Line types, visible vs. hidden information, notes/specifications, and dimension reading.

Group task: Use the V-Groove Test Block and at least one dimensioned figure from the reading. Identify what each view tells you, point to four line types, and explain one mistake that would happen if a dimension were read incorrectly.

Textbook or assigned print packet is required for questions marked [Drawing].',
  true
)
on conflict(slug) do update set
  title=excluded.title,
  description=excluded.description,
  category=excluded.category,
  estimated_minutes=excluded.estimated_minutes,
  sort_order=excluded.sort_order,
  version=excluded.version,
  active=true,
  instructions=excluded.instructions,
  allow_team_members=excluded.allow_team_members;


insert into public.assessment_questions(
  assessment_slug,question_key,question_number,question_type,question_text,
  domain,options,correct_answer,accepted_answers,explanation
)
values
('blueprint_day1','d1q1',1,'mc','[Drawing] Refer to the V-Groove Test Block. Why are three views used to show the object?','Day 1','{"A":"To give enough information about shape, size, and features that one view alone cannot show","B":"To show three different material types","C":"To give each welder a separate copy","D":"To avoid using dimensions"}'::jsonb,'A',null,null),
('blueprint_day1','d1q2',2,'mc','[Drawing] Which three standard orthographic views are typically shown for the V-Groove Test Block?','Day 1','{"A":"Front, top, and right-side views","B":"Isometric, exploded, and section views","C":"Front, detail, and pictorial views","D":"Top, bill of materials, and note view"}'::jsonb,'A',null,null),
('blueprint_day1','d1q3',3,'mc','[Drawing] In standard orthographic projection, which two views show the same length?','Day 1','{"A":"Front and top","B":"Top and right side","C":"Front and right side","D":"Detail and section"}'::jsonb,'A',null,null),
('blueprint_day1','d1q4',4,'mc','[Drawing] In standard orthographic projection, which two views show the same width or depth?','Day 1','{"A":"Front and top","B":"Top and right side","C":"Front and right side","D":"Front and detail"}'::jsonb,'B',null,null),
('blueprint_day1','d1q5',5,'mc','[Drawing] In standard orthographic projection, which two views show the same height or thickness?','Day 1','{"A":"Front and top","B":"Top and right side","C":"Front and right side","D":"Top and detail"}'::jsonb,'C',null,null),
('blueprint_day1','d1q6',6,'mc','[Drawing] What do the top and right-side views have in common with respect to the front view?','Day 1','{"A":"They align with the front view to carry dimensions and features across","B":"They are always drawn larger than the front view","C":"They replace the need for notes","D":"They remove hidden lines from the drawing"}'::jsonb,'A',null,null),
('blueprint_day1','d1q7',7,'mc','What is the main purpose of an object line on a print?','Day 1','{"A":"To show visible edges and outlines of the part","B":"To show center points only","C":"To show cutting planes","D":"To show dimensions only"}'::jsonb,'A',null,null),
('blueprint_day1','d1q8',8,'mc','What is the main purpose of a hidden line?','Day 1','{"A":"To show edges or features not directly visible in that view","B":"To show the outside shape only","C":"To show the center of a hole","D":"To show a finished weld contour"}'::jsonb,'A',null,null),
('blueprint_day1','d1q9',9,'mc','What does a centerline usually indicate?','Day 1','{"A":"The center of a circular or symmetrical feature","B":"The cutting direction for a saw","C":"The surface finish required","D":"The location of a title block"}'::jsonb,'A',null,null),
('blueprint_day1','d1q10',10,'mc','What is the job of a dimension line?','Day 1','{"A":"To show the size or distance being measured","B":"To show hidden edges","C":"To show a material break","D":"To show the order of welding"}'::jsonb,'A',null,null),
('blueprint_day1','d1q11',11,'mc','What is the job of an extension line?','Day 1','{"A":"To extend from the feature out to the dimension line","B":"To darken object lines","C":"To replace leader lines","D":"To show a weld contour"}'::jsonb,'A',null,null),
('blueprint_day1','d1q12',12,'mc','When a drawing includes notes or specifications, why must they be checked before fabrication starts?','Day 1','{"A":"They may include instructions not obvious from the views alone","B":"They are only for office filing","C":"They are used only after welding is complete","D":"They replace all dimensions on the print"}'::jsonb,'A',null,null),
('blueprint_day1','d1q13',13,'mc','A general specification placed in or near the title block usually applies to:','Day 1','{"A":"All or several views on the drawing","B":"Only the smallest detail view","C":"Only the welder who signs first","D":"Only one hidden feature"}'::jsonb,'A',null,null),
('blueprint_day1','d1q14',14,'mc','On a print, the diameter symbol tells the reader that the dimension refers to:','Day 1','{"A":"The full distance across a circle","B":"Half the distance across a circle","C":"The length of a slot","D":"The angle of a bevel"}'::jsonb,'A',null,null),
('blueprint_day1','d1q15',15,'mc','Which statement best describes why dimensions matter to welders and fabricators?','Day 1','{"A":"Wrong dimensions affect fit-up, hole location, and final assembly","B":"Dimensions only matter to machinists","C":"Dimensions are optional if the shape looks right","D":"Dimensions are used only for record keeping"}'::jsonb,'A',null,null),
('blueprint_day1','d1q16',16,'mc','If two group members disagree on what a dimension means, the best next step is to:','Day 1','{"A":"Go back to the view, lines, and notes and prove the answer from the print","B":"Choose the answer that sounds fastest","C":"Ignore the dimension and move on","D":"Let the loudest person decide"}'::jsonb,'A',null,null),
('blueprint_day1','d1q17',17,'mc','A reference dimension is usually included to:','Day 1','{"A":"Provide extra information without controlling production size","B":"Replace every required tolerance","C":"Show hidden lines more clearly","D":"Identify the drawing revision"}'::jsonb,'A',null,null),
('blueprint_day1','d1q18',18,'mc','Which print-reading habit is strongest when learning basic views?','Day 1','{"A":"Compare all views before making a decision","B":"Read only the front view","C":"Ignore notes until the end","D":"Assume every line means the same thing"}'::jsonb,'A',null,null),
('blueprint_day1','d1q19',19,'mc','If a hole appears as a circle in one view and as hidden edges in another view, that tells the reader that:','Day 1','{"A":"The feature must be interpreted across more than one view","B":"The print is automatically wrong","C":"The hole is not really there","D":"The dimensions can be ignored"}'::jsonb,'A',null,null),
('blueprint_day1','d1q20',20,'mc','Why is it dangerous to rely on one view alone when reading a fabrication print?','Day 1','{"A":"One view rarely shows all surfaces, features, and dimensions clearly","B":"One view always uses the wrong scale","C":"One view cannot contain object lines","D":"One view is only for inspectors"}'::jsonb,'A',null,null)
on conflict(assessment_slug,question_key) do update set
  question_number=excluded.question_number,
  question_type=excluded.question_type,
  question_text=excluded.question_text,
  domain=excluded.domain,
  options=excluded.options,
  correct_answer=excluded.correct_answer,
  accepted_answers=excluded.accepted_answers,
  explanation=excluded.explanation;


insert into public.assessment_modules(
  slug,title,description,category,estimated_minutes,sort_order,version,
  active,instructions,allow_team_members
)
values(
  'blueprint_day2',
  'Blueprint Reading — Day 2 • Other views, sections, and assembly prints',
  'Unit 7, pp. 81-96 • Unit 8, pp. 99-108 • Unit 9, pp. 110-113 | Multiple views, section views, detail views, and assembly/subassembly logic.',
  'Blueprint Reading',
  20,
  21,
  143,
  true,
  'Unit 7, pp. 81-96 • Unit 8, pp. 99-108 • Unit 9, pp. 110-113 | Multiple views, section views, detail views, and assembly/subassembly logic.

Group task: Choose one figure with more than one view, one section view, and one assembly or subassembly print. Explain what each extra view reveals that a single outside view would miss.

Textbook or assigned print packet is required for questions marked [Drawing].',
  true
)
on conflict(slug) do update set
  title=excluded.title,
  description=excluded.description,
  category=excluded.category,
  estimated_minutes=excluded.estimated_minutes,
  sort_order=excluded.sort_order,
  version=excluded.version,
  active=true,
  instructions=excluded.instructions,
  allow_team_members=excluded.allow_team_members;


insert into public.assessment_questions(
  assessment_slug,question_key,question_number,question_type,question_text,
  domain,options,correct_answer,accepted_answers,explanation
)
values
('blueprint_day2','d2q1',1,'mc','Why is a second or third view often added to a drawing?','Day 2','{"A":"Because one view usually cannot show every important shape or feature","B":"Because the print needs decoration","C":"Because dimensions are not allowed on one-view drawings","D":"Because every drawing must fill the page"}'::jsonb,'A',null,null),
('blueprint_day2','d2q2',2,'mc','What is the main purpose of a section view?','Day 2','{"A":"To reveal interior features more clearly","B":"To remove all dimensions","C":"To show only surface finish","D":"To identify the welder"}'::jsonb,'A',null,null),
('blueprint_day2','d2q3',3,'mc','A cutting-plane indication tells the reader:','Day 2','{"A":"Where the object is imagined to be cut for the section view","B":"Where the finished weld must be ground","C":"Where the title block belongs","D":"Where to store the part"}'::jsonb,'A',null,null),
('blueprint_day2','d2q4',4,'mc','Section lining or hatch marks in a section view usually represent:','Day 2','{"A":"Material cut by the imaginary cutting plane","B":"Hidden edges behind the object","C":"Dimension lines that were omitted","D":"A weld contour requirement"}'::jsonb,'A',null,null),
('blueprint_day2','d2q5',5,'mc','Why can a section view be easier to read than a view filled with hidden lines?','Day 2','{"A":"It makes internal features clearer and reduces visual clutter","B":"It removes the need for dimensions","C":"It automatically shows tolerances","D":"It replaces the title block"}'::jsonb,'A',null,null),
('blueprint_day2','d2q6',6,'mc','What is the main purpose of a detail view?','Day 2','{"A":"To enlarge and clarify a small area that would be hard to read at full scale","B":"To show the entire assembly at once","C":"To replace the front view","D":"To list raw material only"}'::jsonb,'A',null,null),
('blueprint_day2','d2q7',7,'mc','What does an assembly print help the reader understand?','Day 2','{"A":"How separate parts fit and work together","B":"Only the price of the job","C":"Only the finish of one weld","D":"How to ignore subassemblies"}'::jsonb,'A',null,null),
('blueprint_day2','d2q8',8,'mc','What is a subassembly print most useful for?','Day 2','{"A":"Showing a smaller group of parts before they become part of the full assembly","B":"Showing only notes and no parts","C":"Replacing the bill of materials completely","D":"Displaying only hidden lines"}'::jsonb,'A',null,null),
('blueprint_day2','d2q9',9,'mc','Why is a bill of materials useful on an assembly print?','Day 2','{"A":"It identifies parts, materials, and quantities used in the assembly","B":"It shows the weld contour only","C":"It replaces all detail drawings","D":"It lists only reference dimensions"}'::jsonb,'A',null,null),
('blueprint_day2','d2q10',10,'mc','When a group is reading an assembly print, what should they check first?','Day 2','{"A":"How the parts relate to each other and where each part belongs","B":"Which student is holding the book","C":"Whether the print uses color","D":"How many pages are left in the unit"}'::jsonb,'A',null,null),
('blueprint_day2','d2q11',11,'mc','A removed section differs from an in-place section because it is:','Day 2','{"A":"Drawn away from the main view for clarity","B":"Always larger than the entire drawing","C":"Used only for pipe symbols","D":"Free of section lines"}'::jsonb,'A',null,null),
('blueprint_day2','d2q12',12,'mc','A broken-out section is most useful when:','Day 2','{"A":"Only a small local interior area needs to be revealed","B":"The entire object has no inside features","C":"The print has no notes","D":"The drawing shows only a title block"}'::jsonb,'A',null,null),
('blueprint_day2','d2q13',13,'mc','What is the best reason to compare a detail view back to the parent view?','Day 2','{"A":"To confirm exactly where the enlarged area came from","B":"To replace all dimensions in the parent view","C":"To ignore the main view","D":"To change the scale of the job"}'::jsonb,'A',null,null),
('blueprint_day2','d2q14',14,'mc','Why do assembly prints matter in a welding or fabrication shop?','Day 2','{"A":"Because correct fit-up depends on how parts relate in the full assembly","B":"Because they remove the need for measuring","C":"Because only inspectors use them","D":"Because they always show finished paint colors"}'::jsonb,'A',null,null),
('blueprint_day2','d2q15',15,'mc','If a feature is hard to understand in a regular orthographic view, which added view is most likely to help?','Day 2','{"A":"A detail view or section view","B":"A blank page","C":"A payroll sheet","D":"A cleaning checklist"}'::jsonb,'A',null,null),
('blueprint_day2','d2q16',16,'mc','What does it usually mean when multiple views of the same object are aligned on the page?','Day 2','{"A":"The views are meant to be read together to transfer dimensions and features","B":"The drawing is unfinished","C":"The notes do not apply","D":"Each view is from a different part"}'::jsonb,'A',null,null),
('blueprint_day2','d2q17',17,'mc','A section view should never be treated as:','Day 2','{"A":"A random sketch unrelated to the other views","B":"A tool for understanding internal features","C":"Part of the same drawing information","D":"Evidence for interior shape"}'::jsonb,'A',null,null),
('blueprint_day2','d2q18',18,'mc','What is the strongest group habit when reading assembly or section drawings?','Day 2','{"A":"Point to evidence on the page before choosing an answer","B":"Guess based on memory only","C":"Skip the views and read only the heading","D":"Use only one team member''s opinion"}'::jsonb,'A',null,null),
('blueprint_day2','d2q19',19,'mc','If two parts look similar in the assembly but have different item numbers, the group should:','Day 2','{"A":"Check the bill of materials and detail views before assuming they are the same","B":"Treat them as identical automatically","C":"Ignore the item numbers","D":"Use whichever part is easier to draw"}'::jsonb,'A',null,null),
('blueprint_day2','d2q20',20,'mc','Why are section, detail, and assembly views all important in the same unit?','Day 2','{"A":"Together they help the reader understand inside shape, small features, and part relationships","B":"Together they eliminate the need for practice","C":"Together they replace all weld symbols","D":"Together they show only hidden lines"}'::jsonb,'A',null,null)
on conflict(assessment_slug,question_key) do update set
  question_number=excluded.question_number,
  question_type=excluded.question_type,
  question_text=excluded.question_text,
  domain=excluded.domain,
  options=excluded.options,
  correct_answer=excluded.correct_answer,
  accepted_answers=excluded.accepted_answers,
  explanation=excluded.explanation;


insert into public.assessment_modules(
  slug,title,description,category,estimated_minutes,sort_order,version,
  active,instructions,allow_team_members
)
values(
  'blueprint_day3',
  'Blueprint Reading — Day 3 • Welding symbols and basic joints',
  'Unit 10, pp. 114-126 • Unit 11, pp. 142-147 | Reference line, arrow, tail, and basic joint types.',
  'Blueprint Reading',
  20,
  22,
  143,
  true,
  'Unit 10, pp. 114-126 • Unit 11, pp. 142-147 | Reference line, arrow, tail, and basic joint types.

Group task: Identify the parts of a welding symbol, sketch or point to five basic joint types, and explain why arrow-side reading matters before fit-up and tack welding begin.

Textbook or assigned print packet is required for questions marked [Drawing].',
  true
)
on conflict(slug) do update set
  title=excluded.title,
  description=excluded.description,
  category=excluded.category,
  estimated_minutes=excluded.estimated_minutes,
  sort_order=excluded.sort_order,
  version=excluded.version,
  active=true,
  instructions=excluded.instructions,
  allow_team_members=excluded.allow_team_members;


insert into public.assessment_questions(
  assessment_slug,question_key,question_number,question_type,question_text,
  domain,options,correct_answer,accepted_answers,explanation
)
values
('blueprint_day3','d3q1',1,'mc','Which part of a welding symbol acts as the main baseline for symbol information?','Day 3','{"A":"The reference line","B":"The title block","C":"The border line","D":"The dimension chain"}'::jsonb,'A',null,null),
('blueprint_day3','d3q2',2,'mc','What may be placed in the tail of a welding symbol when needed?','Day 3','{"A":"Extra process, specification, or reference information","B":"The welder''s paycheck","C":"A paint color chart","D":"Only hidden lines"}'::jsonb,'A',null,null),
('blueprint_day3','d3q3',3,'mc','A fillet weld symbol is commonly associated with which shape?','Day 3','{"A":"Circle","B":"Triangle","C":"Square","D":"Star"}'::jsonb,'B',null,null),
('blueprint_day3','d3q4',4,'mc','What is the main purpose of the arrow in a welding symbol?','Day 3','{"A":"To point to the joint or member the symbol applies to","B":"To show the scale of the drawing","C":"To replace the reference line","D":"To show hidden lines"}'::jsonb,'A',null,null),
('blueprint_day3','d3q5',5,'mc','In standard welding-symbol reading, a weld symbol placed below the reference line usually indicates:','Day 3','{"A":"Arrow-side significance","B":"Other-side significance","C":"A detail view","D":"A title-block note"}'::jsonb,'A',null,null),
('blueprint_day3','d3q6',6,'mc','In standard welding-symbol reading, a weld symbol placed above the reference line usually indicates:','Day 3','{"A":"Arrow-side significance","B":"Other-side significance","C":"A section view","D":"A material break"}'::jsonb,'B',null,null),
('blueprint_day3','d3q7',7,'mc','What does a weld-all-around circle at the elbow of the arrow and reference line indicate?','Day 3','{"A":"The weld is required all around the joint","B":"The part is circular","C":"The dimension is reference only","D":"The weld must be done in the field only"}'::jsonb,'A',null,null),
('blueprint_day3','d3q8',8,'mc','What does a field-weld flag indicate?','Day 3','{"A":"The weld is to be made at the job site or field location","B":"The weld must be vertical","C":"The joint is hidden","D":"The part must be painted"}'::jsonb,'A',null,null),
('blueprint_day3','d3q9',9,'mc','What does the size shown to the left of a weld symbol usually tell the reader?','Day 3','{"A":"The required weld size","B":"The weld length","C":"The material color","D":"The quantity of drawings"}'::jsonb,'A',null,null),
('blueprint_day3','d3q10',10,'mc','What does the dimension shown to the right of a weld symbol usually indicate?','Day 3','{"A":"Weld length or related length information","B":"Only the type of material","C":"The page number","D":"The view direction"}'::jsonb,'A',null,null),
('blueprint_day3','d3q11',11,'mc','Pitch shown with intermittent weld information tells the reader:','Day 3','{"A":"The center-to-center spacing of weld segments","B":"The amount of grinding required","C":"The welding process number","D":"The diameter of the part"}'::jsonb,'A',null,null),
('blueprint_day3','d3q12',12,'mc','Which joint type places two members in the same plane with their edges meeting?','Day 3','{"A":"Butt joint","B":"Lap joint","C":"Tee joint","D":"Corner joint"}'::jsonb,'A',null,null),
('blueprint_day3','d3q13',13,'mc','Which joint type is formed when one plate overlaps another?','Day 3','{"A":"Butt joint","B":"Lap joint","C":"Edge joint","D":"Corner joint"}'::jsonb,'B',null,null),
('blueprint_day3','d3q14',14,'mc','Which joint type is formed when one member meets another at roughly 90 degrees in the shape of a T?','Day 3','{"A":"Edge joint","B":"Tee joint","C":"Lap joint","D":"Butt joint"}'::jsonb,'B',null,null),
('blueprint_day3','d3q15',15,'mc','Which joint type is commonly formed by two members meeting at an outside corner?','Day 3','{"A":"Corner joint","B":"Butt joint","C":"Lap joint","D":"Edge joint"}'::jsonb,'A',null,null),
('blueprint_day3','d3q16',16,'mc','Which joint type is formed when two parallel edges are placed side by side for welding?','Day 3','{"A":"Edge joint","B":"Lap joint","C":"Corner joint","D":"Tee joint"}'::jsonb,'A',null,null),
('blueprint_day3','d3q17',17,'mc','Why does reading the arrow side correctly matter before tacking the job?','Day 3','{"A":"Because the weld may belong on a specific side of the joint","B":"Because it changes the page orientation only","C":"Because it removes the need for fit-up","D":"Because it changes the material grade automatically"}'::jsonb,'A',null,null),
('blueprint_day3','d3q18',18,'mc','If a welding symbol uses multiple reference lines, what is the reader expected to watch for?','Day 3','{"A":"Sequence or multiple welding instructions","B":"Only hidden dimensions","C":"Only title-block notes","D":"Only the drawing scale"}'::jsonb,'A',null,null),
('blueprint_day3','d3q19',19,'mc','Which answer best describes a strong habit when reading welding symbols?','Day 3','{"A":"Match symbol details to the actual joint before welding","B":"Assume every symbol means fillet weld","C":"Read only the tail and ignore the rest","D":"Tack first and interpret later"}'::jsonb,'A',null,null),
('blueprint_day3','d3q20',20,'mc','Why are basic joint names important before learning more complex weld symbols?','Day 3','{"A":"The symbol only makes sense when the actual joint type is understood","B":"Joint names are used only in class discussions","C":"Joint names replace the need for symbol reading","D":"Joint names matter only after inspection"}'::jsonb,'A',null,null)
on conflict(assessment_slug,question_key) do update set
  question_number=excluded.question_number,
  question_type=excluded.question_type,
  question_text=excluded.question_text,
  domain=excluded.domain,
  options=excluded.options,
  correct_answer=excluded.correct_answer,
  accepted_answers=excluded.accepted_answers,
  explanation=excluded.explanation;


insert into public.assessment_modules(
  slug,title,description,category,estimated_minutes,sort_order,version,
  active,instructions,allow_team_members
)
values(
  'blueprint_day4',
  'Blueprint Reading — Day 4 • Fillet welds, groove welds, and full review',
  'Unit 12, pp. 152-163 • Unit 13, pp. 165-184 | Fillet-weld reading, groove-weld reading, symbol-to-joint matching, and full review.',
  'Blueprint Reading',
  20,
  23,
  143,
  true,
  'Unit 12, pp. 152-163 • Unit 13, pp. 165-184 | Fillet-weld reading, groove-weld reading, symbol-to-joint matching, and full review.

Group task: Use the Motor Adaptor Bracket and Robot Table review material along with Units 12 and 13. Compare what changes the job on a fillet-weld symbol versus a groove-weld symbol, then defend at least two answers with direct print evidence.

Textbook or assigned print packet is required for questions marked [Drawing].',
  true
)
on conflict(slug) do update set
  title=excluded.title,
  description=excluded.description,
  category=excluded.category,
  estimated_minutes=excluded.estimated_minutes,
  sort_order=excluded.sort_order,
  version=excluded.version,
  active=true,
  instructions=excluded.instructions,
  allow_team_members=excluded.allow_team_members;


insert into public.assessment_questions(
  assessment_slug,question_key,question_number,question_type,question_text,
  domain,options,correct_answer,accepted_answers,explanation
)
values
('blueprint_day4','d4q1',1,'mc','A fillet weld is commonly used where two surfaces meet at roughly:','Day 4','{"A":"A corner or tee-type relationship","B":"The center of a round shaft only","C":"A title block edge","D":"A hidden note"}'::jsonb,'A',null,null),
('blueprint_day4','d4q2',2,'mc','A groove weld is generally associated with:','Day 4','{"A":"Joining edges prepared in a groove or butt-style condition","B":"Painting instructions","C":"Only overhead lifting","D":"Maintenance logs"}'::jsonb,'A',null,null),
('blueprint_day4','d4q3',3,'mc','What is the best reason to compare a fillet weld symbol to the actual joint before welding?','Day 4','{"A":"Fillet weld information has to match the joint configuration","B":"Fillet symbols automatically fit every joint","C":"The joint type does not matter","D":"Only groove welds require fit-up checks"}'::jsonb,'A',null,null),
('blueprint_day4','d4q4',4,'mc','What is the purpose of a reference dimension on a review drawing such as the Motor Adaptor Bracket or Robot Table?','Day 4','{"A":"To provide extra information without controlling production size","B":"To replace all tolerances","C":"To show only weld finish","D":"To identify the page number"}'::jsonb,'A',null,null),
('blueprint_day4','d4q5',5,'mc','If a drawing includes tolerances, what are they telling the reader?','Day 4','{"A":"The allowable variation from the stated dimension","B":"The exact welding process to use","C":"Which view to ignore","D":"The order of student teams"}'::jsonb,'A',null,null),
('blueprint_day4','d4q6',6,'mc','On a fabrication print, the note TYP usually means:','Day 4','{"A":"The same condition applies in all similar locations","B":"The weld is temporary","C":"The print is not final","D":"The tolerance is optional"}'::jsonb,'A',null,null),
('blueprint_day4','d4q7',7,'mc','What do break lines generally indicate on a drawing?','Day 4','{"A":"Part of the object has been shortened in the view","B":"The job failed inspection","C":"The weld must stop immediately","D":"The dimension is hidden"}'::jsonb,'A',null,null),
('blueprint_day4','d4q8',8,'mc','If the size of a fillet weld is not specified, the reader should determine the size by using:','Day 4','{"A":"The applicable code, standard, or print requirements","B":"Any size that looks good","C":"The biggest weld possible","D":"Only the opinion of the fastest student"}'::jsonb,'A',null,null),
('blueprint_day4','d4q9',9,'mc','Why is sectioning useful on a drawing such as the Motor Adaptor Bracket?','Day 4','{"A":"It helps show interior features more clearly","B":"It hides the need for dimensions","C":"It replaces the bill of materials","D":"It removes all notes"}'::jsonb,'A',null,null),
('blueprint_day4','d4q10',10,'mc','A both-sides welding symbol means the reader should expect:','Day 4','{"A":"Weld information on both sides of the joint","B":"A weld only after painting","C":"No joint preparation","D":"No need for fit-up"}'::jsonb,'A',null,null),
('blueprint_day4','d4q11',11,'mc','What is one major difference between fillet-weld information and groove-weld information?','Day 4','{"A":"Groove welds often include joint-preparation requirements that fillet welds do not","B":"Fillet welds never use symbols","C":"Groove welds cannot have dimensions","D":"There is no practical difference"}'::jsonb,'A',null,null),
('blueprint_day4','d4q12',12,'mc','When reading a groove weld symbol, the arrow can matter because it may show:','Day 4','{"A":"Which member requires preparation","B":"Which student answers first","C":"Which page is missing","D":"Which note is decorative"}'::jsonb,'A',null,null),
('blueprint_day4','d4q13',13,'mc','What does a contour symbol communicate on a weld symbol?','Day 4','{"A":"The desired finished shape of the weld face","B":"The color of the base metal","C":"The quantity of parts in stock","D":"The drill size for a hole"}'::jsonb,'A',null,null),
('blueprint_day4','d4q14',14,'mc','Why should a group check thread, hole, or tapped-hole callouts carefully on a fabrication drawing?','Day 4','{"A":"Those details directly affect fit, assembly, and machining operations","B":"They matter only to the teacher","C":"They are optional if the welds look good","D":"They never affect the final assembly"}'::jsonb,'A',null,null),
('blueprint_day4','d4q15',15,'mc','What is the strongest reason to use the Robot Table drawing for full review?','Day 4','{"A":"It forces the group to read tolerances, views, symbols, and part relationships together","B":"It removes the need for weld symbols","C":"It is only useful for memorizing one answer","D":"It contains no dimensioning practice"}'::jsonb,'A',null,null),
('blueprint_day4','d4q16',16,'mc','If a drawing shows multiple reference lines in a welding symbol, the reader should think about:','Day 4','{"A":"Sequence or multiple weld instructions","B":"Surface finish only","C":"Material color only","D":"Centerlines only"}'::jsonb,'A',null,null),
('blueprint_day4','d4q17',17,'mc','A groove weld becomes especially important when:','Day 4','{"A":"The job requires joining prepared edges for stronger or full-penetration-type welds","B":"The print needs more hidden lines","C":"The assembly has no fit-up concerns","D":"Only tack welds are needed"}'::jsonb,'A',null,null),
('blueprint_day4','d4q18',18,'mc','When a group disagrees on a review answer, the best move is to:','Day 4','{"A":"Return to the page reference and identify evidence","B":"Vote fast and move on","C":"Let the loudest person decide","D":"Erase the question"}'::jsonb,'A',null,null),
('blueprint_day4','d4q19',19,'mc','Why is it not enough to identify a weld symbol by shape alone?','Day 4','{"A":"Size, length, pitch, contour, and side significance also change the job","B":"Shape always tells the whole story","C":"Only the tail matters","D":"Only the title block matters"}'::jsonb,'A',null,null),
('blueprint_day4','d4q20',20,'mc','What does strong blueprint-reading performance look like at the end of Day 4?','Day 4','{"A":"The group can justify answers from views, dimensions, notes, and weld symbols","B":"The group can guess quickly without the book","C":"The group memorizes one view and ignores the rest","D":"The group finishes without discussing evidence"}'::jsonb,'A',null,null)
on conflict(assessment_slug,question_key) do update set
  question_number=excluded.question_number,
  question_type=excluded.question_type,
  question_text=excluded.question_text,
  domain=excluded.domain,
  options=excluded.options,
  correct_answer=excluded.correct_answer,
  accepted_answers=excluded.accepted_answers,
  explanation=excluded.explanation;


update public.course_guide_day_resources r
set
  resource_title='Launch Connected Test: Blueprint Reading — Day ' || (d.planner_day_number-4),
  resource_url='/classroom?assessment=blueprint_day' || (d.planner_day_number-4),
  resource_notes='Launches the matching 20-question Blueprint Reading block with QR student join, automatic grading, live progress, and retained reports.'
from public.course_guide_days d
where d.id=r.guide_day_id
  and d.guide_id in (
    '2b9ee9ca-3b98-44d1-aa9e-dbc807deed8d'::uuid,
    'c598a820-6133-4bbc-9518-2d2b880b7ffb'::uuid
  )
  and d.planner_day_number between 5 and 8
  and r.resource_title ilike '%Blueprint%';

