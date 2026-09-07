-- Launch-stage data link for the approved school-sized Level II Live Job Card.
-- Prepared only. Do not apply until the coordinated push.
-- Adds the native launcher to Day 1 of WLD 205 and WLD 210 without changing curriculum/outcomes.
-- Also repairs the resource_type constraint so the existing Resources UI and the new job_card type
-- are accepted without invalidating any legacy resource types already in use.

alter table public.course_guide_day_resources
  drop constraint if exists guide_day_resource_type_check;

alter table public.course_guide_day_resources
  add constraint guide_day_resource_type_check
  check (resource_type in (
    'video','playlist','website','document','handout','worksheet','presentation','image','reference','other',
    'student_resource','resource','book_reference','aws_reference','assessment','print','wps_swps',
    'instructor_report','instructor_only','secure_exam','job_card'
  ));

insert into public.course_guide_day_resources(
  school_id,
  course_id,
  guide_day_id,
  sequence_number,
  resource_type,
  resource_title,
  resource_url,
  resource_notes,
  required,
  integration_mode,
  rights_basis,
  student_safe
)
select
  c.school_id,
  c.id,
  d.id,
  coalesce((select max(r.sequence_number) from public.course_guide_day_resources r where r.guide_day_id = d.id),0) + 1,
  'job_card',
  'Launch Live Level II Job Card',
  '/classroom/job-card?template=level2_school_job_card&day=1',
  'Instructor preloads the job requirement, WPS/SWPS, process/position, material/joint, and up to four critical requirements. Students complete the 3–5 minute requirement-to-evidence card through a QR code; instructor review is retained in LTG.',
  false,
  'native',
  'school_owned',
  true
from public.courses c
join public.course_guide_days d on d.course_id = c.id
where c.course_code in ('WLD 205','WLD 210')
  and d.planner_day_number = 1
  and not exists(
    select 1
    from public.course_guide_day_resources existing
    where existing.guide_day_id = d.id
      and existing.resource_url like '/classroom/job-card%'
  );
