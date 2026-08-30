'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

interface TrainingSession { id:string; school_id:string; session_name:string; status:string; started_at:string; expires_at:string; }
interface StateRow { id:string; source_section_id:string; simulated_current_day:number; manual_hold:boolean; hold_reason:string|null; active_timer_started_at:string|null; }
interface Section { id:string; section_name:string|null; section_code:string|null; course_id:string; planned_instructional_days:number|null; }
interface Course { id:string; course_code:string|null; course_name:string|null; }
interface Delivery { id:string; source_section_id:string; planner_day_number:number; delivery_status:string; actual_minutes:number|null; follow_up_needed:boolean; instructor_id:string|null; }
interface Member { id:string; user_id:string; school_role:string; connected:boolean; joined_at:string; left_at:string|null; }
interface Profile { id:string; display_name:string|null; email:string|null; }
interface Activity { id:string; user_id:string|null; action:string; entity_type:string; details:Record<string,unknown>; created_at:string; }

function fmt(v:string){return new Date(v).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});}
function title(v:string){return v.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());}

export default function TrainingSchoolPage(){
  const params=useParams<{id:string}>(); const sessionId=params.id; const router=useRouter();
  const [supabase]=useState(()=>createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!));
  const [loading,setLoading]=useState(true); const [busy,setBusy]=useState(false); const [error,setError]=useState(''); const [notice,setNotice]=useState('');
  const [session,setSession]=useState<TrainingSession|null>(null); const [states,setStates]=useState<StateRow[]>([]); const [sections,setSections]=useState<Section[]>([]); const [courses,setCourses]=useState<Course[]>([]); const [deliveries,setDeliveries]=useState<Delivery[]>([]); const [members,setMembers]=useState<Member[]>([]); const [profiles,setProfiles]=useState<Profile[]>([]); const [activity,setActivity]=useState<Activity[]>([]); const [canManage,setCanManage]=useState(false); const [endReason,setEndReason]=useState('');
  const sectionMap=useMemo(()=>new Map(sections.map(s=>[s.id,s])),[sections]); const courseMap=useMemo(()=>new Map(courses.map(c=>[c.id,c])),[courses]); const profileMap=useMemo(()=>new Map(profiles.map(p=>[p.id,p])),[profiles]);

  const fetchData=async()=>{
    const [sess,st,del,mem,act,manage]=await Promise.all([
      supabase.from('training_sessions').select('id,school_id,session_name,status,started_at,expires_at').eq('id',sessionId).maybeSingle(),
      supabase.from('training_section_state').select('id,source_section_id,simulated_current_day,manual_hold,hold_reason,active_timer_started_at').eq('training_session_id',sessionId),
      supabase.from('training_day_delivery').select('id,source_section_id,planner_day_number,delivery_status,actual_minutes,follow_up_needed,instructor_id').eq('training_session_id',sessionId),
      supabase.from('training_session_members').select('id,user_id,school_role,connected,joined_at,left_at').eq('training_session_id',sessionId),
      supabase.from('training_activity').select('id,user_id,action,entity_type,details,created_at').eq('training_session_id',sessionId).order('created_at',{ascending:false}).limit(100),
      supabase.rpc('can_manage_training_session',{check_training_session_id:sessionId})
    ]);
    const first=[sess.error,st.error,del.error,mem.error,act.error,manage.error].find(Boolean); if(first)throw new Error(first?.message??'Training school dashboard failed to load.'); if(!sess.data)throw new Error('Training session has ended.');
    const loadedStates=(st.data??[]) as StateRow[]; const ids=loadedStates.map(x=>x.source_section_id);
    let loadedSections:Section[]=[];let loadedCourses:Course[]=[];
    if(ids.length){const sr=await supabase.from('sections').select('id,section_name,section_code,course_id,planned_instructional_days').in('id',ids);if(sr.error)throw sr.error;loadedSections=(sr.data??[]) as Section[];const courseIds=Array.from(new Set(loadedSections.map(s=>s.course_id)));if(courseIds.length){const cr=await supabase.from('courses').select('id,course_code,course_name').in('id',courseIds);if(cr.error)throw cr.error;loadedCourses=(cr.data??[]) as Course[];}}
    const memberIds=((mem.data??[]) as Member[]).map(m=>m.user_id);let loadedProfiles:Profile[]=[];if(memberIds.length){const pr=await supabase.from('profiles').select('id,display_name,email').in('id',memberIds);if(!pr.error)loadedProfiles=(pr.data??[]) as Profile[];}
    setSession(sess.data as TrainingSession);setStates(loadedStates);setSections(loadedSections);setCourses(loadedCourses);setDeliveries((del.data??[]) as Delivery[]);setMembers((mem.data??[]) as Member[]);setProfiles(loadedProfiles);setActivity((act.data??[]) as Activity[]);setCanManage(Boolean(manage.data));
  };

  useEffect(()=>{
    (async()=>{try{const {data:auth}=await supabase.auth.getSession();if(!auth.session){router.replace('/training/login');return;}const {data:m}=await supabase.rpc('is_training_session_member',{check_training_session_id:sessionId});if(!m){const j=await supabase.rpc('join_training_session',{p_training_session_id:sessionId});if(j.error)throw j.error;}await fetchData();}catch(err){setError(err instanceof Error?err.message:String(err));}finally{setLoading(false);}})();
    const ch=supabase.channel(`training-school-${sessionId}`)
      .on('postgres_changes',{event:'*',schema:'public',table:'training_section_state',filter:`training_session_id=eq.${sessionId}`},()=>fetchData())
      .on('postgres_changes',{event:'*',schema:'public',table:'training_day_delivery',filter:`training_session_id=eq.${sessionId}`},()=>fetchData())
      .on('postgres_changes',{event:'*',schema:'public',table:'training_session_members',filter:`training_session_id=eq.${sessionId}`},()=>fetchData())
      .on('postgres_changes',{event:'*',schema:'public',table:'training_activity',filter:`training_session_id=eq.${sessionId}`},()=>fetchData())
      .subscribe();
    const heartbeat=window.setInterval(()=>supabase.rpc('touch_training_session',{p_training_session_id:sessionId}),60000);
    return()=>{window.clearInterval(heartbeat);supabase.removeChannel(ch);};
  },[sessionId]);

  const completed=deliveries.filter(d=>d.delivery_status==='completed'); const minutes=completed.reduce((n,d)=>n+(d.actual_minutes??0),0); const followups=deliveries.filter(d=>d.follow_up_needed).length; const holds=states.filter(s=>s.manual_hold).length; const activeTimers=states.filter(s=>s.active_timer_started_at).length;

  const toggleHold=async(state:StateRow)=>{
    const reason=state.manual_hold?'Training hold released by school dashboard':window.prompt('Training hold reason');
    if(!reason)return;setBusy(true);setError('');try{const r=await supabase.rpc('training_set_section_hold',{p_training_session_id:sessionId,p_source_section_id:state.source_section_id,p_hold:!state.manual_hold,p_reason:reason});if(r.error)throw r.error;setNotice(state.manual_hold?'Training hold released.':'Training section placed on hold.');await fetchData();}catch(err){setError(err instanceof Error?err.message:String(err));}finally{setBusy(false);}
  };

  const endSession=async()=>{
    if(!endReason.trim()){setError('A reason is required to end the training session.');return;}
    if(!window.confirm('End this shared training session now? The final report will be queued and the temporary live training data will be purged.'))return;
    setBusy(true);setError('');
    try{const r=await supabase.rpc('end_training_session',{p_training_session_id:sessionId,p_reason:endReason.trim()});if(r.error)throw r.error;router.push('/training');}
    catch(err){setError(err instanceof Error?err.message:String(err));setBusy(false);}
  };

  const leaveAndLogout=async()=>{setBusy(true);try{await supabase.rpc('leave_training_session',{p_training_session_id:sessionId});}finally{await supabase.auth.signOut();router.push('/training/login');}};

  if(loading)return <main className="loading">Opening Training School Dashboard…</main>;

  return <div className="shell">
    <div className="banner">TRAINING MODE · SCHOOL DASHBOARD SIMULATION · TEMPORARY DATA ONLY</div>
    <header><div><div className="eyebrow">Living Teacher Planner</div><h1>{session?.session_name??'Training Session'}</h1></div><div className="actions"><button onClick={()=>router.push(`/training/session/${sessionId}/teacher`)}>Teacher Training Dashboard</button><button onClick={()=>router.push('/training')}>Training Center</button><button className="danger" onClick={leaveAndLogout}>Leave & Log Out</button></div></header>
    <main>
      {error&&<div className="error">{error}</div>}{notice&&<div className="notice">{notice}</div>}
      <div className="metrics"><Metric label="Participants" value={String(members.length)}/><Metric label="Connected Now" value={String(members.filter(m=>m.connected).length)}/><Metric label="Training Sections" value={String(states.length)}/><Metric label="Classes In Progress" value={String(activeTimers)}/><Metric label="Completed Training Days" value={String(completed.length)}/><Metric label="Recorded Training Time" value={`${minutes} min`}/><Metric label="Follow-Ups" value={String(followups)}/><Metric label="Holds" value={String(holds)}/></div>

      <section className="panel"><div className="eyebrow">Training Sections</div><h2>Shared School View</h2><div className="table">
        <div className="thead"><span>Section</span><span>Course</span><span>Current Day</span><span>Status</span><span>Action</span></div>
        {states.map(st=>{const sec=sectionMap.get(st.source_section_id);const course=sec?courseMap.get(sec.course_id):null;return <div className="trow" key={st.id}><span><strong>{sec?.section_name??sec?.section_code??'Section'}</strong></span><span>{course?.course_code??'—'}</span><span>Day {st.simulated_current_day} / {sec?.planned_instructional_days??'—'}</span><span>{st.active_timer_started_at?'In Progress':st.manual_hold?'On Hold':'Ready'}</span><span><button disabled={busy} onClick={()=>toggleHold(st)}>{st.manual_hold?'Release Hold':'Training Hold'}</button></span></div>})}
      </div></section>

      <div className="two">
        <section className="panel"><div className="eyebrow">Participants</div><h2>Live Training Attendance</h2><div className="people">{members.map(m=><div key={m.id}><span className={m.connected?'dot on':'dot'}></span><strong>{profileMap.get(m.user_id)?.display_name??`Participant ${m.user_id.slice(0,8)}`}</strong><small>{title(m.school_role)} · joined {fmt(m.joined_at)}</small></div>)}</div></section>
        <section className="panel"><div className="eyebrow">Recent Activity</div><h2>Training Activity</h2><div className="activity">{activity.slice(0,30).map(a=><div key={a.id}><strong>{title(a.action)}</strong><span>{a.user_id?profileMap.get(a.user_id)?.display_name??a.user_id.slice(0,8):'System'}</span><small>{fmt(a.created_at)}</small></div>)}</div></section>
      </div>

      {canManage&&<section className="panel danger-zone"><div className="eyebrow">School Admin / Program Lead</div><h2>End Training Session</h2><p>Ending the session generates the temporary final training report, purges the live sandbox, and returns the report to the School Admin Training Reports Inbox.</p><label>Required Reason<textarea value={endReason} onChange={e=>setEndReason(e.target.value)} /></label><button className="danger" disabled={busy} onClick={endSession}>End Training Session & Generate Report</button></section>}
    </main>
    <style jsx>{`
      .shell{min-height:100vh;background:#080808;color:#ddd}.loading{min-height:100vh;display:grid;place-items:center;background:#080808;color:#aaa}.banner{position:sticky;top:0;z-index:30;padding:9px;text-align:center;background:#9a4d13;color:#fff;font-size:11px;font-weight:900;letter-spacing:.08em}header{display:flex;justify-content:space-between;gap:20px;align-items:center;padding:18px 26px;border-bottom:1px solid #272727;background:#111}.eyebrow{color:#ffad70;text-transform:uppercase;letter-spacing:.12em;font-size:10px;font-weight:900}h1,h2{margin:4px 0;color:#fff}h1{font-size:22px}h2{font-size:19px}.actions{display:flex;gap:8px;flex-wrap:wrap}button{padding:9px 12px;border:1px solid #303030;border-radius:7px;background:#151515;color:#ddd;font-weight:750;cursor:pointer}button:hover:not(:disabled){border-color:#ffad70;color:#ffad70}.danger{border-color:rgba(255,80,80,.35);color:#ff8f8f}button:disabled{opacity:.4}
      main{width:min(1400px,calc(100% - 28px));margin:auto;padding:22px 0 50px}.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:9px;margin-bottom:16px}.panel{padding:19px;border:1px solid #292929;border-radius:10px;background:#141414;margin-bottom:16px}.table{margin-top:14px;overflow-x:auto}.thead,.trow{min-width:900px;display:grid;grid-template-columns:1.4fr .7fr .8fr .8fr .7fr;gap:10px;padding:11px 10px}.thead{background:#101010;color:#666;font-size:10px;text-transform:uppercase;font-weight:850}.trow{border-top:1px solid #282828;color:#bbb;font-size:12px;align-items:center}.trow strong{color:#eee}.two{display:grid;grid-template-columns:1fr 1fr;gap:16px}.people,.activity{display:grid;gap:8px;margin-top:13px}.people>div,.activity>div{display:grid;grid-template-columns:14px 1fr;gap:2px 7px;padding:9px;border-radius:7px;background:#101010}.people small,.activity span,.activity small{grid-column:2;color:#666}.dot{width:8px;height:8px;border-radius:50%;background:#555}.dot.on{background:#00ff88}.danger-zone{border-color:rgba(255,80,80,.3)}.danger-zone p{color:#888;line-height:1.5}label{display:grid;gap:6px;margin:12px 0;color:#888;font-size:10px;font-weight:850;text-transform:uppercase}textarea{min-height:75px;padding:10px;border:1px solid #303030;border-radius:7px;background:#0d0d0d;color:#eee;font:inherit}.error,.notice{margin-bottom:12px;padding:10px 12px;border-radius:7px;font-size:12px}.error{color:#ff9090;background:rgba(255,80,80,.07);border:1px solid rgba(255,80,80,.3)}.notice{color:#80ffbb;background:rgba(0,255,136,.06);border:1px solid rgba(0,255,136,.3)}
      @media(max-width:900px){.metrics{grid-template-columns:1fr 1fr}.two{grid-template-columns:1fr}}@media(max-width:700px){header{align-items:flex-start;flex-direction:column}}
    `}</style>
  </div>;
}

function Metric({label,value}:{label:string;value:string}){return <div style={{padding:13,border:'1px solid #292929',borderRadius:8,background:'#141414'}}><span style={{display:'block',color:'#666',fontSize:9,textTransform:'uppercase',fontWeight:850}}>{label}</span><strong style={{display:'block',color:'white',fontSize:20,marginTop:4}}>{value}</strong></div>}
