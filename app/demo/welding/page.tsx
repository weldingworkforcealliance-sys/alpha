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

function PantherMark() {
  return (
    <svg viewBox="0 0 96 76" aria-hidden="true">
      <path d="M14 61c9-4 15-12 18-22 2-9 7-17 15-23 9-7 20-8 31-4l-9 7 13 4-12 5 8 7-14 2-7 9-10-6-5 12-11-4-5 13H14Z" />
      <path d="M56 24c5 1 9 4 12 8M45 34l8-2M59 31l2 1" className="detail" />
    </svg>
  );
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
  const progress = useMemo(() => Math.round((completed.length / DEMO_DAYS.length) * 100), [completed]);

  const completeDay = () => {
    if (!startedAt) return;
    if (!completed.includes(currentDay)) setCompleted((items) => [...items, currentDay]);
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
    <div className={`pccc-demo-workspace ${view}`}>
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
        <div className="education-message">
          <b>{view === 'school' ? 'SCHOOL PORTAL' : 'INSTRUCTOR PORTAL'}</b>
          <span>{view === 'school' ? 'Educate · Manage · Support' : 'Plan · Teach · Assess · Support'}</span>
        </div>
        <div className="actions">
          <button onClick={() => router.push('/demo/programs')}>Program Demos</button>
          <button onClick={resetDemo}>Reset Demo</button>
          <button onClick={() => router.push('/demo')}>Demo Home</button>
          <button onClick={() => router.push('/login')}>Live Login</button>
        </div>
      </header>

      <div className="academic-strip" aria-label="PCCC Welding education priorities">
        <span>CURRICULUM</span><span>INSTRUCTION</span><span>ASSESSMENT</span><span>STUDENT SUPPORT</span><span>CAREER READINESS</span>
      </div>

      <main>
        <nav className="view-switch" aria-label="Demo access level">
          <button className={view === 'teacher' ? 'active' : ''} onClick={() => setView('teacher')}>
            Instructor Access
          </button>
          <button className={view === 'school' ? 'active' : ''} onClick={() => setView('school')}>
            School Access
          </button>
        </nav>

        {view === 'teacher' && (
          <div className="grid">
            <section className="panel course-card">
              <div className="eyebrow">PCCC Welding · Instructor Workspace</div>
              <h1>WLD 105 · Demo Section</h1>
              <p className="subhead">Today&apos;s teaching workflow, student evidence, and follow-up stay connected to the course plan.</p>

              <div className="status-row">
                <span>Current Teaching Day <strong>Day {currentDay}</strong></span>
                <span>Status <strong>{startedAt ? 'IN PROGRESS' : completed.includes(currentDay) ? 'COMPLETED' : 'READY'}</strong></span>
                <span>Instruction Timer <strong>{startedAt ? formatClock(elapsed) : '0:00'}</strong></span>
              </div>

              <div className="controls">
                <button className="primary" disabled={Boolean(startedAt)} onClick={() => { setViewingDay(currentDay); setStartedAt(Date.now()); }}>
                  Start Today
                </button>
                <button disabled={!startedAt} onClick={completeDay}>Complete Day</button>
              </div>

              <label>
                Instructor reflection
                <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Record what worked, where students struggled, or what should change next time." />
              </label>

              <label className="check">
                <input type="checkbox" checked={followUp} onChange={(e) => setFollowUp(e.target.checked)} />
                Student or instructional follow-up needed
              </label>

              {savedNote && (
                <div className="sample-note">
                  <strong>Last simulated instructor note</strong>
                  <span>{savedNote}</span>
                  {followUp && <b>Follow-up flagged</b>}
                </div>
              )}
            </section>

            <section className="panel lesson-card">
              <div className="eyebrow">Living Teacher Planner · Guided Instruction</div>
              <div className="day-nav">
                {DEMO_DAYS.map((item) => (
                  <button key={item.day} className={viewingDay === item.day ? 'active' : ''} onClick={() => setViewingDay(item.day)}>
                    Day {item.day}
                  </button>
                ))}
              </div>

              <h2>Day {day.day}: {day.title}</h2>
              <GuideRow label="Learning Objective" text={day.objective} />
              <GuideRow label="Safety Focus" text={day.safety} />
              <GuideRow label="Instructor Demonstration" text={day.demo} />
              <GuideRow label="Guided Practice" text={day.practice} />
              <GuideRow label="Evidence / Check for Understanding" text={day.check} />

              <div className="limited">Temporary demo only. Notes, progress, and simulated completion disappear when the demo resets.</div>
            </section>
          </div>
        )}

        {view === 'school' && (
          <section className="panel school-dashboard">
            <div className="eyebrow">PCCC Welding · School Operations</div>
            <div className="school-heading">
              <div>
                <h1>Program Overview</h1>
                <p className="subhead">A school-level view of instruction, staffing, progress, and student support.</p>
              </div>
              <span className="school-badge">PASSAIC COUNTY COMMUNITY COLLEGE</span>
            </div>

            <div className="metrics">
              <Metric label="Active Sections" value="1" />
              <Metric label="Assigned Instructors" value="1" />
              <Metric label="Current Teaching Day" value={`Day ${currentDay}`} />
              <Metric label="Instructional Progress" value={`${progress}%`} />
              <Metric label="Follow-Ups" value={followUp ? '1' : '0'} />
            </div>

            <div className="education-grid">
              <article><span>Instruction</span><strong>WLD 105</strong><small>Current course workflow</small></article>
              <article><span>Attendance</span><strong>Connected</strong><small>Daily and class-pair records</small></article>
              <article><span>Assessment</span><strong>Evidence</strong><small>Skills, tests, and activities</small></article>
              <article><span>Support</span><strong>{followUp ? '1 Flag' : 'Clear'}</strong><small>Instructor follow-up visibility</small></article>
            </div>

            <div className="fake-table">
              <div className="table-head"><span>Section</span><span>Instructor</span><span>Progress</span><span>Status</span></div>
              <div className="table-row"><span>WLD 105 · Demo Section</span><span>Demo Instructor</span><span>Day {currentDay} / 3</span><span>{startedAt ? 'In Progress' : 'Ready'}</span></div>
            </div>

            <div className="limited">School reporting in the public demo is sample-only. No demo activity is written to production reporting.</div>
          </section>
        )}
      </main>

      <footer>
        <span>PCCC WELDING · PEOPLE · SKILLS · OPPORTUNITY</span>
        <span>Education first. Real materials. Real classroom workflow.</span>
      </footer>

      <style jsx>{`
        :global(body.pccc-demo-skin) { margin:0; }
        .pccc-demo-workspace { min-height:100vh; color:#edf2f5; background:radial-gradient(circle at 75% 0,rgba(76,135,174,.12),transparent 28rem),linear-gradient(145deg,#081119,#0e1a22 52%,#09131a); }
        .demo-banner { position:sticky; top:0; z-index:30; padding:8px 14px; text-align:center; background:#111b22; border-bottom:1px solid #36434d; color:#c7d2d9; font-size:10px; font-weight:900; letter-spacing:.13em; }
        .portal-frame { width:min(1320px,calc(100% - 28px)); margin:18px auto 0; min-height:104px; padding:16px 20px; display:grid; grid-template-columns:auto 1fr auto; gap:24px; align-items:center; border:1px solid #626d75; border-radius:13px; box-shadow:0 20px 45px rgba(0,0,0,.28),inset 0 1px rgba(255,255,255,.10); }
        .teacher .portal-frame { background:linear-gradient(90deg,rgba(255,255,255,.08),transparent 6%,transparent 94%,rgba(0,0,0,.16)),repeating-linear-gradient(0deg,rgba(255,255,255,.015) 0 1px,rgba(0,0,0,.025) 1px 3px),linear-gradient(180deg,#343e46,#151d23 46%,#0c141a); }
        .school .portal-frame { border-color:#b24a54; background:linear-gradient(90deg,rgba(255,255,255,.10),transparent 6%,transparent 94%,rgba(0,0,0,.16)),repeating-linear-gradient(0deg,rgba(255,255,255,.02) 0 1px,rgba(0,0,0,.025) 1px 3px),linear-gradient(180deg,#97101f,#650a14 48%,#33090e); }
        .brand-lockup { display:flex; align-items:center; gap:12px; min-width:390px; }
        .pccc-wordmark { font-size:40px; font-style:italic; font-weight:950; letter-spacing:-.07em; line-height:1; color:#f5f7f8; text-shadow:0 1px #000; }
        .brand-lockup>div:nth-child(2) { display:grid; gap:3px; padding-left:13px; border-left:1px solid rgba(255,255,255,.26); }
        .brand-lockup strong { color:#fff; font-size:24px; font-style:italic; letter-spacing:.05em; }
        .brand-lockup span { color:#c3cbd0; font-size:9px; font-weight:800; letter-spacing:.12em; text-transform:uppercase; }
        .panther { width:56px; height:46px; margin-left:2px; }
        .panther :global(svg) { width:100%; height:100%; }
        .panther :global(path) { fill:none; stroke:#d4d9dc; stroke-width:4.5; stroke-linecap:round; stroke-linejoin:round; }
        .panther :global(.detail) { stroke-width:3.8; }
        .education-message { justify-self:center; display:grid; gap:5px; text-align:center; }
        .education-message b { color:#fff; font-size:11px; letter-spacing:.17em; }
        .education-message span { color:#9dabb4; font-size:9px; font-weight:800; letter-spacing:.12em; text-transform:uppercase; }
        .actions,.view-switch,.controls,.day-nav { display:flex; flex-wrap:wrap; gap:8px; }
        button { padding:10px 13px; border-radius:8px; border:1px solid #465660; background:linear-gradient(180deg,#1d2b35,#121e27); color:#e0e7eb; font-weight:800; cursor:pointer; }
        button:hover:not(:disabled) { color:#fff; border-color:#7aaed0; }
        .school button:hover:not(:disabled) { border-color:#de4d5b; }
        button:disabled { opacity:.4; cursor:not-allowed; }
        .academic-strip { width:min(1280px,calc(100% - 40px)); margin:15px auto 0; display:grid; grid-template-columns:repeat(5,1fr); gap:1px; overflow:hidden; border:1px solid #2d3d47; border-radius:10px; background:#2d3d47; }
        .academic-strip span { padding:10px 12px; text-align:center; background:#101b23; color:#9eafb9; font-size:9px; font-weight:900; letter-spacing:.12em; }
        main { width:min(1280px,calc(100% - 40px)); margin:auto; padding:18px 0 42px; }
        .view-switch { margin:0 0 14px; padding-bottom:12px; border-bottom:1px solid #2f3e48; }
        .view-switch button { min-width:160px; }
        .teacher .view-switch button.active { color:#eaf7ff; border-color:#75b5dd; background:linear-gradient(180deg,#1d4560,#153146); box-shadow:inset 3px 0 #75b5dd; }
        .school .view-switch button.active { color:#fff; border-color:#e14a59; background:linear-gradient(180deg,#8d1220,#64101a); box-shadow:inset 3px 0 #fff; }
        .grid { display:grid; grid-template-columns:minmax(330px,.82fr) minmax(430px,1.18fr); gap:16px; }
        .panel { padding:21px; border:1px solid #34454f; border-radius:11px; background:linear-gradient(150deg,rgba(255,255,255,.025),transparent 36%),#131f28; box-shadow:0 13px 28px rgba(0,0,0,.18); }
        .school .panel { border-color:#573039; }
        .eyebrow { color:#75b5dd; font-size:10px; text-transform:uppercase; letter-spacing:.14em; font-weight:900; }
        .school .eyebrow { color:#ff919c; }
        h1,h2,p { margin-top:0; }
        h1 { margin:5px 0 6px; color:#fff; font-size:25px; letter-spacing:-.02em; }
        h2 { margin:7px 0; color:#fff; font-size:21px; }
        .subhead { margin:0 0 16px; color:#9fafb8; font-size:12px; line-height:1.55; }
        .status-row { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin:16px 0; }
        .status-row span { background:#0e1921; border:1px solid #2f404a; border-radius:8px; padding:11px; color:#8fa1ab; font-size:10px; }
        .status-row strong { display:block; margin-top:4px; color:#f1f5f7; font-size:14px; }
        .controls .primary { color:#fff; border-color:#4f92bb; background:linear-gradient(180deg,#337ba6,#245d80); }
        label { display:grid; gap:7px; margin-top:14px; color:#aebbc2; font-size:10px; font-weight:850; text-transform:uppercase; letter-spacing:.06em; }
        textarea { min-height:96px; resize:vertical; padding:11px; border:1px solid #3b4c57; border-radius:8px; background:#0b151d; color:#eef3f5; font:inherit; }
        textarea:focus { outline:none; border-color:#75b5dd; box-shadow:0 0 0 3px rgba(117,181,221,.12); }
        .check { display:flex; grid-auto-flow:column; justify-content:start; align-items:center; text-transform:none; letter-spacing:0; }
        .sample-note,.limited { margin-top:14px; padding:12px; border-radius:8px; background:#0f1a22; border:1px solid #30414b; display:grid; gap:5px; color:#a5b3bb; font-size:12px; }
        .sample-note b { color:#f2c76b; }
        .limited { color:#94aab7; line-height:1.5; }
        .guide-row { display:grid; gap:5px; padding:13px 0; border-bottom:1px solid #2b3a44; }
        .guide-row strong { color:#75b5dd; font-size:9px; text-transform:uppercase; letter-spacing:.1em; }
        .guide-row span { color:#d0d8dc; line-height:1.5; }
        .school-heading { display:flex; justify-content:space-between; gap:20px; align-items:start; }
        .school-badge { padding:9px 11px; border:1px solid #6b3039; border-radius:7px; background:#220b0f; color:#f1b2b8; font-size:9px; font-weight:900; letter-spacing:.1em; }
        .metrics { display:grid; grid-template-columns:repeat(5,1fr); gap:8px; margin:18px 0; }
        .metrics :global(.metric) { padding:13px; border:1px solid #3b3136; border-radius:8px; background:#111a21; }
        .education-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; margin:0 0 16px; }
        .education-grid article { display:grid; gap:5px; padding:14px; border:1px solid #364650; border-radius:9px; background:#101b23; }
        .education-grid span { color:#d66773; font-size:9px; font-weight:900; letter-spacing:.1em; text-transform:uppercase; }
        .education-grid strong { color:#fff; font-size:16px; }
        .education-grid small { color:#91a2ac; font-size:10px; }
        .fake-table { margin-top:18px; border:1px solid #3a4650; border-radius:8px; overflow:hidden; background:#0f1a22; }
        .table-head,.table-row { display:grid; grid-template-columns:1.5fr 1fr 1fr 1fr; gap:10px; padding:12px; }
        .table-head { background:#1a2933; color:#bdc9cf; font-size:9px; text-transform:uppercase; font-weight:850; letter-spacing:.06em; }
        .table-row { color:#d3dadd; font-size:12px; border-top:1px solid #2e3d46; }
        footer { width:min(1280px,calc(100% - 40px)); margin:0 auto; padding:18px 0 26px; display:flex; justify-content:space-between; gap:20px; border-top:1px solid #2b3942; color:#7f909a; font-size:9px; font-weight:800; letter-spacing:.11em; }
        @media(max-width:1100px) { .portal-frame { grid-template-columns:1fr auto; } .education-message { display:none; } .brand-lockup { min-width:0; } }
        @media(max-width:820px) { .portal-frame { grid-template-columns:1fr; align-items:start; } .actions { justify-content:flex-start; } .grid { grid-template-columns:1fr; } .status-row,.metrics { grid-template-columns:1fr 1fr; } .education-grid { grid-template-columns:1fr 1fr; } .academic-strip { grid-template-columns:1fr 1fr; } .academic-strip span:last-child { grid-column:1 / -1; } .table-head,.table-row { grid-template-columns:1fr; } }
        @media(max-width:560px) { .brand-lockup { gap:8px; } .pccc-wordmark { font-size:30px; } .brand-lockup strong { font-size:18px; } .brand-lockup span { font-size:7px; } .panther { width:42px; } main,.academic-strip,footer { width:min(100% - 24px,1280px); } .status-row,.metrics,.education-grid { grid-template-columns:1fr; } footer { flex-direction:column; } }
      `}</style>
    </div>
  );
}

function GuideRow({ label, text }: { label: string; text: string }) {
  return <div className="guide-row"><strong>{label}</strong><span>{text}</span></div>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span style={{ display:'block', color:'#919fa8', fontSize:9, textTransform:'uppercase', fontWeight:850, letterSpacing:'.06em' }}>{label}</span>
      <strong style={{ display:'block', marginTop:5, color:'white', fontSize:20 }}>{value}</strong>
    </div>
  );
}
