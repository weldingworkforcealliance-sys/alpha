'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import QRCode from 'qrcode';
import { createBrowserClient } from '@supabase/ssr';

type Section = { section_id:string; section_name:string|null; section_code:string|null; course_code:string|null; course_name:string|null };
type Assessment = { slug:string; title:string; description:string|null; category:string; estimated_minutes:number|null; question_count:number };
type Session = { id:string; join_code:string; status:string; started_at:string; section_id:string; assessment_slug:string };
type Submission = { id:string; student_name:string; student_id:string; score:number; possible_score:number; submitted_at:string; domain_scores:Record<string,{correct:number,total:number}> };

export default function ClassroomPage() {
  const router = useRouter();
  const [supabase] = useState(() => createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!));
  const [sections,setSections]=useState<Section[]>([]);
  const [assessments,setAssessments]=useState<Assessment[]>([]);
  const [sectionId,setSectionId]=useState('');
  const [assessmentSlug,setAssessmentSlug]=useState('');
  const [session,setSession]=useState<Session|null>(null);
  const [submissions,setSubmissions]=useState<Submission[]>([]);
  const [qr,setQr]=useState('');
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const selectedAssessment=assessments.find(a=>a.slug===assessmentSlug)??null;

  const joinUrl=session && typeof window!=='undefined' ? `${window.location.origin}/join/${session.join_code}` : '';

  const loadSubmissions=async(sessionId:string)=>{
    const {data,error:e}=await supabase.from('classroom_submissions').select('id,student_name,student_id,score,possible_score,submitted_at,domain_scores').eq('classroom_session_id',sessionId).order('submitted_at',{ascending:false});
    if(e) throw e;
    setSubmissions((data??[]) as Submission[]);
  };

  useEffect(()=>{
    (async()=>{
      try{
        const {data:auth}=await supabase.auth.getSession();
        if(!auth.session){router.replace('/login');return;}
        const [{data:s,error:se},{data:a,error:ae}]=await Promise.all([
          supabase.from('current_teaching_sections').select('section_id,section_name,section_code,course_code,course_name'),
          supabase.rpc('list_assessment_modules')
        ]);
        if(se||ae) throw se||ae;
        setSections((s??[]) as Section[]);
        setAssessments((a??[]) as Assessment[]);
        if(s?.[0]) setSectionId(s[0].section_id);
        if(a?.[0]) setAssessmentSlug(a[0].slug);
      }catch(e){setError(e instanceof Error?e.message:String(e));}
      finally{setLoading(false);}
    })();
  },[]);

  useEffect(()=>{
    if(!session) return;
    QRCode.toDataURL(joinUrl,{width:340,margin:2,color:{dark:'#050505',light:'#ffffff'}}).then(setQr);
    loadSubmissions(session.id).catch(e=>setError(e.message));
    const channel=supabase.channel(`classroom-${session.id}`)
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'classroom_submissions',filter:`classroom_session_id=eq.${session.id}`},()=>loadSubmissions(session.id))
      .subscribe();
    return()=>{supabase.removeChannel(channel);};
  },[session?.id,joinUrl]);

  const start=async()=>{
    if(!sectionId)return;
    setBusy(true);setError('');
    try{
      const {data,error:e}=await supabase.rpc('start_classroom_session',{p_section_id:sectionId,p_assessment_slug:assessmentSlug});
      if(e)throw e;
      const {data:row,error:re}=await supabase.from('classroom_sessions').select('id,join_code,status,started_at,section_id,assessment_slug').eq('id',data).single();
      if(re)throw re; setSession(row as Session);
    }catch(e){setError(e instanceof Error?e.message:String(e));}
    finally{setBusy(false);}
  };

  const end=async()=>{
    if(!session)return;
    setBusy(true);
    const {error:e}=await supabase.rpc('end_classroom_session',{p_session_id:session.id});
    setBusy(false);
    if(e)setError(e.message); else setSession({...session,status:'ended'});
  };

  const exportCsv=()=>{
    const esc=(v:unknown)=>`"${String(v??'').replaceAll('"','""')}"`;
    const rows=[['Student','Student ID','Score','Possible','Percent','Submitted'],...submissions.map(s=>[s.student_name,s.student_id,s.score,s.possible_score,Math.round(100*s.score/s.possible_score),new Date(s.submitted_at).toLocaleString()])];
    const blob=new Blob([rows.map(r=>r.map(esc).join(',')).join('\n')],{type:'text/csv'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`${session?.assessment_slug??'assessment'}-results.csv`;a.click();URL.revokeObjectURL(a.href);
  };

  if(loading)return <main className="loading">Opening Live Classroom…</main>;
  return <div className="shell">
    <header><div><div className="eyebrow">Living Teacher Guide</div><h1>Live Classroom</h1></div><button onClick={()=>router.push('/dashboard')}>Back to Planner</button></header>
    <main>
      {error&&<div className="error">{error}</div>}
      {!session ? <section className="panel start">
        <div className="eyebrow">Assessment Library</div><h2>Choose a Live Assessment</h2>
        <p>Select any active assessment. The same QR connection and live grading system works automatically.</p>
        <label>Class<select value={sectionId} onChange={e=>setSectionId(e.target.value)}>{sections.map(s=><option key={s.section_id} value={s.section_id}>{s.course_code??''} · {s.section_name??s.section_code??'Class'}</option>)}</select></label>
        <div className="library">{assessments.map(a=><button type="button" key={a.slug} className={`assessment-card ${assessmentSlug===a.slug?'selected':''}`} onClick={()=>setAssessmentSlug(a.slug)}><span>{a.category}</span><strong>{a.title}</strong><small>{a.question_count} questions{a.estimated_minutes?` · ${a.estimated_minutes} minutes`:''}</small>{a.description&&<em>{a.description}</em>}</button>)}</div>
        <button className="primary" disabled={busy||!sectionId||!assessmentSlug} onClick={start}>Start {selectedAssessment?.title??'Live Assessment'}</button>
        {!sections.length&&<p className="muted">No assigned teaching sections were found for this account.</p>}
        {!assessments.length&&<p className="muted">No active assessments are currently available.</p>}
      </section> : <>
        <section className="panel live-grid">
          <div><div className="live">● {session.status==='active'?'LIVE':'ENDED'}</div><h2>Student Join Screen</h2><div className="code">{session.join_code}</div><a href={joinUrl} target="_blank">{joinUrl}</a><div className="actions"><button onClick={()=>navigator.clipboard.writeText(joinUrl)}>Copy Link</button><button className="danger" disabled={busy||session.status!=='active'} onClick={end}>End Session</button></div></div>
          <div className="qr">{qr&&<img src={qr} alt="QR code for students to join the assessment"/>}</div>
        </section>
        <section className="panel"><div className="results-head"><div><div className="eyebrow">Live Grading</div><h2>{submissions.length} Submission{submissions.length===1?'':'s'}</h2></div><button disabled={!submissions.length} onClick={exportCsv}>Export CSV</button></div>
          <div className="table-wrap"><table><thead><tr><th>Student</th><th>ID</th><th>Score</th><th>Percent</th><th>Submitted</th></tr></thead><tbody>{submissions.map(s=><tr key={s.id}><td>{s.student_name}</td><td>{s.student_id}</td><td>{s.score}/{s.possible_score}</td><td><strong>{Math.round(100*s.score/s.possible_score)}%</strong></td><td>{new Date(s.submitted_at).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}</td></tr>)}</tbody></table>{!submissions.length&&<div className="empty">Waiting for student submissions…</div>}</div>
        </section>
      </>}
    </main>
    <style jsx>{`.shell{min-height:100vh;background:#080808;color:#ddd}.loading{min-height:100vh;display:grid;place-items:center;background:#080808;color:#aaa}header{display:flex;justify-content:space-between;align-items:center;padding:20px 28px;border-bottom:1px solid #292929;background:#111}main{width:min(1100px,calc(100% - 28px));margin:auto;padding:25px 0 50px}.eyebrow{color:#9adf4b;text-transform:uppercase;letter-spacing:.12em;font-size:10px;font-weight:900}h1,h2{margin:5px 0;color:white}.panel{margin-bottom:16px;padding:20px;border:1px solid #292929;border-radius:10px;background:#131313}.start{max-width:760px;margin:40px auto}.start p{color:#888}label{display:grid;gap:7px;margin:18px 0;color:#888;font-size:11px;font-weight:800;text-transform:uppercase}select{padding:12px;border:1px solid #333;border-radius:7px;background:#090909;color:#eee}button{padding:10px 14px;border:1px solid #383838;border-radius:7px;background:#151515;color:#ddd;font-weight:800;cursor:pointer}button:disabled{opacity:.4}.primary{width:100%;border-color:#9adf4b;color:#caff77}.danger{border-color:#7b3333;color:#ff9696}.library{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:18px 0}.assessment-card{display:grid;gap:5px;text-align:left;padding:15px}.assessment-card span{color:#9adf4b;font-size:9px;text-transform:uppercase;letter-spacing:.1em}.assessment-card strong{color:#eee;font-size:15px}.assessment-card small{color:#888}.assessment-card em{color:#777;font-size:11px;font-style:normal;line-height:1.4}.assessment-card.selected{border-color:#9adf4b;background:rgba(154,223,75,.07)}.error{margin-bottom:14px;padding:12px;border:1px solid #713333;color:#ff9999}.live-grid{display:grid;grid-template-columns:1fr 360px;gap:25px;align-items:center}.live{color:#00ff88;font-weight:900}.code{margin:18px 0 8px;color:white;font-size:46px;font-weight:900;letter-spacing:.15em}.live-grid a{color:#8edfff;overflow-wrap:anywhere}.actions{display:flex;gap:9px;margin-top:18px}.qr{text-align:center}.qr img{width:min(100%,340px);border-radius:8px}.results-head{display:flex;justify-content:space-between;align-items:center}.table-wrap{overflow-x:auto}table{width:100%;border-collapse:collapse;margin-top:14px}th,td{padding:11px;border-bottom:1px solid #292929;text-align:left}th{color:#777;font-size:10px;text-transform:uppercase}.empty{text-align:center;padding:35px;color:#666}.muted{color:#777}@media(max-width:760px){header{align-items:flex-start;gap:15px}.live-grid,.library{grid-template-columns:1fr}.qr{order:-1}.code{font-size:34px}}`}</style>
  </div>;
}
