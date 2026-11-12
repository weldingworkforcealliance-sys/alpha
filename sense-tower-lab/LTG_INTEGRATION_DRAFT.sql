-- PCCC Welding Record Tower -> LTG integration draft
-- REVIEW ONLY. This file intentionally lives outside supabase/migrations so it cannot
-- be applied accidentally. It assumes the gradebook foundation branch objects exist:
-- gradebooks, gradebook_students, gradebook_items, gradebook_attempts,
-- gradebook_revisions, can_access_gradebook(), and attendance_students.
--
-- Do not move this into supabase/migrations until the gradebook foundation is reconciled
-- onto the target LTG branch and the remaining course-final-grade policy decisions are approved.

begin;

-- ---------------------------------------------------------------------------
-- 1. Idempotent source mapping for planner items and Welding Record Tower items
-- ---------------------------------------------------------------------------

alter table public.gradebook_items
  add column if not exists source_system text,
  add column if not exists source_key text;

create unique index if not exists gradebook_items_external_source_uniq
  on public.gradebook_items(gradebook_id, source_system, source_key)
  where source_system is not null and source_key is not null;

alter table public.gradebook_attempts
  add column if not exists external_attempt_key text;

create unique index if not exists gradebook_attempts_external_attempt_uniq
  on public.gradebook_attempts(gradebook_id, item_id, student_id, external_attempt_key)
  where external_attempt_key is not null;

-- ---------------------------------------------------------------------------
-- 2. Permanent four-digit Weld Test ID
-- ---------------------------------------------------------------------------

create sequence if not exists public.weld_test_id_seq
  as integer minvalue 0 maxvalue 9999 start with 0 increment by 1 no cycle;

create table if not exists public.weld_student_identities (
  student_id uuid primary key references public.attendance_students(id) on delete restrict,
  weld_test_id char(4) not null unique check (weld_test_id ~ '^[0-9]{4}$'),
  issued_at timestamptz not null default now(),
  issued_by uuid
);

create or replace function public.can_access_weld_student(p_student_id uuid)
returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1
    from public.gradebook_students gs
    where gs.student_id = p_student_id
      and public.can_access_gradebook(gs.gradebook_id)
  );
$$;

revoke all on function public.can_access_weld_student(uuid) from public, anon;
grant execute on function public.can_access_weld_student(uuid) to authenticated;

create or replace function public.ensure_weld_test_identity(p_student_id uuid)
returns char(4)
language plpgsql security definer set search_path = '' as $$
declare
  v_id char(4);
  v_number integer;
begin
  if not public.can_access_weld_student(p_student_id) then
    raise exception 'Weld student access denied' using errcode='42501';
  end if;

  select weld_test_id into v_id
  from public.weld_student_identities
  where student_id = p_student_id;

  if found then
    return v_id;
  end if;

  v_number := nextval('public.weld_test_id_seq');
  if v_number > 9999 then
    raise exception 'No four-digit Weld Test IDs remain';
  end if;

  insert into public.weld_student_identities(student_id, weld_test_id, issued_by)
  values (p_student_id, lpad(v_number::text, 4, '0'), auth.uid())
  on conflict (student_id) do nothing
  returning weld_test_id into v_id;

  if v_id is null then
    select weld_test_id into v_id
    from public.weld_student_identities
    where student_id = p_student_id;
  end if;

  return v_id;
end $$;

revoke all on function public.ensure_weld_test_identity(uuid) from public, anon;
grant execute on function public.ensure_weld_test_identity(uuid) to authenticated;

create or replace function public.reject_weld_identity_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'Weld Test ID is permanent after issuance';
end $$;

drop trigger if exists weld_identity_immutable on public.weld_student_identities;
create trigger weld_identity_immutable
before update or delete on public.weld_student_identities
for each row execute function public.reject_weld_identity_mutation();

-- ---------------------------------------------------------------------------
-- 3. Position qualification evidence: PASS / FAIL only
-- ---------------------------------------------------------------------------

create table if not exists public.weld_position_qualifications (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.attendance_students(id) on delete restrict,
  weld_test_id char(4) not null references public.weld_student_identities(weld_test_id) on delete restrict,
  gradebook_id uuid not null references public.gradebooks(id) on delete restrict,
  source_key text not null,
  process text not null,
  material text not null,
  specification text not null,
  filler_metal text not null,
  plate text not null,
  joint_family text not null check (joint_family in ('Fillet','Groove')),
  backing_category text not null check (backing_category in ('N/A','Backing','No Backing')),
  position text not null,
  result text not null check (result in ('Pass','Fail')),
  tested_at date,
  notes text not null default '',
  recorded_at timestamptz not null default now(),
  recorded_by uuid,
  supersedes_id uuid references public.weld_position_qualifications(id) on delete restrict,
  unique(gradebook_id, student_id, source_key, id)
);

create index if not exists weld_position_qualifications_student_idx
  on public.weld_position_qualifications(student_id, recorded_at desc);

-- ---------------------------------------------------------------------------
-- 4. Permanent destructive-test ledger
-- ---------------------------------------------------------------------------

create table if not exists public.weld_destructive_tests (
  id uuid primary key default gen_random_uuid(),
  record_number bigint generated always as identity unique,
  student_id uuid not null references public.attendance_students(id) on delete restrict,
  weld_test_id char(4) not null references public.weld_student_identities(weld_test_id) on delete restrict,
  gradebook_id uuid not null references public.gradebooks(id) on delete restrict,
  process text not null,
  material text not null,
  joint_family text not null check (joint_family in ('Fillet','Groove')),
  backing_category text not null check (backing_category in ('N/A','Backing','No Backing')),
  position text not null,
  test_method text not null check (length(trim(test_method)) > 0),
  face_bend_result text not null check (face_bend_result in ('Satisfactory','Unsatisfactory')),
  root_bend_result text not null check (root_bend_result in ('Satisfactory','Unsatisfactory')),
  overall_result text not null check (overall_result in ('Pass','Fail')),
  test_date date not null,
  inspector text not null check (length(trim(inspector)) > 0),
  notes text not null default '',
  recorded_at timestamptz not null default now(),
  recorded_by uuid,
  supersedes_id uuid references public.weld_destructive_tests(id) on delete restrict
);

create index if not exists weld_destructive_tests_student_idx
  on public.weld_destructive_tests(student_id, test_date desc, record_number desc);

create or replace view public.weld_destructive_test_records
with (security_invoker=true) as
select
  t.*,
  'DT-' || lpad(t.record_number::text, 6, '0') as destructive_test_number
from public.weld_destructive_tests t;

-- ---------------------------------------------------------------------------
-- 5. Certificate records generated from passing destructive tests
-- ---------------------------------------------------------------------------

create table if not exists public.weld_test_certificates (
  id uuid primary key default gen_random_uuid(),
  certificate_number bigint generated always as identity unique,
  destructive_test_id uuid not null references public.weld_destructive_tests(id) on delete restrict,
  version integer not null default 1 check (version > 0),
  snapshot_json jsonb not null,
  rendered_file_reference text,
  issued_at timestamptz not null default now(),
  issued_by uuid,
  supersedes_certificate_id uuid references public.weld_test_certificates(id) on delete restrict,
  unique(destructive_test_id, version)
);

create or replace view public.weld_certificate_records
with (security_invoker=true) as
select
  c.*,
  'CERT-' || lpad(c.certificate_number::text, 6, '0') as certificate_display_number
from public.weld_test_certificates c;


create table if not exists public.weld_certificate_deliveries (
  id uuid primary key default gen_random_uuid(),
  certificate_id uuid not null references public.weld_test_certificates(id) on delete restrict,
  version integer not null check (version > 0),
  student_email text not null check (position('@' in student_email) > 1),
  instructor_email text not null check (position('@' in instructor_email) > 1),
  print_recipient_email text not null default 'jhconnolly@pccc.edu'
    check (position('@' in print_recipient_email) > 1),
  print_note text not null default 'ASAP print on thick paper.',
  email_subject text not null,
  attachment_reference text not null,
  status text not null check (status in ('Queued','Sent','Failed')),
  queued_at timestamptz not null default now(),
  sent_at timestamptz,
  provider_message_id text,
  error text not null default '',
  recorded_by uuid,
  unique(certificate_id, version)
);

create index if not exists weld_certificate_deliveries_certificate_idx
  on public.weld_certificate_deliveries(certificate_id, queued_at desc);

-- ---------------------------------------------------------------------------
-- 6. Course grading policy
-- ---------------------------------------------------------------------------

create table if not exists public.gradebook_grading_policies (
  gradebook_id uuid primary key references public.gradebooks(id) on delete restrict,
  rule_version text not null,
  passing_score numeric not null default 65 check (passing_score >= 0 and passing_score <= 100),
  created_at timestamptz not null default now(),
  created_by uuid
);

create table if not exists public.gradebook_category_weights (
  gradebook_id uuid not null references public.gradebooks(id) on delete restrict,
  category_code text not null,
  category_label text not null,
  weight_percent numeric not null check (weight_percent > 0 and weight_percent <= 100),
  primary key (gradebook_id, category_code)
);

-- Approved prototype policy:
-- WLD 105 / WLD 205: Theory/Assessments 50%, Fabrication Projects 25%, Homework 25%.
-- WLD 110 / WLD 210: Weld Performance 75%, Shop Projects 25%.
-- Qualification, destructive-test, and certificate results remain Pass/Fail outside numeric grading.
-- Promotion to production requires a write RPC that validates category weights sum to exactly 100.

-- ---------------------------------------------------------------------------
-- 7. Append-only final course-grade record
--    This stores the approved final; it does not invent course arithmetic.
-- ---------------------------------------------------------------------------

create table if not exists public.gradebook_final_grade_revisions (
  id bigint generated always as identity primary key,
  gradebook_id uuid not null references public.gradebooks(id) on delete restrict,
  official_final_grade numeric not null
    check (official_final_grade >= 0 and official_final_grade <= 100),
  status text not null check (status in ('Finalized','Amended')),
  calculation_rule_version text not null,
  note text not null default '',
  recorded_at timestamptz not null default now(),
  recorded_by uuid
);

create index if not exists gradebook_final_grade_revisions_latest_idx
  on public.gradebook_final_grade_revisions(gradebook_id, id desc);

create or replace view public.gradebook_latest_final_grade
with (security_invoker=true) as
select f.*
from public.gradebook_final_grade_revisions f
where not exists (
  select 1 from public.gradebook_final_grade_revisions newer
  where newer.gradebook_id=f.gradebook_id and newer.id>f.id
);

-- ---------------------------------------------------------------------------
-- 8. No UPDATE / DELETE on permanent evidence tables.
--    Corrections append a new record with supersedes_id.
-- ---------------------------------------------------------------------------

create or replace function public.reject_welding_record_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'Welding permanent records are append-only; append a correction record';
end $$;

drop trigger if exists preserve_weld_position_qualifications on public.weld_position_qualifications;
create trigger preserve_weld_position_qualifications
before update or delete on public.weld_position_qualifications
for each row execute function public.reject_welding_record_mutation();

drop trigger if exists preserve_weld_destructive_tests on public.weld_destructive_tests;
create trigger preserve_weld_destructive_tests
before update or delete on public.weld_destructive_tests
for each row execute function public.reject_welding_record_mutation();

drop trigger if exists preserve_weld_test_certificates on public.weld_test_certificates;
create trigger preserve_weld_test_certificates
before update or delete on public.weld_test_certificates
for each row execute function public.reject_welding_record_mutation();


drop trigger if exists preserve_weld_certificate_deliveries on public.weld_certificate_deliveries;
create trigger preserve_weld_certificate_deliveries
before update or delete on public.weld_certificate_deliveries
for each row execute function public.reject_welding_record_mutation();

drop trigger if exists preserve_gradebook_final_grade_revisions on public.gradebook_final_grade_revisions;
create trigger preserve_gradebook_final_grade_revisions
before update or delete on public.gradebook_final_grade_revisions
for each row execute function public.reject_welding_record_mutation();

-- ---------------------------------------------------------------------------
-- 9. RLS: read through the existing gradebook authorization boundary.
--    Production write RPCs still need to be reviewed before migration promotion.
-- ---------------------------------------------------------------------------

alter table public.weld_student_identities enable row level security;
alter table public.weld_position_qualifications enable row level security;
alter table public.weld_destructive_tests enable row level security;
alter table public.weld_test_certificates enable row level security;
alter table public.weld_certificate_deliveries enable row level security;
alter table public.gradebook_grading_policies enable row level security;
alter table public.gradebook_category_weights enable row level security;
alter table public.gradebook_final_grade_revisions enable row level security;

revoke all on public.weld_student_identities,
  public.weld_position_qualifications,
  public.weld_destructive_tests,
  public.weld_test_certificates,
  public.weld_certificate_deliveries,
  public.gradebook_grading_policies,
  public.gradebook_category_weights,
  public.gradebook_final_grade_revisions
from anon, authenticated;

grant select on public.weld_student_identities,
  public.weld_position_qualifications,
  public.weld_destructive_tests,
  public.weld_test_certificates,
  public.weld_certificate_deliveries,
  public.gradebook_grading_policies,
  public.gradebook_category_weights,
  public.gradebook_final_grade_revisions
to authenticated;

create policy weld_identity_read on public.weld_student_identities
for select to authenticated using (public.can_access_weld_student(student_id));

create policy weld_qualification_read on public.weld_position_qualifications
for select to authenticated using (public.can_access_gradebook(gradebook_id));

create policy weld_destructive_test_read on public.weld_destructive_tests
for select to authenticated using (public.can_access_gradebook(gradebook_id));

create policy weld_certificate_read on public.weld_test_certificates
for select to authenticated using (
  exists (
    select 1 from public.weld_destructive_tests t
    where t.id=destructive_test_id and public.can_access_gradebook(t.gradebook_id)
  )
);

create policy weld_certificate_delivery_read on public.weld_certificate_deliveries
for select to authenticated using (
  exists (
    select 1 from public.weld_test_certificates c
    join public.weld_destructive_tests t on t.id=c.destructive_test_id
    where c.id=certificate_id and public.can_access_gradebook(t.gradebook_id)
  )
);

create policy gradebook_grading_policy_read on public.gradebook_grading_policies
for select to authenticated using (public.can_access_gradebook(gradebook_id));

create policy gradebook_category_weight_read on public.gradebook_category_weights
for select to authenticated using (public.can_access_gradebook(gradebook_id));

create policy gradebook_final_read on public.gradebook_final_grade_revisions
for select to authenticated using (public.can_access_gradebook(gradebook_id));

-- This draft deliberately does not grant direct INSERT / UPDATE / DELETE.
-- Production writes should be exposed only through reviewed SECURITY DEFINER RPCs
-- that validate section access, student enrollment, course role, source idempotency,
-- qualification Pass/Fail semantics, and certificate eligibility.

rollback;
