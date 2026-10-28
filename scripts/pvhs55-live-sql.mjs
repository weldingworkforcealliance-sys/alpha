// Insert-only release. Existing approved authorities and cohort records are reused.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
const pkg=JSON.parse(readFileSync(new URL('../curriculum/pvhs55/review-package.json',import.meta.url)));
const calendar=JSON.parse(readFileSync(new URL('../curriculum/pvhs55/calendar-basis.json',import.meta.url)));
const version='PVHS-55-2026-10-28-live.1';
const q=x=>x==null?'null':"'"+String(x).replaceAll("'","''")+"'";
const sid="'08ccb452-83ab-482f-bb28-5576e02741b2'::uuid";
const course=code=>`(select id from public.courses where school_id=${sid} and course_code=${q(code)})`;
const authority=code=>`(select id from public.course_curriculum where school_id=${sid} and course_id=${course(code)} and version='2026-2027 additional Level 1 committee syllabus draft' and status='approved' and locked)`;
const guide=code=>`(select id from public.course_guides where school_id=${sid} and course_id=${course(code)} and version_label=${q(version)})`;
const codes=['B','C'].flatMap(c=>[114,115,120,150].map(n=>`PVHS-${c}-WLD${n}-2627-55`));
let sql=`begin;
set local statement_timeout='120s';
do $guard$ begin
 if exists(select 1 from public.sections where school_id=${sid} and section_code in (${codes.map(q)}))
 or exists(select 1 from public.course_guides where school_id=${sid} and version_label=${q(version)}) then raise exception 'Release already exists; refusing duplicate import'; end if;
 if (select count(*) from public.cohorts where school_id=${sid} and cohort_code in('PVHS-B-L1-2627','PVHS-C-L1-2627'))<>2 then raise exception 'Expected B/C cohorts missing'; end if;
end $guard$;
-- Capture the exact old rows in every table we touch. End-of-transaction checks
-- reject changes made indirectly by a trigger; only new IDs may be added.
create temporary table pvhs55_old_rows(table_name text,row_hash text) on commit drop;
do $snapshot$ declare t text; begin
 foreach t in array array['course_guides','course_guide_days','course_guide_day_segments','course_guide_day_outcomes','sections','section_progress','planner_days','gradebooks','gradebook_statuses','gradebook_categories','gradebook_category_weights','gradebook_items'] loop
 execute format('insert into pvhs55_old_rows select %L,md5(to_jsonb(r)::text) from public.%I r',t,t);
 end loop;
end $snapshot$;
`;
for(const m of pkg.masters){
 sql+=`insert into public.course_guides(school_id,course_id,guide_name,academic_year,version_label,planned_instructional_days,status,curriculum_authority_id,authority_notes)
 values(${sid},${course(m.course_code)},${q(m.title+' — PVHS 55-day instructor planner')},'2026-27',${q(version)},55,'draft',${authority(m.course_code)},${q(m.adaptation_note+' User authorized live release and dates October 28, 2026. Existing approved syllabus remains authority. Early-dismissal/exam minutes require instructor adjustment; no delivered hours or competence inferred.')});\n`;
 for(const d of m.days){
  const fields={title:d.title,objective:d.objective,instructor_prep:d.instructor_prep,safety_focus:d.safety_focus,opening_review:d.segments[0].instructor_actions,demonstration:d.segments[1].instructor_actions,guided_practice:d.teaching_guidance,independent_practice:d.activities.join('\n'),instructor_checks:d.acceptance,assessment:d.assessment+'\n'+d.assignment+'\n'+d.rubric_ids.map(id=>{const r=m.rubrics.find(r=>r.id===id);return r.title+'\n'+r.scoring+'\n'+r.rows.map(row=>row.label+'\n'+row.levels.join('\n')).join('\n');}).join('\n'),common_problems:d.remediation,teaching_tips:d.instructor_notes,materials_equipment:d.materials_equipment,corresponding_application:d.handoff,evidence_check_for_understanding:d.evidence,coaching_focus:d.coaching,if_students_struggle:d.remediation,keep_momentum:d.extension,safety_gate:d.gate||'Instructor safety authorization required; lesson completion is not competency.',evidence_type:d.evidence_id,inspection_acceptance_focus:d.acceptance,focused_retry:'Preserve prior attempts; record a linked reassessment.',record_link_expectation:d.evidence_id+' — '+d.gradebook_category+'\nScheduled categories: '+d.due_categories.join(', ')+'\n'+m.templates.filter(t=>d.template_ids.includes(t.id)).map(t=>t.title+'\n'+t.instructions+'\n'+t.fields.join('\n')).join('\n\n')+'\nSource: '+d.source_reference,qualification_guardrail:'No automatic pass, grade, CNC authorization, QC release or qualification from lesson completion.'};
  sql+=`insert into public.course_guide_days(school_id,course_id,guide_id,planner_day_number,${Object.keys(fields)}) values(${sid},${course(m.course_code)},${guide(m.course_code)},${d.day},${Object.values(fields).map(q)});\n`;
  const dayid=`(select id from public.course_guide_days where guide_id=${guide(m.course_code)} and planner_day_number=${d.day})`;
  for(const [i,s] of d.segments.entries())sql+=`insert into public.course_guide_day_segments(school_id,course_id,guide_day_id,sequence_number,segment_type,segment_title,planned_minutes,instructor_actions,student_actions,start_minute,end_minute) values(${sid},${course(m.course_code)},${dayid},${i+1},${q(['opening','instruction','guided_practice','assessment','closure'][i])},${q(s.title)},${s.planned_minutes},${q(s.instructor_actions)},${q(s.student_actions)},${s.start_minute},${s.end_minute});\n`;
  for(const code of d.outcome_codes)sql+=`insert into public.course_guide_day_outcomes(school_id,course_id,guide_day_id,outcome_id) select ${sid},${course(m.course_code)},${dayid},id from public.course_outcomes where curriculum_id=${authority(m.course_code)} and outcome_code=${q(code)};\n`;
 }
}
for(const s of pkg.sections){
 const m=pkg.masters.find(m=>m.course_code===s.course_code),code=`PVHS-${s.cohort}-${s.course_code.replace(' ','')}-2627-55`;
 const sec=`(select id from public.sections where school_id=${sid} and section_code=${q(code)})`,book=`(select id from public.gradebooks where section_id=${sec})`;
 const cohort=`(select id from public.cohorts where school_id=${sid} and cohort_code=${q('PVHS-'+s.cohort+'-L1-2627')})`;
 const rows=calendar.rows.filter(r=>r.pair.includes(s.course_code));
 if(rows.length!==55||m.days.length!==55)throw Error('Expected 55 days');
 sql+=`insert into public.sections(school_id,course_id,section_name,section_code,status,cohort_id,term_id,instructional_block_id,planned_instructional_days,start_time,end_time,planned_minutes_per_day,start_date,end_date)
 select ${sid},${course(s.course_code)},${q('PVHS Cohort '+s.cohort+' — '+s.course_code+' (55 days)')},${q(code)},'draft',h.id,h.term_id,(select id from public.instructional_blocks where cohort_id=h.id and school_id=h.school_id and block_number=${[114,115].includes(Number(s.course_code.slice(-3)))?2:3}),55,${q(s.start_time)},${q(s.end_time)},${m.minutes},${q(rows[0].proposed_date)},${q(rows.at(-1).proposed_date)} from public.cohorts h where h.id=${cohort};
 insert into public.section_progress(school_id,section_id,manual_hold) values(${sid},${sec},false);
 insert into public.gradebooks(section_id,course_pair_id) select ${sec},p.id from public.gradebook_course_pairs p join public.program_semesters sm on sm.id=p.semester_id join public.cohorts h on h.id=${cohort} and h.level_id=sm.level_id where ${course(s.course_code)} in(p.theory_course_id,p.lab_course_id);
 -- One empty gradebook per section; no enrollment is copied.
 do $book$ begin if (select count(*) from public.gradebooks where section_id=${sec})<>1 then raise exception 'Expected one automatically initialized gradebook'; end if; end $book$;
 insert into public.gradebook_statuses(gradebook_id,code,label,requires_score) values(${book},'pending','Pending instructor assessment',false),(${book},'scored','Instructor assessed',true);\n`;
 for(const row of rows)sql+=`insert into public.planner_days(school_id,section_id,planner_day_number,scheduled_date,title,course_id,guide_day_id) select ${sid},${sec},planner_day_number,${q(row.proposed_date)},title,course_id,id from public.course_guide_days where guide_id=${guide(s.course_code)} and planner_day_number=${row.instructional_day};\n`;
 for(const [cat,weight]of Object.entries(m.weights)){
 sql+=`insert into public.gradebook_categories(gradebook_id,code,label) values(${book},${q(cat)},${q(cat.replaceAll('_',' '))});
 insert into public.gradebook_category_weights(gradebook_id,category_code,weight_percent) values(${book},${q(cat)},${weight});\n`;
 for(const day of m.assessment_plan[cat])sql+=`insert into public.gradebook_items(gradebook_id,category_id,title,assessment_slug) select ${book},id,${q('Day '+day+' '+cat.replaceAll('_',' '))},${q(m.course_code.replace(' ','')+'-D'+String(day).padStart(2,'0')+'-'+cat)} from public.gradebook_categories where gradebook_id=${book} and code=${q(cat)};\n`;
 }
}
sql+=`set constraints all immediate;
do $verify$ declare t text; changed bigint; begin
 foreach t in array array['course_guides','course_guide_days','course_guide_day_segments','course_guide_day_outcomes','sections','section_progress','planner_days','gradebooks','gradebook_statuses','gradebook_categories','gradebook_category_weights','gradebook_items'] loop
 execute format('select count(*) from pvhs55_old_rows b where b.table_name=%L and not exists(select 1 from public.%I r where md5(to_jsonb(r)::text)=b.row_hash)',t,t) into changed;
 if changed<>0 then raise exception 'Existing rows changed in %',t; end if;
 end loop;
 if (select count(*) from public.planner_days p join public.sections s on s.id=p.section_id where s.school_id=${sid} and s.section_code in(${codes.map(q)}))<>440 then raise exception 'Expected 440 dated planner rows'; end if;
 if exists(select 1 from public.planner_day_compliance p join public.sections s on s.id=p.section_id where s.school_id=${sid} and s.section_code in(${codes.map(q)}) and (timing_status<>'PASS' or curriculum_status<>'PASS')) then raise exception 'Planner compliance failed'; end if;
end $verify$;
select s.section_code,count(p.id) days,min(p.scheduled_date) first_day,max(p.scheduled_date) last_day from public.sections s join public.planner_days p on p.section_id=s.id where s.school_id=${sid} and s.section_code in(${codes.map(q)}) group by s.section_code order by s.section_code;
commit;`;
writeFileSync(new URL('../curriculum/pvhs55/live-import.sql',import.meta.url),sql);
console.log(JSON.stringify({bytes:Buffer.byteLength(sql),version,sections:codes.length,days:440}));
// Bounded requests for Supabase's API. Every batch verifies that pre-existing
// rows are unchanged. Sections stay draft throughout the content import.
const first=sql.indexOf('insert into public.course_guides');
const end=sql.indexOf('set constraints all immediate;');
const prelude=sql.slice(0,first);
const snapshot=prelude.slice(prelude.indexOf('-- Capture'));
const verify=sql.slice(end,sql.indexOf(' if (select count(*) from public.planner_days'))+'end $verify$;\n';
const body=sql.slice(first,end), statements=[];
let start=0,quote=false,dollar=null;
for(let i=0;i<body.length;i++){
 if(dollar){if(body.startsWith(dollar,i)){i+=dollar.length-1;dollar=null;}continue;}
 if(quote){if(body[i]==="'"){if(body[i+1]==="'")i++;else quote=false;}continue;}
 if(body[i]==="'"){quote=true;continue;}
 if(body[i]==='$'){const match=body.slice(i).match(/^\$[a-zA-Z_]*\$/);if(match){dollar=match[0];i+=dollar.length-1;continue;}}
 if(body[i]===';'){statements.push(body.slice(start,i+1));start=i+1;}
}
if(body.slice(start).trim())throw Error('Unterminated SQL');
const batches=[];let batch='';
for(const stmt of statements){if(batch.length+stmt.length>180000){batches.push(batch);batch='';}batch+=stmt;}
if(batch)batches.push(batch);
const dir=new URL('../curriculum/pvhs55/live-batches/',import.meta.url);mkdirSync(dir,{recursive:true});
batches.forEach((b,i)=>writeFileSync(new URL(`${String(i).padStart(2,'0')}.sql`,dir),(i===0?prelude:'begin;\nset local statement_timeout=\'120s\';\n'+snapshot)+b+'\n'+verify+'commit;\n'));
const final=sql.slice(end).replace('commit;',`update public.course_guides set status='active' where school_id=${sid} and version_label=${q(version)};
update public.sections set status='active' where school_id=${sid} and section_code in(${codes.map(q)});
commit;`);
// Final activation deliberately excludes the import's new rows from the old-row snapshot.
writeFileSync(new URL('99-activate.sql',dir),'begin;\n'+snapshot.replace("from public.%I r'", "from public.%I r'")+final);
console.log(JSON.stringify({batches:batches.length,activation:'99-activate.sql'}));
