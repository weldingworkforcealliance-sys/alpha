'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type AttendanceStatus = 'Present' | 'Late' | 'Absent';
type DemoModule =
  | 'planner'
  | 'agenda'
  | 'resources'
  | 'classroom'
  | 'attendance'
  | 'timeclock'
  | 'reports'
  | 'school';

type Student = {
  id: number;
  name: string;
  status: AttendanceStatus;
};

type DemoState = {
  activeModule: DemoModule;
  currentDay: number;
  dayStartedAt: number | null;
  completedDays: number[];
  note: string;
  followUp: boolean;
  clockedInAt: number | null;
  accumulatedSeconds: number;
  liveActivityStarted: boolean;
  attendance: Student[];
};

const STORAGE_KEY = 'ltg_demo_welding_workspace';

const STUDENTS: Student[] = [
  { id: 1, name: 'Jordan Lee', status: 'Present' },
  { id: 2, name: 'Maya Ortiz', status: 'Present' },
  { id: 3, name: 'Evan Brooks', status: 'Present' },
  { id: 4, name: 'Avery Patel', status: 'Present' },
  { id: 5, name: 'Noah Reed', status: 'Present' },
  { id: 6, name: 'Sofia Martinez', status: 'Present' },
];

const DAYS = [
  {
    day: 1,
    title: 'Orientation & Shop Readiness',
    objective: 'Prepare students to enter the shop safely and understand the daily LTG workflow.',
    safety: 'PPE, work-area awareness, eye protection, hot-work expectations.',
    demonstration: 'Instructor models the pre-shop briefing, helmet fit, grinder inspection, and work-area check.',
    practice: 'Students complete a guided PPE and workstation readiness check.',
    evidence: 'Instructor confirms readiness and records exceptions before lab work begins.',
  },
  {
    day: 2,
    title: 'SMAW Setup & Arc Starts',
    objective: 'Set up an SMAW station and establish controlled E6010 arc starts.',
    safety: 'Lead condition, ground placement, electrode handling, hot metal awareness.',
    demonstration: 'Instructor demonstrates machine setup, polarity verification, body position, and arc-start technique.',
    practice: 'Students perform repeated arc starts on plate with instructor coaching.',
    evidence: 'Three controlled starts with safe shutdown and workstation reset.',
  },
  {
    day: 3,
    title: 'Blueprint to Shop Task',
    objective: 'Translate a simple print into dimensions, layout marks, and a fabrication sequence.',
    safety: 'Safe measuring, layout-tool handling, edge awareness, material movement.',
    demonstration: 'Instructor reads dimensions and weld symbols before transferring measurements to material.',
    practice: 'Students identify dimensions and create a sample layout.',
    evidence: 'Layout is checked against the drawing before fabrication begins.',
  },
];

const RESOURCES = [
  ['WLD 105 Instructor Guide', 'Daily theory sequence, demonstrations, checks, and pacing.'],
  ['WLD 110 Lab Guide', 'Shop setup, hands-on procedure, fabrication, and performance work.'],
  ['Welding Safety Reference', 'PPE, hot work, ventilation, electrical, and grinder safety.'],
  ['Blueprint Review', 'Joint types, dimensions, symbols, and print-to-task practice.'],
  ['Math for Welders', 'Short daily applied math sequence used across the course.'],
  ['Performance Evidence', 'Instructor-facing checks, job cards, and completion evidence.'],
];

const MODULES: Array<[DemoModule, string, string]> = [
  ['planner', 'Planner', 'Teaching'],
  ['agenda', 'Agenda Workspace', 'Teaching'],
  ['resources', 'Content & Resources', 'Teaching'],
  ['classroom', 'Live Classroom', 'Teaching'],
  ['attendance', 'Student Attendance', 'Classroom Tools'],
  ['timeclock', 'Employee Time Clock', 'Classroom Tools'],
  ['reports', 'Reporting & Analytics', 'Reports'],
  ['school', 'School Dashboard', 'Admin'],
];

const INITIAL_STATE: DemoState = {
  activeModule: 'planner',
  currentDay: 1,
  dayStartedAt: null,
  completedDays: [],
  note: '',
  followUp: false,
  clockedInAt: null,
  accumulatedSeconds: 0,
  liveActivityStarted: false,
  attendance: STUDENTS,
};

function formatDuration(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}m`;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function isDemoModule(value: unknown): value is DemoModule {
  return MODULES.some(([id]) => id === value);
}

export default function WeldingDemoWorkspace() {
  const router = useRouter();
  const [state, setState] = useState<DemoState>(INITIAL_STATE);
  const [hydrated, setHydrated] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<DemoState>;
        setState({
          ...INITIAL_STATE,
          ...parsed,
          activeModule: isDemoModule(parsed.activeModule) ? parsed.activeModule : 'planner',
          attendance: Array.isArray(parsed.attendance) ? parsed.attendance : STUDENTS,
        });
      }
    } catch {
      sessionStorage.removeItem(STORAGE_KEY);
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state, hydrated]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const currentDay = DAYS.find((item) => item.day === state.currentDay) ?? DAYS[0];
  const presentCount = state.attendance.filter((student) => student.status === 'Present').length;
  const lateCount = state.attendance.filter((student) => student.status === 'Late').length;
  const absentCount = state.attendance.filter((student) => student.status === 'Absent').length;
  const attendanceRate = Math.round(((presentCount + lateCount) / state.attendance.length) * 100);
  const teachingSeconds = state.dayStartedAt ? Math.max(0, Math.floor((now - state.dayStartedAt) / 1000)) : 0;
  const clockSeconds = state.accumulatedSeconds + (state.clockedInAt ? Math.max(0, Math.floor((now - state.clockedInAt) / 1000)) : 0);
  const courseProgress = Math.round((state.completedDays.length / DAYS.length) * 100);

  const sectionStatus = state.dayStartedAt
    ? 'IN PROGRESS'
    : state.completedDays.includes(state.currentDay)
      ? 'COMPLETED'
      : 'READY';

  const updateState = (patch: Partial<DemoState>) => {
    setState((current) => ({ ...current, ...patch }));
  };

  const resetDemo = () => {
    sessionStorage.removeItem(STORAGE_KEY);
    setState(INITIAL_STATE);
  };

  const completeDay = () => {
    const completedDays = state.completedDays.includes(state.currentDay)
      ? state.completedDays
      : [...state.completedDays, state.currentDay];
    const nextDay = state.currentDay < DAYS.length ? state.currentDay + 1 : state.currentDay;
    updateState({
      completedDays,
      currentDay: nextDay,
      dayStartedAt: null,
      liveActivityStarted: false,
    });
  };

  const setAttendance = (id: number, status: AttendanceStatus) => {
    updateState({
      attendance: state.attendance.map((student) =>
        student.id === id ? { ...student, status } : student
      ),
    });
  };

  const allPresent = () => {
    updateState({
      attendance: state.attendance.map((student) => ({ ...student, status: 'Present' as const })),
    });
  };

  const punchClock = () => {
    if (state.clockedInAt) {
      const added = Math.max(0, Math.floor((Date.now() - state.clockedInAt) / 1000));
      updateState({ clockedInAt: null, accumulatedSeconds: state.accumulatedSeconds + added });
    } else {
      updateState({ clockedInAt: Date.now() });
    }
  };

  const groupedModules = useMemo(() => {
    const groups = new Map<string, Array<[DemoModule, string]>>();
    MODULES.forEach(([id, label, group]) => {
      const items = groups.get(group) ?? [];
      items.push([id, label]);
      groups.set(group, items);
    });
    return Array.from(groups.entries());
  }, []);

  if (!hydrated) {
    return <div className="loading">Launching isolated LTG demo workspace…</div>;
  }

  return (
    <div className="demo-app">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-mark">LTG</div>
          <div><strong>Education</strong><span>Operating System</span></div>
        </div>

        <div className="demo-chip">PUBLIC DEMO</div>

        <div className="school-context">
          <small>DEMO WELDING SCHOOL</small>
          <strong>WLD 105 / 110</strong>
          <span>Demo Section · Instructor View</span>
        </div>

        <nav aria-label="Demo workspace navigation">
          {groupedModules.map(([group, items]) => (
            <div className="nav-group" key={group}>
              <div className="nav-label">{group}</div>
              {items.map(([id, label]) => (
                <button
                  key={id}
                  className={state.activeModule === id ? 'nav-link active' : 'nav-link'}
                  onClick={() => updateState({ activeModule: id })}
                >
                  {label}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button onClick={resetDemo}>Reset Demo</button>
          <button onClick={() => router.push('/demo/programs')}>Change Program</button>
          <button onClick={() => router.push('/demo')}>Demo Home</button>
        </div>
      </aside>

      <main className="workspace">
        <div className="banner">
          <span>PUBLIC DEMO · CLOSED SYSTEM · NO LIVE SCHOOL DATA</span>
          <span>Resets after 30 minutes of inactivity</span>
        </div>

        <header className="workspace-header">
          <div>
            <div className="eyebrow">Living Teacher Guide</div>
            <h1>{MODULES.find(([id]) => id === state.activeModule)?.[1] ?? 'Planner'}</h1>
          </div>
          <div className="header-status">
            <span>WLD 105 / 110</span>
            <strong>Day {state.currentDay}</strong>
            <b>{sectionStatus}</b>
          </div>
        </header>

        <section className="context-strip">
          <div><span>School</span><strong>Demo Welding School</strong></div>
          <div><span>Section</span><strong>WLD 105 / 110</strong></div>
          <div><span>Instructor</span><strong>Demo Instructor</strong></div>
          <div><span>Attendance</span><strong>{attendanceRate}%</strong></div>
          <div><span>Clock</span><strong>{state.clockedInAt ? 'CLOCKED IN' : 'CLOCKED OUT'}</strong></div>
        </section>

        {state.activeModule === 'planner' && (
          <div className="content-grid planner-grid">
            <section className="panel primary-panel">
              <div className="panel-heading">
                <div>
                  <div className="eyebrow">Current Teaching Day</div>
                  <h2>Day {currentDay.day}: {currentDay.title}</h2>
                </div>
                <div className="timer">{state.dayStartedAt ? formatDuration(teachingSeconds) : '0:00'}</div>
              </div>

              <div className="planner-actions">
                <button
                  className="accent"
                  disabled={Boolean(state.dayStartedAt)}
                  onClick={() => updateState({ dayStartedAt: Date.now() })}
                >
                  Start Today
                </button>
                <button disabled={!state.dayStartedAt} onClick={completeDay}>Complete Day</button>
                <button onClick={() => updateState({ activeModule: 'classroom' })}>Launch Live Class</button>
              </div>

              <GuideRow label="Objective" text={currentDay.objective} />
              <GuideRow label="Safety Focus" text={currentDay.safety} />
              <GuideRow label="Demonstration" text={currentDay.demonstration} />
              <GuideRow label="Guided Practice" text={currentDay.practice} />
              <GuideRow label="Evidence / Check" text={currentDay.evidence} />
            </section>

            <aside className="panel side-panel">
              <div className="eyebrow">Instructor Notes</div>
              <label className="field-label" htmlFor="demo-note">Daily observation</label>
              <textarea
                id="demo-note"
                value={state.note}
                onChange={(event) => updateState({ note: event.target.value })}
                placeholder="Record an observation, pacing note, student issue, or improvement idea."
              />
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={state.followUp}
                  onChange={(event) => updateState({ followUp: event.target.checked })}
                />
                Flag for follow-up
              </label>
              <div className="notice">Demo notes are temporary. They never enter the live school database.</div>
            </aside>
          </div>
        )}

        {state.activeModule === 'agenda' && (
          <section className="panel wide-panel">
            <div className="panel-heading">
              <div><div className="eyebrow">Agenda Workspace</div><h2>Instructional day at a glance</h2></div>
              <button className="accent" onClick={() => updateState({ activeModule: 'planner' })}>Open Planner</button>
            </div>
            <div className="agenda-list">
              <AgendaRow time="8:30" title="Theory / briefing" text={currentDay.objective} />
              <AgendaRow time="9:15" title="Demonstration" text={currentDay.demonstration} />
              <AgendaRow time="9:35" title="Guided shop work" text={currentDay.practice} />
              <AgendaRow time="10:45" title="Evidence & closeout" text={currentDay.evidence} />
            </div>
          </section>
        )}

        {state.activeModule === 'resources' && (
          <section className="panel wide-panel">
            <div className="panel-heading"><div><div className="eyebrow">Content & Resources</div><h2>Course-connected teaching resources</h2></div></div>
            <div className="resource-grid">
              {RESOURCES.map(([title, text]) => (
                <article key={title} className="resource-card">
                  <span>RESOURCE</span><h3>{title}</h3><p>{text}</p><button>Open Preview</button>
                </article>
              ))}
            </div>
          </section>
        )}

        {state.activeModule === 'classroom' && (
          <section className="panel wide-panel">
            <div className="panel-heading">
              <div><div className="eyebrow">Live Classroom</div><h2>Day {currentDay.day} instructor-guided activity</h2></div>
              <span className={state.liveActivityStarted ? 'live-pill active' : 'live-pill'}>
                {state.liveActivityStarted ? 'LIVE' : 'READY'}
              </span>
            </div>
            {!state.liveActivityStarted ? (
              <div className="launch-card">
                <h3>Launch Day {currentDay.day} activity</h3>
                <p>Students join a temporary classroom session. Responses and activity status exist only inside this demo browser session.</p>
                <button className="accent" onClick={() => updateState({ liveActivityStarted: true })}>Launch Live Class Activity</button>
              </div>
            ) : (
              <div className="live-grid">
                <article><span>CONNECTED</span><strong>6</strong><small>students</small></article>
                <article><span>RESPONDED</span><strong>4</strong><small>students</small></article>
                <article><span>NEEDS REVIEW</span><strong>1</strong><small>response</small></article>
                <article><span>COMPLETE</span><strong>67%</strong><small>activity</small></article>
              </div>
            )}
            <div className="question-card">
              <div className="eyebrow">Live Prompt</div>
              <h3>Before welding begins, identify the first safety condition you would correct in the work area.</h3>
              <div className="response-list"><span>Ventilation</span><span>Combustibles</span><span>Ground placement</span><span>PPE check</span></div>
            </div>
          </section>
        )}

        {state.activeModule === 'attendance' && (
          <section className="panel wide-panel">
            <div className="panel-heading">
              <div><div className="eyebrow">Student Attendance</div><h2>Daily attendance · WLD 105 / 110</h2></div>
              <button className="accent" onClick={allPresent}>Mark All Present</button>
            </div>
            <div className="attendance-summary">
              <Metric label="Present" value={String(presentCount)} />
              <Metric label="Late" value={String(lateCount)} />
              <Metric label="Absent" value={String(absentCount)} />
              <Metric label="Attendance Rate" value={`${attendanceRate}%`} />
            </div>
            <div className="student-table">
              {state.attendance.map((student) => (
                <div className="student-row" key={student.id}>
                  <strong>{student.name}</strong>
                  <div className="attendance-buttons">
                    {(['Present', 'Late', 'Absent'] as AttendanceStatus[]).map((status) => (
                      <button
                        key={status}
                        className={student.status === status ? 'selected' : ''}
                        onClick={() => setAttendance(student.id, status)}
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {state.activeModule === 'timeclock' && (
          <section className="panel wide-panel clock-panel">
            <div><div className="eyebrow">Employee Time Clock</div><h2>Demo Instructor</h2><p>Instructor time is shown exactly as a school user would review it, but no payroll record is created.</p></div>
            <div className="clock-card">
              <span>{state.clockedInAt ? 'CURRENTLY CLOCKED IN' : 'CURRENTLY CLOCKED OUT'}</span>
              <strong>{formatDuration(clockSeconds)}</strong>
              <button className="accent" onClick={punchClock}>{state.clockedInAt ? 'Clock Out' : 'Clock In'}</button>
            </div>
          </section>
        )}

        {state.activeModule === 'reports' && (
          <section className="panel wide-panel">
            <div className="panel-heading"><div><div className="eyebrow">Reporting & Analytics</div><h2>Connected operational snapshot</h2></div></div>
            <div className="metric-grid">
              <Metric label="Course Progress" value={`${courseProgress}%`} />
              <Metric label="Attendance Rate" value={`${attendanceRate}%`} />
              <Metric label="Completed Days" value={`${state.completedDays.length} / ${DAYS.length}`} />
              <Metric label="Instructor Time" value={formatDuration(clockSeconds)} />
              <Metric label="Live Activity" value={state.liveActivityStarted ? 'Active' : 'Not started'} />
              <Metric label="Follow-Ups" value={state.followUp ? '1' : '0'} />
            </div>
            <div className="report-table">
              <div className="report-head"><span>Section</span><span>Current Day</span><span>Attendance</span><span>Status</span></div>
              <div className="report-row"><strong>WLD 105 / 110</strong><span>Day {state.currentDay}</span><span>{attendanceRate}%</span><b>{sectionStatus}</b></div>
            </div>
          </section>
        )}

        {state.activeModule === 'school' && (
          <section className="panel wide-panel">
            <div className="panel-heading"><div><div className="eyebrow">School Dashboard</div><h2>Demo Welding School</h2></div></div>
            <div className="metric-grid">
              <Metric label="Active Sections" value="1" />
              <Metric label="Students" value="6" />
              <Metric label="Instructors" value="1" />
              <Metric label="Attendance" value={`${attendanceRate}%`} />
              <Metric label="Instruction Progress" value={`${courseProgress}%`} />
              <Metric label="Open Follow-Ups" value={state.followUp ? '1' : '0'} />
            </div>
            <div className="school-note">
              <strong>Closed demo environment</strong>
              <p>This view is driven only by the temporary actions taken inside this demo session. It does not read from or write to live LTG school records.</p>
            </div>
          </section>
        )}
      </main>

      <style jsx>{`
        :global(body.ltg-demo-route) { margin:0; background:#0a0d0f; color:#d7e0e4; }
        :global(body.ltg-demo-route .app-container), :global(body.ltg-demo-route .ltg-public-content) { width:100%; max-width:none; margin:0; padding:0; display:block; }
        * { box-sizing:border-box; }
        .loading { min-height:100vh; display:grid; place-items:center; background:#0b0e10; color:#79dfff; font-weight:800; }
        .demo-app { min-height:100vh; display:grid; grid-template-columns:252px minmax(0,1fr); background:#0a0d0f; color:#d7e0e4; }
        .sidebar { position:sticky; top:0; height:100vh; overflow:auto; padding:18px 14px; border-right:1px solid #222b30; background:#101519; }
        .brand-block { display:flex; align-items:center; gap:10px; padding:4px 6px 16px; border-bottom:1px solid #242d32; }
        .brand-mark { width:44px; height:44px; display:grid; place-items:center; border-radius:9px; background:#f36a2f; color:#fff; font-weight:950; }
        .brand-block>div:last-child { display:grid; gap:1px; } .brand-block strong { color:#fff; font-size:13px; } .brand-block span { color:#85969e; font-size:10px; }
        .demo-chip { margin:14px 6px 0; padding:7px 9px; border:1px solid #176a88; border-radius:7px; background:#0c3140; color:#7bdfff; text-align:center; font-size:9px; font-weight:950; letter-spacing:.12em; }
        .school-context { display:grid; gap:4px; margin:14px 6px 18px; padding:12px; border:1px solid #273238; border-radius:8px; background:#151b1f; }
        .school-context small { color:#5fd6ff; font-size:8px; font-weight:900; letter-spacing:.08em; } .school-context strong { color:#fff; font-size:13px; } .school-context span { color:#809097; font-size:9px; }
        .nav-group { margin:14px 0; } .nav-label { padding:0 10px 6px; color:#64747c; font-size:8px; font-weight:900; letter-spacing:.12em; text-transform:uppercase; }
        .nav-link { width:100%; border:0; border-left:3px solid transparent; border-radius:6px; background:transparent; color:#aebbc1; padding:10px 11px; text-align:left; font-size:12px; font-weight:750; cursor:pointer; }
        .nav-link:hover { background:#172025; color:#fff; } .nav-link.active { border-left-color:#5ed8ff; background:#17252c; color:#fff; }
        .sidebar-footer { display:grid; gap:7px; margin-top:20px; padding-top:14px; border-top:1px solid #263036; }
        .sidebar-footer button { border:1px solid #2b373d; border-radius:6px; background:#151b1f; color:#98a8af; padding:9px; font-size:10px; font-weight:800; cursor:pointer; }
        .workspace { min-width:0; }
        .banner { display:flex; justify-content:space-between; gap:20px; padding:8px 24px; border-bottom:1px solid #0f6688; background:#0a5270; color:#dff8ff; font-size:9px; font-weight:900; letter-spacing:.08em; }
        .workspace-header { display:flex; justify-content:space-between; gap:20px; align-items:center; padding:22px 28px 18px; border-bottom:1px solid #20282d; background:#0e1215; }
        .eyebrow { color:#5dd8ff; font-size:9px; font-weight:950; letter-spacing:.12em; text-transform:uppercase; }
        h1,h2,h3,p { margin-top:0; } h1 { margin:5px 0 0; color:#fff; font-size:27px; } h2 { margin:5px 0 0; color:#fff; font-size:22px; } h3 { color:#eef5f7; }
        .header-status { display:flex; gap:8px; align-items:center; } .header-status span,.header-status strong,.header-status b { padding:7px 9px; border:1px solid #283238; border-radius:7px; background:#151b1f; color:#9baab1; font-size:9px; } .header-status b { border-color:#1f6680; color:#67d9ff; }
        .context-strip { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:1px; margin:18px 28px 0; border:1px solid #242e33; border-radius:9px; overflow:hidden; background:#242e33; }
        .context-strip div { display:grid; gap:4px; padding:11px 13px; background:#12171a; } .context-strip span { color:#65757c; font-size:8px; text-transform:uppercase; letter-spacing:.08em; } .context-strip strong { color:#d8e1e5; font-size:11px; }
        .content-grid { display:grid; gap:14px; padding:18px 28px 36px; } .planner-grid { grid-template-columns:minmax(0,1.55fr) minmax(280px,.65fr); }
        .panel { border:1px solid #273137; border-radius:10px; background:#11171a; box-shadow:0 12px 30px rgba(0,0,0,.14); }
        .primary-panel,.side-panel,.wide-panel { padding:22px; } .wide-panel { margin:18px 28px 36px; }
        .panel-heading { display:flex; justify-content:space-between; gap:18px; align-items:flex-start; margin-bottom:18px; }
        .timer { padding:9px 12px; border:1px solid #2b3b42; border-radius:8px; color:#6edcff; background:#0e1b20; font:900 13px ui-monospace,monospace; }
        .planner-actions { display:flex; flex-wrap:wrap; gap:8px; margin:0 0 20px; padding-bottom:18px; border-bottom:1px solid #263137; }
        button { font:inherit; } .planner-actions button,.panel-heading button,.resource-card button,.launch-card button,.clock-card button { border:1px solid #34434a; border-radius:7px; background:#182126; color:#c7d2d6; padding:9px 12px; font-size:10px; font-weight:850; cursor:pointer; }
        button.accent { border-color:#2b9dc6; background:#123443; color:#71ddff; } button:disabled { opacity:.35; cursor:not-allowed; }
        .guide-row { display:grid; grid-template-columns:132px 1fr; gap:16px; padding:13px 0; border-top:1px solid #222d32; } .guide-row:first-of-type { border-top:0; } .guide-row strong { color:#8fa0a7; font-size:10px; text-transform:uppercase; letter-spacing:.06em; } .guide-row span { color:#c4ced2; font-size:12px; line-height:1.58; }
        .field-label { display:block; margin:18px 0 7px; color:#8d9da4; font-size:10px; font-weight:850; text-transform:uppercase; }
        textarea { width:100%; min-height:180px; resize:vertical; border:1px solid #303c42; border-radius:8px; background:#0b1012; color:#e1e7e9; padding:12px; font:inherit; font-size:12px; }
        .check-row { display:flex; gap:8px; align-items:center; margin:12px 0; color:#b1bec3; font-size:11px; }
        .notice,.school-note { margin-top:16px; padding:12px; border:1px solid #1f5063; border-radius:8px; background:#0d252e; color:#8ecde1; font-size:10px; line-height:1.55; }
        .agenda-list { display:grid; gap:8px; } .agenda-row { display:grid; grid-template-columns:70px 180px 1fr; gap:16px; padding:14px; border:1px solid #263136; border-radius:8px; background:#0e1316; } .agenda-row time { color:#65d8ff; font-weight:900; } .agenda-row strong { color:#eef4f6; font-size:12px; } .agenda-row span { color:#899aa1; font-size:11px; line-height:1.45; }
        .resource-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; } .resource-card { padding:17px; border:1px solid #29353a; border-radius:9px; background:#0e1417; } .resource-card>span { color:#56cfff; font-size:8px; font-weight:900; letter-spacing:.1em; } .resource-card h3 { margin:7px 0; font-size:14px; } .resource-card p { min-height:56px; color:#7f9198; font-size:10px; line-height:1.5; }
        .live-pill { padding:7px 10px; border:1px solid #39454a; border-radius:999px; color:#87979e; font-size:9px; font-weight:900; } .live-pill.active { border-color:#1d9c65; background:#103625; color:#7ce9b5; }
        .launch-card { padding:24px; border:1px dashed #32505d; border-radius:10px; background:#0c1519; } .launch-card p { color:#86979e; font-size:11px; line-height:1.6; }
        .live-grid,.metric-grid,.attendance-summary { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:10px; margin-bottom:16px; } .live-grid article { display:grid; gap:3px; padding:17px; border:1px solid #26383f; border-radius:8px; background:#0d171b; } .live-grid span { color:#5ccff5; font-size:8px; font-weight:900; } .live-grid strong { color:#fff; font-size:26px; } .live-grid small { color:#71858d; }
        .question-card { margin-top:16px; padding:20px; border:1px solid #29363c; border-radius:9px; background:#0e1417; } .question-card h3 { margin:8px 0 16px; font-size:16px; line-height:1.45; } .response-list { display:flex; flex-wrap:wrap; gap:8px; } .response-list span { padding:8px 10px; border:1px solid #2e3e45; border-radius:7px; background:#151d21; color:#aebcc2; font-size:10px; }
        .metric { display:grid; gap:5px; padding:15px; border:1px solid #29343a; border-radius:8px; background:#0e1417; } .metric span { color:#687a82; font-size:8px; font-weight:900; text-transform:uppercase; letter-spacing:.08em; } .metric strong { color:#f0f5f7; font-size:19px; }
        .student-table { border:1px solid #29343a; border-radius:9px; overflow:hidden; } .student-row { display:grid; grid-template-columns:1fr auto; gap:14px; align-items:center; padding:12px 14px; border-top:1px solid #263137; background:#0e1417; } .student-row:first-child { border-top:0; } .student-row strong { color:#dbe4e7; font-size:11px; }
        .attendance-buttons { display:flex; gap:5px; } .attendance-buttons button { border:1px solid #303c42; border-radius:6px; background:#151c20; color:#88999f; padding:7px 9px; font-size:9px; font-weight:800; cursor:pointer; } .attendance-buttons button.selected { border-color:#2693b8; background:#123442; color:#75ddff; }
        .clock-panel { display:grid; grid-template-columns:1fr 320px; gap:24px; align-items:center; } .clock-panel p { max-width:620px; color:#809198; font-size:11px; line-height:1.6; } .clock-card { display:grid; gap:10px; padding:20px; border:1px solid #2b383e; border-radius:10px; background:#0d1417; } .clock-card span { color:#62d8ff; font-size:8px; font-weight:900; letter-spacing:.08em; } .clock-card strong { color:#fff; font-size:34px; font-family:ui-monospace,monospace; }
        .report-table { margin-top:18px; border:1px solid #29343a; border-radius:8px; overflow:hidden; } .report-head,.report-row { display:grid; grid-template-columns:1.4fr .8fr .8fr .8fr; gap:10px; padding:11px 14px; } .report-head { background:#151c20; color:#73858c; font-size:8px; font-weight:900; text-transform:uppercase; } .report-row { background:#0d1316; color:#b6c2c7; font-size:10px; } .report-row b { color:#61d7ff; }
        .school-note strong { display:block; color:#dff7ff; margin-bottom:5px; } .school-note p { margin:0; color:#8ecde1; }
        @media(max-width:980px) { .demo-app { grid-template-columns:210px minmax(0,1fr); } .planner-grid { grid-template-columns:1fr; } .resource-grid { grid-template-columns:1fr 1fr; } .context-strip { grid-template-columns:1fr 1fr; } .clock-panel { grid-template-columns:1fr; } }
        @media(max-width:720px) { .demo-app { display:block; } .sidebar { position:relative; width:100%; height:auto; } .nav-group { display:flex; gap:6px; flex-wrap:wrap; } .nav-label { width:100%; } .nav-link { width:auto; border:1px solid #29343a; border-left-width:1px; } .nav-link.active { border-color:#5ed8ff; } .banner,.workspace-header { padding-left:14px; padding-right:14px; } .banner { flex-direction:column; gap:4px; } .workspace-header { align-items:flex-start; flex-direction:column; } .context-strip,.wide-panel,.content-grid { margin-left:14px; margin-right:14px; } .content-grid { padding-left:0; padding-right:0; } .resource-grid,.metric-grid,.attendance-summary,.live-grid { grid-template-columns:1fr 1fr; } .agenda-row { grid-template-columns:60px 1fr; } .agenda-row span { grid-column:1 / -1; } .student-row { grid-template-columns:1fr; } .attendance-buttons { flex-wrap:wrap; } }
      `}</style>
    </div>
  );
}

function GuideRow({ label, text }: { label: string; text: string }) {
  return <div className="guide-row"><strong>{label}</strong><span>{text}</span></div>;
}

function AgendaRow({ time, title, text }: { time: string; title: string; text: string }) {
  return <div className="agenda-row"><time>{time}</time><strong>{title}</strong><span>{text}</span></div>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="metric"><span>{label}</span><strong>{value}</strong></div>;
}
