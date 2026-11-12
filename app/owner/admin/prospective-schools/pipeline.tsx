'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabase-browser';
import { leadStatuses, type ContactInput, type LeadStatus } from '@/lib/contact';
import './pipeline.css';

type Lead = ContactInput & { id: string; created_at: string; updated_at: string; status: LeadStatus; notes: string; notification_status: string };
type History = { id: string; changed_at: string; old_status: string; new_status: string; notes_changed: boolean };
export default function Pipeline() {
  const [db] = useState(getSupabase);
  const [leads,setLeads] = useState<Lead[]>([]);
  const [filter,setFilter] = useState('all'); const [page,setPage] = useState(0);
  const [total,setTotal] = useState(0); const [loading,setLoading] = useState(true);
  const [selected,setSelected] = useState<Lead|null>(null);
  const [history,setHistory] = useState<History[]>([]);
  const [status,setStatus] = useState<LeadStatus>('New'); const [notes,setNotes] = useState('');
  const [error,setError] = useState(''); const [notice,setNotice] = useState(''); const [busy,setBusy] = useState(false);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    let query = db.from('contact_leads').select('*',{count:'exact'}).order('created_at',{ascending:false}).order('id').range(page*25,page*25+24);
    if (filter !== 'all') query = query.eq('status',filter);
    const {data,error,count} = await query;
    if(error) setError('Unable to load inquiries. Check your access or try again.');
    else { setLeads(data as Lead[]); setTotal(count || 0); }
    setLoading(false);
  },[db,filter,page]);
  useEffect(()=>{ void load(); },[load]);
  useEffect(()=>{
    let active=true; setHistory([]);
    if(selected) void db.from('contact_lead_history').select('*').eq('lead_id',selected.id).order('changed_at',{ascending:false}).limit(50).then(({data,error}: {data: History[] | null; error: unknown})=>{if(active){if(error)setError('Unable to load change history.');else setHistory(data || []);}});
    return ()=>{active=false;};
  },[db,selected]);
  function open(lead:Lead){setSelected(lead);setStatus(lead.status);setNotes(lead.notes);setError('');setNotice('');}
  async function save(){
    if(!selected)return;setBusy(true);setError('');setNotice('');
    const {data,error}=await db.from('contact_leads').update({status,notes}).eq('id',selected.id).eq('updated_at',selected.updated_at).select().maybeSingle();
    if(error || !data)setError('Could not save. This inquiry may have changed; refresh and reopen it before retrying.');
    else{setSelected(data as Lead);setNotice('Changes saved.');await load();}setBusy(false);
  }
  async function retry(){
    if(!selected)return;setBusy(true);setError('');setNotice('');
    try{const r=await fetch('/api/contact/notify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:selected.id})});const data=await r.json();if(!r.ok)setError(data.error || 'Notification retry failed.');else {setNotice('Notification sent.');setSelected({...selected,notification_status:'sent'});await load();}}
    catch{setError('Notification retry failed. Please try again.');}finally{setBusy(false);}
  }
  return <main className="lead-shell"><header><div><p>LTG / ADMINISTRATION</p><h1>Prospective Schools</h1><p>Track inquiries, demonstrations, and partnerships.</p></div><Link href="/owner/admin">Back to Administration</Link></header>
    <nav aria-label="Pipeline status">{['all',...leadStatuses].map(s=><button key={s} aria-pressed={filter===s} onClick={()=>{setFilter(s);setPage(0);setSelected(null);}}>{s==='all'?'All inquiries':s}</button>)}</nav>
    {error && <p className="lead-error" role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
    <div className="lead-layout"><section aria-label="Inquiries"><div className="lead-list-heading"><p>{total} inquiries</p><button disabled={loading || busy} onClick={()=>{setSelected(null);void load();}}>Refresh</button></div>
      {loading?<p role="status">Loading inquiries…</p>:leads.length===0?<p>No inquiries in this stage yet.</p>:leads.map(lead=><button className="lead-row" key={lead.id} onClick={()=>open(lead)} aria-pressed={selected?.id===lead.id}><strong>{lead.institution}</strong><span>{lead.name} · {lead.inquiry_type}</span><span>{lead.status} · {new Date(lead.created_at).toLocaleDateString()}</span>{lead.notification_status!=='sent'&&<span>Notification {lead.notification_status}</span>}</button>)}
      <div className="lead-pager"><button disabled={page===0 || loading} onClick={()=>setPage(page-1)}>Previous</button><span>Page {page+1}</span><button disabled={(page+1)*25>=total || loading} onClick={()=>setPage(page+1)}>Next</button></div></section>
      <section className="lead-detail" aria-label="Inquiry details">{!selected?<p>Select an inquiry to view details and update its stage.</p>:<><h2>{selected.institution}</h2><p>Received {new Date(selected.created_at).toLocaleString()}</p><dl>{Object.entries(selected).filter(([key])=>['name','job_title','email','phone','department','inquiry_type','message','heard_about','source_page','referrer','utm_source','utm_medium','utm_campaign','utm_term','utm_content'].includes(key)).map(([key,value])=><div key={key}><dt>{key.replaceAll('_',' ')}</dt><dd>{String(value || '—')}</dd></div>)}</dl>
        <label>Pipeline stage<select value={status} onChange={e=>setStatus(e.target.value as LeadStatus)}>{leadStatuses.map(s=><option key={s}>{s}</option>)}</select></label><label>Follow-up notes<textarea rows={5} maxLength={10000} value={notes} onChange={e=>setNotes(e.target.value)} /></label><button disabled={busy} onClick={()=>void save()}>{busy?'Working…':'Save changes'}</button>
        <p>Notification: {selected.notification_status}</p>{selected.notification_status!=='sent'&&<button disabled={busy} onClick={()=>void retry()}>Retry notification email</button>}
        <h3>Change history</h3>{history.length===0?<p>No changes yet.</p>:history.map(h=><p key={h.id}>{new Date(h.changed_at).toLocaleString()}: {h.old_status} → {h.new_status}{h.notes_changed?' · Notes updated':''}</p>)}</>}
      </section></div></main>;
}
