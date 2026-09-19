-- Cover both composite demonstration references used by competency records.
create index wld110_completion_first_reference_idx on public.wld110_shop_completions(gradebook_id,student_id,competency,first_attempt_id);
create index wld110_completion_second_reference_idx on public.wld110_shop_completions(gradebook_id,student_id,competency,second_attempt_id);
