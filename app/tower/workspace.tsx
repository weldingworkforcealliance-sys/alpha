'use client';
import {useEffect,useRef,useState} from 'react';
import {getSupabase} from '@/lib/supabase-browser';
import {readGradebookRows,type Gradebook} from '@/lib/gradebook';
import {formatError} from '@/lib/format-error';
import LabCoachingPanel from '../lab/coaching-panel';
import type {LabContext} from '@/lib/lab-coaching';
import {WELD_SIZER} from '@/lib/weld-sizer';
import {courseFinalRecords,type SavedCourseFinal} from '@/lib/course-final-records';
type StudentRow={id:string;name:string;active:boolean;weldTestId:string;revision:number;data:Record<string,unknown>};
type Payload={book:Gradebook;students:StudentRow[];assignments:Record<string,unknown>[]};
type Props={gradebookId?:string;view?:string;studentId?:string;assignmentId?:string;onStudentChange?:(id:string)=>void;onSaveState?:(blocked:boolean)=>void};
export default function TowerWorkspace(props:Props){
 const context=useRef(props);context.current=props;
 const [client]=useState(getSupabase),[books,setBooks]=useState<Gradebook[]>([]),[selected,setSelected]=useState('');
 const [payload,setPayload]=useState<Payload|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [labContext,setLabContext]=useState<LabContext|null>(null),[frameBlocked,setFrameBlocked]=useState(false),[coachingBlocked,setCoachingBlocked]=useState(false);
 const coachingState=useRef(false);coachingState.current=coachingBlocked;
 const actionSequence=useRef(0);
 useEffect(()=>{props.onSaveState?.(frameBlocked||coachingBlocked||busy);},[frameBlocked,coachingBlocked,busy,props.onSaveState]);
 const frame=useRef<HTMLIFrameElement>(null),current=useRef<Payload|null>(null),busyRef=useRef(false);
 const responses=useRef(new Map<number,Record<string,unknown>>());
 useEffect(()=>{let alive=true;void readGradebookRows<Gradebook>((from,to)=>client.from('gradebook_directory').select('*').eq('course_role','lab').eq('section_status','active').order('section_name').order('id').range(from,to))
  .then(rows=>{if(alive){setBooks(rows);setSelected(context.current.gradebookId||rows[0]?.id||'');setLoading(false);}}).catch(c=>{if(alive){setError(formatError(c,'Unable to load your assigned classes.'));setLoading(false);}});
  return()=>{alive=false;};},[client]);
 useEffect(()=>{if(props.gradebookId)setSelected(props.gradebookId);},[props.gradebookId]);
 useEffect(()=>{frame.current?.contentWindow?.postMessage({type:'tower-context',view:props.view,studentId:props.studentId,assignmentId:props.assignmentId},window.location.origin);},[props.view,props.studentId,props.assignmentId]);
 useEffect(()=>{let alive=true;setPayload(null);setLabContext(null);setFrameBlocked(false);setCoachingBlocked(false);current.current=null;responses.current.clear();if(!selected)return;
  setLoading(true);setError('');void client.rpc('open_tower',{p_gradebook_id:selected}).then(({data,error}:{data:Payload|null;error:unknown})=>{
   if(!alive)return;if(error){setError(formatError(error,'Could not load this class.'));}else{current.current=data;setPayload(data);}setLoading(false);});
  return()=>{alive=false;};},[client,selected]);
 useEffect(()=>{
  async function receive(e:MessageEvent){
   if(e.origin!==window.location.origin||e.source!==frame.current?.contentWindow||!current.current)return;
   const m=e.data;const target=frame.current.contentWindow;
   if(m?.type==='tower-selection'){
    if(coachingState.current)return;
    if(!current.current.students.some(s=>s.id===m.studentId&&s.active))return;
    context.current.onStudentChange?.(m.studentId);
    setLabContext(m.view==='lab'?{studentId:m.studentId,assignmentId:m.assignmentId}:null);return;
   }
   if(m?.type==='tower-coaching'){
    if(coachingState.current||busyRef.current)return;
    if(!current.current.students.some(s=>s.id===m.studentId&&s.active)||
      !current.current.assignments.some(a=>a.id===m.assignmentId)||!['coach','qr'].includes(m.action))return;
    setLabContext({studentId:m.studentId,assignmentId:m.assignmentId,action:m.action,requestId:++actionSequence.current});return;
   }
   if(m?.type==='tower-save-state'){setFrameBlocked(Boolean(m.blocked));return;}
   if(m?.type==='tower-ready'){target?.postMessage({type:'tower-init',payload:{...current.current,weldSizer:WELD_SIZER},context:{view:context.current.view,studentId:context.current.studentId,assignmentId:context.current.assignmentId}},window.location.origin);return;}
   if(m?.type==='tower-read-finals'&&typeof m.requestId==='number'){
    if(process.env.NEXT_PUBLIC_GRADEBOOK_FINALS_ENABLED!=='true'){
     target?.postMessage({type:'tower-final-records',requestId:m.requestId,studentId:m.studentId,status:'disabled'},window.location.origin);return;
    }
    try{
     if(!current.current.students.some(s=>s.id===m.studentId))throw new Error('This student is not in the selected class.');
     const [finals,directory]=await Promise.all([
      readGradebookRows<SavedCourseFinal>((from,to)=>client.from('gradebook_finalizations').select('id,gradebook_id,student_id,revision,snapshot,reason,finalized_at').eq('student_id',m.studentId).order('revision',{ascending:false}).range(from,to)),
      readGradebookRows<Gradebook>((from,to)=>client.from('gradebook_directory').select('*').order('id').range(from,to)),
     ]);
     target?.postMessage({type:'tower-final-records',requestId:m.requestId,studentId:m.studentId,status:'ready',records:courseFinalRecords(finals,directory,m.studentId)},window.location.origin);
    }catch(c){target?.postMessage({type:'tower-final-records',requestId:m.requestId,studentId:m.studentId,status:'error',message:formatError(c,'Official grades could not load. Refresh and try again.')},window.location.origin);}
    return;
   }
   if(!['tower-save','tower-create-assignment'].includes(m?.type)||typeof m.requestId!=='number')return;
   const known=responses.current.get(m.requestId);
   if(known){target?.postMessage({requestId:m.requestId,...known},window.location.origin);return;}
   if(busyRef.current)return;
   busyRef.current=true;setBusy(true);setError('');
   try{
    if(m.type==='tower-create-assignment'){
     const result=await client.rpc('create_tower_assignment',{p_gradebook_id:current.current.book.id,p_id:m.assignmentId,p_definition:m.definition});
     if(result.error)throw result.error;
     const updated={...current.current,assignments:[...current.current.assignments.filter(a=>a.id!==result.data.id),result.data]};
     current.current=updated;setPayload(updated);
     const response={type:'tower-assignment-saved',assignment:result.data};
     responses.current.set(m.requestId,response);
     target?.postMessage({requestId:m.requestId,...response},window.location.origin);return;
    }
    if(!current.current.students.some(s=>s.id===m.studentId&&s.active))throw new Error('This student is not on the active class roster.');
    const result=await client.rpc('save_tower_student',{p_gradebook_id:current.current.book.id,p_student_id:m.studentId,p_revision:m.revision,p_data:m.data});
    if(result.error)throw result.error;
    responses.current.set(m.requestId,{type:'tower-saved',...result.data});
    target?.postMessage({type:'tower-saved',requestId:m.requestId,...result.data},window.location.origin);
   }catch(c){const message=formatError(c,'The record was not saved. Keep this page open and retry.');setError(message);
    target?.postMessage({type:'tower-error',requestId:m.requestId,message},window.location.origin);
   }finally{busyRef.current=false;setBusy(false);}
  }
  window.addEventListener('message',receive);return()=>window.removeEventListener('message',receive);
 },[client]);
 return <section>{!props.gradebookId&&<><h1>Welding assessment</h1><p>Class rosters · weld grades · competencies · permanent test records</p>
 <label>Class <select value={selected} disabled={busy||frameBlocked||coachingBlocked} onChange={e=>{if(!busy&&!frameBlocked&&!coachingBlocked&&window.confirm('Confirm all changes show Saved to LTG before changing class.'))setSelected(e.target.value);}}>
 {books.map(b=><option key={b.id} value={b.id}>{b.course_code} · {b.section_name}</option>)}</select></label>
 <a href="/gradebook" style={{marginLeft:16}}>Course gradebooks</a></>}
 {error&&<p role="alert">{error}</p>}{loading&&<p role="status">Loading class…</p>}
 {!loading&&!books.length&&!error&&<p>No active lab classes are assigned to your account. A school administrator can configure course pairs and instructor assignments.</p>}
 {payload&&<>
  {labContext&&<LabCoachingPanel key={payload.book.id} gradebookId={payload.book.id} context={labContext}
   assignments={payload.assignments.map(a=>({id:String(a.id),name:String(a.name)}))}
   disabled={busy||frameBlocked} onBlocked={setCoachingBlocked} onSelect={(studentId,assignmentId)=>{
    if(busy||frameBlocked||coachingBlocked)return;
    setLabContext({studentId,assignmentId});
    frame.current?.contentWindow?.postMessage({type:'tower-context',view:'lab',studentId,assignmentId},window.location.origin);
   }}/>}
  <div inert={coachingBlocked||undefined}><iframe key={payload.book.id} ref={frame} src="/tower-ui/index.html" title="Welding Record Tower workspace" style={{width:'100%',height:'85vh',minHeight:700,border:0,marginTop:16}}/></div>
 </>}
 </section>;
}
