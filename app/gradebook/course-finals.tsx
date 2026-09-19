'use client';
import {useState} from 'react';
import {getSupabase} from '@/lib/supabase-browser';
import {formatError} from '@/lib/format-error';
import {readGradebookRows} from '@/lib/gradebook';
type Preview={ready:boolean;grade:number|null;passingScore:number;fingerprint:string;blockers:number;categories:{code:string;weight:number;average:number|null;unresolved:number}[]};
type Final={id:string;snapshot:Preview;source_fingerprint:string;reason:string;finalized_at:string};
export default function CourseFinals({bookId,students}:{bookId:string;students:{student_id:string;display_name:string;active:boolean}[]}){
 const [client]=useState(getSupabase),[student,setStudent]=useState(''),[preview,setPreview]=useState<Preview|null>(null),[finals,setFinals]=useState<Final[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[reason,setReason]=useState('');
 async function review(){
  setBusy(true);setError('');setPreview(null);
  try{const [p,f]=await Promise.all([client.rpc('preview_gradebook_final',{p_gradebook_id:bookId,p_student_id:student}),readGradebookRows<Final>((from,to)=>client.from('gradebook_finalizations').select('id,snapshot,source_fingerprint,reason,finalized_at').eq('gradebook_id',bookId).eq('student_id',student).order('revision',{ascending:false}).range(from,to))]);if(p.error)throw p.error;setPreview(p.data);setFinals(f);}catch(e){setError(formatError(e,'Could not load course totals.'));}finally{setBusy(false);}
 }
 async function finalize(){
  if(!preview?.ready)return;setBusy(true);setError('');
  try{const r=await client.rpc('finalize_gradebook_student',{p_gradebook_id:bookId,p_student_id:student,p_fingerprint:preview.fingerprint,p_reason:reason});if(r.error)throw r.error;setReason('');await review();}catch(e){setError(formatError(e,'Final grade was not saved.'));}finally{setBusy(false);}
 }
 return <section aria-label="Final course grades"><h3>Final course grades</h3><p>Shop: welding 75%, projects 25%. Theory: assessments 50%, fabrication projects 25%, homework 25%. Passing: 65%.</p>
 <p>All assigned items must be resolved. Missing work counts as zero and needs its possible points entered. Excused work is excluded. Every weighted category needs graded work. Ordinary assessments use the latest attempt; welding uses its counted attempt.</p>
 <label>Student for final grade<select disabled={busy} value={student} onChange={e=>{setStudent(e.target.value);setPreview(null);setFinals([]);setReason('');setError('');}}><option value="">Choose student</option>{students.map(s=><option key={s.student_id} value={s.student_id}>{s.display_name}{!s.active?' (inactive)':''}</option>)}</select></label>
 <button disabled={busy||!student} onClick={()=>void review()}>Review course total</button>
 {error&&<p role="alert">{error}</p>}
 {preview&&<><table><thead><tr><th>Category</th><th>Weight</th><th>Average</th></tr></thead><tbody>{preview.categories.map(c=><tr key={c.code}><td>{c.code.replaceAll('_',' ')}</td><td>{c.weight}%</td><td>{c.average===null?'No counted work':`${c.average}%`}{c.unresolved?` · ${c.unresolved} unresolved`:''}</td></tr>)}</tbody></table>
 <p>{preview.ready?`Reviewed total: ${preview.grade}% · ${preview.grade!>=preview.passingScore?'Passing':'Not passing'}`:`Not ready to finalize: ${preview.blockers} unresolved item/category checks.`}</p>
 {finals[0]&&<p>Last finalized: {finals[0].snapshot.grade}% · {new Date(finals[0].finalized_at).toLocaleString()}{finals[0].source_fingerprint!==preview.fingerprint?' · Grades have changed since finalization. Review before issuing a correction.':''}</p>}
 <label>Finalization / correction reason<input value={reason} onChange={e=>setReason(e.target.value)} disabled={busy}/></label><button disabled={busy||!preview.ready||!reason.trim()||!students.find(s=>s.student_id===student)?.active||finals[0]?.source_fingerprint===preview.fingerprint} onClick={()=>void finalize()}>Finalize reviewed grade</button>
 <details><summary>Final-grade history</summary><ol>{finals.map(f=><li key={f.id}>{f.snapshot.grade}% · {new Date(f.finalized_at).toLocaleString()} · {f.reason}</li>)}</ol></details></>}
 </section>;
}
