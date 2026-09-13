'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import FinsenSierraClock from '../../components/finsen-sierra-clock';

type DemoEntry = {
  id: number;
  clockIn: number;
  clockOut: number | null;
};

function formatDuration(ms: number) {
  const totalMinutes = Math.floor(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${String(minutes).padStart(2, '0')}m`;
}

function formatTime(value: number) {
  return new Date(value).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function PantherMark() {
  return (
    <svg viewBox="0 0 96 76" aria-hidden="true">
      <path d="M14 61c9-4 15-12 18-22 2-9 7-17 15-23 9-7 20-8 31-4l-9 7 13 4-12 5 8 7-14 2-7 9-10-6-5 12-11-4-5 13H14Z" />
      <path d="M56 24c5 1 9 4 12 8M45 34l8-2M59 31l2 1" className="detail" />
    </svg>
  );
}

export default function DemoTimeClockPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<DemoEntry[]>([]);
  const [tick, setTick] = useState(Date.now());
  const [showHistory, setShowHistory] = useState(false);

  const openEntry = entries.find((entry) => entry.clockOut === null) ?? null;
  const clockedIn = Boolean(openEntry);

  useEffect(() => {
    if (!clockedIn) return;
    const timer = window.setInterval(() => setTick(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [clockedIn]);

  const totalMs = useMemo(
    () => entries.reduce((sum, entry) => sum + Math.max(0, (entry.clockOut ?? tick) - entry.clockIn), 0),
    [entries, tick]
  );

  const clockIn = () => {
    if (clockedIn) return;
    const now = Date.now();
    setTick(now);
    setEntries((current) => [...current, { id: now, clockIn: now, clockOut: null }]);
  };

  const clockOut = () => {
    if (!openEntry) return;
    const now = Date.now();
    setTick(now);
    setEntries((current) => current.map((entry) => entry.id === openEntry.id ? { ...entry, clockOut: now } : entry));
  };

  const reset = () => {
    setEntries([]);
    setTick(Date.now());
    setShowHistory(false);
  };

  return (
    <main className="demo-clock-page">
      <div className="demo-banner">PUBLIC DEMO · TEMPORARY SESSION · NO LIVE SCHOOL DATA</div>

      <header className="portal-frame">
        <div className="brand-lockup">
          <div className="pccc-wordmark">PCCC</div>
          <div>
            <strong>WELDING</strong>
            <span>Passaic County Community College</span>
          </div>
          <div className="panther"><PantherMark /></div>
        </div>
        <div className="module-title">
          <span>WORKFORCE TIME · OPTIONAL MODULE</span>
          <h1>Finsen Sierra Time Clock</h1>
          <p>Fine-timepiece character on the clock itself. Cleaner school software around it. Humanity continues to survive branding systems somehow.</p>
        </div>
        <div className="header-actions">
          <button type="button" onClick={reset}>Reset Clock</button>
          <button type="button" onClick={() => router.push('/demo/welding')}>Welding Demo</button>
          <button type="button" onClick={() => router.push('/demo/programs')}>Programs</button>
        </div>
      </header>

      <div className="academic-strip"><span>INSTRUCTOR TIME</span><span>SCHOOL REVIEW</span><span>PAYROLL READY</span><span>PROGRAM OPERATIONS</span></div>

      <section className="clock-stage">
        <div className="stage-label">
          <span>PCCC WELDING · INSTRUCTOR PORTAL</span>
          <b>Time turns potential into progress.</b>
        </div>
        <FinsenSierraClock
          displayName="Alex Carter"
          department="PCCC Welding"
          employeeNumber="1047"
          clockedIn={clockedIn}
          sinceLabel={openEntry ? formatTime(openEntry.clockIn) : null}
          todayTotal={formatDuration(totalMs)}
          onClockIn={clockIn}
          onClockOut={clockOut}
          onViewTime={() => setShowHistory((value) => !value)}
        />
      </section>

      <section className="explain-grid">
        <article>
          <span>Clear working status</span>
          <h2>Green means punched in. Red means punched out.</h2>
          <p>The vintage lamps stay because they communicate status instantly without turning the entire interface into a machine shop prop.</p>
        </article>
        <article>
          <span>School identity</span>
          <h2>The department owns the surrounding experience.</h2>
          <p>PCCC Welding branding, educational navigation, and school context frame the Finsen Sierra clock without changing the clock&apos;s signature face.</p>
        </article>
        <article>
          <span>Operational record</span>
          <h2>Time belongs to the education workflow.</h2>
          <p>Instructor time can sit beside classes, attendance, planning, and reporting instead of living in a disconnected administrative corner.</p>
        </article>
      </section>

      {showHistory && (
        <section className="history" aria-live="polite">
          <div className="history-heading">
            <div><span>Demo time record</span><h2>Today&apos;s simulated punches</h2></div>
            <strong>{formatDuration(totalMs)}</strong>
          </div>
          {entries.length === 0 ? (
            <p>No demo punches yet.</p>
          ) : (
            <div className="history-list">
              {entries.map((entry, index) => (
                <div key={entry.id}>
                  <b>Session {index + 1}</b>
                  <span>In {formatTime(entry.clockIn)}</span>
                  <span>Out {entry.clockOut ? formatTime(entry.clockOut) : 'Active'}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <footer><span>PCCC WELDING · PEOPLE · SKILLS · OPPORTUNITY</span><span>Finsen Sierra Time Clock · Brandable workforce module</span></footer>

      <style jsx>{`
        :global(body.pccc-demo-skin) { margin:0; }
        .demo-clock-page { min-height:100vh; background:radial-gradient(circle at 72% 0,rgba(77,135,173,.12),transparent 28rem),linear-gradient(145deg,#071018,#0d1821 52%,#09131a); color:#e8eef1; }
        .demo-banner { position:sticky; top:0; z-index:20; padding:8px 14px; text-align:center; background:#111b22; border-bottom:1px solid #36434d; color:#c7d2d9; font-size:10px; font-weight:900; letter-spacing:.13em; }
        .portal-frame { width:min(1260px,calc(100% - 28px)); margin:18px auto 0; padding:16px 20px; display:grid; grid-template-columns:auto 1fr auto; gap:24px; align-items:center; border:1px solid #626d75; border-radius:13px; background:linear-gradient(90deg,rgba(255,255,255,.08),transparent 6%,transparent 94%,rgba(0,0,0,.16)),repeating-linear-gradient(0deg,rgba(255,255,255,.015) 0 1px,rgba(0,0,0,.025) 1px 3px),linear-gradient(180deg,#343e46,#151d23 46%,#0c141a); box-shadow:0 20px 45px rgba(0,0,0,.28),inset 0 1px rgba(255,255,255,.10); }
        .brand-lockup { display:flex; align-items:center; gap:10px; min-width:330px; }
        .pccc-wordmark { font-size:36px; font-style:italic; font-weight:950; letter-spacing:-.07em; color:#f5f7f8; }
        .brand-lockup>div:nth-child(2) { display:grid; gap:2px; padding-left:11px; border-left:1px solid rgba(255,255,255,.24); }
        .brand-lockup strong { color:#fff; font-size:21px; font-style:italic; letter-spacing:.05em; }
        .brand-lockup span { color:#bcc7cd; font-size:8px; font-weight:800; letter-spacing:.11em; text-transform:uppercase; }
        .panther { width:50px; height:42px; }
        .panther :global(svg) { width:100%; height:100%; }
        .panther :global(path) { fill:none; stroke:#d4d9dc; stroke-width:4.5; stroke-linecap:round; stroke-linejoin:round; }
        .panther :global(.detail) { stroke-width:3.8; }
        .module-title span,article>span,.history-heading span,.stage-label span { color:#75b5dd; font-size:9px; font-weight:900; letter-spacing:.13em; text-transform:uppercase; }
        h1,h2,p { margin-top:0; }
        h1 { margin:4px 0 5px; font-size:24px; color:white; }
        .module-title p { max-width:560px; margin:0; color:#9aabb4; font-size:11px; line-height:1.5; }
        .header-actions { display:flex; flex-wrap:wrap; justify-content:flex-end; gap:8px; }
        button { padding:10px 13px; border:1px solid #465660; border-radius:8px; background:linear-gradient(180deg,#1d2b35,#121e27); color:#dfe8ec; font-weight:800; cursor:pointer; }
        button:hover { border-color:#75b5dd; color:#fff; }
        .academic-strip { width:min(1180px,calc(100% - 32px)); margin:14px auto 0; display:grid; grid-template-columns:repeat(4,1fr); gap:1px; overflow:hidden; border:1px solid #2e3e48; border-radius:9px; background:#2e3e48; }
        .academic-strip span { padding:10px; text-align:center; background:#101b23; color:#99aab4; font-size:9px; font-weight:900; letter-spacing:.1em; }
        .clock-stage { width:min(1140px,calc(100% - 32px)); margin:18px auto 0; padding:14px; border:1px solid #48555e; border-radius:16px; background:linear-gradient(150deg,rgba(255,255,255,.025),transparent 36%),#0f1a22; box-shadow:0 20px 50px rgba(0,0,0,.25); }
        .stage-label { display:flex; justify-content:space-between; gap:18px; align-items:center; padding:2px 4px 12px; }
        .stage-label b { color:#d7dee2; font-size:11px; font-weight:750; letter-spacing:.03em; }
        .explain-grid { width:min(1140px,calc(100% - 32px)); margin:14px auto; display:grid; grid-template-columns:repeat(3,1fr); gap:12px; }
        article { padding:18px; border:1px solid #34454f; border-radius:10px; background:#131f28; box-shadow:0 10px 24px rgba(0,0,0,.14); }
        article h2 { margin:7px 0 8px; color:#fff; font-size:16px; line-height:1.25; }
        article p { margin:0; color:#9aabb4; font-size:12px; line-height:1.55; }
        .history { width:min(1140px,calc(100% - 32px)); margin:14px auto 40px; padding:20px; border:1px solid #3f5360; border-radius:11px; background:#111f29; }
        .history-heading { display:flex; justify-content:space-between; gap:20px; align-items:center; }
        .history-heading h2 { margin:4px 0 0; font-size:19px; }
        .history-heading strong { font-size:24px; color:#a7d8f5; }
        .history>p { margin:16px 0 0; color:#91a4ae; }
        .history-list { display:grid; gap:8px; margin-top:16px; }
        .history-list>div { display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px; padding:11px 12px; border:1px solid #2c3c46; border-radius:8px; background:#0c1720; color:#b8c6cd; font-size:12px; }
        .history-list b { color:#fff; }
        footer { width:min(1140px,calc(100% - 32px)); margin:0 auto; padding:18px 0 26px; display:flex; justify-content:space-between; gap:20px; border-top:1px solid #2b3942; color:#7f909a; font-size:9px; font-weight:800; letter-spacing:.1em; }
        @media(max-width:1080px) { .portal-frame { grid-template-columns:1fr auto; } .module-title { grid-column:1 / -1; grid-row:2; } .brand-lockup { min-width:0; } }
        @media(max-width:800px) { .portal-frame { grid-template-columns:1fr; } .header-actions { justify-content:flex-start; } .academic-strip { grid-template-columns:1fr 1fr; } .explain-grid { grid-template-columns:1fr; } .stage-label { align-items:flex-start; flex-direction:column; } }
        @media(max-width:520px) { .pccc-wordmark { font-size:29px; } .brand-lockup strong { font-size:17px; } .brand-lockup span { font-size:7px; } .panther { width:40px; } .academic-strip { grid-template-columns:1fr; } .history-list>div { grid-template-columns:1fr; } footer { flex-direction:column; } }
      `}</style>
    </main>
  );
}
