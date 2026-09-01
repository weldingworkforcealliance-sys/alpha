-- LTG Live Classroom: QR joining, server-side grading, and real-time results.
-- This is additive. It does not modify approved curriculum or course outcomes.

create extension if not exists pgcrypto;

create table if not exists public.assessment_modules (
  slug text primary key,
  title text not null,
  description text,
  category text not null default 'General',
  estimated_minutes integer,
  sort_order integer not null default 100,
  version integer not null default 1,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.assessment_questions (
  id uuid primary key default gen_random_uuid(),
  assessment_slug text not null references public.assessment_modules(slug) on delete restrict,
  question_key text not null,
  question_number integer not null,
  question_type text not null check (question_type in ('mc','text')),
  question_text text not null,
  domain text not null,
  options jsonb,
  correct_answer text not null,
  accepted_answers jsonb,
  explanation text,
  unique(assessment_slug,question_key),
  unique(assessment_slug,question_number)
);

create table if not exists public.classroom_sessions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  section_id uuid not null references public.sections(id) on delete restrict,
  instructor_id uuid not null references auth.users(id) on delete restrict,
  assessment_slug text not null references public.assessment_modules(slug) on delete restrict,
  join_code text not null unique,
  status text not null default 'active' check (status in ('active','ended')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  expires_at timestamptz not null default (now() + interval '12 hours')
);

create table if not exists public.classroom_submissions (
  id uuid primary key default gen_random_uuid(),
  classroom_session_id uuid not null references public.classroom_sessions(id) on delete restrict,
  student_name text not null,
  student_id text not null,
  answers jsonb not null,
  score integer not null,
  possible_score integer not null,
  domain_scores jsonb not null default '{}'::jsonb,
  submitted_at timestamptz not null default now(),
  unique(classroom_session_id,student_id)
);

create index if not exists classroom_sessions_school_id_idx on public.classroom_sessions(school_id);
create index if not exists classroom_sessions_section_id_idx on public.classroom_sessions(section_id);
create index if not exists classroom_sessions_instructor_id_idx on public.classroom_sessions(instructor_id);
create index if not exists classroom_sessions_assessment_slug_idx on public.classroom_sessions(assessment_slug);

alter table public.assessment_modules enable row level security;
alter table public.assessment_questions enable row level security;
alter table public.classroom_sessions enable row level security;
alter table public.classroom_submissions enable row level security;

drop policy if exists assessment_modules_no_direct_access on public.assessment_modules;
create policy assessment_modules_no_direct_access on public.assessment_modules
for all to anon, authenticated using (false) with check (false);

drop policy if exists assessment_questions_no_direct_access on public.assessment_questions;
create policy assessment_questions_no_direct_access on public.assessment_questions
for all to anon, authenticated using (false) with check (false);

revoke all on public.assessment_modules from anon, authenticated;
revoke all on public.assessment_questions from anon, authenticated;
revoke all on public.classroom_sessions from anon, authenticated;
revoke all on public.classroom_submissions from anon, authenticated;

-- The instructor UI reads these two tables directly. RLS below restricts
-- every row to the session's instructor or the Platform Owner.
grant select on public.classroom_sessions to authenticated;
grant select on public.classroom_submissions to authenticated;

drop policy if exists classroom_sessions_instructor_read on public.classroom_sessions;
create policy classroom_sessions_instructor_read on public.classroom_sessions for select to authenticated
using (instructor_id = (select auth.uid()) or (select public.is_platform_owner()));

drop policy if exists classroom_submissions_instructor_read on public.classroom_submissions;
create policy classroom_submissions_instructor_read on public.classroom_submissions for select to authenticated
using (exists(select 1 from public.classroom_sessions s where s.id=classroom_session_id and (s.instructor_id=(select auth.uid()) or (select public.is_platform_owner()))));

create or replace function public.make_classroom_join_code()
returns text language plpgsql volatile set search_path=public as $$
declare code text;
begin
  loop
    code := upper(substr(encode(gen_random_bytes(6),'hex'),1,6));
    exit when not exists(select 1 from public.classroom_sessions where join_code=code);
  end loop;
  return code;
end $$;

create or replace function public.start_classroom_session(p_section_id uuid,p_assessment_slug text default 'preclass_math')
returns uuid language plpgsql security definer set search_path=public as $$
declare result_id uuid; target_school uuid;
begin
  if auth.uid() is null then raise exception 'Instructor login required'; end if;
  select school_id into target_school from public.sections where id=p_section_id;
  if target_school is null then raise exception 'Class not found'; end if;
  if not exists(select 1 from public.assessment_modules where slug=p_assessment_slug and active) then raise exception 'Assessment is not available'; end if;
  if not exists(select 1 from public.current_teaching_sections where section_id=p_section_id)
     and not public.is_platform_owner() then raise exception 'You are not assigned to this class'; end if;
  update public.classroom_sessions set status='ended',ended_at=now()
    where instructor_id=auth.uid() and section_id=p_section_id and status='active';
  insert into public.classroom_sessions(school_id,section_id,instructor_id,assessment_slug,join_code)
  values(target_school,p_section_id,auth.uid(),p_assessment_slug,public.make_classroom_join_code()) returning id into result_id;
  return result_id;
end $$;

create or replace function public.list_assessment_modules()
returns table(slug text,title text,description text,category text,estimated_minutes integer,question_count bigint)
language sql security definer stable set search_path=public as $$
  select m.slug,m.title,m.description,m.category,m.estimated_minutes,count(q.id)
  from public.assessment_modules m
  left join public.assessment_questions q on q.assessment_slug=m.slug
  where m.active
  group by m.slug,m.title,m.description,m.category,m.estimated_minutes,m.sort_order
  order by m.sort_order,m.title
$$;

create or replace function public.end_classroom_session(p_session_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  update public.classroom_sessions set status='ended',ended_at=now()
  where id=p_session_id and (instructor_id=auth.uid() or public.is_platform_owner());
  if not found then raise exception 'Session not found or permission denied'; end if;
end $$;

create or replace function public.get_classroom_assessment(p_join_code text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare s public.classroom_sessions; payload jsonb;
begin
  select * into s from public.classroom_sessions where join_code=upper(trim(p_join_code)) and status='active' and expires_at>now();
  if s.id is null then raise exception 'This class code is invalid or the session has ended'; end if;
  select jsonb_build_object(
    'session',jsonb_build_object('session_id',s.id,'session_name','Live Welding Class','assessment_title',m.title,'question_count',count(q.id)),
    'questions',coalesce(jsonb_agg(jsonb_build_object('key',q.question_key,'number',q.question_number,'type',q.question_type,'text',q.question_text,'domain',q.domain,'options',q.options) order by q.question_number),'[]'::jsonb)
  ) into payload from public.assessment_modules m join public.assessment_questions q on q.assessment_slug=m.slug where m.slug=s.assessment_slug group by m.title;
  return payload;
end $$;

create or replace function public.submit_classroom_assessment(p_join_code text,p_student_name text,p_student_id text,p_answers jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare s public.classroom_sessions; q record; total integer:=0; correct integer:=0; normalized text; domains jsonb:='{}'::jsonb; domain_row jsonb;
begin
  if length(trim(p_student_name))<2 or length(trim(p_student_id))<1 then raise exception 'Student name and ID are required'; end if;
  select * into s from public.classroom_sessions where join_code=upper(trim(p_join_code)) and status='active' and expires_at>now() for update;
  if s.id is null then raise exception 'This class session has ended'; end if;
  if exists(select 1 from public.classroom_submissions where classroom_session_id=s.id and student_id=trim(p_student_id)) then raise exception 'This Student ID has already submitted'; end if;
  for q in select * from public.assessment_questions where assessment_slug=s.assessment_slug order by question_number loop
    total:=total+1; normalized:=lower(trim(coalesce(p_answers->>q.question_key,'')));
    domain_row:=coalesce(domains->q.domain,jsonb_build_object('correct',0,'total',0));
    domain_row:=jsonb_set(domain_row,'{total}',to_jsonb((domain_row->>'total')::int+1));
    if (q.question_type='mc' and upper(normalized)=upper(q.correct_answer)) or
       (q.question_type='text' and exists(select 1 from jsonb_array_elements_text(coalesce(q.accepted_answers,'[]'::jsonb)) a where lower(trim(a))=normalized)) then
      correct:=correct+1; domain_row:=jsonb_set(domain_row,'{correct}',to_jsonb((domain_row->>'correct')::int+1));
    end if;
    domains:=jsonb_set(domains,array[q.domain],domain_row,true);
  end loop;
  if jsonb_object_length(p_answers)<>total then raise exception 'Every question must be answered'; end if;
  insert into public.classroom_submissions(classroom_session_id,student_name,student_id,answers,score,possible_score,domain_scores)
  values(s.id,trim(p_student_name),trim(p_student_id),p_answers,correct,total,domains);
  return jsonb_build_object('score',correct,'possible_score',total,'percent',round(100.0*correct/greatest(total,1)));
end $$;

revoke execute on function public.make_classroom_join_code() from public, anon, authenticated;
revoke execute on function public.start_classroom_session(uuid,text) from public, anon, authenticated;
revoke execute on function public.list_assessment_modules() from public, anon, authenticated;
revoke execute on function public.end_classroom_session(uuid) from public, anon, authenticated;
revoke execute on function public.get_classroom_assessment(text) from public, anon, authenticated;
revoke execute on function public.submit_classroom_assessment(text,text,text,jsonb) from public, anon, authenticated;

grant execute on function public.start_classroom_session(uuid,text) to authenticated;
grant execute on function public.list_assessment_modules() to authenticated;
grant execute on function public.end_classroom_session(uuid) to authenticated;
grant execute on function public.get_classroom_assessment(text) to anon, authenticated;
grant execute on function public.submit_classroom_assessment(text,text,text,jsonb) to anon, authenticated;

insert into public.assessment_modules(slug,title,description,category,estimated_minutes,sort_order,version)
values('preclass_math','Pre-Class Welding Math Assessment','Measures fractions, decimals, shop arithmetic, tape measurement, layout, area, and conversions.','Welding Mathematics',20,10,1)
on conflict(slug) do update set title=excluded.title,description=excluded.description,category=excluded.category,estimated_minutes=excluded.estimated_minutes,sort_order=excluded.sort_order,version=excluded.version,active=true;

insert into public.assessment_questions(assessment_slug,question_key,question_number,question_type,question_text,domain,options,correct_answer,accepted_answers,explanation) values
('preclass_math','q1',1,'mc','Which of the following is equal to 1/2 inch in decimal form?','Fractions & Decimals','{"A":"0.25","B":"0.50","C":"0.75","D":"0.33"}','B',null,'1 ÷ 2 = 0.50.'),
('preclass_math','q2',2,'mc','What is 7/8 inch as a decimal?','Fractions & Decimals','{"A":"0.875","B":"0.625","C":"0.0875","D":"0.857"}','A',null,'7 ÷ 8 = 0.875.'),
('preclass_math','q3',3,'mc','Which fraction is the same as 0.375?','Fractions & Decimals','{"A":"3/8","B":"5/8","C":"7/8","D":"1/4"}','A',null,'3 ÷ 8 = 0.375.'),
('preclass_math','q4',4,'mc','Convert 0.625 inches to a fraction.','Fractions & Decimals','{"A":"5/8","B":"3/4","C":"7/8","D":"1/2"}','A',null,'0.625 = 5/8.'),
('preclass_math','q5',5,'mc','Which of the following is the smallest?','Fractions & Decimals','{"A":"1/8","B":"0.150","C":"3/16","D":"0.25"}','A',null,'1/8 = 0.125.'),
('preclass_math','q6',6,'mc','You have a piece of metal 12 inches long. You cut off 3 5/8 inches. How much remains?','Shop Arithmetic','{"A":"8 3/8 in","B":"9 1/2 in","C":"8 1/4 in","D":"8 5/8 in"}','A',null,'12 - 3 5/8 = 8 3/8 inches.'),
('preclass_math','q7',7,'mc','What is 3 3/4 in + 2 1/8 in?','Shop Arithmetic','{"A":"5 5/8 in","B":"5 7/8 in","C":"6 in","D":"6 1/4 in"}','B',null,'3 6/8 + 2 1/8 = 5 7/8 inches.'),
('preclass_math','q8',8,'mc','A weld joint needs a 1/4-inch gap, but the current gap is 3/8 inch. By how much must the gap be reduced?','Shop Arithmetic','{"A":"1/8 in","B":"1/4 in","C":"3/8 in","D":"1/16 in"}','A',null,'3/8 - 1/4 = 1/8 inch.'),
('preclass_math','q9',9,'mc','Multiply: 5 1/2 in × 2 = ?','Shop Arithmetic','{"A":"10 in","B":"11 in","C":"11 1/2 in","D":"12 in"}','B',null,'5.5 × 2 = 11 inches.'),
('preclass_math','q10',10,'mc','A 48-inch plate is cut into four equal parts. What is the length of each part?','Shop Arithmetic','{"A":"12 in","B":"10 in","C":"11.5 in","D":"12.5 in"}','A',null,'48 ÷ 4 = 12 inches.'),
('preclass_math','q11',11,'mc','On a tape measure divided into 1/16-inch increments, what measurement is the fourth small line after 3 inches?','Tape & Measurement','{"A":"3 1/4 in","B":"3 3/8 in","C":"3 5/16 in","D":"3 7/16 in"}','A',null,'Four 1/16-inch increments equal 1/4 inch.'),
('preclass_math','q12',12,'mc','Which measurement is the longest?','Tape & Measurement','{"A":"7/16 in","B":"3/8 in","C":"1/2 in","D":"5/16 in"}','C',null,'1/2 = 8/16.'),
('preclass_math','q13',13,'mc','A weld bead must start at 10 7/8 inches. Where is that location on a tape measure divided into 1/16-inch increments?','Tape & Measurement','{"A":"Two small lines before 11 in","B":"One small line after 10 3/4 in","C":"At 10 1/2 in","D":"Halfway between 10 1/2 in and 11 in"}','A',null,'10 7/8 = 10 14/16.'),
('preclass_math','q14',14,'mc','How many 1/8-inch segments are in 1 inch?','Tape & Measurement','{"A":"4","B":"6","C":"8","D":"10"}','C',null,'1 ÷ 1/8 = 8 segments.'),
('preclass_math','q15',15,'mc','True or False: A tape measure marked in 1/16-inch increments divides each inch into 16 equal spaces.','Tape & Measurement','{"A":"True","B":"False"}','A',null,'Sixteen 1/16-inch spaces make one inch.'),
('preclass_math','q16',16,'mc','Five holes are drilled evenly along an 18-inch plate, with the first hole at one end and the last hole at the other end. What is the spacing between adjacent holes?','Layout, Area & Conversions','{"A":"4 in","B":"3.5 in","C":"4.5 in","D":"3.6 in"}','C',null,'Five holes create four equal spaces. 18 ÷ 4 = 4.5 inches.'),
('preclass_math','q17',17,'mc','Steel plate costs $0.30 per square inch. What is the material cost of a 12 in × 6 in piece?','Layout, Area & Conversions','{"A":"$2.10","B":"$18.00","C":"$21.60","D":"$19.50"}','C',null,'72 × $0.30 = $21.60.'),
('preclass_math','q18',18,'mc','A steel rod is 5 feet long. How many inches is that?','Layout, Area & Conversions','{"A":"50","B":"55","C":"60","D":"65"}','C',null,'5 × 12 = 60 inches.'),
('preclass_math','q19',19,'mc','A 36-inch bar is cut into 5 equal sections. What is the length of each section?','Shop Arithmetic','{"A":"6 in","B":"7 in","C":"7.2 in","D":"7.5 in"}','C',null,'36 ÷ 5 = 7.2 inches.'),
('preclass_math','q20',20,'text','What is the decimal equivalent of 9/16 inch?','Fractions & Decimals',null,'0.5625','["0.5625",".5625","0.56250",".56250"]','9 ÷ 16 = 0.5625.')
on conflict(assessment_slug,question_key) do update set question_number=excluded.question_number,question_type=excluded.question_type,question_text=excluded.question_text,domain=excluded.domain,options=excluded.options,correct_answer=excluded.correct_answer,accepted_answers=excluded.accepted_answers,explanation=excluded.explanation;

do $$ begin
  alter publication supabase_realtime add table public.classroom_submissions;
exception when duplicate_object then null;
end $$;
