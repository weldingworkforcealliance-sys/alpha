'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

type AnyReport = Record<string, any>;

function fmt(v:any){
  if(!v)return '—';
  return new Date(v).toLocaleString('en-US',{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'});
}

export default function TrainingReportPage(){
  const params=useParams<{id:string}>(); const reportId=params.id; const router=useRouter();
  const [supabase]=useState(()=>createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!));
  const [loading,setLoading]=useState(true);const[busy,setBusy]=useState(false);const[error,setError]=useState('');const[report,setReport]=useState<AnyReport|null>(null);

  useEffect(()=>{(async()=>{try{const{data:auth}=await supabase.auth.getSession();if(!auth.session){router.replace('/training/login');return;}const{data,error:rpcError}=await supabase.rpc('get_training_report',{p_report_id:reportId});if(rpcError)throw rpcError;setReport((data??null) as AnyReport|null);}catch(err){setError(err instanceof Error?err.message:String(err));}finally{setLoading(false);}})();},[reportId]);

  const downloadJson=()=>{if(!report)return;const blob=new Blob([JSON.stringify(report,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`training_report_${report.session_name??reportId}.json`.replace(/[^a-z0-9_.-]+/gi,'_');a.click();URL.revokeObjectURL(url);};
  const acknowledge=async()=>{if(!window.confirm('Confirm you have received this report? The temporary report envelope will be deleted from the system.'))return;setBusy(true);setError('');try{const r=await supabase.rpc('acknowledge_training_report',{p_report_id:reportId});if(r.error)throw r.error;router.push('/training');}catch(err){setError(err instanceof Error?err.message:String(err));setBusy(false);}};

  if(loading)return <main className="loading">Loading temporary training report…</main>;
  if(!report)return <main className="loading">{error||'Training report unavailable.'}</main>;

  const participants=Array.isArray(report.participants)?report.participants:[];const sections=Array.isArray(report.sections)?report.sections:[];const actions=report.activity_counts&&typeof report.activity_counts==='object'?Object.entries(report.activity_counts):[];

  return <div className="shell">
    <div className="banner">TRAINING REPORT · TEMPORARY · NOT PART OF PRODUCTION REPORTING</div>
    <header><div><div className="eyebrow">Living Teacher Planner</div><h1>{report.session_name??'Training Report'}</h1></div><div className="actions"><button onClick={()=>window.print()}>Print / Save PDF</button><button onClick={downloadJson}>Download JSON</button><button onClick={()=>router.push('/training')}>Training Center</button></div></header>
    <main>
      {error&&<div className="error">{error}</div>}
      <section className="panel title"><div><div className="eyebrow">{report.report_type??'Training Report'}</div><h2>{report.school_name??'School'}</h2></div><div className="stamp">TRAINING ONLY<br/><strong>Production affected: NO</strong></div></section>
      <div className="metrics"><Metric label="Participants" value={String(report.participant_count??participants.length)}/><Metric label="Duration" value={`${report.duration_minutes??0} min`}/><Metric label="Completed Training Days" value={String(report.completed_training_days??0)}/><Metric label="Training Notes" value={String(report.training_notes??0)}/><Metric label="Follow-Ups" value={String(report.follow_ups??0)}/></div>

      <section className="panel"><h2>Session</h2><div className="facts"><Fact label="Started" value={fmt(report.started_at)}/><Fact label="Ended" value={fmt(report.ended_at)}/><Fact label="Session ID" value={String(report.session_id??'—')}/></div></section>

      <section className="panel"><h2>Participants</h2><div className="table"><div className="thead"><span>Name</span><span>Role</span><span>Joined</span><span>Left</span><span>Training Time</span></div>{participants.map((p:any)=><div className="trow" key={p.user_id}><span><strong>{p.display_name??'Unnamed User'}</strong><small>{p.email??''}</small></span><span>{String(p.school_role??'').replace(/_/g,' ')}</span><span>{fmt(p.joined_at)}</span><span>{fmt(p.left_at)}</span><span>{p.training_minutes??0} min</span></div>)}</div></section>

      <section className="panel"><h2>Section Training Summary</h2><div className="table"><div className="thead sections"><span>Section</span><span>Course</span><span>Current Training Day</span><span>Completed Days</span><span>Follow-Ups</span><span>Hold</span></div>{sections.map((s:any)=><div className="trow sections" key={s.section_id}><span><strong>{s.section_name??'Section'}</strong></span><span>{s.course_code??'—'}</span><span>Day {s.current_training_day??'—'}</span><span>{s.completed_training_days??0}</span><span>{s.follow_ups??0}</span><span>{s.manual_hold?'Yes':'No'}</span></div>)}</div></section>

      <section className="panel"><h2>Activity Practiced</h2><div className="actions-list">{actions.map(([name,count])=><div key={name}><span>{String(name).replace(/_/g,' ')}</span><strong>{String(count)}</strong></div>)}</div></section>

      <section className="panel delete"><h2>Report Receipt</h2><p>This report envelope is temporary. After you print, save, or download it, acknowledge receipt to remove the final training-report record from the platform.</p><button className="danger" disabled={busy} onClick={acknowledge}>Acknowledge Receipt & Delete Temporary Report</button></section>
    </main>
    <style jsx>{`
      .shell{min-height:100vh;background:#f3f3f3;color:#222}.loading{min-height:100vh;display:grid;place-items:center;background:#080808;color:#aaa}.banner{padding:9px;text-align:center;background:#9a4d13;color:#fff;font-size:11px;font-weight:900;letter-spacing:.08em}header{display:flex;justify-content:space-between;gap:20px;align-items:center;padding:18px 26px;background:#111;color:#fff}.eyebrow{color:#b45a16;text-transform:uppercase;letter-spacing:.12em;font-size:10px;font-weight:900}header .eyebrow{color:#ffad70}h1,h2{margin:4px 0}h1{font-size:22px}h2{font-size:20px}.actions{display:flex;gap:8px;flex-wrap:wrap}button{padding:9px 12px;border:1px solid #444;border-radius:7px;background:#1a1a1a;color:#eee;font-weight:750;cursor:pointer}.danger{border-color:#b93636;color:#a72828;background:#fff}.actions button:hover{border-color:#ffad70;color:#ffad70}main{width:min(1200px,calc(100% - 28px));margin:auto;padding:22px 0 50px}.panel{padding:20px;border:1px solid #d5d5d5;border-radius:9px;background:#fff;margin-bottom:15px}.title{display:flex;justify-content:space-between;align-items:center}.stamp{padding:11px 14px;border:2px solid #b45a16;color:#b45a16;text-align:center;font-size:10px;font-weight:900}.stamp strong{font-size:12px}.metrics{display:grid;grid-template-columns:repeat(5,1fr);gap:9px;margin-bottom:15px}.facts{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.fact{padding:11px;border-radius:7px;background:#f5f5f5}.fact span{display:block;color:#777;font-size:9px;text-transform:uppercase;font-weight:850}.fact strong{display:block;margin-top:3px;word-break:break-word}.table{overflow-x:auto;margin-top:12px}.thead,.trow{min-width:900px;display:grid;grid-template-columns:1.4fr .8fr 1fr 1fr .7fr;gap:10px;padding:10px}.sections{grid-template-columns:1.4fr .6fr .8fr .8fr .7fr .5fr}.thead{background:#efefef;color:#666;font-size:9px;text-transform:uppercase;font-weight:850}.trow{border-top:1px solid #e4e4e4;font-size:12px}.trow strong,.trow small{display:block}.trow small{color:#888;margin-top:2px}.actions-list{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.actions-list>div{display:flex;justify-content:space-between;gap:10px;padding:10px;border-radius:7px;background:#f5f5f5;text-transform:capitalize}.delete{border-color:#e3b6b6}.delete p{color:#666;line-height:1.5}.error{margin-bottom:12px;padding:10px;border:1px solid #d99999;background:#fff0f0;color:#a33;border-radius:7px}
      @media(max-width:800px){header,.title{align-items:flex-start;flex-direction:column}.metrics{grid-template-columns:1fr 1fr}.facts,.actions-list{grid-template-columns:1fr}}
      @media print{.banner,header,.delete{display:none!important}.shell{background:#fff}main{width:100%;padding:0}.panel{break-inside:avoid}}
    `}</style>
  </div>;
}
function Metric({label,value}:{label:string;value:string}){return <div style={{padding:12,border:'1px solid #d5d5d5',borderRadius:8,background:'white'}}><span style={{display:'block',color:'#777',fontSize:9,textTransform:'uppercase',fontWeight:850}}>{label}</span><strong style={{display:'block',fontSize:20,marginTop:4}}>{value}</strong></div>}
function Fact({label,value}:{label:string;value:string}){return <div className="fact"><span>{label}</span><strong>{value}</strong></div>}
