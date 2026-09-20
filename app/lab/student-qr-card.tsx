'use client';
import {useEffect,useRef,useState} from 'react';
import styles from './lab.module.css';

export type StudentQr = {
 student:{student_id:string;display_name:string;focus:string[];note?:string;assignment?:string|null};afterCoaching:boolean;url:string;image:string;error:string;
};

export function StudentQrCard({qr,busy,onRetry}:{qr:StudentQr;busy:boolean;onRetry:()=>void}) {
 const card=useRef<HTMLElement>(null);
 const [copyMessage,setCopyMessage]=useState('');
 useEffect(()=>{if(qr.image||qr.error)card.current?.focus();},[qr.image,qr.error]);
 return <section ref={card} tabIndex={-1} className={styles.card+' '+styles.studentQr} aria-label="Student QR code">
  <div className={styles.qrDetails}>
   {qr.afterCoaching&&<p className={styles.saved} role="status">Coaching saved · No grade recorded</p>}
   <h3>{qr.student.display_name}</h3>
   <p className={styles.qrInstruction}>Scan to open your shop card</p>
   {qr.student.focus.length>0&&<p><strong>Practice focus:</strong> {qr.student.focus.join(' · ')}</p>}
   {qr.student.assignment&&<p><strong>Assignment:</strong> {qr.student.assignment}</p>}
   {qr.student.note&&<p>{qr.student.note}</p>}
   <p className={styles.muted}>View your assignment and coaching, then request a weld check when ready.</p>
   {qr.error&&<p role="alert" className={styles.error}>{qr.error}</p>}
   {!qr.image&&!qr.error&&<p role="status">Preparing student QR code…</p>}
   <div className={styles.qrActions}>
    {qr.error&&<button disabled={busy} className={styles.primary} onClick={onRetry}>Retry student QR</button>}
    {qr.url&&<>
     <a href={qr.url} target="_blank" rel="noreferrer">Open student shop card</a>
     <button onClick={()=>void navigator.clipboard.writeText(qr.url).then(()=>setCopyMessage('Student link copied.')).catch(()=>setCopyMessage('Copy failed. Use Open student shop card.'))}>Copy student link</button>
    </>}
   </div>
   {copyMessage&&<p role="status">{copyMessage}</p>}
  </div>
  {qr.image&&<img className={styles.qrImage} src={qr.image} width={280} height={280} alt={'Scan to open the shop card for '+qr.student.display_name}/>}
 </section>;
}
