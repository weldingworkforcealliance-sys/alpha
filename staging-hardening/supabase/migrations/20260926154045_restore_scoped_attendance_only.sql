-- Gltg only. The preview now uses class/date scoped RPCs.
revoke execute on function public.mark_all_attendance(uuid,text) from authenticated;
revoke execute on function public.set_attendance_record(uuid,uuid,text,text,text[],text) from authenticated;
revoke execute on function public.reset_attendance_session(uuid) from authenticated;

