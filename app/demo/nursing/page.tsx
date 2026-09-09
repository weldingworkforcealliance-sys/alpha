'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type AttendanceStatus = 'Present' | 'Late' | 'Absent' | 'Not recorded';
type View = 'instructor' | 'school' | 'platform';

type DemoDay = {
  day: number;
  title: string;
  objective: string;
  safety: string;
  demonstration: string;
  practice: string;
  checkoff: string;
  resources: string[];
};

const DEMO_DAYS: DemoDay[] = [
  {
    day: 1,
    title: 'Patient Safety & Infection Prevention',
    objective: 'Introduce the daily learning workflow while reinforcing patient-safety habits and infection-prevention routines.',
    safety: 'Hand hygiene, appropriate PPE selection, environmental awareness, and clear escalation when a safety concern is identified.',
    demonstration: 'Instructor models a structured hand-hygiene and PPE sequence, then explains how the class records evidence of understanding.',
    practice: 'Students rotate through a guided skills station using a fictional patient scenario and standardized supplies.',
    checkoff: 'Instructor observes the sequence and records Ready, Needs Coaching, or Recheck Required.',
    resources: ['Instructor procedure guide', 'Skills checklist', 'Fictional patient scenario', 'Student reflection prompt'],
  },
  {
    day: 2,
    title: 'Vital Signs & Documentation',
    objective: 'Develop a consistent approach to measuring, verifying, and documenting basic vital-sign observations in a simulated setting.',
    safety: 'Patient identification, equipment readiness, privacy, and escalation of unexpected findings in the simulation workflow.',
    demonstration: 'Instructor demonstrates a complete simulated vital-sign workflow and shows the expected documentation standard.',
    practice: 'Students practice in pairs, compare readings, and document the simulated results using the class template.',
    checkoff: 'Instructor validates workflow consistency and documentation completeness.',
    resources: ['Vital-sign station guide', 'Documentation template', 'Equipment checklist', 'Instructor coaching notes'],
  },
  {
    day: 3,
    title: 'Safe Mobility & Transfers',
    objective: 'Apply safe body mechanics, communication, and preparation to a simulated patient-transfer activity.',
    safety: 'Fall-risk awareness, environmental setup, equipment positioning, communication, and stopping when conditions are unsafe.',
    demonstration: 'Instructor models preparation, communication, positioning, and completion of a simulated bed-to-chair transfer.',
    practice: 'Students rehearse the sequence using a mannequin or simulation partner under instructor supervision.',
    checkoff: 'Instructor verifies preparation, communication, positioning, and post-transfer safety checks.',
    resources: ['Transfer skills checklist', 'Simulation setup card', 'Safety stop criteria', 'Student self-check'],
  },
  {
    day: 4,
    title: 'Medication Safety Concepts',
    objective: 'Use a controlled simulation to practice medication-safety verification and documentation habits without administering real medication.',
    safety: 'Correct identification, order verification, allergy awareness, labeling, independent checks where required, and escalation of discrepancies.',
    demonstration: 'Instructor walks through a fictional medication scenario and models the verification process before any simulated administration step.',
    practice: 'Students work through scenario cards, identify discrepancies, and explain whether they would proceed, pause, or escalate.',
    checkoff: 'Instructor records whether the student consistently identifies required verification points and stops appropriately when information conflicts.',
    resources: ['Fictional medication record', 'Scenario cards', 'Verification checklist', 'Debrief guide'],
  },
  {
    day: 5,
    title: 'Basic Patient Assessment',
    objective: 'Organize observation, communication, and basic assessment findings into a repeatable simulated workflow.',
    safety: 'Respectful communication, privacy, infection prevention, positioning, and immediate escalation of simulated urgent findings.',
    demonstration: 'Instructor models a focused head-to-toe simulation sequence and narrates what is observed, verified, and documented.',
    practice: 'Students complete assigned portions of a simulated assessment and document findings using standardized fictional data.',
    checkoff: 'Instructor reviews organization, communication, observation sequence, and documentation quality.',
    resources: ['Assessment sequence card', 'Simulation chart', 'Documentation rubric', 'Coaching guide'],
  },
  {
    day: 6,
    title: 'Therapeutic Communication',
    objective: 'Practice clear, respectful, patient-centered communication in common simulated care situations.',
    safety: 'Professional boundaries, privacy, respectful language, confirmation of understanding, and escalation when communication reveals a safety concern.',
    demonstration: 'Instructor models ineffective and improved responses to the same fictional patient concern.',
    practice: 'Students rotate through short role-play scenarios and receive structured peer and instructor feedback.',
    checkoff: 'Instructor records evidence of active listening, clarification, appropriate response, and closed-loop confirmation.',
    resources: ['Communication scenario cards', 'Observation rubric', 'Reflection prompt', 'Instructor debrief notes'],
  },
  {
    day: 7,
    title: 'Integrated Skills Validation',
    objective: 'Combine safety, communication, assessment, and documentation habits in a controlled multi-step simulation.',
    safety: 'Students must stop and request instructor review whenever a simulated safety gate is not satisfied.',
    demonstration: 'Instructor previews the station flow, protected outcomes, scoring expectations, and recheck process without giving away assessment answers.',
    practice: 'Students complete a fictional patient-care sequence while the instructor observes required competency checkpoints.',
    checkoff: 'Instructor records Pass, Coaching Required, or Recheck Required for each competency area and documents next steps.',
    resources: ['Integrated simulation brief', 'Instructor-only validation rubric', 'Student-facing task sheet', 'Recheck plan template'],
  },
];

const STUDENTS = Array.from({ length: 8 }, (_, index) => ({
  id: `NUR-DEMO-${String(index + 1).padStart(2, '0')}`,
  name: `Student ${String(index + 1).padStart(2, '0')}`,
}));

const PROTECTED_OUTCOMES = [
  'Demonstrate safe, organized performance of foundational nursing skills in a simulated learning environment.',
  'Communicate clearly and professionally while maintaining patient-centered safety practices.',
  'Document simulated observations and interventions accurately using the approved course format.',
  'Recognize conditions that require the learner to stop, verify, or escalate before proceeding.',
];

const TERMINOLOGY = [
  ['Welding implementation', 'Nursing implementation'],
  ['Shop / lab', 'Skills lab / simulation lab'],
  ['Performance test', 'Skills validation / checkoff'],
  ['Fabrication task', 'Simulation activity'],
  ['Welding procedure resource', 'Clinical / skills procedure resource'],
  ['Shop safety gate', 'Patient-safety / skills safety gate'],
];

export default function NursingDemoPage() {
  const router = useRouter();
  const [view, setView] = useState<View>('instructor');
  const [viewingDay, setViewingDay] = useState(1);
  const [currentDay, setCurrentDay] = useState(1);
  const [started, setStarted] = useState(false);
  const [completedDays, setCompletedDays] = useState<number[]>([]);
  const [note, setNote] = useState('');
  const [savedNote, setSavedNote] = useState('');
  const [attendance, setAttendance] = useState<Record<string, AttendanceStatus>>(
    Object.fromEntries(STUDENTS.map((student) => [student.id, 'Not recorded']))
  );
  const [checkoffs, setCheckoffs] = useState<Record<string, 'Ready' | 'Needs Coaching' | 'Recheck Required'>>({
    'Hand hygiene / PPE sequence': 'Ready',
    'Vital-sign workflow': 'Needs Coaching',
    'Documentation standard': 'Ready',
  });

  const day = DEMO_DAYS.find((item) => item.day === viewingDay) ?? DEMO_DAYS[0];
  const presentCount = Object.values(attendance).filter((status) => status === 'Present' || status === 'Late').length;
  const absentCount = Object.values(attendance).filter((status) => status === 'Absent').length;
  const recordedCount = Object.values(attendance).filter((status) => status !== 'Not recorded').length;
  const progress = useMemo(() => Math.round((completedDays.length / DEMO_DAYS.length) * 100), [completedDays]);

  const markAllPresent = () => {
    setAttendance(Object.fromEntries(STUDENTS.map((student) => [student.id, 'Present'])));
  };

  const completeDay = () => {
    if (!started) return;
    setCompletedDays((items) => items.includes(currentDay) ? items : [...items, currentDay]);
    setSavedNote(note.trim());
    setNote('');
    setStarted(false);
    if (currentDay < DEMO_DAYS.length) {
      const next = currentDay + 1;
      setCurrentDay(next);
      setViewingDay(next);
    }
  };

  const resetDemo = () => {
    setView('instructor');
    setViewingDay(1);
    setCurrentDay(1);
    setStarted(false);
    setCompletedDays([]);
    setNote('');
    setSavedNote('');
    setAttendance(Object.fromEntries(STUDENTS.map((student) => [student.id, 'Not recorded'])));
  };

  return (
    <div className="shell">
      <div className="demo-banner">
        NURSING DEMONSTRATION · SYNTHETIC DATA ONLY · DEMO CONTENT IS NOT AN APPROVED NURSING CURRICULUM
      </div>

      <header>
        <div>
          <div className="eyebrow">LTG · Education Operating System</div>
          <h1>Nursing Program Demonstration</h1>
          <p className="subtitle">Same LTG platform. Different program, terminology, outcomes, skills workflow, and reporting context.</p>
        </div>
        <div className="actions">
          <button onClick={() => router.push('/demo')}>Welding Demo</button>
          <button onClick={resetDemo}>Reset Nursing Demo</button>
          <button onClick={() => router.push('/login')}>Live Login</button>
        </div>
      </header>

      <main>
        <section className="identity-strip">
          <div><span>Demo Organization</span><strong>LTG Demonstration Institute</strong></div>
          <div><span>Department</span><strong>Health Sciences</strong></div>
          <div><span>Program</span><strong>Nursing</strong></div>
          <div><span>Course</span><strong>NUR 101 · Fundamentals of Nursing Practice</strong></div>
          <div><span>Cohort</span><strong>Nursing Demo Cohort A</strong></div>
        </section>

        <nav>
          <button className={view === 'instructor' ? 'active' : ''} onClick={() => setView('instructor')}>Instructor View</button>
          <button className={view === 'school' ? 'active' : ''} onClick={() => setView('school')}>School Admin View</button>
          <button className={view === 'platform' ? 'active' : ''} onClick={() => setView('platform')}>Platform Proof</button>
        </nav>

        {view === 'instructor' && (
          <div className="instructor-layout">
            <section className="panel teaching-panel">
              <div className="panel-head">
                <div>
                  <div className="eyebrow">Current Teaching Section</div>
                  <h2>NUR 101 · Nursing Demo Cohort A</h2>
                </div>
                <StatusPill label={started ? 'DAY IN PROGRESS' : completedDays.includes(currentDay) ? 'COMPLETED' : 'READY'} active={started} />
              </div>

              <div className="metrics compact">
                <Metric label="Current Day" value={`${currentDay} / ${DEMO_DAYS.length}`} />
                <Metric label="Attendance" value={`${recordedCount} / ${STUDENTS.length}`} />
                <Metric label="Present / Late" value={String(presentCount)} />
                <Metric label="Rechecks" value={String(Object.values(checkoffs).filter((value) => value === 'Recheck Required').length)} />
              </div>

              <div className="controls">
                <button className="primary" disabled={started} onClick={() => { setViewingDay(currentDay); setStarted(true); }}>Start Today</button>
                <button disabled={!started} onClick={completeDay}>Complete Day</button>
                <button onClick={markAllPresent}>Demo: Mark All Present</button>
              </div>

              <div className="attendance-card">
                <div className="section-title-row">
                  <div>
                    <div className="eyebrow">Student Attendance</div>
                    <h3>Fictional Student Roster</h3>
                  </div>
                  <span className="muted">No real student or patient data</span>
                </div>
                <div className="attendance-grid">
                  {STUDENTS.map((student) => (
                    <div className="student-row" key={student.id}>
                      <div>
                        <strong>{student.name}</strong>
                        <span>{student.id}</span>
                      </div>
                      <select
                        value={attendance[student.id]}
                        onChange={(event) => setAttendance((current) => ({ ...current, [student.id]: event.target.value as AttendanceStatus }))}
                      >
                        <option>Not recorded</option>
                        <option>Present</option>
                        <option>Late</option>
                        <option>Absent</option>
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              <label>
                Instructor implementation note
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Example: Students needed a second demonstration before the transfer sequence. Consider adding a visual setup card next term."
                />
              </label>
              {savedNote && <div className="saved-note"><strong>Saved simulated note</strong><span>{savedNote}</span></div>}
            </section>

            <section className="panel guide-panel">
              <div className="eyebrow">Daily Instructor Planner</div>
              <div className="day-nav">
                {DEMO_DAYS.map((item) => (
                  <button key={item.day} className={viewingDay === item.day ? 'active' : ''} onClick={() => setViewingDay(item.day)}>Day {item.day}</button>
                ))}
              </div>

              <h2>Day {day.day}: {day.title}</h2>
              <GuideRow label="Learning Objective" text={day.objective} />
              <GuideRow label="Safety Focus" text={day.safety} />
              <GuideRow label="Instructor Demonstration" text={day.demonstration} />
              <GuideRow label="Guided Skills Practice" text={day.practice} />
              <GuideRow label="Competency / Checkoff" text={day.checkoff} />

              <div className="resource-box">
                <div className="eyebrow">Day Resources</div>
                {day.resources.map((resource) => <div key={resource}>• {resource}</div>)}
              </div>

              <div className="protected-box">
                <div className="lock">PROTECTED</div>
                <strong>Approved outcomes remain locked.</strong>
                <span>Instructor notes may improve pacing, resources, demonstrations, sequencing, and implementation. They cannot silently rewrite approved course outcomes.</span>
              </div>

              <div className="checkoff-box">
                <div className="eyebrow">Skills Validation Snapshot</div>
                {Object.entries(checkoffs).map(([skill, value]) => (
                  <div className="checkoff-row" key={skill}>
                    <span>{skill}</span>
                    <select value={value} onChange={(event) => setCheckoffs((current) => ({ ...current, [skill]: event.target.value as typeof value }))}>
                      <option>Ready</option>
                      <option>Needs Coaching</option>
                      <option>Recheck Required</option>
                    </select>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {view === 'school' && (
          <div className="school-layout">
            <section className="panel">
              <div className="eyebrow">School Administrator Dashboard</div>
              <h2>Health Sciences · Nursing</h2>
              <div className="metrics">
                <Metric label="Active Sections" value="1" />
                <Metric label="Demo Students" value="8" />
                <Metric label="Planner Progress" value={`${progress}%`} />
                <Metric label="Attendance Recorded" value={`${recordedCount}/8`} />
                <Metric label="Absent" value={String(absentCount)} />
                <Metric label="Instructor Notes" value={savedNote ? '1' : '0'} />
              </div>

              <div className="table">
                <div className="table-head"><span>Section</span><span>Instructor</span><span>Current Day</span><span>Attendance</span><span>Status</span></div>
                <div className="table-row"><span>NUR 101 · Cohort A</span><span>Demo Nursing Instructor</span><span>Day {currentDay} / 7</span><span>{recordedCount} / 8 recorded</span><span>{started ? 'In Progress' : 'Ready'}</span></div>
              </div>
            </section>

            <section className="panel two-column">
              <div>
                <div className="eyebrow">Protected Course Outcomes</div>
                <h3>What administration approves</h3>
                {PROTECTED_OUTCOMES.map((outcome, index) => (
                  <div className="outcome" key={outcome}><b>OUT-{index + 1}</b><span>{outcome}</span><em>Locked</em></div>
                ))}
              </div>
              <div>
                <div className="eyebrow">Continuous Improvement</div>
                <h3>What instructors can improve</h3>
                <div className="scope-list">
                  <span>✓ Pacing and lesson sequence</span>
                  <span>✓ Demonstration approach</span>
                  <span>✓ Skills-lab setup</span>
                  <span>✓ Teaching resources</span>
                  <span>✓ Instructor notes and coaching prompts</span>
                  <span>✓ Suggested remediation / recheck workflow</span>
                  <span className="blocked">✕ Approved outcomes cannot be changed from the classroom</span>
                </div>
              </div>
            </section>
          </div>
        )}

        {view === 'platform' && (
          <div className="platform-layout">
            <section className="panel hero-proof">
              <div className="eyebrow">Platform Proof</div>
              <h2>Welding is an implementation. LTG is the platform.</h2>
              <p>The nursing demonstration uses the same core operating model: organization, program, course, section, daily planner, protected outcomes, attendance, instructor notes, competency evidence, and reporting.</p>
              <div className="architecture">
                <span>LTG Platform</span><b>→</b><span>School / Organization</span><b>→</b><span>Department / Program</span><b>→</b><span>Course</span><b>→</b><span>Section</span><b>→</b><span>Daily Instruction</span>
              </div>
            </section>

            <section className="panel">
              <div className="eyebrow">Terminology Layer</div>
              <h3>Same function, different instructional language</h3>
              <div className="terminology-table">
                <div className="term-head"><span>Welding</span><span>Nursing</span></div>
                {TERMINOLOGY.map(([left, right]) => <div className="term-row" key={left}><span>{left}</span><span>{right}</span></div>)}
              </div>
            </section>

            <section className="panel">
              <div className="eyebrow">Shared LTG Functions</div>
              <h3>Program-independent capabilities</h3>
              <div className="feature-grid">
                {[
                  'Daily instructor planner', 'Protected curriculum and outcomes', 'Student attendance', 'Instructor notes',
                  'Skills / competency evidence', 'School administrator reporting', 'Instructor timekeeping', 'Resource management',
                  'Multi-course / multi-section structure', 'Mobile browser access', 'Continuous-improvement review', 'Program analytics',
                ].map((feature) => <div className="feature" key={feature}>{feature}</div>)}
              </div>
            </section>
          </div>
        )}
      </main>

      <style jsx>{`
        .shell { min-height:100vh; background:#080a0b; color:#d9dde0; }
        .demo-banner { position:sticky; top:0; z-index:30; padding:9px 14px; text-align:center; background:#176c86; color:#fff; font-size:10px; font-weight:900; letter-spacing:.08em; }
        header { display:flex; justify-content:space-between; align-items:flex-start; gap:22px; padding:24px 30px; border-bottom:1px solid #273036; background:linear-gradient(135deg,#101416,#0b0e10); }
        h1,h2,h3 { color:white; margin:5px 0; } h1 { font-size:28px; } h2 { font-size:21px; } h3 { font-size:16px; }
        .subtitle { color:#8d9aa1; max-width:760px; margin:8px 0 0; line-height:1.5; font-size:13px; }
        .eyebrow { color:#61d5ff; font-size:10px; text-transform:uppercase; letter-spacing:.12em; font-weight:900; }
        .actions, nav, .controls, .day-nav { display:flex; gap:8px; flex-wrap:wrap; }
        button, select { border:1px solid #303b40; background:#13181b; color:#dce2e5; border-radius:7px; padding:9px 12px; font-weight:750; }
        button { cursor:pointer; } button:hover:not(:disabled), button.active { border-color:#61d5ff; color:#61d5ff; }
        button.primary { border-color:#5ce0a1; color:#5ce0a1; } button:disabled { opacity:.4; cursor:not-allowed; }
        main { width:min(1420px, calc(100% - 28px)); margin:auto; padding:20px 0 56px; }
        .identity-strip { display:grid; grid-template-columns:1.15fr .8fr .7fr 1.5fr 1fr; gap:1px; overflow:hidden; border:1px solid #273036; border-radius:10px; margin-bottom:16px; background:#273036; }
        .identity-strip div { background:#111619; padding:13px; } .identity-strip span { display:block; color:#67757c; font-size:9px; text-transform:uppercase; font-weight:850; letter-spacing:.08em; } .identity-strip strong { display:block; color:#e2e7e9; font-size:12px; margin-top:4px; }
        nav { border-bottom:1px solid #273036; padding:0 0 12px; margin-bottom:16px; }
        .instructor-layout { display:grid; grid-template-columns:minmax(360px,.9fr) minmax(460px,1.1fr); gap:16px; }
        .school-layout, .platform-layout { display:grid; gap:16px; }
        .panel { background:#111619; border:1px solid #273036; border-radius:10px; padding:20px; box-shadow:0 10px 28px rgba(0,0,0,.18); }
        .panel-head, .section-title-row { display:flex; justify-content:space-between; align-items:flex-start; gap:14px; }
        .status-pill { border:1px solid #334047; border-radius:999px; padding:7px 10px; color:#aab4b9; font-size:9px; font-weight:900; letter-spacing:.08em; } .status-pill.on { border-color:#5ce0a1; color:#5ce0a1; }
        .metrics { display:grid; grid-template-columns:repeat(6,1fr); gap:8px; margin:16px 0; } .metrics.compact { grid-template-columns:repeat(4,1fr); }
        .metric { background:#0b0f11; border:1px solid #20292d; border-radius:8px; padding:11px; } .metric span { display:block; color:#68757c; font-size:9px; text-transform:uppercase; font-weight:850; } .metric strong { display:block; color:#fff; margin-top:4px; font-size:18px; }
        .controls { margin:14px 0 18px; }
        .attendance-card, .resource-box, .checkoff-box, .protected-box, .saved-note { background:#0b0f11; border:1px solid #253037; border-radius:8px; padding:14px; margin-top:14px; }
        .muted { color:#69767c; font-size:10px; }
        .attendance-grid { display:grid; grid-template-columns:1fr 1fr; gap:7px; margin-top:10px; }
        .student-row { display:flex; justify-content:space-between; align-items:center; gap:8px; background:#111619; border:1px solid #20292d; border-radius:7px; padding:8px; }
        .student-row strong, .student-row span { display:block; } .student-row strong { font-size:12px; } .student-row span { color:#657178; font-size:9px; margin-top:2px; } .student-row select { padding:6px 8px; font-size:10px; }
        label { display:grid; gap:7px; margin-top:14px; color:#78868d; font-size:10px; font-weight:850; text-transform:uppercase; letter-spacing:.05em; }
        textarea { min-height:96px; resize:vertical; background:#0b0f11; color:#e2e6e8; border:1px solid #303b40; border-radius:7px; padding:11px; font:inherit; }
        .saved-note { display:grid; gap:4px; } .saved-note strong { color:#61d5ff; font-size:10px; text-transform:uppercase; } .saved-note span { color:#bbc4c8; font-size:12px; line-height:1.5; }
        .day-nav { margin:10px 0 14px; } .day-nav button { padding:7px 9px; font-size:10px; }
        .guide-row { display:grid; gap:5px; padding:12px 0; border-bottom:1px solid #222b2f; } .guide-row strong { color:#61d5ff; font-size:9px; text-transform:uppercase; letter-spacing:.09em; } .guide-row span { color:#c5cdd1; line-height:1.52; font-size:12px; }
        .resource-box { color:#aeb8bc; font-size:11px; line-height:1.65; border-color:rgba(97,213,255,.25); }
        .protected-box { display:grid; gap:5px; border-color:rgba(255,185,92,.35); } .protected-box .lock { color:#ffb95c; font-size:9px; font-weight:900; letter-spacing:.12em; } .protected-box span { color:#a7b0b4; font-size:11px; line-height:1.5; }
        .checkoff-row { display:grid; grid-template-columns:1fr 160px; gap:9px; align-items:center; padding:8px 0; border-bottom:1px solid #20292d; font-size:11px; } .checkoff-row:last-child { border-bottom:0; } .checkoff-row select { font-size:10px; padding:7px; }
        .table { border:1px solid #273036; border-radius:8px; overflow:hidden; margin-top:16px; } .table-head,.table-row { display:grid; grid-template-columns:1.5fr 1fr .8fr 1fr .8fr; gap:10px; padding:11px 12px; } .table-head { background:#0b0f11; color:#68757c; font-size:9px; text-transform:uppercase; font-weight:850; } .table-row { border-top:1px solid #273036; color:#c7cfd2; font-size:11px; }
        .two-column { display:grid; grid-template-columns:1.25fr .75fr; gap:22px; }
        .outcome { display:grid; grid-template-columns:56px 1fr 52px; gap:10px; align-items:start; padding:10px 0; border-bottom:1px solid #222b2f; } .outcome b { color:#61d5ff; font-size:9px; } .outcome span { color:#c7cfd2; font-size:11px; line-height:1.45; } .outcome em { color:#ffb95c; font-size:9px; font-style:normal; text-transform:uppercase; font-weight:850; }
        .scope-list { display:grid; gap:9px; margin-top:12px; color:#c0c9cd; font-size:11px; } .scope-list .blocked { color:#ff8e88; margin-top:5px; }
        .hero-proof p { color:#aab5ba; line-height:1.6; max-width:900px; }
        .architecture { display:flex; flex-wrap:wrap; gap:8px; align-items:center; margin-top:18px; } .architecture span { border:1px solid #31515d; background:#0b1114; border-radius:7px; padding:9px 11px; color:#cde8f1; font-size:10px; font-weight:800; } .architecture b { color:#4e626a; }
        .terminology-table { margin-top:12px; border:1px solid #273036; border-radius:8px; overflow:hidden; } .term-head,.term-row { display:grid; grid-template-columns:1fr 1fr; gap:1px; background:#273036; } .term-head span,.term-row span { padding:10px 12px; background:#0d1113; } .term-head span { color:#68757c; font-size:9px; text-transform:uppercase; font-weight:850; } .term-row span { color:#c6cfd3; font-size:11px; }
        .feature-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; margin-top:12px; } .feature { border:1px solid #273036; border-radius:7px; background:#0d1113; padding:11px; color:#bdc7cb; font-size:11px; }
        @media(max-width:1000px) { .identity-strip { grid-template-columns:1fr 1fr; } .instructor-layout,.two-column { grid-template-columns:1fr; } .metrics,.metrics.compact { grid-template-columns:repeat(3,1fr); } .feature-grid { grid-template-columns:1fr 1fr; } }
        @media(max-width:650px) { header { flex-direction:column; padding:20px 16px; } main { width:min(100% - 18px,1420px); } .identity-strip,.attendance-grid,.metrics,.metrics.compact,.feature-grid { grid-template-columns:1fr; } .table-head { display:none; } .table-row { grid-template-columns:1fr; } .checkoff-row { grid-template-columns:1fr; } }
      `}</style>
    </div>
  );
}

function GuideRow({ label, text }: { label: string; text: string }) {
  return <div className="guide-row"><strong>{label}</strong><span>{text}</span></div>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="metric"><span>{label}</span><strong>{value}</strong></div>;
}

function StatusPill({ label, active }: { label: string; active?: boolean }) {
  return <div className={`status-pill ${active ? 'on' : ''}`}>{label}</div>;
}
