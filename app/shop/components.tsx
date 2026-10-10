'use client';
import {useState} from 'react';
import {assignmentLabel,CATEGORIES,cleanTags,COMPETENCIES,defaultRatings,gradeTotal,RATINGS,type Ratings,type ShopStudent,type Tags} from '@/lib/wld110-shop';
import {WELD_SIZER} from '@/lib/weld-sizer';
import styles from './shop.module.css';

export function StudentShopCard({student,busy,onRequest}:{student:ShopStudent;busy:boolean;onRequest:()=>void}) {
 const current=COMPETENCIES[student.current_competency];
 const next=COMPETENCIES.findIndex((_,index)=>index>student.current_competency&&!student.completions.some(completion=>completion.competency===index));
 const latest=student.attempts.at(-1);
 const completed=student.completions.at(-1);
 return <section className={styles.card} aria-label="Your shop assignment">
  <p className={styles.muted}>WLD 110 · SMAW SHOP</p><h1>{student.display_name}</h1>
  <p>Current project</p><h2>{assignmentLabel(student.current_competency)}</h2>
  {current&&<p>{current.coupon}</p>}
  <p><strong>{!current?'Complete':student.requested_at?'Check requested':'Practice'}</strong></p>
  {student.focus.length>0&&<p>Current focus: {student.focus.join(' · ')}</p>}
  {current&&<button className={styles.primary} disabled={busy||Boolean(student.requested_at)||!student.active} onClick={onRequest}>{student.requested_at?'You are in the check queue':'Request check'}</button>}
  {latest&&<p>Latest graded weld: <strong>{latest.total}%</strong> · {assignmentLabel(latest.competency)} · Weld {latest.attempt_number}</p>}
  {completed&&<p>Completed: {assignmentLabel(completed.competency)} · Competency grade <strong>{completed.grade}%</strong></p>}
  {student.current_competency>=8&&<p>Core SMAW complete. Advanced 2G is enrichment.</p>}
  {current&&<p>Next assignment: {next>=0?assignmentLabel(next):'None after this competency'}</p>}
  <p className={styles.muted}>Practice is ungraded. Advance when your instructor accepts a grade. Try again keeps you on this project.</p>
 </section>;
}

export type GradeDraft = {ratings:Ratings;tags:Tags;sizerNote:string;decision:'grade'|'retry'};
export function GradeForm({student,busy,locked,onSave,onCancel}:{student:ShopStudent;busy:boolean;locked:boolean;onSave:(draft:GradeDraft)=>void;onCancel:()=>void}) {
 const [ratings,setRatings]=useState(defaultRatings);
 const [tags,setTags]=useState<Tags>({});
 const [sizerNote,setSizerNote]=useState('');
 const attempts=student.attempts.filter(a=>a.competency===student.current_competency);
 const first=attempts[0],total=gradeTotal(ratings);
 const [decision,setDecision]=useState<'grade'|'retry'>('grade');
 const submit=(choice:'grade'|'retry')=>{setDecision(choice);onSave({ratings,tags:cleanTags(ratings,tags),sizerNote,decision:choice});};
 return <section className={styles.card+' '+styles.dialog} aria-label="Grade weld">
  <h2>{student.display_name} · Weld {attempts.length+1}</h2><p>{assignmentLabel(student.current_competency)}</p>
  {first&&<p>Weld 1: <strong>{first.total}%</strong> · Current change: {total-first.total>=0?'+':''}{total-first.total}</p>}
  {CATEGORIES.map(category=><fieldset className={styles.ratings} key={category.key} disabled={locked||busy}>
   <legend>{category.label}</legend>
   <div className={styles.choices}>{RATINGS.map(r=><button type="button" key={r.points} aria-pressed={ratings[category.key]===r.points} onClick={()=>{
    setRatings({...ratings,[category.key]:r.points});setTags({...tags,[category.key]:[]});
   }}>{r.label}<br/>{r.points}</button>)}</div>
   {ratings[category.key]===12&&<div className={styles.tags} aria-label={category.label+' deficiency tags'}>
    {category.tags.map(tag=><button type="button" key={tag} aria-pressed={tags[category.key]?.includes(tag)??false} onClick={()=>setTags({...tags,[category.key]:tags[category.key]?.includes(tag)?tags[category.key]?.filter(t=>t!==tag):[...(tags[category.key]??[]),tag]})}>{tag}</button>)}
   </div>}
  </fieldset>)}
  <p><strong>Existing LTG Weld Sizer:</strong> {WELD_SIZER.help}</p>
  <p className={styles.muted}>Check size and profile with the existing sizer. Choose Needs Work when outside its requirements. Saving records your dimensional evaluation.</p>
  <details><summary>Optional measurement / inspection note</summary><label>Sizer evidence<input maxLength={500} value={sizerNote} disabled={locked||busy} onChange={e=>setSizerNote(e.target.value)}/></label></details>
  <p className={styles.grade} aria-live="polite">Grade: {total}%</p>
  <p>Grade accepts this score as the project grade and advances to the next incomplete project. Try again saves this attempt and keeps the current project. Earlier attempts stay in history; scores are not averaged.</p>
  <div className={styles.actions}>{locked?<button disabled={busy} className={styles.primary} onClick={()=>submit(decision)}>{busy?'Saving…':'Retry same decision'}</button>:<><button disabled={busy} className={styles.primary} onClick={()=>submit('grade')}>Grade</button><button disabled={busy} onClick={()=>submit('retry')}>Try again</button></>}
  <button disabled={busy} onClick={onCancel}>{locked?'Reload student':'Cancel'}</button></div>
 </section>;
}
export function AttemptHistory({student}:{student:ShopStudent}) {
 return <details className={styles.card}><summary>All attempts · {student.attempts.length}</summary>
  {!student.attempts.length&&<p>No graded attempts. Practice does not create a grade.</p>}
  {student.attempts.map(a=>{
   const counted=student.completions.some(c=>[c.first_attempt_id,c.second_attempt_id].includes(a.id));
   return <article key={a.id}><h3>{assignmentLabel(a.competency)} · Weld {a.attempt_number} · {a.total}%</h3>
    <p>{new Date(a.recorded_at).toLocaleString()} · {counted?'Used for competency grade':'Retained in history'}</p>
    <p>{CATEGORIES.map(c=>c.label+': '+a.ratings[c.key]).join(' · ')}</p>
    {Object.values(a.tags).flat().length>0&&<p>Focus: {Object.values(a.tags).flat().join(' · ')}</p>}
    {a.sizer_note&&<p>Weld Sizer: {a.sizer_note}</p>}
   </article>;
  })}
 </details>;
}
