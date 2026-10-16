'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getSupabase } from '@/lib/supabase-browser';
import { readGradebookRows, type Gradebook } from '@/lib/gradebook';
import { subscribeAttendanceFinalized } from '@/lib/attendance-events';
import SchoolActiveTodayEmployees from '../school-active-today-employees';
import styles from './operations.module.css';

export type SchoolClass = { id: string; name: string; course: string; instructors: string; status: string };
type Pair = { id: string; pair_name: string; primary_section_id: string; completion_section_id: string; active: boolean };
type Session = { id: string; pair_id: string; attendance_date: string; status: string; finalized_at: string | null };
type Alert = { session_id: string; completion_section_id: string; pair_name: string; attendance_date: string; marked_count: number; student_count: number };
function today() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }

export default function SchoolOperations({ schoolId, classes, canManage, canTimeManage }: {
  schoolId: string; classes: SchoolClass[]; canManage: boolean; canTimeManage: boolean;
}) {
  const [client] = useState(getSupabase);
  const [area, setArea] = useState<'grading' | 'attendance' | 'time'>('grading');
  const [search, setSearch] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [date, setDate] = useState(today);
  const [books, setBooks] = useState<Gradebook[]>([]);
  const [pairs, setPairs] = useState<Pair[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const sectionIds = classes.map(row => row.id).sort().join(',');
  const schoolQuery = `school=${encodeURIComponent(schoolId)}`;

  useEffect(() => {
    const reload = () => setRefresh(value => value + 1);
    const unsubscribe = subscribeAttendanceFinalized(reload);
    window.addEventListener('focus', reload);
    return () => { unsubscribe(); window.removeEventListener('focus', reload); };
  }, []);

  useEffect(() => {
    let alive = true;
    setLoading(true); setErrors([]); setBooks([]); setPairs([]); setSessions([]); setAlerts([]);
    const ids = sectionIds ? sectionIds.split(',') : [];
    void Promise.allSettled([
      ids.length ? readGradebookRows<Gradebook>((from,to) => client.from('gradebook_directory').select('*').in('section_id',ids).order('id').range(from,to)) : Promise.resolve([] as Gradebook[]),
      readGradebookRows<Pair>((from,to) => client.from('attendance_pairs').select('id,pair_name,primary_section_id,completion_section_id,active').eq('school_id',schoolId).order('id').range(from,to)),
      readGradebookRows<Session>((from,to) => client.from('attendance_sessions').select('id,pair_id,attendance_date,status,finalized_at').eq('school_id',schoolId).eq('attendance_date',date).order('id').range(from,to)),
      client.rpc('get_unfinalized_attendance_alerts',{p_as_of:today()}).then(({data,error}: {data: Alert[] | null; error: unknown}) => { if(error) throw error; return ((data ?? []) as Alert[]).filter(row=>ids.includes(row.completion_section_id)); }),
    ]).then(([grading,attendance,days,review]) => {
      if (!alive) return;
      const failed: string[] = [];
      if(grading.status==='fulfilled') setBooks(grading.value); else failed.push('Grading directory could not load.');
      if(attendance.status==='fulfilled') setPairs(attendance.value); else failed.push('Attendance classes could not load.');
      if(days.status==='fulfilled') setSessions(days.value); else failed.push('Attendance status could not load.');
      if(review.status==='fulfilled') setAlerts(review.value); else failed.push('Attendance review queue could not load.');
      setErrors(failed); setLoading(false);
    });
    return () => { alive = false; };
  }, [client,schoolId,sectionIds,date,refresh]);

  const query = search.trim().toLowerCase();
  const visible = classes.filter(row => (includeArchived || !['archived','inactive','completed'].includes(row.status)) && `${row.name} ${row.course} ${row.instructors}`.toLowerCase().includes(query));
  const visiblePairs = pairs.filter(pair => (includeArchived || pair.active) && `${pair.pair_name} ${classes.filter(row=>[pair.primary_section_id,pair.completion_section_id].includes(row.id)).map(row=>`${row.course} ${row.instructors}`).join(' ')}`.toLowerCase().includes(query));

  return <section className={styles.workspace} aria-label="School operations">
    <div className={styles.intro}><div><span className={styles.eyebrow}>Daily administration</span><h2>What needs your attention?</h2><p>Find a class, review its records, and open the right correction tools.</p></div><button onClick={()=>setRefresh(value=>value+1)} disabled={loading}>Refresh status</button></div>
    <div className={styles.areas} aria-label="Administration work areas">
      <button aria-pressed={area==='grading'} onClick={()=>setArea('grading')}><span>01 · Learning</span><strong>Grading</strong><small>Course grades, shop rubrics & student records</small></button>
      <button aria-pressed={area==='attendance'} onClick={()=>setArea('attendance')}><span>02 · Students</span><strong>Student attendance</strong><small>Daily status, finalization & corrections</small></button>
      <button aria-pressed={area==='time'} onClick={()=>setArea('time')}><span>03 · Instructors</span><strong>Instructor time</strong><small>Current punches, corrections & payroll</small></button>
    </div>
    {errors.map(error=><p key={error} role="alert" className={styles.error}>{error} Use Refresh status to retry.</p>)}
    {!loading && alerts.length>0 && <details className={styles.attention} open><summary>{alerts.length} attendance {alerts.length===1?'session needs':'sessions need'} final confirmation</summary>{alerts.map(alert=><div key={alert.session_id}><span><strong>{alert.pair_name}</strong><small>{alert.attendance_date} · {alert.marked_count}/{alert.student_count} students marked</small></span><Link href={`/attendance?section=${encodeURIComponent(alert.completion_section_id)}&date=${alert.attendance_date}`}>Review & finalize</Link></div>)}</details>}
    {area!=='time' && <div className={styles.filters}><label>Find a class or instructor<input type="search" value={search} onChange={event=>setSearch(event.target.value)} placeholder="Course, class or instructor name" /></label>{area==='attendance'&&<label>Attendance date<input type="date" value={date} onChange={event=>{if(event.target.value)setDate(event.target.value);}} /></label>}<label className={styles.check}><input type="checkbox" checked={includeArchived} onChange={event=>setIncludeArchived(event.target.checked)} /> Include archived classes</label></div>}
    {loading && area!=='time' ? <p role="status">Loading school records…</p> : area==='grading' ? <section aria-label="School grading"><div className={styles.heading}><h3>Grading by class</h3><span>{visible.length} classes</span></div><p>Open a class to review or correct grades, use its welding rubric, or inspect an individual student’s record.</p><div className={styles.rows}>{visible.map(row=>{const book=books.find(book=>book.section_id===row.id);return <article key={row.id}><div><strong>{row.course} · {row.name}</strong><small>{row.instructors || 'Instructor not assigned'} · {row.status}</small></div><div className={styles.actions}>{book && process.env.NEXT_PUBLIC_GRADEBOOK_ENABLED==='true'?<Link href={`/gradebook?section=${encodeURIComponent(row.id)}`}>Open grading</Link>:<span>{errors.some(error=>error.startsWith('Grading'))?'Status unavailable':'Gradebook unavailable'}</span>}</div></article>;})}</div>{!visible.length&&<p>No classes match these filters.</p>}</section> : area==='attendance' ? <section aria-label="School attendance"><div className={styles.heading}><h3>Attendance by class pair</h3>{canManage&&<Link href={`/attendance/admin?${schoolQuery}`}>Manage rosters & reporting</Link>}</div><p>Choose a date to review saved attendance. Historical corrections retain the required reason and audit history.</p><div className={styles.rows}>{visiblePairs.map(pair=>{const day=sessions.filter(row=>row.pair_id===pair.id);return <article key={pair.id}><div><strong>{pair.pair_name}</strong><small>{errors.some(error=>error.startsWith('Attendance status'))?'Status unavailable':day.length?day.every(row=>row.finalized_at)?'Finalized': 'Not finalized':'No attendance session for this date'}</small></div><div className={styles.actions}><Link href={`/attendance?section=${encodeURIComponent(pair.completion_section_id)}&date=${date}`}>Review attendance</Link>{canManage&&<Link href={`/attendance/corrections?${schoolQuery}&pair=${encodeURIComponent(pair.id)}&date=${date}`}>Correct attendance</Link>}</div></article>;})}</div>{!visiblePairs.length&&<p>No attendance pairs match these filters.</p>}</section> : <section aria-label="Instructor time management"><div className={styles.heading}><h3>Instructor time clock</h3><div className={styles.actions}><Link href={`/time-clock?${schoolQuery}`}>{canTimeManage?'Manage punches & corrections':'Open time clock'}</Link>{canTimeManage&&<Link href={`/time-clock/payroll?${schoolQuery}`}>Weekly payroll & exports</Link>}</div></div><SchoolActiveTodayEmployees key={`${schoolId}:${refresh}`} pathname="/school" schoolId={schoolId} canManage={canTimeManage}/></section>}
  </section>;
}
