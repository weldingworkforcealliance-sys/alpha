'use client';
import {useEffect,useState} from 'react';
import {getSupabase} from '@/lib/supabase-browser';
import {readGradebookRows,scoreLabel} from '@/lib/gradebook';
import {weldingEvidence,type EvidenceGrade,type EvidenceItem,type EvidenceWeld,type EvidenceCompletion,type WeldingEvidence} from '@/lib/welding-evidence';

export default function WeldingHistory({gradebookId,studentId,refreshKey=0}:{gradebookId:string;studentId?:string;refreshKey?:number}) {
 const [client]=useState(getSupabase),[rows,setRows]=useState<WeldingEvidence[]>([]);
 const [names,setNames]=useState<Record<string,string>>({}),[error,setError]=useState(''),[loading,setLoading]=useState(true),[retry,setRetry]=useState(0);
 useEffect(()=>{
  let alive=true;setLoading(true);setError('');setRows([]);setNames({});
  const read=<T,>(table:string,columns:string,order:string)=>readGradebookRows<T>((from,to)=>{
   let query=client.from(table).select(columns).eq('gradebook_id',gradebookId);
   if(studentId&&table!=='gradebook_items')query=query.eq('student_id',studentId);
   return query.order(order).range(from,to) as unknown as PromiseLike<{data:T[]|null;error:unknown}>;
  });
  void Promise.all([
   read<EvidenceGrade>('gradebook_latest_attempts','id,student_id,item_id,score,possible_score,status_label,attempted_at','id'),
   read<EvidenceItem>('gradebook_items','id,title,assessment_slug','id'),
   read<EvidenceWeld>('wld110_shop_attempts','id,student_id,competency,attempt_number,total,recorded_at','id'),
   read<EvidenceCompletion>('wld110_shop_completions','student_id,competency,first_attempt_id,second_attempt_id','first_attempt_id'),
   read<{attempt_id:string}>('tower_effective_grades','student_id,attempt_id','attempt_id'),
   read<{student_id:string;display_name:string;active:boolean}>('gradebook_roster','student_id,display_name,active','student_id'),
  ]).then(([grades,items,welds,completions,counted,roster])=>{
   if(!alive)return;
   setRows(weldingEvidence(grades,items,welds,completions,counted.map(row=>row.attempt_id)));
   setNames(Object.fromEntries(roster.map(row=>[row.student_id,row.display_name+(row.active?'':' (inactive)')])));
  }).catch(()=>{if(alive)setError('Welding history could not load. Existing records have not been changed.');})
   .finally(()=>{if(alive)setLoading(false);});
  return()=>{alive=false;};
 },[client,gradebookId,studentId,refreshKey,retry]);
 return <section aria-label="Combined welding history">
  <h3>Combined welding history</h3>
  <p>Earlier welding grades and all shop demonstrations appear here. A demonstration becomes a competency grade only after the required checks; it is not counted twice.</p>
  <button type="button" disabled={loading} onClick={()=>setRetry(value=>value+1)}>Refresh welding history</button>
  {loading?<p role="status">Loading welding history…</p>:error?<p role="alert">{error}</p>:!rows.length?<p>No welding grades or demonstrations recorded for this selection.</p>:
   <div style={{overflowX:'auto'}}><table><caption>Saved welding evidence</caption><thead><tr><th>Student</th><th>Assignment</th><th>Score</th><th>Record type</th><th>Date</th></tr></thead><tbody>
    {rows.map(row=><tr key={row.id}><td>{names[row.studentId]??'Student record'}</td><td>{row.title}</td><td>{scoreLabel(row.score,row.possible)}</td><td>{row.status}</td><td>{new Date(row.date).toLocaleString()}</td></tr>)}
   </tbody></table></div>}
 </section>;
}
