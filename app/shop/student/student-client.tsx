'use client';
import {useEffect,useRef,useState} from 'react';
import {getSupabase} from '@/lib/supabase-browser';
import {formatError} from '@/lib/format-error';
import type {ShopStudent} from '@/lib/wld110-shop';
import {StudentShopCard} from '../components';
import styles from '../shop.module.css';
export default function StudentPageClient(){
 const [client]=useState(getSupabase),[student,setStudent]=useState<ShopStudent|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const token=useRef(''),requesting=useRef(false),generation=useRef(0);
 useEffect(()=>{
  let alive=true;
  const fragment=window.location.hash.slice(1);
  token.current=fragment;
  try{
   token.current=fragment||sessionStorage.getItem('ltg-wld110-student')||'';
   if(fragment){sessionStorage.setItem('ltg-wld110-student',fragment);window.history.replaceState(null,'','/shop/student');}
  }catch{ /* Keep the fragment usable when this browser disables session storage. */ }
  const refresh=async()=>{
   if(!token.current){setError('Open the personal shop link from your instructor.');return;}
   if(requesting.current)return;
   const seq=++generation.current;
   try{
    const result=await client.rpc('read_wld110_student',{p_token:token.current});
    if(!alive||seq!==generation.current)return;
    if(result.error)throw result.error;
    setStudent(result.data as ShopStudent);setError('');
   }catch(e){
    if(alive&&seq===generation.current)setError(formatError(e,'Your shop card could not load. Ask your instructor for a new link if it has expired.'));
   }
  };
  void refresh();const timer=setInterval(()=>void refresh(),10000);
  return()=>{alive=false;++generation.current;clearInterval(timer);};
 },[client]);
 async function request(){
  if(!student||requesting.current)return;
  requesting.current=true;++generation.current;setBusy(true);setError('');
  try{const result=await client.rpc('request_wld110_check',{p_token:token.current,p_competency:student.current_competency});
   if(result.error)throw result.error;setStudent(result.data);
  }catch(e){setError(formatError(e,'Check request was not confirmed. Try again.'));}
  finally{requesting.current=false;setBusy(false);}
 }
 return <main className={styles.shop}>{error&&<p className={styles.error} role="alert">{error}</p>}
 {!student&&!error&&<p role="status">Loading your shop card…</p>}
 {student&&<StudentShopCard student={student} busy={busy} onRequest={request}/>}</main>;
}
