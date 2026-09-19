'use client';
import {useEffect,useState} from 'react';
import {getSupabase} from '@/lib/supabase-browser';
import {readGradebookRows,type Gradebook} from '@/lib/gradebook';
import {formatError} from '@/lib/format-error';
import ShopWorkspace from './workspace';
import styles from './shop.module.css';
export default function ShopPageClient(){
 const [client]=useState(getSupabase),[books,setBooks]=useState<Gradebook[]>([]),[selected,setSelected]=useState(''),[blocked,setBlocked]=useState(false),[error,setError]=useState(''),[loading,setLoading]=useState(true);
 useEffect(()=>{let alive=true;void readGradebookRows<Gradebook>((from,to)=>client.from('gradebook_directory').select('*').eq('course_code','WLD 110').eq('course_role','lab').eq('section_status','active').order('id').range(from,to))
 .then(rows=>{if(!alive)return;setBooks(rows);const requested=new URLSearchParams(window.location.search).get('book');setSelected(rows.find(b=>b.id===requested)?.id??rows[0]?.id??'');})
 .catch(e=>{if(alive)setError(formatError(e));}).finally(()=>{if(alive)setLoading(false);});return()=>{alive=false;};},[client]);
 return <main><header className={styles.shop}><a href="/dashboard">Planner</a> · <a href="/gradebook">Gradebook</a>
 <h1>WLD 110 SMAW shop</h1><label>Class <select value={selected} disabled={blocked} onChange={e=>setSelected(e.target.value)}>{books.map(b=><option key={b.id} value={b.id}>{b.section_name}</option>)}</select></label>
 {error&&<p role="alert">{error}</p>}{loading&&<p>Loading classes…</p>}{!loading&&!error&&!books.length&&<p>No active WLD 110 lab classes are assigned to you.</p>}</header>
 {selected&&<ShopWorkspace key={selected} gradebookId={selected} onSaveState={setBlocked}/>}</main>;
}
