'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import FinsenSierraClock from '../../components/finsen-sierra-clock';

type DemoEntry = {
  id: string;
  clockIn: string;
  clockOut?: string;
};

const STORAGE_KEY = 'ltg_demo_finsen_sierra_clock_v2';

function formatClock(value: string) {
  return new Date(value).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function totalHours(entries: DemoEntry[], now: number) {
  return entries.reduce((sum, entry) => {
    const start = new Date(entry.clockIn).getTime();
    const end = entry.clockOut ? new Date(entry.clockOut).getTime() : now;
    return sum + Math.max(0, end - start) / 3_600_000;
  }, 0);
}

function formatDuration(hours: number) {
  const minutes = Math.max(0, Math.round(hours * 60));
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`;
}

export default function DemoTimeClockPage() {
  const [entries, setEntries] = useState<DemoEntry[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) setEntries(JSON.parse(raw) as DemoEntry[]);
    } catch {
      sessionStorage.removeItem(STORAGE_KEY);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  }, [entries, hydrated]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  const openEntry = entries.find((entry) => !entry.clockOut) ?? null;
  const total = useMemo(() => totalHours(entries, now), [entries, now]);

  const clockIn = () => {
    if (openEntry) return;
    setEntries((current) => [...current, { id: crypto.randomUUID(), clockIn: new Date().toISOString() }]);
  };

  const clockOut = () => {
    if (!openEntry) return;
    const stamp = new Date().toISOString();
    setEntries((current) => current.map((entry) => entry.id === openEntry.id ? { ...entry, clockOut: stamp } : entry));
  };

  const reset = () => {
    sessionStorage.removeItem(STORAGE_KEY);
    setEntries([]);
  };

  return (
    <main className="finsen-demo-page">
      <div className="finsen-demo-topbar">
        <div>
          <span>LTG OPTIONAL MODULE</span>
          <h1>Finsen Sierra Time Clock</h1>
          <p>Interactive public demo · temporary session data only</p>
        </div>
        <div className="finsen-demo-actions">
          <Link href="/demo">Demo Home</Link>
          <button type="button" onClick={reset}>Reset Clock Demo</button>
        </div>
      </div>

      <section className="finsen-demo-stage">
        <FinsenSierraClock
          displayName="Alex Carter"
          department="Demo Instructor"
          employeeNumber="1047"
          clockedIn={Boolean(openEntry)}
          sinceLabel={openEntry ? formatClock(openEntry.clockIn) : null}
          todayTotal={formatDuration(total)}
          onClockIn={clockIn}
          onClockOut={clockOut}
          onViewTime={() => document.getElementById('demo-time-record')?.scrollIntoView({ behavior: 'smooth' })}
        />
      </section>

      <section id="demo-time-record" className="finsen-demo-record">
        <div className="finsen-demo-record-heading">
          <div>
            <span>DEMO EMPLOYEE RECORD</span>
            <h2>Time Record</h2>
          </div>
          <strong>{formatDuration(total)}</strong>
        </div>
        <div className="finsen-demo-table-wrap">
          <table>
            <thead><tr><th>Clock In</th><th>Clock Out</th><th>Status</th></tr></thead>
            <tbody>
              {entries.length ? [...entries].reverse().map((entry) => (
                <tr key={entry.id}>
                  <td>{formatClock(entry.clockIn)}</td>
                  <td>{entry.clockOut ? formatClock(entry.clockOut) : 'Active'}</td>
                  <td>{entry.clockOut ? 'Completed' : 'On Site'}</td>
                </tr>
              )) : <tr><td colSpan={3}>No demo punches yet.</td></tr>}
            </tbody>
          </table>
        </div>
        <p className="finsen-demo-note">This demonstration never writes to live employee, payroll, or school records.</p>
      </section>

      <style jsx>{`
        .finsen-demo-page { min-height:100vh; background:#0b0d0e; color:#e8ecee; padding:24px; }
        .finsen-demo-topbar { width:min(1080px,100%); margin:0 auto 10px; display:flex; justify-content:space-between; gap:20px; align-items:flex-start; }
        .finsen-demo-topbar span,.finsen-demo-record-heading span { color:#c89a5a; font-size:10px; font-weight:900; letter-spacing:.14em; }
        .finsen-demo-topbar h1 { margin:5px 0 3px; font:600 28px/1.05 Georgia,'Times New Roman',serif; color:#fff; }
        .finsen-demo-topbar p { margin:0; color:#8e9aa0; font-size:12px; }
        .finsen-demo-actions { display:flex; gap:8px; flex-wrap:wrap; }
        .finsen-demo-actions a,.finsen-demo-actions button { border:1px solid #39434a; background:#111619; color:#dfe5e8; border-radius:7px; padding:9px 12px; font:700 11px Arial,sans-serif; text-decoration:none; cursor:pointer; }
        .finsen-demo-stage { width:min(1080px,100%); margin:auto; padding:2px 0 12px; display:grid; place-items:center; }
        .finsen-demo-record { width:min(900px,100%); margin:0 auto; padding:16px; border:1px solid #252d31; border-radius:10px; background:#111619; }
        .finsen-demo-record-heading { display:flex; justify-content:space-between; gap:16px; align-items:end; margin-bottom:12px; }
        .finsen-demo-record-heading h2 { margin:3px 0 0; color:#fff; font-size:18px; }
        .finsen-demo-record-heading > strong { color:#d5aa69; font-size:22px; }
        .finsen-demo-table-wrap { overflow:auto; border:1px solid #293238; border-radius:8px; }
        table { width:100%; border-collapse:collapse; font:12px Arial,sans-serif; }
        th,td { padding:10px 12px; text-align:left; border-bottom:1px solid #242d32; }
        th { color:#819099; font-size:10px; text-transform:uppercase; letter-spacing:.08em; background:#0d1113; }
        td { color:#d5dde1; }
        tbody tr:last-child td { border-bottom:0; }
        .finsen-demo-note { margin:10px 0 0; color:#74838a; font-size:10px; }
        @media(max-width:700px) { .finsen-demo-page { padding:14px; } .finsen-demo-topbar { flex-direction:column; } .finsen-demo-actions { width:100%; } }
      `}</style>
    </main>
  );
}
