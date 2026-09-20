-- Private-by-RLS storage for licensed WLD 110 courseware PDFs.
-- Stores chapter PDFs in base64 chunks so the instructor-only route can serve full slide visuals
-- without exposing the purchased courseware in the public repository.

create table if not exists public.instructor_courseware_pdf_chunks (
  school_id uuid not null references public.schools(id) on delete cascade,
  course_code text not null default 'WLD 110',
  chapter_key text not null check (chapter_key in ('ofc','smaw','safety')),
  chunk_index integer not null check (chunk_index >= 0),
  chunk_b64 text not null check (length(chunk_b64) > 0),
  total_chunks integer not null check (total_chunks > 0),
  source_filename text not null,
  mime_type text not null default 'application/pdf',
  sha256 text not null,
  created_at timestamptz not null default now(),
  primary key (school_id, chapter_key, chunk_index)
);

alter table public.instructor_courseware_pdf_chunks enable row level security;

revoke all on public.instructor_courseware_pdf_chunks from anon;
revoke insert, update, delete on public.instructor_courseware_pdf_chunks from authenticated;
grant select on public.instructor_courseware_pdf_chunks to authenticated;

drop policy if exists instructor_courseware_pdf_chunks_select on public.instructor_courseware_pdf_chunks;
create policy instructor_courseware_pdf_chunks_select
on public.instructor_courseware_pdf_chunks
for select
to authenticated
using (
  school_id = '08ccb452-83ab-482f-bb28-5576e02741b2'::uuid
  and (
    public.is_platform_owner()
    or public.has_school_role(
      school_id,
      array[
        'school_admin'::public.app_school_role,
        'program_lead'::public.app_school_role,
        'lead_instructor'::public.app_school_role,
        'instructor'::public.app_school_role
      ]
    )
  )
);

create index if not exists instructor_courseware_pdf_chunks_lookup_idx
  on public.instructor_courseware_pdf_chunks (school_id, chapter_key, chunk_index);
