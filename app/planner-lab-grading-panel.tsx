'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { getSupabase } from '@/lib/supabase-browser';
import { readGradebookRows, type Gradebook } from '@/lib/gradebook';
import { readSelectedSectionId, subscribeSelectedSection } from '@/lib/section-selection';
import { nextPlannerLabSession, plannerLabGradebook } from '@/lib/planner-lab-grading';
import styles from './planner-lab-grading-panel.module.css';

const TowerWorkspace = dynamic(() => import('./tower/workspace'), {
  loading: () => <p role="status">Loading lab grading…</p>,
});
const ShopWorkspace = dynamic(() => import('./shop/workspace'));

export default function PlannerLabGradingPanel({ pathname }: { pathname: string }) {
  const [client] = useState(getSupabase);
  const [sectionId, setSectionId] = useState(readSelectedSectionId);
  const [books, setBooks] = useState<Gradebook[]>([]);
  const [session, setSession] = useState<Gradebook | null>(null);
  const [saveBlocked, setSaveBlocked] = useState(false);
  const [open, setOpen] = useState(false);
  const [opened, setOpened] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const enabled = process.env.NEXT_PUBLIC_TOWER_ENABLED === 'true' &&
    process.env.NEXT_PUBLIC_GRADEBOOK_ENABLED === 'true';

  useEffect(() => {
    if (!enabled) return;
    setSectionId(readSelectedSectionId());
    return subscribeSelectedSection(setSectionId);
  }, [enabled, pathname]);

  useEffect(() => {
    if (!enabled || pathname !== '/dashboard') return;
    let alive = true;
    setError('');
    void readGradebookRows<Gradebook>((from, to) => client
      .from('gradebook_directory').select('*').eq('course_role', 'lab')
      .eq('section_status', 'active').order('id').range(from, to))
      .then(rows => { if (alive) setBooks(rows); })
      .catch(() => { if (alive) setError('Lab grading could not load. Try again.'); });
    return () => { alive = false; };
  }, [client, enabled, pathname, retry]);

  const requested = plannerLabGradebook(books, sectionId);
  useEffect(() => {
    const next = nextPlannerLabSession(session, requested, saveBlocked);
    if (next?.id === session?.id) return;
    setSession(next);
    setOpen(false);
    setOpened(false);
  }, [requested, saveBlocked, session]);

  // Keep the existing frame alive until its pending save/retry has completed,
  // including when another planner control changes the selected section or route.
  if (!enabled || (pathname !== '/dashboard' && !saveBlocked)) return null;
  if (!session) return error ? <div className={styles.notice} role="alert">
    {error} <button type="button" onClick={() => setRetry(value => value + 1)}>Retry lab grading</button>
  </div> : null;

  const switching = sectionId !== session.section_id || pathname !== '/dashboard';
  return <section className={styles.panel} aria-label="Planner lab grading">
    <button type="button" className={styles.summary}
      aria-expanded={open} aria-controls="planner-lab-grading-workspace"
      onClick={() => { setOpen(value => !value); setOpened(true); }}>
      <span><strong>Lab grading</strong><small>{session.course_code} · {session.section_name}</small></span>
      <span className={styles.action}>{saveBlocked ? 'Saving / needs attention' : open ? 'Close grading' : 'Open grading'}</span>
      <span aria-hidden="true" className={styles.chevron}>{open ? '⌃' : '⌄'}</span>
    </button>
    {saveBlocked && <p role="status" className={styles.notice}>
      {switching ? `Finish saving ${session.section_name} below before grading the newly selected class.`
        : 'Keep this grading session open until it shows Saved to LTG. If a save fails, use Retry save.'}
    </p>}
    <div id="planner-lab-grading-workspace" hidden={!open} className={styles.body}>
      <p className={styles.help}>Grade welds here. Scores save to this class’s gradebook and student records.</p>
      {opened && (process.env.NEXT_PUBLIC_WLD110_SHOP_ENABLED === 'true' && session.course_code === 'WLD 110'
        ? <ShopWorkspace key={session.id} gradebookId={session.id} onSaveState={setSaveBlocked}/>
        : <TowerWorkspace key={session.id} gradebookId={session.id} view="lab" onSaveState={setSaveBlocked} />)}
    </div>
  </section>;
}
