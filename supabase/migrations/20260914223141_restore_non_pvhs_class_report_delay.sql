update public.attendance_pairs
set report_delay_minutes = 30,
    updated_at = now()
where pair_name = 'PCCC Night · WLD 105/110'
  and report_delay_minutes is distinct from 30;
