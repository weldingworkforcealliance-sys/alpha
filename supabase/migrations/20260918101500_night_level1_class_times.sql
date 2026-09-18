-- Set exact Night Level 1 class clock times for the LTG class-time watchdog.
-- Planned instructional minutes are intentionally unchanged; only scheduled start/end
-- times are set here.

update public.sections
set start_time = time '17:00',
    end_time   = time '18:00'
where section_code = 'PCCC-NIGHT-WLD105-2627';

update public.sections
set start_time = time '18:15',
    end_time   = time '21:45'
where section_code = 'PCCC-NIGHT-WLD110-2627';
