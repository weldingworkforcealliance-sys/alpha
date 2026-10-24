-- Keep existing reporting functions and authorization intact while excluding unresolved punches.
-- The optional private helper exists in production but not all staging baselines.
do $repair$
declare
  signature text;
  definition text;
  alias_name text;
  needle text;
begin
  foreach signature in array array[
    'public.ltg_reporting_summary_internal(uuid,date,date)',
    'private.timeclock_reported_employee_hours(uuid,date,date,text)'
  ] loop
    if to_regprocedure(signature) is null then
      if signature like 'public.%' then raise exception 'Required reporting function missing'; end if;
      continue;
    end if;
    definition := pg_get_functiondef(to_regprocedure(signature));
    alias_name := case when signature like 'public.%' then 'e' else 'te' end;
    needle := 'and ' || alias_name || '.clock_out_at is not null';
    if position(needle in definition) = 0 then raise exception 'Unexpected reporting function: %', signature; end if;
    definition := replace(definition, needle, needle || E'\n     and not ' || alias_name || '.requires_correction' ||
      E'\n     and extract(epoch from (' || alias_name || '.clock_out_at - ' || alias_name || '.clock_in_at))/3600.0 <= coalesce((select s.long_shift_threshold_hours from public.timeclock_school_settings s where s.school_id=' || alias_name || '.school_id),16)');
    execute definition;
  end loop;
end $repair$;

