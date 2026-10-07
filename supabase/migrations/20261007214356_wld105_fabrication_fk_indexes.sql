create index if not exists wld105_fabrication_attempt_fk_idx
  on public.wld105_fabrication_attempts(gradebook_id, gradebook_attempt_id);
create index if not exists wld105_fabrication_student_fk_idx
  on public.wld105_fabrication_attempts(student_id);