'use client';
import {useEffect,useRef,useState} from 'react';
import {getSupabase} from '@/lib/supabase-browser';
import {formatError} from '@/lib/format-error';
import type {LabCoaching} from '@/lib/lab-coaching';
import styles from '../lab.module.css';

export default function LabStudentClient(){
 const [client]=useState(getSupabase),[student,setStudent]=useState<LabCoaching|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const token=useRef(''),requesting=useRef(false),generation=useRef(0);
 useEffect(()=>{
  let alive=true;
  const fragment=window.location.hash.slice(1);token.current=fragment;
  try{
   token.current=fragment||sessionStorage.getItem('ltg-lab-student')||'';
   if(fragment){sessionStorage.setItem('ltg-lab-student',fragment);window.history.replaceState(null,'','/lab/student');}
  }catch{ /* Keep the fragment usable when storage is unavailable. */ }
  async function refresh(){
   if(!token.current){setError('Scan the student QR code from your instructor.');return;}
   if(requesting.current)return;
   const seq=++generation.current;
   try{
    const result=await client.rpc('read_lab_student',{p_token:token.current});
    if(!alive||seq!==generation.current)return;
    if(result.error)throw result.error;setStudent(result.data as LabCoaching);setError('');
   }catch(e){if(alive&&seq===generation.current){setStudent(null);setError(formatError(e,'Your shop card could not load. Ask your instructor for a new QR code.'));}}
  }
  void refresh();const timer=setInterval(()=>void refresh(),10000);
  return()=>{alive=false;++generation.current;clearInterval(timer);};
 },[client]);
 async function request(){
  if(!student||requesting.current)return;
  requesting.current=true;++generation.current;setBusy(true);setError('');
  try{
   const result=await client.rpc('request_lab_check',{p_token:token.current,p_revision:student.revision});
   if(result.error)throw result.error;setStudent(result.data as LabCoaching);
  }catch(e){setError(formatError(e,'Check request was not confirmed. Try again.'));}
  finally{requesting.current=false;setBusy(false);}
 }
 return <main className={styles.lab}>
  {error&&<p role="alert" className={styles.error}>{error}</p>}
  {!student&&!error&&<p role="status">Loading your shop card…</p>}
  {student&&<section className={styles.card} aria-label="Your lab coaching">
   <p className={styles.muted}>{student.course_code} · {student.section_name}</p>
   <h1>{student.display_name}</h1>
   <h2>{student.assignment?.name||'Your instructor will assign your next practice task'}</h2>
   {student.assignment&&<p>{[student.assignment.process,student.assignment.position,student.assignment.electrode].filter(Boolean).join(' · ')}</p>}
   <p><strong>{student.requested_at?'Check requested':'Practice'}</strong></p>
   {student.focus.length>0&&<><h2>Practice focus</h2><ul>{student.focus.map(f=><li key={f}>{f}</li>)}</ul></>}
   {student.note&&<p>{student.note}</p>}
   {student.assignment_id&&<button className={styles.primary} disabled={busy||Boolean(student.requested_at)} onClick={()=>void request()}>{student.requested_at?'You are in the check queue':'Request check'}</button>}
   <p className={styles.muted}>Practice coaching is ungraded. Your instructor checks your work using this course’s requirements.</p>
  </section>}
 </main>;
}
