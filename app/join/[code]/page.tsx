'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

type Question={key:string;number:number;text:string;domain:string;type:'mc'|'text';options:Record<string,string>|null};
type SessionInfo={session_id:string;session_name:string;assessment_title:string;question_count:number;expected_students:number;instructions:string|null;allow_team_members:boolean};

export default function StudentAssessmentPage(){
  const {code}=useParams<{code:string}>();
  const [supabase]=useState(()=>createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!));
  const [info,setInfo]=useState<SessionInfo|null>(null);
  const [questions,setQuestions]=useState<Question[]>([]);
  const [name,setName]=useState('');
  const [studentId,setStudentId]=useState('');
  const [teamMembers,setTeamMembers]=useState('');
  const [answers,setAnswers]=useState<Record<string,string>>({});
  const [started,setStarted]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [result,setResult]=useState<{score:number;possible_score:number;percent:number}|null>(null);
  const storageKey=`ltg-assessment-${String(code).toUpperCase()}`;

  useEffect(()=>{
    (async()=>{
      const {data,error:e}=await supabase.rpc('get_classroom_assessment',{p_join_code:String(code).toUpperCase()});
      if(e){setError(e.message);return;}
      const payload=data as {session:SessionInfo;questions:Question[]};
      setInfo(payload.session);setQuestions(payload.questions);
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

  const submit=async()=>{
    if(Object.keys(answers).length!==questions.length){setError(`Answer all ${questions.length} questions before submitting.`);return;}
    setBusy(true);setError('');
    const {data,error:e}=await supabase.rpc('submit_classroom_assessment_v2',{
      p_join_code:String(code).toUpperCase(),p_student_name:name.trim(),p_student_id:studentId.trim(),p_team_members:teamMembers.trim(),p_answers:answers
    });
    setBusy(false);
    if(e)setError(e.message);else{localStorage.removeItem(storageKey);setResult(data);}
  };

  if(error&&!info)return <main className="center"><div><h1>Unable to Join</h1><p>{error}</p></div><style jsx>{styles}</style></main>;
  if(!info)return <main className="center">Opening assessment…<style jsx>{styles}</style></main>;
  if(result)return <main className="center"><div className="card result"><div className="check">✓</div><h1>Assessment Submitted</h1><div className="score">{result.score}/{result.possible_score}</div><strong>{result.percent}%</strong><p>Your instructor received your score.</p></div><style jsx>{styles}</style></main>;
  if(!started)return <main className="center"><div className="card"><div className="eyebrow">PCCC Welding · Living Teacher Guide</div><h1>{info.assessment_title}</h1><p>{info.question_count} questions · Results are sent directly to your instructor.</p>{info.instructions&&<div className="instructions">{info.instructions}</div>}{error&&<div className="error">{error}</div>}<label>Student Name<input value={name} onChange={e=>setName(e.target.value)} autoComplete="name"/></label><label>Student ID<input value={studentId} onChange={e=>setStudentId(e.target.value)} inputMode="numeric"/></label>{info.allow_team_members&&<label>Team Members (optional)<input value={teamMembers} onChange={e=>setTeamMembers(e.target.value)} placeholder="Names of students working with you"/></label>}<button disabled={!name.trim()||!studentId.trim()} onClick={()=>setStarted(true)}>Begin Assessment</button><p className="draft-note">Your answers are saved on this device until you submit.</p></div><style jsx>{styles}</style></main>;
  return <main><div className="top"><div><div className="eyebrow">{info.assessment_title}</div><h1>{name}</h1></div><div>{Object.keys(answers).length}/{questions.length} answered</div></div>{error&&<div className="error">{error}</div>}<div className="questions">{questions.map(q=><section className="card" key={q.key}><div className="qmeta">Question {q.number} · {q.domain}</div><h2>{q.text}</h2>{q.type==='mc'&&q.options?Object.entries(q.options).map(([key,value])=><label className={`option ${answers[q.key]===key?'selected':''}`} key={key}><input type="radio" name={q.key} checked={answers[q.key]===key} onChange={()=>setAnswers(a=>({...a,[q.key]:key}))}/><strong>{key}</strong><span>{value}</span></label>):<input className="text-answer" value={answers[q.key]??''} onChange={e=>setAnswers(a=>({...a,[q.key]:e.target.value}))} placeholder="Enter your answer"/>}</section>)}</div><button className="submit" disabled={busy} onClick={submit}>{busy?'Submitting…':'Submit Assessment'}</button><style jsx>{styles}</style></main>;
}

const styles=`main{min-height:100vh;background:#080808;color:#ddd;padding:22px;font-family:Arial,sans-serif}.center{display:grid;place-items:center}.card{width:min(720px,100%);box-sizing:border-box;margin:0 auto 14px;padding:20px;border:1px solid #303030;border-radius:10px;background:#131313}.eyebrow,.qmeta{color:#9adf4b;font-size:10px;font-weight:900;letter-spacing:.1em;text-transform:uppercase}h1,h2{color:#fff}h1{margin:6px 0;font-size:25px}h2{font-size:18px;line-height:1.4}.card p{color:#888;line-height:1.5}.instructions{margin:15px 0;padding:13px;border-left:3px solid #9adf4b;background:#0d0d0d;color:#bbb;white-space:pre-line;line-height:1.55;font-size:13px}label:not(.option){display:grid;gap:7px;margin-top:16px;color:#999;font-size:11px;font-weight:800;text-transform:uppercase}input{box-sizing:border-box;width:100%;padding:12px;border:1px solid #383838;border-radius:7px;background:#090909;color:#fff;font-size:16px}button{width:100%;margin-top:18px;padding:14px;border:1px solid #9adf4b;border-radius:8px;background:rgba(154,223,75,.08);color:#caff77;font-size:15px;font-weight:900}button:disabled{opacity:.4}.draft-note{text-align:center;font-size:11px}.top{width:min(720px,100%);margin:0 auto 18px;display:flex;justify-content:space-between;align-items:center}.questions{display:grid;gap:2px}.option{display:grid;grid-template-columns:22px 28px 1fr;align-items:center;margin-top:9px;padding:12px;border:1px solid #303030;border-radius:8px;background:#0d0d0d;cursor:pointer}.option.selected{border-color:#9adf4b;background:rgba(154,223,75,.07)}.option input{padding:0;accent-color:#9adf4b}.option strong{color:#caff77}.option span{color:#ddd}.text-answer{width:100%}.submit{display:block;width:min(720px,100%);margin:20px auto 50px}.error{width:min(720px,100%);box-sizing:border-box;margin:0 auto 14px;padding:12px;border:1px solid #713333;border-radius:7px;color:#ff9999;background:#1c0c0c}.result{text-align:center}.check{color:#9adf4b;font-size:56px}.score{margin:15px;color:white;font-size:54px;font-weight:900}.result>strong{color:#9adf4b;font-size:25px}@media(max-width:600px){main{padding:14px}.card{padding:16px}.top{align-items:flex-start}.top h1{font-size:20px}}`;
