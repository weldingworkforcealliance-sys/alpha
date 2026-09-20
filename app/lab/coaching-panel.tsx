'use client';
import {useEffect,useRef,useState} from 'react';
import {getSupabase} from '@/lib/supabase-browser';
import {formatError} from '@/lib/format-error';
import {StudentQrCache} from '@/lib/student-qr';
import {PRACTICE_FOCUS,type LabCoaching,type LabContext} from '@/lib/lab-coaching';
import {StudentQrCard,type StudentQr} from './student-qr-card';
import styles from './lab.module.css';

type Form={student:LabCoaching;assignmentId:string;focus:string[];note:string};
type Props={gradebookId:string;context:LabContext;assignments:{id:string;name:string}[];
 disabled:boolean;onBlocked:(blocked:boolean)=>void;onSelect:(studentId:string,assignmentId:string)=>void};
export default function LabCoachingPanel({gradebookId,context,assignments,disabled,onBlocked,onSelect}:Props){
 const [client]=useState(getSupabase),[rows,setRows]=useState<LabCoaching[]>([]);
 const [form,setForm]=useState<Form|null>(null),[qr,setQr]=useState<StudentQr|null>(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[loaded,setLoaded]=useState(false);
 const [locked,setLocked]=useState(false);
 const pending=useRef<Record<string,unknown>|null>(null),saving=useRef(false),cache=useRef(new StudentQrCache());
 const handled=useRef<number|undefined>(undefined),formNode=useRef<HTMLElement>(null);
 const blocked=Boolean(form||busy);
 const busyState=useRef(blocked);busyState.current=blocked;
 const generation=useRef(0);
 useEffect(()=>{onBlocked(blocked);},[blocked,onBlocked]);
 useEffect(()=>{
  let alive=true;
  async function refresh(){
   if(busyState.current)return;
   const seq=++generation.current;
   try{
    const result=await client.rpc('open_lab_coaching',{p_gradebook_id:gradebookId});
    if(!alive||seq!==generation.current||busyState.current)return;
    if(result.error)throw result.error;
    setRows(result.data as LabCoaching[]);setLoaded(true);setError('');
   }catch(e){if(alive&&seq===generation.current&&!busyState.current)setError(formatError(e,'Student coaching could not load.'));}
  }
  void refresh();const timer=setInterval(()=>void refresh(),10000);
  return()=>{alive=false;++generation.current;clearInterval(timer);};
 },[client,gradebookId,blocked]);
 useEffect(()=>{
  if(!blocked)return;
  const warn=(event:BeforeUnloadEvent)=>event.preventDefault();
  window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);
 },[blocked]);
 useEffect(()=>{if(form)formNode.current?.focus();},[Boolean(form)]);
 useEffect(()=>{if(!blocked)setQr(null);},[context.studentId,context.assignmentId]); // Hide the previous student's handoff.
 function accept(row:LabCoaching){++generation.current;setRows(old=>old.map(s=>s.student_id===row.student_id?row:s));}
 function start(row:LabCoaching){
  if(disabled||busyState.current)return;
  setQr(null);setError('');pending.current=null;setLocked(false);
  setForm({student:row,assignmentId:context.assignmentId||row.assignment_id||assignments[0]?.id||'',focus:[...row.focus],note:row.note});
 }
 async function prepare(row:LabCoaching,afterCoaching:boolean){
  const student={student_id:row.student_id,display_name:row.display_name,focus:row.focus,note:row.note,assignment:row.assignment?.name};
  const key=gradebookId+':'+row.student_id;
  setQr({student,afterCoaching,url:'',image:'',error:''});
  try{
   const link=await cache.current.prepare(key,async()=>{
    const result=await client.rpc('issue_lab_student_link',{p_gradebook_id:gradebookId,p_student_id:row.student_id});
    if(result.error)throw result.error;
    if(typeof result.data!=='string'||!result.data)throw new Error('Student link could not load.');
    return window.location.origin+'/lab/student#'+result.data;
   });
   setQr({student,afterCoaching,...link,error:''});
  }catch{setQr({student,afterCoaching,url:cache.current.url(key),image:'',error:'Student QR code could not load. Try again.'});}
 }
 async function showQr(row:LabCoaching,afterCoaching=false){
  if(saving.current||disabled)return;
  saving.current=true;setBusy(true);setError('');
  try{await prepare(row,afterCoaching);}finally{saving.current=false;setBusy(false);}
 }
 const selected=rows.find(row=>row.student_id===context.studentId);
 useEffect(()=>{
  if(context.requestId===undefined||context.requestId===handled.current||!selected||disabled||blocked)return;
  handled.current=context.requestId;
  if(context.action==='coach')start(selected);
  if(context.action==='qr')void showQr(selected);
 });
 async function save(){
  if(!form||saving.current)return;
  saving.current=true;setBusy(true);setError('');setLocked(true);
  pending.current??={p_gradebook_id:gradebookId,p_student_id:form.student.student_id,p_revision:form.student.revision,
   p_save_id:crypto.randomUUID(),p_assignment_id:form.assignmentId,p_focus:form.focus,p_note:form.note};
  try{
   const result=await client.rpc('save_lab_coaching',pending.current);
   if(result.error)throw result.error;
   const row=result.data as LabCoaching;accept(row);pending.current=null;setLocked(false);setForm(null);
   await prepare(row,true);
  }catch(e){setError(formatError(e,'Coaching save was not confirmed. Retry the same save.'));}
  finally{saving.current=false;setBusy(false);}
 }
 async function markHandled(row:LabCoaching){
  if(saving.current||disabled)return;
  saving.current=true;setBusy(true);setError('');
  try{
   const result=await client.rpc('mark_lab_check_handled',{p_gradebook_id:gradebookId,p_student_id:row.student_id,p_requested_at:row.requested_at});
   if(result.error)throw result.error;accept(result.data as LabCoaching);
  }catch(e){setError(formatError(e,'Check status could not save.'));}
  finally{saving.current=false;setBusy(false);}
 }
 const ready=rows.filter(row=>row.requested_at).sort((a,b)=>a.requested_at!.localeCompare(b.requested_at!));
 return <section className={styles.lab} aria-label="Lab student coaching">
  <div className={styles.heading}><h2>Student coaching</h2><span>Ready for check: {ready.length}</span></div>
  {error&&<p className={styles.error} role="alert">{error}</p>}
  {!loaded&&!error&&<p role="status">Loading student coaching…</p>}
  {ready.length>0&&<div className={styles.queue} aria-label="Students ready for check">{ready.map(row=>
   <button key={row.student_id} disabled={disabled||blocked} onClick={()=>onSelect(row.student_id,row.assignment_id||context.assignmentId)}>{row.display_name} · Ready for check</button>)}</div>}
  {!form&&selected&&<div className={styles.actions}>
   <strong>{selected.display_name}</strong>
   <button className={styles.primary} disabled={disabled||busy||!loaded} onClick={()=>start(selected)}>Practice / coach</button>
   <button disabled={disabled||busy||!loaded} onClick={()=>void showQr(selected)}>Student QR</button>
   {selected.requested_at&&<button disabled={disabled||busy} onClick={()=>void markHandled(selected)}>Check handled</button>}
  </div>}
  {form&&<section ref={formNode} tabIndex={-1} className={styles.card+' '+styles.dialog} aria-label="Practice coaching form">
   <h3 className={styles.formTitle}>Practice focus · {form.student.display_name}</h3>
   <p>Save coaching, then let the student scan their QR code.</p>
   <label>Assignment<select disabled={locked||busy} value={form.assignmentId} onChange={e=>setForm({...form,assignmentId:e.target.value})}>
    {assignments.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
   <div className={styles.focusList}>{Array.from(new Set([...PRACTICE_FOCUS,...form.focus])).map(focus=>
    <button key={focus} disabled={locked||busy} aria-pressed={form.focus.includes(focus)} onClick={()=>setForm({...form,focus:form.focus.includes(focus)?form.focus.filter(f=>f!==focus):form.focus.length<12?[...form.focus,focus]:form.focus})}>{focus}</button>)}</div>
   <label>Coaching note (optional)<textarea maxLength={500} disabled={locked||busy} value={form.note} onChange={e=>setForm({...form,note:e.target.value})}/></label>
   <div className={styles.actions}><button className={styles.primary} disabled={busy||!form.assignmentId} onClick={()=>void save()}>{busy?'Saving…':locked?'Retry coaching save':'Save practice focus'}</button>
    <button disabled={busy} onClick={()=>{setForm(null);setLocked(false);pending.current=null;setError('');}}>{locked?'Close and reload coaching':'Cancel'}</button></div>
  </section>}
  {qr&&<StudentQrCard key={qr.student.student_id} qr={qr} busy={busy} onRetry={()=>{const row=rows.find(r=>r.student_id===qr.student.student_id);if(row)void showQr(row,qr.afterCoaching);}}/>}
 </section>;
}
