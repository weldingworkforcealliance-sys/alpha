'use client';

import { useState } from 'react';
import Link from 'next/link';
import ThemeToggle from '../theme-toggle';
import styles from './pccc-portal.module.css';

export type PcccPortalMode = 'school' | 'instructor';

// Reuses the existing single-head mark; no duplicated or mirrored head.
export function PcccBrand() {
  return <div className={styles.brand}>
    <svg viewBox="0 0 96 76" aria-hidden="true" className={styles.panther}>
      <path fill="none" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" d="M14 61c9-4 15-12 18-22 2-9 7-17 15-23 9-7 20-8 31-4l-9 7 13 4-12 5 8 7-14 2-7 9-10-6-5 12-11-4-5 13H14Z" />
      <path fill="none" stroke="currentColor" strokeWidth="3.8" strokeLinecap="round" d="M56 24c5 1 9 4 12 8M45 34l8-2M59 31l2 1" />
    </svg>
    <div><strong>PCCC <span>WELDING</span></strong><small>Passaic County<br />Community College</small></div>
  </div>;
}

const DESTINATIONS = [
  { id: 'planner', title: 'Teaching planner', detail: 'Daily lessons & learning outcomes', href: '/dashboard' },
  { id: 'agenda', title: 'Agenda workspace', detail: 'Pacing, notes & preparation', href: '/agenda' },
  { id: 'resources', title: 'Learning resources', detail: 'Instructional materials & activities', href: '/resources' },
  { id: 'classroom', title: 'Live classroom', detail: 'Connected activities & assessment', href: '/classroom' },
  { id: 'attendance', title: 'Student attendance', detail: 'Daily attendance & class completion', href: '/attendance' },
  { id: 'timeclock', title: 'Finsen Sierra Time Clock', detail: 'Your punches & time records', href: '/time-clock' },
  { id: 'reports', title: 'Reports & progress', detail: 'Attendance & program reporting', href: '/reports' },
];

export function PcccPortalHeader({ mode, title, demo = false, onNavigate }: {
  mode: PcccPortalMode; title: string; demo?: boolean; onNavigate?: (id: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const matches = DESTINATIONS.filter(item => `${item.title} ${item.detail}`.toLowerCase().includes(query.toLowerCase()));
  return <header className={styles.header} data-portal-mode={mode}>
    <div className={styles.nameplate}><span>PASSAIC COUNTY COMMUNITY COLLEGE</span><strong>{mode === 'school' ? 'School Portal' : 'Instructor Portal'}</strong><small>Welding Technology <b aria-hidden="true">/</b> {title}</small></div>
    <div className={styles.utilities}>
      <div className={styles.search}>
        <label><span className={styles.srOnly}>Find a workspace</span><input type="search" placeholder="Find a workspace…" value={query} onChange={event => { setQuery(event.target.value); setSearchOpen(true); }} onFocus={() => setSearchOpen(true)} onKeyDown={event => { if (event.key === 'Escape') setSearchOpen(false); }} aria-expanded={searchOpen} aria-controls="pccc-workspace-search" /></label>
        {searchOpen && <div id="pccc-workspace-search" className={styles.searchResults}>
          <button className={styles.closeSearch} onClick={() => setSearchOpen(false)}>Close search</button>
          {matches.length ? matches.map(item => demo ? <button key={item.id} onClick={() => { onNavigate?.(item.id); setSearchOpen(false); setQuery(''); }}><strong>{item.title}</strong><span>{item.detail}</span></button> : <Link key={item.id} href={item.href} onClick={() => { setSearchOpen(false); setQuery(''); }}><strong>{item.title}</strong><span>{item.detail}</span></Link>) : <p>No matching workspace.</p>}
        </div>}
      </div>
      <ThemeToggle />
      <span className={styles.accessBadge}>{demo ? 'DEMO' : 'PCCC'}<small>{mode === 'school' ? 'School' : 'Instructor'}</small></span>
    </div>
  </header>;
}

export function PcccLearningHub({ mode, demo = false, onNavigate }: {
  mode: PcccPortalMode; demo?: boolean; onNavigate?: (id: string) => void;
}) {
  const actions = mode === 'school'
    ? [DESTINATIONS[4], DESTINATIONS[6], DESTINATIONS[0]]
    : [DESTINATIONS[0], DESTINATIONS[3], DESTINATIONS[4]];
  return <section className={styles.learningHub} data-portal-mode={mode} aria-label="PCCC learning workspace">
    <div className={styles.welcome}>
      <span className={styles.eyebrow}>{mode === 'school' ? 'PROGRAM LEADERSHIP' : 'YOUR TEACHING DAY'}</span>
      <h1>{mode === 'school' ? 'A clear view of your program.' : 'Prepared to teach. Ready to inspire.'}</h1>
      <p>{mode === 'school' ? 'Support your instructors, follow student participation, and keep learning on track.' : 'Your lessons, students, and classroom tools — together in one teaching workspace.'}</p>
      <div className={styles.discipline}><span>CURRICULUM</span><i /> <span>INSTRUCTION</span><i /> <span>STUDENT SUCCESS</span></div>
    </div>
    <nav className={styles.actions} aria-label="PCCC workspace shortcuts">{actions.map((item, index) => {
      const content = <><span className={styles.actionNumber}>0{index + 1}</span><span><strong>{item.title}</strong><small>{item.detail}</small></span><b aria-hidden="true">↗</b></>;
      return demo ? <button key={item.id} onClick={() => onNavigate?.(item.id)}>{content}</button> : <Link key={item.id} href={item.href}>{content}</Link>;
    })}</nav>
  </section>;
}
