-- STAGING ONLY: Gltg ezlvivmeneefiiwqwgqd
set local lock_timeout='3s';
set local statement_timeout='15s';
do $guard$ begin
if (select md5(pg_get_functiondef(oid)) from pg_proc where oid='public.start_current_planner_day(uuid,date)'::regprocedure) is distinct from 'a5c7f788586342e78a25540c96d9cc04' then raise exception 'Planner function drift; review before applying'; end if;
end $guard$;
alter function public.start_current_planner_day(uuid,date) set search_path='public';
