'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

interface TrainingSession { id:string; school_id:string; session_name:string; status:string; started_at:string; expires_at:string; }
interface StateRow { id:string; training_session_id:string; school_id:string; source_section_id:string; simulated_current_day:number; manual_hold:boolean; hold_reason:string|null; active_timer_started_at:string|null; active_timer_started_by:string|null; }
interface Section { id:string; school_id:string; course_id:string; section_name:string|null; section_code:string|null; planned_instructional_days:number|null; }
interface Course { id:string; course_code:string|null; course_name:string|null; }
interface Delivery { id:string; source_section_id:string; planner_day_number:number; delivery_status:string; started_at:string|null; completed_at:string|null; actual_minutes:number|null; instructor_id:string|null; deviation_summary:string|null; follow_up_needed:boolean; follow_up_notes:string|null; }
interface Member { id:string; user_id:string; school_role:string; connected:boolean; joined_at:string; left_at:string|null; }
interface Profile { id:string; display_name:string|null; email:string|null; }
interface GuideDay { id:string; planner_day_number:number; title:string|null; objective:string|null; safety_focus:string|null; opening_review:string|null; demonstration:string|null; guided_practice:string|null; independent_practice:string|null; instructor_checks:string|null; assessment:string|null; materials_equipment:string|null; teaching_tips:string|null; }
interface Segment { id:string; sequence_number:number; segment_title:string|null; planned_minutes:number|null; instructor_actions:string|null; student_actions:string|null; notes:string|null; }
interface Resource { id:string; sequence_number:number; resource_type:string|null; resource_title:string|null; resource_url:string|null; resource_notes:string|null; required:boolean; }

function clock(start:string|null) {
  if (!start) return '0:00';
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(start).getTime())/1000));
  return `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
}

export default function TrainingTeacherPage() {
  const params = useParams<{id:string}>();
  const sessionId = params.id;
  const router = useRouter();
  const [supabase] = useState(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  ));

  const [loading,setLoading] = useState(true);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const [notice,setNotice] = useState('');
  const [session,setSession] = useState<TrainingSession|null>(null);
  const [states,setStates] = useState<StateRow[]>([]);
  const [sections,setSections] = useState<Section[]>([]);
  const [courses,setCourses] = useState<Course[]>([]);
  const [deliveries,setDeliveries] = useState<Delivery[]>([]);
  const [members,setMembers] = useState<Member[]>([]);
  const [profiles,setProfiles] = useState<Profile[]>([]);
  const [sectionId,setSectionId] = useState('');
  const [viewingDay,setViewingDay] = useState(1);
  const [guide,setGuide] = useState<GuideDay|null>(null);
  const [segments,setSegments] = useState<Segment[]>([]);
  const [resources,setResources] = useState<Resource[]>([]);
  const [comment,setComment] = useState('');
  const [followUp,setFollowUp] = useState(false);
  const [followNotes,setFollowNotes] = useState('');
  const [trainingNote,setTrainingNote] = useState('');
  const [,setTick] = useState(0);

  const sectionMap = useMemo(() => new Map(sections.map(s => [s.id,s])),[sections]);
  const courseMap = useMemo(() => new Map(courses.map(c => [c.id,c])),[courses]);
  const profileMap = useMemo(() => new Map(profiles.map(p => [p.id,p])),[profiles]);
  const selectedState = states.find(s => s.source_section_id === sectionId) ?? states[0] ?? null;
  const selectedSection = selectedState ? sectionMap.get(selectedState.source_section_id) ?? null : null;
  const selectedCourse = selectedSection ? courseMap.get(selectedSection.course_id) ?? null : null;
  const currentDay = selectedState?.simulated_current_day ?? 1;
  const plannedDays = selectedSection?.planned_instructional_days ?? 1;
  const activeDelivery = deliveries.find(d => d.source_section_id === selectedState?.source_section_id && d.planner_day_number === currentDay && d.delivery_status === 'in_progress') ?? null;

  const fetchMain = async () => {
    const [sessionResult,stateResult,deliveryResult,memberResult] = await Promise.all([
      supabase.from('training_sessions').select('id,school_id,session_name,status,started_at,expires_at').eq('id',sessionId).maybeSingle(),
      supabase.from('training_section_state').select('id,training_session_id,school_id,source_section_id,simulated_current_day,manual_hold,hold_reason,active_timer_started_at,active_timer_started_by').eq('training_session_id',sessionId).order('source_section_id'),
      supabase.from('training_day_delivery').select('id,source_section_id,planner_day_number,delivery_status,started_at,completed_at,actual_minutes,instructor_id,deviation_summary,follow_up_needed,follow_up_notes').eq('training_session_id',sessionId),
      supabase.from('training_session_members').select('id,user_id,school_role,connected,joined_at,left_at').eq('training_session_id',sessionId),
    ]);
    const first=[sessionResult.error,stateResult.error,deliveryResult.error,memberResult.error].find(Boolean);
    if(first) throw new Error(first?.message ?? 'Training session failed to load.');
    if(!sessionResult.data) throw new Error('Training session is no longer active.');

    const loadedStates=(stateResult.data??[]) as StateRow[];
    const sourceIds=loadedStates.map(s=>s.source_section_id);

    let loadedSections:Section[]=[];
    let loadedCourses:Course[]=[];
    if(sourceIds.length){
      const sectionResult=await supabase.from('sections').select('id,school_id,course_id,section_name,section_code,planned_instructional_days').in('id',sourceIds);
      if(sectionResult.error) throw sectionResult.error;
      loadedSections=(sectionResult.data??[]) as Section[];
      const courseIds=Array.from(new Set(loadedSections.map(s=>s.course_id)));
      if(courseIds.length){
        const courseResult=await supabase.from('courses').select('id,course_code,course_name').in('id',courseIds);
        if(courseResult.error) throw courseResult.error;
        loadedCourses=(courseResult.data??[]) as Course[];
      }
    }

    const memberIds=((memberResult.data??[]) as Member[]).map(m=>m.user_id);
    let loadedProfiles:Profile[]=[];
    if(memberIds.length){
      const profileResult=await supabase.from('profiles').select('id,display_name,email').in('id',memberIds);
      if(!profileResult.error) loadedProfiles=(profileResult.data??[]) as Profile[];
    }

    setSession(sessionResult.data as TrainingSession);
    setStates(loadedStates);
    setSections(loadedSections);
    setCourses(loadedCourses);
    setDeliveries((deliveryResult.data??[]) as Delivery[]);
    setMembers((memberResult.data??[]) as Member[]);
    setProfiles(loadedProfiles);

    if(!sectionId && loadedStates[0]){
      setSectionId(loadedStates[0].source_section_id);
      setViewingDay(loadedStates[0].simulated_current_day);
    }
  };

  const ensureJoined = async () => {
    const { data: auth } = await supabase.auth.getSession();
    if(!auth.session){ router.replace('/training/login'); return false; }
    const { data: member, error: memberError } = await supabase.rpc('is_training_session_member',{ check_training_session_id:sessionId });
    if(memberError) throw memberError;
    if(!member){
      const { error: joinError } = await supabase.rpc('join_training_session',{ p_training_session_id:sessionId });
      if(joinError) throw joinError;
    }
    return true;
  };

  useEffect(() => {
    (async()=>{
      try{
        if(await ensureJoined()) await fetchMain();
      }catch(err){ setError(err instanceof Error?err.message:String(err)); }
      finally{ setLoading(false); }
    })();

    const channel=supabase.channel(`training-teacher-${sessionId}`)
      .on('postgres_changes',{event:'*',schema:'public',table:'training_section_state',filter:`training_session_id=eq.${sessionId}`},()=>fetchMain())
      .on('postgres_changes',{event:'*',schema:'public',table:'training_day_delivery',filter:`training_session_id=eq.${sessionId}`},()=>fetchMain())
      .on('postgres_changes',{event:'*',schema:'public',table:'training_session_members',filter:`training_session_id=eq.${sessionId}`},()=>fetchMain())
      .on('postgres_changes',{event:'*',schema:'public',table:'training_notes',filter:`training_session_id=eq.${sessionId}`},()=>fetchMain())
      .subscribe();

    const heartbeat=window.setInterval(()=>supabase.rpc('touch_training_session',{p_training_session_id:sessionId}),60000);
    return()=>{window.clearInterval(heartbeat);supabase.removeChannel(channel);};
  },[sessionId]);

  useEffect(()=>{
    if(selectedState) setViewingDay(selectedState.simulated_current_day);
  },[selectedState?.source_section_id]);

  useEffect(()=>{
    if(!selectedSection) return;
    (async()=>{
      const dayResult=await supabase.from('course_guide_days')
        .select('id,planner_day_number,title,objective,safety_focus,opening_review,demonstration,guided_practice,independent_practice,instructor_checks,assessment,materials_equipment,teaching_tips')
        .eq('course_id',selectedSection.course_id).eq('planner_day_number',viewingDay).maybeSingle();
      if(dayResult.error){ setGuide(null);setSegments([]);setResources([]);return; }
      const day=(dayResult.data??null) as GuideDay|null;
      setGuide(day);
      if(!day){setSegments([]);setResources([]);return;}
      const [segResult,resResult]=await Promise.all([
        supabase.from('course_guide_day_segments').select('id,sequence_number,segment_title,planned_minutes,instructor_actions,student_actions,notes').eq('guide_day_id',day.id).order('sequence_number'),
        supabase.from('course_guide_day_resources').select('id,sequence_number,resource_type,resource_title,resource_url,resource_notes,required').eq('guide_day_id',day.id).order('sequence_number')
      ]);
      setSegments((segResult.data??[]) as Segment[]);
      setResources((resResult.data??[]) as Resource[]);
    })();
  },[selectedSection?.id,viewingDay]);

  useEffect(()=>{
    const id=window.setInterval(()=>setTick(v=>v+1),1000);
    return()=>window.clearInterval(id);
  },[]);

  const run = async (fn:()=>PromiseLike<{error:any}>, message:string) => {
    setBusy(true);setError('');setNotice('');
    try{const r=await fn();if(r.error)throw r.error;setNotice(message);await fetchMain();}
    catch(err){setError(err instanceof Error?err.message:String(err));}
    finally{setBusy(false);}
  };

  const startDay=()=>run(()=>supabase.rpc('training_start_current_day',{p_training_session_id:sessionId,p_source_section_id:selectedState!.source_section_id}),'Training class started.');
  const completeDay=()=>run(()=>supabase.rpc('training_complete_current_day',{
    p_training_session_id:sessionId,
    p_source_section_id:selectedState!.source_section_id,
    p_deviation_summary:comment,
    p_follow_up_needed:followUp,
    p_follow_up_notes:followNotes
  }),'Training day completed.').then(()=>{setComment('');setFollowUp(false);setFollowNotes('');});

  const addNote=()=>run(()=>supabase.rpc('training_add_note',{
    p_training_session_id:sessionId,
    p_source_section_id:selectedState!.source_section_id,
    p_planner_day_number:viewingDay,
    p_note_type:'training_note',
    p_note_text:trainingNote,
    p_follow_up_needed:followUp
  }),'Training note added.').then(()=>setTrainingNote(''));

  const leaveAndLogout=async()=>{
    setBusy(true);
    try{await supabase.rpc('leave_training_session',{p_training_session_id:sessionId});}
    finally{await supabase.auth.signOut();router.push('/training/login');}
  };

  if(loading) return <main className="loading">Opening shared training classroom…</main>;

  return (
    <div className="shell">
      <div className="banner">TRAINING MODE · SHARED LIVE SANDBOX · NO PRODUCTION RECORDS ARE CHANGED</div>
      <header>
        <div><div className="eyebrow">Living Teacher Planner</div><h1>{session?.session_name ?? 'Training Session'}</h1></div>
        <div className="actions">
          <button onClick={()=>router.push(`/training/session/${sessionId}/school`)}>Training School Dashboard</button>
          <button onClick={()=>router.push('/training')}>Training Center</button>
          <button className="danger" onClick={leaveAndLogout}>Leave Training & Log Out</button>
        </div>
      </header>

      <main>
        {error&&<div className="error">{error}</div>}{notice&&<div className="notice">{notice}</div>}

        <div className="top-grid">
          <section className="panel">
            <div className="eyebrow">Teacher Training Dashboard</div>
            <label>Training Section
              <select value={selectedState?.source_section_id??''} onChange={e=>setSectionId(e.target.value)}>
                {states.map(s=>{
                  const sec=sectionMap.get(s.source_section_id);
                  return <option key={s.id} value={s.source_section_id}>{sec?.section_name??sec?.section_code??s.source_section_id}</option>;
                })}
              </select>
            </label>

            <div className="metrics">
              <Metric label="Course" value={selectedCourse?.course_code??'—'} />
              <Metric label="Current Day" value={`Day ${currentDay}`} />
              <Metric label="Status" value={activeDelivery?'In Progress':selectedState?.manual_hold?'On Hold':'Ready'} />
              <Metric label="Timer" value={clock(selectedState?.active_timer_started_at??null)} />
              <Metric label="Connected" value={String(members.filter(m=>m.connected).length)} />
            </div>

            <div className="controls">
              <button className="primary" disabled={busy||Boolean(activeDelivery)||Boolean(selectedState?.manual_hold)} onClick={startDay}>Start Today</button>
              <button disabled={busy||!activeDelivery} onClick={completeDay}>Complete Day</button>
            </div>

            {selectedState?.manual_hold&&<div className="hold">Training hold: {selectedState.hold_reason??'No reason recorded'}</div>}

            <label>Daily Comment
              <textarea value={comment} onChange={e=>setComment(e.target.value)} placeholder="Training-only comment" />
            </label>
            <label className="check"><input type="checkbox" checked={followUp} onChange={e=>setFollowUp(e.target.checked)} /> Follow-up needed</label>
            {followUp&&<label>Follow-up Notes<input value={followNotes} onChange={e=>setFollowNotes(e.target.value)} /></label>}
          </section>

          <section className="panel">
            <div className="eyebrow">Shared Participants</div>
            <h2>Live Training Room</h2>
            <div className="people">
              {members.map(m=>(
                <div key={m.id}><span className={m.connected?'dot on':'dot'}></span><strong>{profileMap.get(m.user_id)?.display_name??`Participant ${m.user_id.slice(0,8)}`}</strong><small>{m.school_role.replace(/_/g,' ')}</small></div>
              ))}
            </div>
          </section>
        </div>

        <section className="panel guide">
          <div className="guide-head">
            <div><div className="eyebrow">Full Training Guide Access</div><h2>{selectedCourse?.course_code??'Course'} · Viewing Day {viewingDay}</h2></div>
            <label>Browse Day
              <select value={viewingDay} onChange={e=>setViewingDay(Number(e.target.value))}>
                {Array.from({length:plannedDays},(_,i)=>i+1).map(d=><option key={d} value={d}>Day {d}</option>)}
              </select>
            </label>
          </div>

          {guide ? <>
            <h3>{guide.title}</h3>
            <div className="guide-grid">
              <Guide label="Objective" value={guide.objective}/>
              <Guide label="Safety Focus" value={guide.safety_focus}/>
              <Guide label="Opening / Review" value={guide.opening_review}/>
              <Guide label="Demonstration" value={guide.demonstration}/>
              <Guide label="Guided Practice" value={guide.guided_practice}/>
              <Guide label="Independent Practice" value={guide.independent_practice}/>
              <Guide label="Instructor Checks" value={guide.instructor_checks}/>
              <Guide label="Assessment" value={guide.assessment}/>
              <Guide label="Materials / Equipment" value={guide.materials_equipment}/>
              <Guide label="Teaching Tips" value={guide.teaching_tips}/>
            </div>

            {segments.length>0&&<div className="segments"><h3>Daily Segments</h3>{segments.map(s=><article key={s.id}><strong>{s.sequence_number}. {s.segment_title??'Segment'} {s.planned_minutes?`· ${s.planned_minutes} min`:''}</strong><span>{s.instructor_actions??''}</span><small>{s.student_actions??''}</small></article>)}</div>}
            {resources.length>0&&<div className="resources"><h3>Resources</h3>{resources.map(r=><article key={r.id}><strong>{r.resource_title??r.resource_type??'Resource'}</strong>{r.resource_url&&<a href={r.resource_url} target="_blank" rel="noreferrer">Open resource</a>}<span>{r.resource_notes??''}</span></article>)}</div>}
          </> : <div className="empty">No guide content found for this training day.</div>}
        </section>

        <section className="panel">
          <div className="eyebrow">Practice Notes</div>
          <h2>Add Training Note</h2>
          <label>Training Note<textarea value={trainingNote} onChange={e=>setTrainingNote(e.target.value)} placeholder="This note is temporary and exists only inside this training session." /></label>
          <button className="primary" disabled={busy||!trainingNote.trim()} onClick={addNote}>Add Training Note</button>
        </section>
      </main>

      <style jsx>{`
        .shell{min-height:100vh;background:#080808;color:#ddd}.loading{min-height:100vh;display:grid;place-items:center;background:#080808;color:#aaa}.banner{position:sticky;top:0;z-index:30;padding:9px;text-align:center;background:#9a4d13;color:#fff;font-size:11px;font-weight:900;letter-spacing:.08em}
        header{display:flex;justify-content:space-between;align-items:center;gap:20px;padding:18px 26px;border-bottom:1px solid #272727;background:#111}.eyebrow{color:#ffad70;text-transform:uppercase;letter-spacing:.12em;font-size:10px;font-weight:900}h1,h2,h3{color:#fff;margin:4px 0}h1{font-size:22px}h2{font-size:20px}h3{font-size:16px}.actions,.controls{display:flex;gap:8px;flex-wrap:wrap}
        button{padding:10px 13px;border:1px solid #303030;border-radius:7px;background:#151515;color:#ddd;font-weight:750;cursor:pointer}button:hover:not(:disabled){border-color:#ffad70;color:#ffad70}button:disabled{opacity:.4;cursor:not-allowed}.primary{border-color:rgba(0,255,136,.5);color:#00ff88}.danger{border-color:rgba(255,80,80,.35);color:#ff8f8f}
        main{width:min(1380px,calc(100% - 28px));margin:auto;padding:22px 0 50px}.top-grid{display:grid;grid-template-columns:1.45fr .55fr;gap:16px}.panel{padding:19px;border:1px solid #292929;border-radius:10px;background:#141414;margin-bottom:16px}.metrics{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin:15px 0}
        label{display:grid;gap:6px;margin-top:12px;color:#888;font-size:10px;font-weight:850;text-transform:uppercase}select,input,textarea{padding:10px 11px;border:1px solid #303030;border-radius:7px;background:#0d0d0d;color:#eee;font:inherit}textarea{min-height:80px;resize:vertical}.check{display:flex;align-items:center;gap:7px;text-transform:none}.check input{width:auto}.hold{margin:12px 0;padding:10px;border-radius:7px;background:rgba(255,154,82,.08);color:#ffad70;border:1px solid rgba(255,154,82,.3)}
        .people{display:grid;gap:8px;margin-top:14px}.people>div{display:grid;grid-template-columns:14px 1fr;gap:2px 7px;align-items:center;padding:9px;border-radius:7px;background:#101010}.people small{grid-column:2;color:#666;text-transform:capitalize}.dot{width:8px;height:8px;border-radius:50%;background:#555}.dot.on{background:#00ff88}
        .guide-head{display:flex;justify-content:space-between;gap:18px;align-items:end}.guide-head label{min-width:160px;margin:0}.guide-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px}.guide-row{padding:12px;border:1px solid #282828;border-radius:8px;background:#101010;display:grid;gap:5px}.guide-row strong{color:#ffad70;font-size:10px;text-transform:uppercase}.guide-row span{color:#c7c7c7;line-height:1.45;font-size:12px}.segments,.resources{margin-top:18px;display:grid;gap:8px}.segments article,.resources article{display:grid;gap:5px;padding:11px;border:1px solid #282828;border-radius:7px;background:#101010}.segments span,.resources span{color:#bbb;font-size:12px}.segments small{color:#777}.resources a{color:#55cfff;font-size:12px}.empty{padding:24px;text-align:center;color:#666}
        .error,.notice{margin-bottom:12px;padding:10px 12px;border-radius:7px;font-size:12px}.error{color:#ff9090;background:rgba(255,80,80,.07);border:1px solid rgba(255,80,80,.3)}.notice{color:#80ffbb;background:rgba(0,255,136,.06);border:1px solid rgba(0,255,136,.3)}
        @media(max-width:1000px){.top-grid{grid-template-columns:1fr}.metrics{grid-template-columns:1fr 1fr 1fr}.guide-grid{grid-template-columns:1fr}}@media(max-width:700px){header{align-items:flex-start;flex-direction:column}.metrics{grid-template-columns:1fr 1fr}.guide-head{align-items:flex-start;flex-direction:column}.guide-head label{width:100%}}
      `}</style>
    </div>
  );
}

function Metric({label,value}:{label:string;value:string}) {
  return <div style={{padding:10,borderRadius:7,background:'#101010'}}><span style={{display:'block',color:'#666',fontSize:9,textTransform:'uppercase',fontWeight:800}}>{label}</span><strong style={{display:'block',color:'white',marginTop:3}}>{value}</strong></div>;
}
function Guide({label,value}:{label:string;value:string|null}) {
  if(!value) return null;
  return <div className="guide-row"><strong>{label}</strong><span>{value}</span></div>;
}
