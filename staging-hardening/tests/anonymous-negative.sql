begin;
create temp table contract_results(test text, passed boolean, detail text) on commit drop;
do $test$
declare c record; got text;
begin
perform set_config('request.jwt.claims','{"role":"anon"}',true);
for c in select * from (values
('class read null','select public.get_classroom_assessment(null)','A valid class code is required'),
('class read empty','select public.get_classroom_assessment('''')','A valid class code is required'),
('class read oversized','select public.get_classroom_assessment(repeat(''x'',1025))','A valid class code is required'),
('job read null','select public.get_job_card_by_code(null)','A valid Live Job Card code is required'),
('job read empty','select public.get_job_card_by_code('''')','A valid Live Job Card code is required'),
('job read oversized','select public.get_job_card_by_code(repeat(''x'',1025))','A valid Live Job Card code is required'),
('class submit SQL null','select public.submit_classroom_assessment_v2(''INVALID'',''Synthetic Student'',''TEST-NULL'',null,null)','Every question must be answered'),
('job submit SQL null start','select public.submit_job_card(''INVALID'',''Synthetic Student'',''TEST-NULL'',null,''{}'',''[]'')','Invalid Start Check payload'),
('job submit SQL null quality','select public.submit_job_card(''INVALID'',''Synthetic Student'',''TEST-NULL'',''{}'',null,''[]'')','Invalid Quick Quality Check payload'),
('job submit SQL null results','select public.submit_job_card(''INVALID'',''Synthetic Student'',''TEST-NULL'',''{}'',''{}'',null)','Invalid Job Card requirement results')
) v(test,statement,expected)
loop
got:='unexpected success';
begin
execute 'set local role anon';
execute c.statement;
exception when others then got:=SQLERRM;
end;
execute 'reset role';
insert into contract_results values(c.test,got=c.expected,got);
end loop;
end $test$;
do $assert$ begin
  if exists(select 1 from contract_results where passed is not true) then
    raise exception 'Staging contract test failed; inspect test results';
  end if;
end $assert$;
select * from contract_results;
rollback;