'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getSupabase } from '@/lib/supabase-browser';

type Question={
  key:string;
  number:number;
  text:string;
  domain:string;
  type:'mc'|'text';
  options:Record<string,string>|null
};

type SessionInfo={
  session_id:string;
  session_name:string;
  assessment_title:string;
  question_count:number;
  expected_students:number;
  instructions:string|null;
  allow_team_members:boolean;
  reference_title:string|null;
  reference_image_url:string|null;
  reference_body:string|null;
  show_student_score:boolean;
};

export default function StudentAssessmentPage(){
  const {code}=useParams<{code:string}>();
  const [supabase]=useState(getSupabase);
  const [info,setInfo]=useState<SessionInfo|null>(null);
  const [questions,setQuestions]=useState<Question[]>([]);
  const [name,setName]=useState('');
  const [studentId,setStudentId]=useState('');
  const [teamMembers,setTeamMembers]=useState('');
  const [answers,setAnswers]=useState<Record<string,string>>({});
  const [started,setStarted]=useState(false);
  const [referenceOpen,setReferenceOpen]=useState(false);
  const [referenceMaximized,setReferenceMaximized]=useState(false);
  const [referenceZoom,setReferenceZoom]=useState(1);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [result,setResult]=useState<{score:number;possible_score:number;percent:number}|null>(null);
  const storageKey=`ltg-assessment-${String(code).toUpperCase()}`;

  useEffect(()=>{
    (async()=>{
      const {data,error:e}=await supabase.rpc('get_classroom_assessment',{p_join_code:String(code).toUpperCase()});
      if(e){setError(e.message);return;}
      const payload=data as {session:SessionInfo;questions:Question[]};
      setInfo(payload.session);
      setQuestions(payload.questions);
      try{
        const saved=JSON.parse(localStorage.getItem(storageKey)??'{}');
        if(saved.name)setName(saved.name);
        if(saved.studentId)setStudentId(saved.studentId);
        if(saved.teamMembers)setTeamMembers(saved.teamMembers);
        if(saved.answers)setAnswers(saved.answers);
      }catch{/* Ignore an invalid local draft. */}
    })();
  },[code,storageKey,supabase]);

  useEffect(()=>{
    if(!info||result)return;
    localStorage.setItem(storageKey,JSON.stringify({name,studentId,teamMembers,answers}));
  },[answers,info,name,result,storageKey,studentId,teamMembers]);

  useEffect(()=>{
    if(!referenceMaximized)return;
    const previousOverflow=document.body.style.overflow;
    document.body.style.overflow='hidden';
    const handleKeyDown=(event:KeyboardEvent)=>{
      if(event.key==='Escape')setReferenceMaximized(false);
    };
    window.addEventListener('keydown',handleKeyDown);
    return()=>{
      document.body.style.overflow=previousOverflow;
      window.removeEventListener('keydown',handleKeyDown);
    };
  },[referenceMaximized]);

  const submit=async()=>{
    if(Object.keys(answers).length!==questions.length){
      setError(`Answer all ${questions.length} questions before submitting.`);
      return;
    }
    setBusy(true);
    setError('');
    const {data,error:e}=await supabase.rpc('submit_classroom_assessment_v2',{
      p_join_code:String(code).toUpperCase(),
      p_student_name:name.trim(),
      p_student_id:studentId.trim(),
      p_team_members:teamMembers.trim(),
      p_answers:answers
    });
    setBusy(false);
    if(e)setError(e.message);
    else{
      localStorage.removeItem(storageKey);
      setResult(data);
    }
  };

  const openMaximizedReference=()=>{
    setReferenceZoom(1);
    setReferenceMaximized(true);
  };

  const adjustReferenceZoom=(amount:number)=>{
    setReferenceZoom(current=>Math.min(2.5,Math.max(.75,Number((current+amount).toFixed(2)))));
  };

  const ReferencePanel=()=>{
    if(!(info?.reference_title||info?.reference_image_url||info?.reference_body))return null;
    const isWhiteboard=Boolean(info.reference_image_url);
    const openLabel=isWhiteboard?'Open Class Whiteboard':'Open Class Reference';
    const closeLabel=isWhiteboard?'Close Whiteboard':'Close Reference';

    return <>
      <section className="card reference-card">
        <div className="reference-head">
          <div>
            <div className="reference-kicker">Class Reference</div>
            <div className="reference-title">{info.reference_title??'Live class reference'}</div>
          </div>
          <div className="reference-actions">
            {referenceOpen&&info.reference_image_url&&
              <button
                type="button"
                className="reference-toggle"
                onClick={openMaximizedReference}
              >
                Maximize Whiteboard
              </button>
            }
            <button
              type="button"
              className="reference-toggle"
              aria-expanded={referenceOpen}
              onClick={()=>setReferenceOpen(open=>!open)}
            >
              {referenceOpen?closeLabel:openLabel}
            </button>
          </div>
        </div>
        {referenceOpen&&
          <div className="reference-content">
            {info.reference_image_url&&
              <img
                className="reference-image"
                src={info.reference_image_url}
                alt={info.reference_title??'Live class reference'}
              />
            }
            {info.reference_body&&<div className="reference-body">{info.reference_body}</div>}
          </div>
        }
      </section>

      {referenceMaximized&&info.reference_image_url&&
        <div className="reference-overlay" role="dialog" aria-modal="true" aria-label={info.reference_title??'Maximized class whiteboard'}>
          <div className="reference-overlay-toolbar">
            <div className="reference-overlay-title">
              <div className="reference-kicker">Maximized Whiteboard</div>
              <strong>{info.reference_title??'Live class reference'}</strong>
            </div>
            <div className="reference-overlay-controls">
              <button type="button" onClick={()=>adjustReferenceZoom(-.25)} disabled={referenceZoom<=.75} aria-label="Zoom out">−</button>
              <button type="button" onClick={()=>setReferenceZoom(1)}>{Math.round(referenceZoom*100)}%</button>
              <button type="button" onClick={()=>adjustReferenceZoom(.25)} disabled={referenceZoom>=2.5} aria-label="Zoom in">+</button>
              <button type="button" className="reference-exit" onClick={()=>setReferenceMaximized(false)}>Exit Full Screen</button>
            </div>
          </div>
          <div className="reference-overlay-canvas">
            <img
              className="reference-overlay-image"
              src={info.reference_image_url}
              alt={info.reference_title??'Live class reference'}
              style={{width:`${referenceZoom*100}%`}}
            />
          </div>
          {info.reference_body&&<div className="reference-overlay-body">{info.reference_body}</div>}
        </div>
      }
    </>;
  };

  if(error&&!info)return <main className="center"><div><h1>Unable to Join</h1><p>{error}</p></div><style jsx>{styles}</style></main>;
  if(!info)return <main className="center">Opening assessment…<style jsx>{styles}</style></main>;

  if(result)return <main className="center">
    <div className="card result">
      <div className="check">✓</div>
      <h1>{info.show_student_score?'Activity Submitted':'Readiness Check Submitted'}</h1>
      {info.show_student_score&&<>
        <div className="score">{result.score}/{result.possible_score}</div>
        <strong>{result.percent}%</strong>
      </>}
      <p>
        {info.show_student_score
          ? 'Your instructor received your results.'
          : 'Your instructor received your readiness evidence. Complete the class closeout with your instructor.'}
      </p>
    </div>
    <style jsx>{styles}</style>
  </main>;

  if(!started)return <main className="center">
    <div className="start-stack">
      <div className="card">
        <div className="eyebrow">PCCC Welding · Living Teacher Guide</div>
        <h1>{info.assessment_title}</h1>
        <p>{info.question_count} live-check items · Results are sent directly to your instructor.</p>
        {info.instructions&&<div className="instructions">{info.instructions}</div>}
        {error&&<div className="error">{error}</div>}
        <label>Student Name<input value={name} onChange={e=>setName(e.target.value)} autoComplete="name"/></label>
        <label>Student ID<input value={studentId} onChange={e=>setStudentId(e.target.value)} inputMode="numeric"/></label>
        {info.allow_team_members&&
          <label>Team Members (optional)
            <input value={teamMembers} onChange={e=>setTeamMembers(e.target.value)} placeholder="Names of students working with you"/>
          </label>
        }
        <button disabled={!name.trim()||!studentId.trim()} onClick={()=>{setReferenceOpen(false);setReferenceMaximized(false);setStarted(true);}}>Begin Live Activity</button>
        <p className="draft-note">Your answers are saved on this device until you submit.</p>
      </div>
      <ReferencePanel/>
    </div>
    <style jsx>{styles}</style>
  </main>;

  return <main>
    <div className="top">
      <div><div className="eyebrow">{info.assessment_title}</div><h1>{name}</h1></div>
      <div>{Object.keys(answers).length}/{questions.length} answered</div>
    </div>
    {error&&<div className="error">{error}</div>}
    <ReferencePanel/>
    <div className="questions">
      {questions.map(q=>
        <section className="card" key={q.key}>
          <div className="qmeta">Question {q.number} · {q.domain}</div>
          <h2>{q.text}</h2>
          {q.type==='mc'&&q.options
            ? Object.entries(q.options).map(([key,value])=>
                <label className={`option ${answers[q.key]===key?'selected':''}`} key={key}>
                  <input type="radio" name={q.key} checked={answers[q.key]===key} onChange={()=>setAnswers(a=>({...a,[q.key]:key}))}/>
                  <strong>{key}</strong><span>{value}</span>
                </label>
              )
            : <input
                className="text-answer"
                value={answers[q.key]??''}
                onChange={e=>setAnswers(a=>({...a,[q.key]:e.target.value}))}
                placeholder="Enter your answer"
              />
          }
        </section>
      )}
    </div>
    <button className="submit" disabled={busy} onClick={submit}>{busy?'Submitting…':'Submit Live Activity'}</button>
    <style jsx>{styles}</style>
  </main>;
}

const styles=`
main{min-height:100vh;background:#080808;color:#ddd;padding:22px;font-family:Arial,sans-serif}
.center{display:grid;place-items:center}
.start-stack{width:min(720px,100%)}
.card{width:min(720px,100%);box-sizing:border-box;margin:0 auto 14px;padding:20px;border:1px solid #303030;border-radius:10px;background:#131313}
.eyebrow,.qmeta{color:#9adf4b;font-size:10px;font-weight:900;letter-spacing:.1em;text-transform:uppercase}
h1,h2{color:#fff}
h1{margin:6px 0;font-size:25px}
h2{font-size:18px;line-height:1.4}
.card p{color:#888;line-height:1.5}
.instructions{margin:15px 0;padding:13px;border-left:3px solid #9adf4b;background:#0d0d0d;color:#bbb;white-space:pre-line;line-height:1.55;font-size:13px}
label:not(.option){display:grid;gap:7px;margin-top:16px;color:#999;font-size:11px;font-weight:800;text-transform:uppercase}
input{box-sizing:border-box;width:100%;padding:12px;border:1px solid #383838;border-radius:7px;background:#090909;color:#fff;font-size:16px}
button{width:100%;margin-top:18px;padding:14px;border:1px solid #9adf4b;border-radius:8px;background:rgba(154,223,75,.08);color:#caff77;font-size:15px;font-weight:900}
button:disabled{opacity:.4}
.draft-note{text-align:center;font-size:11px}
.top{width:min(720px,100%);margin:0 auto 18px;display:flex;justify-content:space-between;align-items:center}
.questions{display:grid;gap:2px}
.option{display:grid;grid-template-columns:22px 28px 1fr;align-items:center;margin-top:9px;padding:12px;border:1px solid #303030;border-radius:8px;background:#0d0d0d;cursor:pointer}
.option.selected{border-color:#9adf4b;background:rgba(154,223,75,.07)}
.option input{padding:0;accent-color:#9adf4b}
.option strong{color:#caff77}
.option span{color:#ddd}
.text-answer{width:100%}
.submit{display:block;width:min(720px,100%);margin:20px auto 50px}
.error{width:min(720px,100%);box-sizing:border-box;margin:0 auto 14px;padding:12px;border:1px solid #713333;border-radius:7px;color:#ff9999;background:#1c0c0c}
.result{text-align:center}
.check{color:#9adf4b;font-size:56px}
.score{margin:15px;color:white;font-size:54px;font-weight:900}
.result>strong{color:#9adf4b;font-size:25px}
.reference-card{border-color:#566b46;background:#10140d}
.reference-head{display:flex;gap:14px;align-items:center;justify-content:space-between}
.reference-kicker{color:#82966f;font-size:9px;font-weight:900;letter-spacing:.12em;text-transform:uppercase}
.reference-title{margin-top:4px;color:#caff77;font-weight:900}
.reference-actions{display:flex;gap:8px;align-items:center;justify-content:flex-end;flex-wrap:wrap}
button.reference-toggle{width:auto;flex:0 0 auto;margin:0;padding:9px 12px;font-size:12px}
.reference-content{margin-top:14px;max-height:70vh;overflow:auto;padding-right:2px}
.reference-image{display:block;width:auto;max-width:100%;height:auto;max-height:56vh;margin:0 auto;border:1px solid #333;border-radius:7px;background:#fff;object-fit:contain}
.reference-body{margin-top:10px;color:#bbb;white-space:pre-line;line-height:1.5;font-size:13px}
.reference-overlay{position:fixed;inset:0;z-index:1000;display:grid;grid-template-rows:auto minmax(0,1fr) auto;background:#080808;color:#ddd;padding:14px;box-sizing:border-box}
.reference-overlay-toolbar{display:flex;gap:14px;align-items:center;justify-content:space-between;padding:0 0 12px;border-bottom:1px solid #303030}
.reference-overlay-title strong{display:block;margin-top:4px;color:#caff77;font-size:16px}
.reference-overlay-controls{display:flex;gap:8px;align-items:center;justify-content:flex-end;flex-wrap:wrap}
.reference-overlay-controls button{width:auto;min-width:46px;margin:0;padding:9px 12px;font-size:12px}
.reference-overlay-controls .reference-exit{min-width:130px}
.reference-overlay-canvas{min-height:0;overflow:auto;overscroll-behavior:contain;padding:14px;background:#111;border:1px solid #2c2c2c;border-radius:8px;margin-top:12px}
.reference-overlay-image{display:block;min-width:100%;max-width:none;height:auto;margin:0 auto;background:#fff;border-radius:5px}
.reference-overlay-body{padding:10px 2px 0;color:#bbb;white-space:pre-line;line-height:1.45;font-size:12px}
@media(max-width:600px){main{padding:14px}.card{padding:16px}.top{align-items:flex-start}.top h1{font-size:20px}.reference-head{align-items:flex-start;flex-direction:column}.reference-actions{width:100%;justify-content:stretch}.reference-actions button.reference-toggle{width:100%}.reference-content{max-height:64vh}.reference-image{max-height:50vh}.reference-overlay{padding:8px}.reference-overlay-toolbar{align-items:flex-start;flex-direction:column}.reference-overlay-controls{width:100%;justify-content:stretch}.reference-overlay-controls button{flex:1}.reference-overlay-controls .reference-exit{flex-basis:100%}.reference-overlay-canvas{padding:8px;margin-top:8px}}
`;
