'use client';
import {useEffect,useRef,useState} from 'react';
import {getSupabase} from '@/lib/supabase-browser';
import {readGradebookRows,scoreLabel} from '@/lib/gradebook';
import {formatError} from '@/lib/format-error';
import styles from './workspace.module.css';

type Student={student_id:string;display_name:string;active:boolean};
type Item={id:string;title:string;assessment_slug:string|null};
type Attempt={id:string;student_id:string;item_id:string;attempted_at:string;status_code:string;status_label:string;score:number|null;possible_score:number|null;revision_id:number};
type Revision={id:number;status_label:string;score:number|null;possible_score:number|null;recorded_at:string;note:string};
type Props={bookId:string;students:Student[];items:Item[];attempts:Attempt[];statuses:{code:string;label:string;active:boolean;requires_score:boolean}[];countedIds:string[];studentId?:string;disabled?:boolean;onRecord:(id:string)=>void;onWelding:(student:string,assignment:string)=>void;onRefresh:()=>void};

// Latest ordinary attempt, explicitly counted Tower attempt. Never average evidence rows.
export function cellAttempts(attempts:Attempt[],student:string,item:Item,countedIds:string[]){
 const rows=attempts.filter(a=>a.student_id===student&&a.item_id===item.id).sort((a,b)=>b.attempted_at.localeCompare(a.attempted_at)||b.revision_id-a.revision_id);
 const counted=item.assessment_slug?.startsWith('tower:')?rows.find(a=>countedIds.includes(a.id)):rows[0];
 return {rows,counted};
}

export default function GradeGrid(props:Props){
 const [search,setSearch]=useState(''),[assessment,setAssessment]=useState(''),[showAll,setShowAll]=useState(false);
 const [detail,setDetail]=useState<{student:Student;item:Item;rows:Attempt[]}|null>(null);
 const students=props.students.filter(s=>(!props.studentId||s.student_id===props.studentId)&&s.display_name.toLowerCase().includes(search.toLowerCase().trim()));
 const items=props.items.filter(i=>(!assessment||i.id===assessment)&&(showAll||assessment||props.attempts.some(a=>a.item_id===i.id&&(!props.studentId||a.student_id===props.studentId))));
 function score(student:Student,item:Item){
  const {rows,counted}=cellAttempts(props.attempts,student.student_id,item,props.countedIds);
  return rows.length?<button className={styles.scoreButton} disabled={props.disabled} aria-label={`${student.display_name} · ${item.title} · ${counted?scoreLabel(counted.score,counted.possible_score):'No counted grade'}`} onClick={()=>setDetail({student,item,rows})}>
   <strong>{counted?scoreLabel(counted.score,counted.possible_score):'No counted grade'}</strong><span>{counted?.status_label??'Retained history'}{rows.length>1?` · ${rows.length} attempts`:''}</span>
  </button>:<span className={styles.emptyScore}>Not recorded</span>;
 }
 return <section aria-label="Class grades">
  <div className={styles.filters}>
   {!props.studentId&&<label>Find student<input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Name or student number"/></label>}
   <label>Assessment<select value={assessment} onChange={e=>setAssessment(e.target.value)}><option value="">All assessments</option>{props.items.map(i=><option key={i.id} value={i.id}>{i.title}</option>)}</select></label>
   <label><input type="checkbox" checked={showAll} onChange={e=>setShowAll(e.target.checked)}/> Show assignments without grades</label>
  </div>
  <p>{students.length} student(s) · {items.length} assessment(s). Select a score for attempts, history or corrections. “Not recorded” is not a zero.</p>
  {!students.length?<p>No students match this selection.</p>:!items.length?<><p>No recorded assessments for this selection. Enable “Show assignments without grades” to view the catalog.</p><ul>{students.map(s=><li key={s.student_id}><button disabled={props.disabled} onClick={()=>props.onRecord(s.student_id)}>{s.display_name}</button>{!s.active&&' (inactive)'}</li>)}</ul></>:<>
   <div className={`${styles.scroll} ${styles.desktopGrid}`} tabIndex={0} role="region" aria-label="Scrollable grade grid"><table className={styles.gradeGrid}><thead><tr><th scope="col">Student</th>{items.map(i=><th scope="col" key={i.id}>{i.title}</th>)}</tr></thead><tbody>
    {students.map(s=><tr key={s.student_id}><th scope="row"><button disabled={props.disabled} onClick={()=>props.onRecord(s.student_id)}>{s.display_name}</button>{!s.active&&<span>Inactive</span>}</th>{items.map(i=><td key={i.id}>{score(s,i)}</td>)}</tr>)}
   </tbody></table></div>
   <div className={styles.mobileGrades}>{students.map(s=><article className={styles.studentCard} key={s.student_id}><h3><button disabled={props.disabled} onClick={()=>props.onRecord(s.student_id)}>{s.display_name}</button>{!s.active&&' (inactive)'}</h3><dl>{items.map(i=><div key={i.id}><dt>{i.title}</dt><dd>{score(s,i)}</dd></div>)}</dl></article>)}</div>
  </>}
  {detail&&<GradeDetail key={detail.student.student_id+detail.item.id} {...props} {...detail} onClose={()=>setDetail(null)}/>}
 </section>;
}

function GradeDetail(props:Props&{student:Student;item:Item;rows:Attempt[];onClose:()=>void}){
 const [client]=useState(getSupabase),dialog=useRef<HTMLDialogElement>(null);
 const [attemptId,setAttemptId]=useState(cellAttempts(props.rows,props.student.student_id,props.item,props.countedIds).counted?.id??props.rows[0].id);
 const attempt=props.rows.find(a=>a.id===attemptId)!;
 const [history,setHistory]=useState<Revision[]>([]),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[editing,setEditing]=useState(false),[retry,setRetry]=useState(0);
 const welding=/^(tower:|wld110-shop:)/.test(props.item.assessment_slug??'');
 useEffect(()=>{const el=dialog.current;const previous=document.activeElement as HTMLElement|null;el?.showModal();return()=>{el?.close();previous?.focus();};},[]);
 useEffect(()=>{let alive=true;setLoading(true);setError('');setHistory([]);
  void readGradebookRows<Revision>((from,to)=>client.from('gradebook_revisions').select('id,status_label,score,possible_score,recorded_at,note').eq('gradebook_id',props.bookId).eq('attempt_id',attemptId).order('id',{ascending:false}).range(from,to))
   .then(rows=>{if(alive)setHistory(rows);}).catch(()=>{if(alive)setError('History could not load. Retry before making a correction.');}).finally(()=>{if(alive)setLoading(false);});
  return()=>{alive=false;};
 },[client,props.bookId,attemptId,retry]);
 return <dialog ref={dialog} className={styles.gradeDialog} aria-labelledby="grade-detail-title" onCancel={e=>{e.preventDefault();if(!busy)props.onClose();}}>
  <header className={styles.dialogHeader}><div><h2 id="grade-detail-title">{props.student.display_name}</h2><p>{props.item.title}</p></div><button autoFocus disabled={busy} onClick={props.onClose}>Close</button></header>
  <label>Attempt<select disabled={busy||editing} value={attemptId} onChange={e=>setAttemptId(e.target.value)}>{props.rows.map(a=><option key={a.id} value={a.id}>{new Date(a.attempted_at).toLocaleString()} · {scoreLabel(a.score,a.possible_score)}{props.countedIds.includes(a.id)?' · Counted':''}</option>)}</select></label>
  <p><strong>{scoreLabel(attempt.score,attempt.possible_score)}</strong> · {attempt.status_label}</p>
  {error&&<p role="alert">{error}</p>}
  {loading?<p role="status">Loading grade history…</p>:<><h3>Grade history</h3><ol>{history.map(r=><li key={r.id}>{scoreLabel(r.score,r.possible_score)} · {r.status_label} · {new Date(r.recorded_at).toLocaleString()}<p>{r.note}</p></li>)}</ol>{!history.length&&<button onClick={()=>setRetry(v=>v+1)}>Retry history</button>}</>}
  {welding?<><p>Welding grades use their original rubric. Individual demonstrations do not count as additional course grades.</p><button onClick={()=>{props.onClose();props.onWelding(props.student.student_id,props.item.assessment_slug!);}}>Open welding assessment</button></>:!editing?<button disabled={loading||!history.length||props.disabled} onClick={()=>setEditing(true)}>Correct this grade</button>:<form onSubmit={async e=>{
   e.preventDefault();if(busy)return;const data=new FormData(e.currentTarget);setBusy(true);setError('');
   try{const result=await client.rpc('record_gradebook_attempt',{p_gradebook_id:props.bookId,p_item_id:attempt.item_id,p_student_id:attempt.student_id,p_status_code:data.get('status'),p_score:data.get('score')===''?null:Number(data.get('score')),p_possible_score:data.get('possible')===''?null:Number(data.get('possible')),p_note:data.get('note'),p_attempt_id:attempt.id});if(result.error)throw result.error;props.onClose();props.onRefresh();}
   catch(c){setError(formatError(c,'Correction was not saved. Your entries remain here.'));}finally{setBusy(false);}
  }}><fieldset disabled={busy}><legend>Correct this grade</legend><p>The original grade remains in history.</p>
   <label>Status<select name="status" defaultValue={attempt.status_code}>{props.statuses.filter(s=>s.active||s.code===attempt.status_code).map(s=><option key={s.code} value={s.code}>{s.label}</option>)}</select></label>
   <label>Score<input name="score" type="number" min="0" step="any" defaultValue={attempt.score??''}/></label>
   <label>Possible score<input name="possible" type="number" min="0.01" step="any" defaultValue={attempt.possible_score??''}/></label>
   <label>Correction reason<input name="note" required/></label><button>Save correction</button><button type="button" onClick={()=>setEditing(false)}>Cancel correction</button>
  </fieldset></form>}
 </dialog>;
}
