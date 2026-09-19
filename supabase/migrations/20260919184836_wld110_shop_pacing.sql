-- Count actual instructional meetings, including attendance already taken today.
create or replace function private.wld110_snapshot(p_book uuid,p_student uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
  'student_id',p.student_id,'display_name',r.display_name,'active',r.active,
  'current_competency',p.current_competency,'revision',p.revision,
  'requested_at',p.requested_at,'focus',p.focus,
  'position_meetings',(select count(distinct a.attendance_date)
   from public.gradebooks g join public.attendance_pairs pair
    on g.section_id in(pair.primary_section_id,pair.completion_section_id)
   join public.attendance_sessions a on a.pair_id=pair.id
   where g.id=p_book and a.counts_toward_attendance and (a.taken_at is not null or a.status='finalized')
    and a.attendance_date between p.position_started_on and (now() at time zone 'America/New_York')::date),
  'attempts',coalesce((select jsonb_agg(to_jsonb(a)-'gradebook_id'-'student_id' order by a.competency,a.attempt_number)
    from public.wld110_shop_attempts a where a.gradebook_id=p_book and a.student_id=p_student),'[]'),
  'completions',coalesce((select jsonb_agg(to_jsonb(c)-'gradebook_id'-'student_id' order by c.competency)
    from public.wld110_shop_completions c where c.gradebook_id=p_book and c.student_id=p_student),'[]')
 )
 from public.wld110_shop_progress p join public.gradebook_roster r
 on r.gradebook_id=p.gradebook_id and r.student_id=p.student_id
 where p.gradebook_id=p_book and p.student_id=p_student
$$;
