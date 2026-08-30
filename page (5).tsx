'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

const DEMO_DAYS = [
  {
    day: 1,
    title: 'Orientation & Shop Readiness',
    objective: 'Introduce the planner workflow and prepare students for safe, organized shop instruction.',
    safety: 'PPE expectations, eye protection, work-area awareness.',
    demo: 'Instructor models how a daily welding lesson moves from briefing to demonstration to guided practice.',
    practice: 'Students identify required PPE and review the day plan.',
    check: 'Quick verbal safety and workflow check.',
  },
  {
    day: 2,
    title: 'Welding Safety in Practice',
    objective: 'Connect routine shop decisions to safe welding practice.',
    safety: 'Hot work, sparks, ventilation, nearby combustibles.',
    demo: 'Instructor walks through a pre-weld work-area inspection.',
    practice: 'Students inspect a sample work area and identify hazards.',
    check: 'Students explain one correction before welding begins.',
  },
  {
    day: 3,
    title: 'Blueprint to Shop Task',
    objective: 'Show how a drawing becomes a clear fabrication task.',
    safety: 'Safe measuring, handling, and layout-tool use.',
    demo: 'Instructor reads a simple drawing and demonstrates basic layout sequence.',
    practice: 'Students identify dimensions and transfer a sample measurement.',
    check: 'Students verify the sample layout before work proceeds.',
  },
];

function formatClock(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function DemoPage() {
  const router = useRouter();
  const [view, setView] = useState<'teacher' | 'school'>('teacher');
  const [currentDay, setCurrentDay] = useState(1);
  const [viewingDay, setViewingDay] = useState(1);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [completed, setCompleted] = useState<number[]>([]);
  const [note, setNote] = useState('');
  const [followUp, setFollowUp] = useState(false);
  const [savedNote, setSavedNote] = useState('');

  useEffect(() => {
    if (!startedAt) {
      setElapsed(0);
      return;
    }
    const update = () => setElapsed(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    update();
    const id = window.setInterval(update, 1000);
    return () => window.clearInterval(id);
  }, [startedAt]);

  const day = DEMO_DAYS.find((item) => item.day === viewingDay) ?? DEMO_DAYS[0];

  const progress = useMemo(
    () => Math.round((completed.length / DEMO_DAYS.length) * 100),
    [completed]
  );

  const completeDay = () => {
    if (!startedAt) return;
    if (!completed.includes(currentDay)) {
      setCompleted((items) => [...items, currentDay]);
    }
    setSavedNote(note.trim());
    setStartedAt(null);
    setNote('');
    if (currentDay < DEMO_DAYS.length) {
      const next = currentDay + 1;
      setCurrentDay(next);
      setViewingDay(next);
    }
  };

  const resetDemo = () => {
    setView('teacher');
    setCurrentDay(1);
    setViewingDay(1);
    setStartedAt(null);
    setCompleted([]);
    setNote('');
    setSavedNote('');
    setFollowUp(false);
  };

  return (
    <div className="shell">
      <div className="demo-banner">
        TRY DEMO · LIMITED SAMPLE · NOTHING IS SAVED OR REPORTED
      </div>

      <header>
        <div>
          <div className="eyebrow">Living Teacher Planner</div>
          <h1>Public Try Demo</h1>
        </div>
        <div className="actions">
          <button onClick={resetDemo}>Reset Demo</button>
          <button onClick={() => router.push('/training/login')}>Training Mode</button>
          <button onClick={() => router.push('/login')}>Live Login</button>
        </div>
      </header>

      <main>
        <nav>
          <button className={view === 'teacher' ? 'active' : ''} onClick={() => setView('teacher')}>
            Teacher Dashboard Sample
          </button>
          <button className={view === 'school' ? 'active' : ''} onClick={() => setView('school')}>
            School Dashboard Sample
          </button>
        </nav>

        {view === 'teacher' && (
          <div className="grid">
            <section className="panel">
              <div className="eyebrow">Demo Welding School</div>
              <h2>WLD 105 · Demo Section</h2>

              <div className="status-row">
                <span>Current Teaching Day <strong>Day {currentDay}</strong></span>
                <span>Status <strong>{startedAt ? 'IN PROGRESS' : completed.includes(currentDay) ? 'COMPLETED' : 'READY'}</strong></span>
                <span>Timer <strong>{startedAt ? formatClock(elapsed) : '0:00'}</strong></span>
              </div>

              <div className="controls">
                <button
                  className="primary"
                  disabled={Boolean(startedAt)}
                  onClick={() => {
                    setViewingDay(currentDay);
                    setStartedAt(Date.now());
                  }}
                >
                  Start Today
                </button>
                <button
                  disabled={!startedAt}
                  onClick={completeDay}
                >
                  Complete Day
                </button>
              </div>

              <label>
                Daily note
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Try entering a teacher note. It disappears when the demo resets."
                />
              </label>

              <label className="check">
                <input
                  type="checkbox"
                  checked={followUp}
                  onChange={(e) => setFollowUp(e.target.checked)}
                />
                Flag follow-up
              </label>

              {savedNote && (
                <div className="sample-note">
                  <strong>Last simulated note</strong>
                  <span>{savedNote}</span>
                  {followUp && <b>Follow-up flagged</b>}
                </div>
              )}
            </section>

            <section className="panel">
              <div className="eyebrow">Teacher Guide Preview</div>
              <div className="day-nav">
                {DEMO_DAYS.map((item) => (
                  <button
                    key={item.day}
                    className={viewingDay === item.day ? 'active' : ''}
                    onClick={() => setViewingDay(item.day)}
                  >
                    Day {item.day}
                  </button>
                ))}
              </div>

              <h2>Day {day.day}: {day.title}</h2>
              <GuideRow label="Objective" text={day.objective} />
              <GuideRow label="Safety Focus" text={day.safety} />
              <GuideRow label="Demonstration" text={day.demo} />
              <GuideRow label="Guided Practice" text={day.practice} />
              <GuideRow label="Evidence / Check" text={day.check} />

              <div className="limited">
                This public demo intentionally shows only three sample days. Full course guides are available only in authorized Training Mode and the live platform.
              </div>
            </section>
          </div>
        )}

        {view === 'school' && (
          <section className="panel">
            <div className="eyebrow">School Dashboard Preview</div>
            <h2>Demo Welding School</h2>

            <div className="metrics">
              <Metric label="Active Sections" value="1" />
              <Metric label="Instructors" value="1" />
              <Metric label="Current Day" value={`Day ${currentDay}`} />
              <Metric label="Demo Progress" value={`${progress}%`} />
              <Metric label="Follow-Ups" value={followUp ? '1' : '0'} />
            </div>

            <div className="fake-table">
              <div className="table-head">
                <span>Section</span><span>Instructor</span><span>Progress</span><span>Status</span>
              </div>
              <div className="table-row">
                <span>WLD 105 · Demo Section</span>
                <span>Demo Instructor</span>
                <span>Day {currentDay} / 3</span>
                <span>{startedAt ? 'In Progress' : 'Ready'}</span>
              </div>
            </div>

            <div className="limited">
              School reporting in the public demo is sample-only. No demo activity is written to production reporting.
            </div>
          </section>
        )}
      </main>

      <style jsx>{`
        .shell { min-height:100vh; background:#080808; color:#ddd; }
        .demo-banner {
          position: sticky; top:0; z-index:20; padding:9px 14px; text-align:center;
          background:#0b79b7; color:white; font-size:11px; font-weight:900; letter-spacing:.08em;
        }
        header {
          display:flex; justify-content:space-between; gap:20px; align-items:center;
          padding:20px 28px; border-bottom:1px solid #262626; background:#111;
        }
        .eyebrow { color:#4ecbff; font-size:10px; text-transform:uppercase; letter-spacing:.12em; font-weight:900; }
        h1,h2 { margin:4px 0; color:white; }
        h1 { font-size:24px; } h2 { font-size:21px; }
        .actions, nav, .controls, .day-nav { display:flex; flex-wrap:wrap; gap:8px; }
        button {
          padding:10px 13px; border-radius:7px; border:1px solid #303030; background:#161616;
          color:#ddd; font-weight:750; cursor:pointer;
        }
        button:hover:not(:disabled), button.active { border-color:#4ecbff; color:#4ecbff; }
        button.primary { border-color:#00ff88; color:#00ff88; }
        button:disabled { opacity:.4; cursor:not-allowed; }
        main { width:min(1280px, calc(100% - 28px)); margin:auto; padding:24px 0 50px; }
        nav { margin-bottom:16px; border-bottom:1px solid #252525; padding-bottom:12px; }
        .grid { display:grid; grid-template-columns:minmax(320px,.8fr) minmax(380px,1.2fr); gap:16px; }
        .panel { padding:20px; border:1px solid #292929; border-radius:10px; background:#141414; }
        .status-row, .metrics {
          display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin:16px 0;
        }
        .status-row span, .metrics :global(.metric) { background:#101010; border-radius:8px; padding:11px; color:#777; font-size:11px; }
        .status-row strong { display:block; margin-top:3px; color:#eee; font-size:15px; }
        label { display:grid; gap:7px; margin-top:14px; color:#888; font-size:11px; font-weight:800; text-transform:uppercase; }
        textarea {
          min-height:90px; resize:vertical; padding:11px; border:1px solid #303030; border-radius:7px;
          background:#0d0d0d; color:#eee; font:inherit;
        }
        .check { display:flex; grid-auto-flow:column; justify-content:start; align-items:center; text-transform:none; }
        .sample-note, .limited {
          margin-top:14px; padding:12px; border-radius:7px; background:#101010; border:1px solid #292929;
          display:grid; gap:5px; color:#aaa; font-size:12px;
        }
        .sample-note b { color:#ffad70; }
        .limited { border-color:rgba(78,203,255,.28); color:#7997a4; line-height:1.5; }
        .guide-row { display:grid; gap:5px; padding:13px 0; border-bottom:1px solid #252525; }
        .guide-row strong { color:#4ecbff; font-size:10px; text-transform:uppercase; letter-spacing:.08em; }
        .guide-row span { color:#c7c7c7; line-height:1.5; }
        .fake-table { margin-top:18px; border:1px solid #292929; border-radius:8px; overflow:hidden; }
        .table-head, .table-row { display:grid; grid-template-columns:1.5fr 1fr 1fr 1fr; gap:10px; padding:12px; }
        .table-head { background:#101010; color:#666; font-size:10px; text-transform:uppercase; font-weight:800; }
        .table-row { color:#ccc; font-size:12px; border-top:1px solid #252525; }
        @media(max-width:800px) {
          header { align-items:flex-start; flex-direction:column; }
          .grid { grid-template-columns:1fr; }
          .status-row, .metrics { grid-template-columns:1fr 1fr; }
          .table-head, .table-row { grid-template-columns:1fr; }
        }
      `}</style>
    </div>
  );
}

function GuideRow({ label, text }: { label: string; text: string }) {
  return (
    <div className="guide-row">
      <strong>{label}</strong>
      <span>{text}</span>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span style={{display:'block', color:'#777', fontSize:10, textTransform:'uppercase', fontWeight:800}}>{label}</span>
      <strong style={{display:'block', marginTop:4, color:'white', fontSize:20}}>{value}</strong>
    </div>
  );
}
