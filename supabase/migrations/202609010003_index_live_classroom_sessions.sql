-- Cover live-classroom foreign keys for school-scale reporting and cleanup.

create index if not exists classroom_sessions_school_id_idx on public.classroom_sessions(school_id);
create index if not exists classroom_sessions_section_id_idx on public.classroom_sessions(section_id);
create index if not exists classroom_sessions_instructor_id_idx on public.classroom_sessions(instructor_id);
create index if not exists classroom_sessions_assessment_slug_idx on public.classroom_sessions(assessment_slug);
