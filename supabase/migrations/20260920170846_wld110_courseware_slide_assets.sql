-- Repurpose the empty instructor-only WLD 110 courseware chunk table for full-slide images.
-- The initial PDF-chunk table was applied before assets were loaded, so this rename preserves history
-- while using much smaller full-slide WebP images for lab display.

alter table public.instructor_courseware_pdf_chunks
  rename to instructor_courseware_slide_assets;

alter table public.instructor_courseware_slide_assets
  rename column chunk_index to slide_number;
alter table public.instructor_courseware_slide_assets
  rename column chunk_b64 to image_b64;
alter table public.instructor_courseware_slide_assets
  rename column total_chunks to source_slide_count;

alter table public.instructor_courseware_slide_assets
  alter column mime_type set default 'image/webp';

drop policy if exists instructor_courseware_pdf_chunks_select
  on public.instructor_courseware_slide_assets;
create policy instructor_courseware_slide_assets_select
on public.instructor_courseware_slide_assets
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

alter index if exists public.instructor_courseware_pdf_chunks_lookup_idx
  rename to instructor_courseware_slide_assets_lookup_idx;
