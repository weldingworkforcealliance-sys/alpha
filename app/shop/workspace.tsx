'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import QRCode from 'qrcode';
import {StudentQrCard,type StudentQr} from './student-qr-card';
import {getSupabase} from '@/lib/supabase-browser';
import {formatError} from '@/lib/format-error';
import {assignmentLabel,CATEGORIES,PACING,sortedQueue,type ShopBoard,type ShopStudent} from '@/lib/wld110-shop';
import {AttemptHistory,GradeForm,type GradeDraft} from './components';
import styles from './shop.module.css';

export default function ShopWorkspace({gradebookId,onSaveState}:{gradebookId:string;onSaveState?:(blocked:boolean)=>void}) {
 const [client]=useState(getSupabase),[board,setBoard]=useState<ShopBoard|null>(null),[error,setError]=useState('');
 const [selected,setSelected]=useState<ShopStudent|null>(null),[busy,setBusy]=useState(false),[locked,setLocked]=useState(false);
 const [history,setHistory]=useState<string|null>(null),[notice,setNotice]=useState('');
 const [studentQr,setStudentQr]=useState<StudentQr|null>(null);
 const qrLinks=useRef(new Map<string,{url:string;image?:string}>());
 const [coaching,setCoaching]=useState<ShopStudent|null>(null),[focus,setFocus]=useState<string[]>([]);
 const saving=useRef(false),generation=useRef(0),pending=useRef<Record<string,unknown>|null>(null);
 const refresh=useCallback(async()=>{
  const seq=++generation.current;
  const result=await client.rpc('open_wld110_shop',{p_gradebook_id:gradebookId});
  if(seq!==generation.current)return;
  if(result.error)throw result.error;
  setBoard(result.data as ShopBoard);
 },[client,gradebookId]);
 useEffect(()=>{
  if(selected||coaching)return;
  let alive=true;
  const poll=()=>{void refresh().catch(e=>{if(alive)setError(formatError(e,'The shop board could not refresh. Try again.'));});};
  poll();const timer=setInterval(poll,10000);
  return()=>{alive=false;++generation.current;clearInterval(timer);};
 },[refresh,selected,coaching]);
 useEffect(()=>{onSaveState?.(Boolean(selected||coaching||busy));},[selected,coaching,busy,onSaveState]);
 useEffect(()=>{
  if(!selected&&!coaching&&!busy)return;
  const warn=(event:BeforeUnloadEvent)=>event.preventDefault();
  window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);
 },[selected,coaching,busy]);
 function accept(student:ShopStudent) {
  ++generation.current;
  setBoard(b=>b?{...b,students:b.students.map(s=>s.student_id===student.student_id?student:s)}:b);
 }
 async function save(draft:GradeDraft) {
  if(!selected||saving.current)return;
  saving.current=true;setBusy(true);setError('');
  pending.current??={p_gradebook_id:gradebookId,p_student_id:selected.student_id,p_save_id:crypto.randomUUID(),
   p_competency:selected.current_competency,p_revision:selected.revision,p_ratings:draft.ratings,p_tags:draft.tags,p_sizer_note:draft.sizerNote};
  setLocked(true);
  try{
   const result=await client.rpc('grade_wld110_weld',pending.current);
   if(result.error)throw result.error;
   const student=result.data as ShopStudent;accept(student);
   setNotice(student.current_competency>selected.current_competency?'Competency complete. Next: '+assignmentLabel(student.current_competency):'Grade saved. Continue practice for the next demonstration.');
   pending.current=null;setSelected(null);setLocked(false);
  }catch(e){setError(formatError(e,'The grade was not confirmed. Retry the same grade, or reload to check the saved record.'));}
  finally{saving.current=false;setBusy(false);}
 }
 async function practice(){
  if(!coaching||saving.current)return;
  saving.current=true;setBusy(true);setError('');
  try{
   const result=await client.rpc('coach_wld110_practice',{p_gradebook_id:gradebookId,p_student_id:coaching.student_id,p_revision:coaching.revision,p_focus:focus});
   if(result.error)throw result.error;
   const student=result.data as ShopStudent;accept(student);setCoaching(null);setNotice('');
   await prepareStudentQr(student,true);
  }catch(e){setError(formatError(e));}finally{saving.current=false;setBusy(false);}
 }
 async function prepareStudentQr(student:ShopStudent,afterCoaching:boolean){
  setStudentQr({student,afterCoaching,url:'',image:'',error:''});
  const key=gradebookId+':'+student.student_id;
  try{
   let cached=qrLinks.current.get(key);
   if(!cached){
    const result=await client.rpc('issue_wld110_student_link',{p_gradebook_id:gradebookId,p_student_id:student.student_id});
    if(result.error)throw result.error;
    if(typeof result.data!=='string'||!result.data)throw new Error('Student link could not load.');
    cached={url:window.location.origin+'/shop/student#'+result.data};
    qrLinks.current.set(key,cached);
   }
   if(!cached.image){
    cached.image=await QRCode.toDataURL(cached.url,{width:280,margin:4,errorCorrectionLevel:'M',color:{dark:'#000000',light:'#ffffff'}});
   }
   setStudentQr({student,afterCoaching,url:cached.url,image:cached.image,error:''});
  }catch{
   const cached=qrLinks.current.get(key);
   setStudentQr({student,afterCoaching,url:cached?.url??'',image:'',error:'Student QR code could not load. Try again.'});
  }
 }
 async function showStudentQr(student:ShopStudent,afterCoaching=false){
  if(saving.current)return;
  saving.current=true;setBusy(true);setError('');setNotice('');
  try{await prepareStudentQr(student,afterCoaching);}
  finally{saving.current=false;setBusy(false);}
 }
 const students=board?sortedQueue(board.students):[];
 const selectedHistory=board?.students.find(s=>s.student_id===history);
 return <div className={styles.shop}>
  <div className={styles.heading}><div><h2>WLD 110 shop board</h2><p>Ready for check: {students.filter(s=>s.active&&s.requested_at).length} · Pacing reviews: {students.filter(s=>s.active&&s.current_competency<8&&s.position_meetings>=6).length}</p></div>
  <button disabled={busy||Boolean(selected||coaching)} onClick={()=>{setError('');void refresh().catch(e=>setError(formatError(e)));}}>Refresh board</button></div>
  {error&&<p className={styles.error} role="alert">{error}</p>}
  {notice&&<p role="status">{notice}</p>}
  {!board&&!error&&<p role="status">Loading shop board…</p>}
  {selected&&<GradeForm key={selected.student_id+':'+selected.revision} student={selected} busy={busy} locked={locked} onSave={save} onCancel={()=>{pending.current=null;setLocked(false);setSelected(null);setError('');}}/>}
  {coaching&&<section className={styles.card}><h3>Practice focus · {coaching.display_name}</h3><p>Ungraded coaching and pacing review. The assignment stays the same.</p>
   <div className={styles.tags}>{['Continue current project','Targeted booth coaching','Instructor demonstration','Scrap exercise','Additional coupon',...CATEGORIES.flatMap(c=>[...c.tags])].map(tag=><button key={tag} disabled={busy} aria-pressed={focus.includes(tag)} onClick={()=>setFocus(f=>f.includes(tag)?f.filter(t=>t!==tag):f.length<12?[...f,tag]:f)}>{tag}</button>)}</div>
   <button className={styles.primary} disabled={busy} onClick={practice}>Save practice focus</button> <button disabled={busy} onClick={()=>setCoaching(null)}>Cancel</button>
  </section>}
  {studentQr&&<StudentQrCard key={studentQr.student.student_id} qr={studentQr} busy={busy} onRetry={()=>void showStudentQr(studentQr.student,studentQr.afterCoaching)}/>}
  {board&&<div className={styles.card+' '+styles.scroll}><table><caption>Check queue and current work</caption><thead><tr><th>Student</th><th>Current work</th><th>Status / focus</th><th>Action</th></tr></thead><tbody>
   {students.map(s=><tr key={s.student_id}><td>{s.display_name}{!s.active?' (inactive)':''}</td><td>{assignmentLabel(s.current_competency)}<br/><small>Core {Math.min(s.current_competency,8)} / 8</small></td>
    <td>{s.current_competency===9?'Complete':s.requested_at?'Ready for check':'Practice'}{s.requested_at&&<small> · {new Date(s.requested_at).toLocaleTimeString()}</small>}
     {s.current_competency<8&&s.position_meetings>=6&&<p className={styles.alert}>Pacing review · {s.position_meetings} meetings in position</p>}
     {s.focus.length>0&&<p>{s.focus.join(' · ')}</p>}</td>
    <td><div className={styles.actions}><button className={styles.primary} disabled={busy||Boolean(selected||coaching)||!s.active||s.current_competency===9} onClick={()=>{setSelected(s);setNotice('');setStudentQr(null);setError('');}}>Grade weld</button>
     <button disabled={busy||Boolean(selected||coaching)||!s.active||s.current_competency===9} onClick={()=>{setCoaching(s);setFocus(s.focus.slice(0,12));setStudentQr(null);setNotice('');setError('');}}>Practice / coach</button>
     <button disabled={busy||Boolean(selected||coaching)||!s.active} onClick={()=>void showStudentQr(s)}>Student QR</button>
     <button onClick={()=>setHistory(s.student_id)}>History</button></div></td></tr>)}
  </tbody></table>{!students.length&&<p>No students enrolled in this class.</p>}</div>}
  {selectedHistory&&<AttemptHistory student={selectedHistory}/>}
  <details className={styles.card}><summary>23-night pacing guide{board?.night?' · Night '+board.night:''}</summary><p>Benchmarks guide instruction. Dates never advance students. All electrodes are 1/8 in. Grade workmanship and existing sizer requirements; no bead-count requirement.</p>
   <ol>{PACING.map((night,i)=><li key={night}><strong>{board?.night===i+1?'Tonight: ':''}</strong>{night}</li>)}</ol>
  </details>
 </div>;
}
