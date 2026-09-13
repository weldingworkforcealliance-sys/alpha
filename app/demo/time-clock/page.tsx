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

      <header>
        <div>
          <div className="eyebrow">Optional Workforce Time Module</div>
          <h1>Finsen Sierra Time Clock</h1>
          <p>The clock face stays the same in light or dark mode. School and department branding can change behind it.</p>
        </div>
        <div className="header-actions">
          <button type="button" onClick={reset}>Reset Clock</button>
          <button type="button" onClick={() => router.push('/demo/programs')}>Program Demos</button>
          <button type="button" onClick={() => router.push('/demo')}>Demo Home</button>
        </div>
      </header>

      <section className="clock-stage">
        <FinsenSierraClock
          displayName="Alex Carter"
          department="Demo Operations"
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
          <span>1950s status lamps</span>
          <h2>Green means punched in. Red means punched out.</h2>
          <p>The inactive lamp stays visible but unlit, preserving the physical timepiece effect.</p>
        </article>
        <article>
          <span>Brandable module</span>
          <h2>One clock, different school identity.</h2>
          <p>The Finsen Sierra frame and controls remain fixed while a school can supply its own background image and department context.</p>
        </article>
        <article>
          <span>Closed demo data</span>
          <h2>Try it without touching production.</h2>
          <p>Punches on this page exist only in this temporary demo session and disappear when the session resets.</p>
        </article>
      </section>

      {showHistory && (
        <section className="history" aria-live="polite">
          <div className="history-heading">
            <div>
              <span>Demo time record</span>
              <h2>Today&apos;s simulated punches</h2>
            </div>
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

      <style jsx>{`
        :global(body.ltg-demo-route) { margin:0; background:#0c1720; }
        :global(body.ltg-demo-route .app-container),
        :global(body.ltg-demo-route .ltg-public-content) { width:100%; max-width:none; margin:0; padding:0; display:block; }
        .demo-clock-page { min-height:100vh; background:radial-gradient(circle at 50% 0,#1b2c38,#0d1b25 48%,#09141c 100%); color:#e8eef1; }
        .demo-banner { position:sticky; top:0; z-index:20; padding:9px 14px; text-align:center; background:#0b79b7; color:white; font-size:11px; font-weight:900; letter-spacing:.08em; }
        header { width:min(1180px,calc(100% - 32px)); margin:auto; padding:30px 0 18px; display:flex; align-items:flex-end; justify-content:space-between; gap:24px; border-bottom:1px solid rgba(255,255,255,.1); }
        .eyebrow, article>span, .history-heading span { color:#f5b85c; font-size:10px; font-weight:900; letter-spacing:.13em; text-transform:uppercase; }
        h1,h2,p { margin-top:0; }
        h1 { margin:5px 0 8px; font-size:34px; color:white; }
        header p { max-width:760px; margin:0; color:#9db0bb; font-size:13px; line-height:1.5; }
        .header-actions { display:flex; flex-wrap:wrap; justify-content:flex-end; gap:8px; }
        button { padding:10px 13px; border:1px solid #425866; border-radius:8px; background:#142531; color:#dfe8ec; font-weight:800; cursor:pointer; }
        button:hover { border-color:#e7b85f; color:#f5cf86; }
        .clock-stage { width:min(1100px,calc(100% - 32px)); margin:24px auto 0; padding:12px; border:1px solid rgba(255,255,255,.09); border-radius:18px; background:rgba(4,10,14,.35); box-shadow:0 20px 60px rgba(0,0,0,.24); }
        .explain-grid { width:min(1100px,calc(100% - 32px)); margin:16px auto; display:grid; grid-template-columns:repeat(3,1fr); gap:12px; }
        article { padding:18px; border:1px solid rgba(255,255,255,.1); border-radius:12px; background:rgba(17,31,41,.8); }
        article h2 { margin:7px 0 8px; color:#fff; font-size:16px; line-height:1.25; }
        article p { margin:0; color:#91a4ae; font-size:12px; line-height:1.55; }
        .history { width:min(1100px,calc(100% - 32px)); margin:16px auto 48px; padding:20px; border:1px solid rgba(245,184,92,.24); border-radius:12px; background:#111f29; }
        .history-heading { display:flex; justify-content:space-between; gap:20px; align-items:center; }
        .history-heading h2 { margin:4px 0 0; font-size:19px; }
        .history-heading strong { font-size:24px; color:#f5cf86; }
        .history>p { margin:16px 0 0; color:#91a4ae; }
        .history-list { display:grid; gap:8px; margin-top:16px; }
        .history-list>div { display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px; padding:11px 12px; border-radius:8px; background:#0c1720; color:#b8c6cd; font-size:12px; }
        .history-list b { color:#fff; }
        @media(max-width:800px) { header { align-items:flex-start; flex-direction:column; } .header-actions { justify-content:flex-start; } .explain-grid { grid-template-columns:1fr; } }
        @media(max-width:520px) { h1 { font-size:27px; } .history-list>div { grid-template-columns:1fr; } }
      `}</style>
    </main>
  );
}
