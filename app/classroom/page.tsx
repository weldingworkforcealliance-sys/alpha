'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import QRCode from 'qrcode';
import { createBrowserClient } from '@supabase/ssr';

type Section = { section_id:string; section_name:string|null; section_code:string|null; course_code:string|null; course_name:string|null };
type Assessment = { slug:string; title:string; description:string|null; category:string; estimated_minutes:number|null; question_count:number; instructions:string|null; allow_team_members:boolean };
type Session = { id:string; join_code:string; status:string; started_at:string; expires_at:string; section_id:string; assessment_slug:string; expected_students:number };
type Submission = { id:string; student_name:string; student_id:string; team_members:string|null; score:number; possible_score:number; submitted_at:string; domain_scores:Record<string,{correct:number,total:number}> };
type ReportQuestion = { key:string; number:number; domain:string; text:string; options:Record<string,string>|null; student_answer:string; correct_answer:string; is_correct:boolean; explanation:string|null };
type Report = { submission:Submission & { percent:number; assessment_title:string }; questions:ReportQuestion[] };
type AnswerKey = { assessment:{slug:string;title:string;instructions:string|null}; questions:Array<Omit<ReportQuestion,'student_answer'|'is_correct'> & {accepted_answers:string[]|null}> };

export default function ClassroomPage() {
  const router=useRouter();
  const [supabase]=useState(()=>createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!));
  const [sections,setSections]=useState<Section[]>([]);
  const [assessments,setAssessments]=useState<Assessment[]>([]);
  const [sectionId,setSectionId]=useState('');
  const [assessmentSlug,setAssessmentSlug]=useState('');
  const [expectedStudents,setExpectedStudents]=useState(17);
  const [session,setSession]=useState<Session|null>(null);
  const [submissions,setSubmissions]=useState<Submission[]>([]);
  const [qr,setQr]=useState('');
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [report,setReport]=useState<Report|null>(null);
  const [answerKey,setAnswerKey]=useState<AnswerKey|null>(null);

  const selectedAssessment=assessments.find(a=>a.slug===assessmentSlug)??null;
  const selectedSection=sections.find(s=>s.section_id===sectionId)??null;
  const submitted=submissions.length;
  const remaining=Math.max((session?.expected_students??expectedStudents)-submitted,0);
  const progress=Math.min(100,Math.round(100*submitted/Math.max(session?.expected_students??expectedStudents,1)));
  const joinUrl=session?.status==='active'&&typeof window!=='undefined'?`${window.location.origin}/join/${session.join_code}`:'';

  const loadSubmissions=async(sessionId:string)=>{
    const {data,error:e}=await supabase.from('classroom_submissions')
      .select('id,student_name,student_id,team_members,score,possible_score,submitted_at,domain_scores')
      .eq('classroom_session_id',sessionId).order('submitted_at',{ascending:false});
    if(e) throw e;
    setSubmissions((data??[]) as Submission[]);
  };

  useEffect(()=>{
    (async()=>{
      try{
        const {data:auth}=await supabase.auth.getSession();
        if(!auth.session){router.replace('/login');return;}

        const {error:expireError}=await supabase.rpc('expire_classroom_sessions');
        if(expireError) throw expireError;

        const [{data:s,error:se},{data:a,error:ae}]=await Promise.all([
          supabase.from('current_teaching_sections').select('section_id,section_name,section_code,course_code,course_name'),
          supabase.rpc('list_assessment_modules_v2')
        ]);
        if(se||ae) throw se||ae;
        const sectionRows=(s??[]) as Section[];
        const assessmentRows=(a??[]) as Assessment[];
        setSections(sectionRows);setAssessments(assessmentRows);

        const params=new URLSearchParams(window.location.search);
        const requestedSection=params.get('section');
        const requestedAssessment=params.get('assessment');
        const validRequestedSection=requestedSection&&sectionRows.some(row=>row.section_id===requestedSection)?requestedSection:null;
        const validRequestedAssessment=requestedAssessment&&assessmentRows.some(row=>row.slug===requestedAssessment)?requestedAssessment:null;
        const initialSection=validRequestedSection??sectionRows[0]?.section_id??'';
        const initialAssessment=validRequestedAssessment??assessmentRows[0]?.slug??'';
        if(initialSection)setSectionId(initialSection);
        if(initialAssessment)setAssessmentSlug(initialAssessment);

        const hasRequestedContext=Boolean(requestedSection||requestedAssessment);
        const requestedContextIsValid=(!requestedSection||Boolean(validRequestedSection))&&(!requestedAssessment||Boolean(validRequestedAssessment));
        const sectionIds=sectionRows.map(row=>row.section_id);

        if(sectionIds.length&&(!hasRequestedContext||requestedContextIsValid)){
          let activeQuery=supabase.from('classroom_sessions')
            .select('id,join_code,status,started_at,expires_at,section_id,assessment_slug,expected_students')
            .eq('status','active')
            .gt('expires_at',new Date().toISOString())
            .in('section_id',sectionIds);

          if(validRequestedSection)activeQuery=activeQuery.eq('section_id',validRequestedSection);
          if(validRequestedAssessment)activeQuery=activeQuery.eq('assessment_slug',validRequestedAssessment);

          const {data:active,error:activeError}=await activeQuery.order('started_at',{ascending:false}).limit(1).maybeSingle();
          if(activeError)throw activeError;
          if(active){
            const restored=active as Session;
            setSession(restored);setSectionId(restored.section_id);setAssessmentSlug(restored.assessment_slug);setExpectedStudents(restored.expected_students);
          }
        }
      }catch(e){setError(e instanceof Error?e.message:String(e));}
      finally{setLoading(false);}
    })();
  },[router,supabase]);

  useEffect(()=>{
    if(!session||session.status!=='active'||!joinUrl){setQr('');return;}
    QRCode.toDataURL(joinUrl,{width:340,margin:2,color:{dark:'#050505',light:'#ffffff'}}).then(setQr).catch(e=>setError(e.message));
    loadSubmissions(session.id).catch(e=>setError(e.message));
    const channel=supabase.channel(`classroom-${session.id}`)
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'classroom_submissions',filter:`classroom_session_id=eq.${session.id}`},()=>loadSubmissions(session.id))
      .subscribe();
    return()=>{void supabase.removeChannel(channel);};
  },[session?.id,session?.status,joinUrl,supabase]);

  const start=async()=>{
    if(!sectionId||!assessmentSlug)return;
    setBusy(true);setError('');
    try{
      const {data,error:e}=await supabase.rpc('start_classroom_session_v2',{p_section_id:sectionId,p_assessment_slug:assessmentSlug,p_expected_students:expectedStudents});
      if(e)throw e;
      const {data:row,error:re}=await supabase.from('classroom_sessions')
        .select('id,join_code,status,started_at,expires_at,section_id,assessment_slug,expected_students').eq('id',data).single();
      if(re)throw re;
      setSubmissions([]);setReport(null);setSession(row as Session);
    }catch(e){setError(e instanceof Error?e.message:String(e));}
    finally{setBusy(false);}
  };

  const end=async()=>{
    if(!session)return;
    setBusy(true);setError('');
    const {error:e}=await supabase.rpc('end_classroom_session',{p_session_id:session.id});
    setBusy(false);
    if(e)setError(e.message);else setSession({...session,status:'ended'});
  };

  const openReport=async(id:string)=>{
    setBusy(true);setError('');
    const {data,error:e}=await supabase.rpc('get_classroom_submission_report',{p_submission_id:id});
    setBusy(false);
    if(e)setError(e.message);else setReport(data as Report);
  };

  const openAnswerKey=async(slug=assessmentSlug)=>{
    if(!slug)return;
    setBusy(true);setError('');
    const {data,error:e}=await supabase.rpc('get_assessment_answer_key',{p_assessment_slug:slug});
    setBusy(false);
    if(e)setError(e.message);else setAnswerKey(data as AnswerKey);
  };

  const exportCsv=()=>{
    const esc=(v:unknown)=>`"${String(v??'').replaceAll('"','""')}"`;
    const rows=[['Student','Student ID','Team Members','Score','Possible','Percent','Submitted','Domain Scores'],...submissions.map(s=>[s.student_name,s.student_id,s.team_members??'',s.score,s.possible_score,Math.round(100*s.score/s.possible_score),new Date(s.submitted_at).toLocaleString(),JSON.stringify(s.domain_scores)])];
    const blob=new Blob([rows.map(r=>r.map(esc).join(',')).join('\n')],{type:'text/csv'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`${session?.assessment_slug??'assessment'}-results.csv`;a.click();URL.revokeObjectURL(a.href);
  };

  if(loading)return <main className="loading">Opening Connected Classroom…</main>;
  return <div className="shell">
    <header><div><div className="eyebrow">Living Teacher Guide</div><h1>Connected Classroom Testing</h1></div><button onClick={()=>router.push('/dashboard')}>Back to Planner</button></header>
    <main>
      {error&&<div className="error">{error}</div>}
      {!session?<section className="panel start">
        <div className="eyebrow">Assessment Library</div><h2>Launch a Class Test</h2>
        <p>Choose the class and test. Students scan one QR code; scores appear here as they submit.</p>
        <div className="setup-grid">
          <label>Class<select value={sectionId} onChange={e=>setSectionId(e.target.value)}>{sections.map(s=><option key={s.section_id} value={s.section_id}>{s.course_code??''} · {s.section_name??s.section_code??'Class'}</option>)}</select></label>
          <label>Expected Students<input type="number" min={1} max={60} value={expectedStudents} onChange={e=>setExpectedStudents(Math.min(60,Math.max(1,Number(e.target.value)||1)))}/></label>
        </div>
        <div className="library">{assessments.map(a=><button type="button" key={a.slug} className={`assessment-card ${assessmentSlug===a.slug?'selected':''}`} onClick={()=>setAssessmentSlug(a.slug)}><span>{a.category}</span><strong>{a.title}</strong><small>{a.question_count} questions{a.estimated_minutes?` · ${a.estimated_minutes} minutes`:''}</small>{a.description&&<em>{a.description}</em>}</button>)}</div>
        {selectedAssessment?.instructions&&<details><summary>Instructor directions</summary><p className="directions">{selectedAssessment.instructions}</p></details>}
        <div className="start-actions"><button className="primary" disabled={busy||!sectionId||!assessmentSlug} onClick={start}>Start {selectedAssessment?.title??'Live Assessment'}</button><button disabled={busy||!assessmentSlug} onClick={()=>openAnswerKey()}>View Answer Key</button></div>
        {!sections.length&&<p className="muted">No assigned teaching sections were found for this account.</p>}
      </section>:<>
        <section className="panel live-grid">
          <div><div className={session.status==='active'?'live':'ended'}>● {session.status==='active'?'LIVE':'ENDED'}</div><div className="eyebrow">{selectedSection?.course_code} · {selectedSection?.section_name??selectedSection?.section_code}</div><h2>{selectedAssessment?.title??session.assessment_slug}</h2>{session.status==='active'?<><div className="code">{session.join_code}</div><a href={joinUrl} target="_blank" rel="noreferrer">{joinUrl}</a><p className="muted">Join code valid until {new Date(session.expires_at).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}.</p></>:<p className="muted">Session ended. The student join code is no longer valid.</p>}<div className="actions">{session.status==='active'&&<button onClick={()=>navigator.clipboard.writeText(joinUrl)}>Copy Link</button>}<button onClick={()=>openAnswerKey(session.assessment_slug)}>Answer Key</button><button className="danger" disabled={busy||session.status!=='active'} onClick={end}>End Session</button>{session.status==='ended'&&<button className="primary" onClick={()=>{setSession(null);setReport(null);setQr('');}}>New Session</button>}</div></div>
          <div className="qr">{session.status==='active'&&qr&&<img src={qr} alt="QR code for students to join the assessment"/>}</div>
        </section>
        <section className="panel"><div className="results-head"><div><div className="eyebrow">Live Progress</div><h2>{submitted} submitted · {remaining} remaining</h2></div><button disabled={!submissions.length} onClick={exportCsv}>Export CSV</button></div><div className="progress"><span style={{width:`${progress}%`}}/></div><div className="progress-label">{progress}% of {session.expected_students} expected students</div>
          <div className="table-wrap"><table><thead><tr><th>Student</th><th>ID / Team</th><th>Score</th><th>Percent</th><th>Submitted</th><th>Report</th></tr></thead><tbody>{submissions.map(s=><tr key={s.id}><td>{s.student_name}</td><td>{s.student_id}{s.team_members&&<small>{s.team_members}</small>}</td><td>{s.score}/{s.possible_score}</td><td><strong>{Math.round(100*s.score/s.possible_score)}%</strong></td><td>{new Date(s.submitted_at).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}</td><td><button disabled={busy} onClick={()=>openReport(s.id)}>View</button></td></tr>)}</tbody></table>{!submissions.length&&<div className="empty">Waiting for student submissions…</div>}</div>
        </section>
      </>}
      {report&&<section className="panel report"><div className="results-head"><div><div className="eyebrow">Individual Report</div><h2>{report.submission.student_name} · {report.submission.score}/{report.submission.possible_score} ({report.submission.percent}%)</h2><p>{report.submission.student_id}{report.submission.team_members?` · Team: ${report.submission.team_members}`:''}</p></div><div className="actions"><button onClick={()=>window.print()}>Print</button><button onClick={()=>setReport(null)}>Close</button></div></div><div className="report-list">{report.questions.map(q=><article key={q.key} className={q.is_correct?'correct':'incorrect'}><strong>{q.number}. {q.text}</strong><p>Student: {q.student_answer} · Correct: {q.correct_answer}</p>{q.explanation&&<small>{q.explanation}</small>}</article>)}</div></section>}
      {answerKey&&<section className="panel report"><div className="results-head"><div><div className="eyebrow">Instructor Only</div><h2>{answerKey.assessment.title} Answer Key</h2></div><div className="actions"><button onClick={()=>window.print()}>Print</button><button onClick={()=>setAnswerKey(null)}>Close</button></div></div><div className="report-list">{answerKey.questions.map(q=><article key={q.key}><strong>{q.number}. {q.text}</strong><p>Answer: {q.correct_answer}{q.options?.[q.correct_answer]?` — ${q.options[q.correct_answer]}`:''}</p>{q.explanation&&<small>{q.explanation}</small>}</article>)}</div></section>}
    </main>
    <style jsx>{`.shell{min-height:100vh;background:#080808;color:#ddd}.loading{min-height:100vh;display:grid;place-items:center;background:#080808;color:#aaa}header{display:flex;justify-content:space-between;align-items:center;padding:20px 28px;border-bottom:1px solid #292929;background:#111}main{width:min(1100px,calc(100% - 28px));margin:auto;padding:25px 0 50px}.eyebrow{color:#9adf4b;text-transform:uppercase;letter-spacing:.12em;font-size:10px;font-weight:900}h1,h2{margin:5px 0;color:white}.panel{margin-bottom:16px;padding:20px;border:1px solid #292929;border-radius:10px;background:#131313}.start{max-width:850px;margin:40px auto}.start>p,.directions,.report p{color:#999;white-space:pre-line;line-height:1.5}.setup-grid{display:grid;grid-template-columns:1fr 180px;gap:12px}label{display:grid;gap:7px;margin:18px 0;color:#888;font-size:11px;font-weight:800;text-transform:uppercase}select,input{box-sizing:border-box;width:100%;padding:12px;border:1px solid #333;border-radius:7px;background:#090909;color:#eee}button{padding:10px 14px;border:1px solid #383838;border-radius:7px;background:#151515;color:#ddd;font-weight:800;cursor:pointer}button:disabled{opacity:.4}.primary{border-color:#9adf4b;color:#caff77}.danger{border-color:#7b3333;color:#ff9696}.library{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:18px 0}.assessment-card{display:grid;gap:5px;text-align:left;padding:15px}.assessment-card span{color:#9adf4b;font-size:9px;text-transform:uppercase;letter-spacing:.1em}.assessment-card strong{color:#eee;font-size:15px}.assessment-card small{color:#888}.assessment-card em{color:#777;font-size:11px;font-style:normal;line-height:1.4}.assessment-card.selected{border-color:#9adf4b;background:rgba(154,223,75,.07)}details{margin-bottom:16px;color:#caff77}.start-actions,.actions{display:flex;gap:9px;flex-wrap:wrap}.start-actions .primary{flex:1}.error{margin-bottom:14px;padding:12px;border:1px solid #713333;color:#ff9999}.live-grid{display:grid;grid-template-columns:1fr 360px;gap:25px;align-items:center}.live{color:#00ff88;font-weight:900}.ended{color:#ffb35c;font-weight:900}.code{margin:18px 0 8px;color:white;font-size:46px;font-weight:900;letter-spacing:.15em}.live-grid a{color:#8edfff;overflow-wrap:anywhere}.actions{margin-top:18px}.qr{text-align:center}.qr img{width:min(100%,340px);border-radius:8px}.results-head{display:flex;justify-content:space-between;align-items:center;gap:15px}.progress{height:12px;margin-top:16px;overflow:hidden;border-radius:20px;background:#292929}.progress span{display:block;height:100%;background:#9adf4b}.progress-label{margin-top:6px;color:#888;font-size:11px}.table-wrap{overflow-x:auto}table{width:100%;border-collapse:collapse;margin-top:14px}th,td{padding:11px;border-bottom:1px solid #292929;text-align:left}th{color:#777;font-size:10px;text-transform:uppercase}td small{display:block;margin-top:3px;color:#888}.empty{text-align:center;padding:35px;color:#666}.muted{color:#777}.report-list{display:grid;gap:8px;margin-top:18px}.report-list article{padding:12px;border-left:4px solid #555;background:#0d0d0d}.report-list article.correct{border-color:#67c23a}.report-list article.incorrect{border-color:#e05d5d}.report-list article p{margin:6px 0}.report-list article small{color:#888}@media(max-width:760px){header{align-items:flex-start;gap:15px}.live-grid,.library,.setup-grid{grid-template-columns:1fr}.qr{order:-1}.code{font-size:34px}.results-head{align-items:flex-start;flex-direction:column}}@media print{header,.live-grid,.panel:not(.report),.report .actions{display:none}.shell,main,.panel{background:white;color:black}.report{display:block;border:0}.report h2,.report strong{color:black}}`}</style>
  </div>;
}
