'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type AttendanceStatus = 'Present' | 'Late' | 'Absent' | 'Not recorded';
type SkillStatus = 'Ready' | 'Needs Coaching' | 'Recheck Required';
type View = 'instructor' | 'school' | 'quality' | 'platform';

type DemoDay = {
  day: number;
  title: string;
  objective: string;
  safety: string;
  demonstration: string;
  practice: string;
  evidence: string;
  resources: string[];
};

const DEMO_DAYS: DemoDay[] = [
  { day: 1, title: 'Patient Safety & Infection Prevention', objective: 'Introduce the daily learning workflow while reinforcing patient-safety habits and infection-prevention routines.', safety: 'Hand hygiene, appropriate PPE selection, environmental awareness, and escalation when a safety concern is identified.', demonstration: 'Instructor models a structured hand-hygiene and PPE sequence and explains the expected evidence of understanding.', practice: 'Students rotate through a guided skills station using a fictional patient scenario and standardized supplies.', evidence: 'Instructor observes the sequence and records Ready, Needs Coaching, or Recheck Required.', resources: ['Instructor procedure guide', 'Skills checklist', 'Fictional patient scenario', 'Student reflection prompt'] },
  { day: 2, title: 'Vital Signs & Documentation', objective: 'Develop a consistent approach to measuring, verifying, and documenting basic vital-sign observations in a simulated setting.', safety: 'Patient identification, equipment readiness, privacy, and escalation of unexpected findings.', demonstration: 'Instructor demonstrates a complete simulated vital-sign workflow and the expected documentation standard.', practice: 'Students practice in pairs, compare readings, and document simulated results.', evidence: 'Instructor validates workflow consistency and documentation completeness.', resources: ['Vital-sign station guide', 'Documentation template', 'Equipment checklist', 'Instructor coaching notes'] },
  { day: 3, title: 'Safe Mobility & Transfers', objective: 'Apply safe body mechanics, communication, and preparation to a simulated patient-transfer activity.', safety: 'Fall-risk awareness, environmental setup, equipment positioning, communication, and stopping when conditions are unsafe.', demonstration: 'Instructor models preparation, communication, positioning, and completion of a simulated bed-to-chair transfer.', practice: 'Students rehearse the sequence using a mannequin or simulation partner under instructor supervision.', evidence: 'Instructor verifies preparation, communication, positioning, and post-transfer safety checks.', resources: ['Transfer skills checklist', 'Simulation setup card', 'Safety stop criteria', 'Student self-check'] },
  { day: 4, title: 'Medication Safety Concepts', objective: 'Practice medication-safety verification and documentation habits in a controlled simulation without administering real medication.', safety: 'Identification, order verification, allergy awareness, labeling, required checks, and escalation of discrepancies.', demonstration: 'Instructor walks through a fictional medication scenario and models the verification process.', practice: 'Students work through scenario cards, identify discrepancies, and explain whether they would proceed, pause, or escalate.', evidence: 'Instructor records whether required verification points and appropriate stops are consistently identified.', resources: ['Fictional medication record', 'Scenario cards', 'Verification checklist', 'Debrief guide'] },
  { day: 5, title: 'Basic Patient Assessment', objective: 'Organize observation, communication, and basic assessment findings into a repeatable simulated workflow.', safety: 'Respectful communication, privacy, infection prevention, positioning, and escalation of simulated urgent findings.', demonstration: 'Instructor models a focused assessment simulation sequence and narrates what is observed, verified, and documented.', practice: 'Students complete assigned portions of a simulated assessment and document standardized fictional findings.', evidence: 'Instructor reviews organization, communication, observation sequence, and documentation quality.', resources: ['Assessment sequence card', 'Simulation chart', 'Documentation rubric', 'Coaching guide'] },
  { day: 6, title: 'Therapeutic Communication', objective: 'Practice clear, respectful, patient-centered communication in common simulated care situations.', safety: 'Professional boundaries, privacy, respectful language, confirmation of understanding, and escalation of safety concerns.', demonstration: 'Instructor models ineffective and improved responses to the same fictional patient concern.', practice: 'Students rotate through short role-play scenarios and receive structured peer and instructor feedback.', evidence: 'Instructor records evidence of active listening, clarification, appropriate response, and closed-loop confirmation.', resources: ['Communication scenario cards', 'Observation rubric', 'Reflection prompt', 'Instructor debrief notes'] },
  { day: 7, title: 'Integrated Skills Validation', objective: 'Combine safety, communication, assessment, and documentation habits in a controlled multi-step simulation.', safety: 'Students stop and request instructor review whenever a simulated safety gate is not satisfied.', demonstration: 'Instructor previews the station flow, protected outcomes, scoring expectations, and recheck process.', practice: 'Students complete a fictional patient-care sequence while the instructor observes competency checkpoints.', evidence: 'Instructor records Ready, Needs Coaching, or Recheck Required and documents next steps.', resources: ['Integrated simulation brief', 'Instructor-only validation rubric', 'Student-facing task sheet', 'Recheck plan template'] },
];

const STUDENTS = Array.from({ length: 8 }, (_, index) => ({
  id: `NUR-DEMO-${String(index + 1).padStart(2, '0')}`,
  name: `Student ${String(index + 1).padStart(2, '0')}`,
}));

const EMPTY_ATTENDANCE = () => Object.fromEntries(STUDENTS.map((student) => [student.id, 'Not recorded'])) as Record<string, AttendanceStatus>;

const INITIAL_CHECKOFFS: Record<string, SkillStatus> = {
  'Hand hygiene / PPE sequence': 'Ready',
  'Vital-sign workflow': 'Needs Coaching',
  'Documentation standard': 'Ready',
  'Safety stop / escalation behavior': 'Ready',
};

const PROTECTED_OUTCOMES = [
  'Demonstrate safe, organized performance of foundational nursing skills in a simulated learning environment.',
  'Communicate clearly and professionally while maintaining patient-centered safety practices.',
  'Document simulated observations and interventions accurately using the approved course format.',
  'Recognize conditions that require the learner to stop, verify, or escalate before proceeding.',
];

const QUALITY_ROWS = [
  ['OUT-1', 'Skills observation', 'Day 1, 3, 7', 'Evidence mapped'],
  ['OUT-2', 'Instructor rubric', 'Day 3, 6, 7', 'Evidence mapped'],
  ['OUT-3', 'Documentation review', 'Day 2, 4, 5, 7', 'Evidence mapped'],
  ['OUT-4', 'Safety-gate observation', 'Day 1, 3, 4, 7', 'Evidence mapped'],
];

const TERMINOLOGY = [
  ['Shop / lab', 'Skills lab / simulation lab'],
  ['Performance test', 'Skills validation / checkoff'],
  ['Fabrication task', 'Simulation activity'],
  ['Procedure resource', 'Clinical / skills procedure resource'],
  ['Safety gate', 'Patient-safety / skills safety gate'],
  ['Rework / retest', 'Coaching / recheck'],
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
  const [attendance, setAttendance] = useState<Record<string, AttendanceStatus>>(EMPTY_ATTENDANCE);
  const [checkoffs, setCheckoffs] = useState<Record<string, SkillStatus>>({ ...INITIAL_CHECKOFFS });

  const day = DEMO_DAYS.find((item) => item.day === viewingDay) ?? DEMO_DAYS[0];
  const recordedCount = Object.values(attendance).filter((status) => status !== 'Not recorded').length;
  const presentCount = Object.values(attendance).filter((status) => status === 'Present' || status === 'Late').length;
  const absentCount = Object.values(attendance).filter((status) => status === 'Absent').length;
  const attendanceComplete = recordedCount === STUDENTS.length;
  const recheckCount = Object.values(checkoffs).filter((value) => value === 'Recheck Required').length;
  const coachingCount = Object.values(checkoffs).filter((value) => value === 'Needs Coaching').length;
  const progress = useMemo(() => Math.round((completedDays.length / DEMO_DAYS.length) * 100), [completedDays]);

  const markAllPresent = () => setAttendance(Object.fromEntries(STUDENTS.map((student) => [student.id, 'Present'])) as Record<string, AttendanceStatus>);

  const completeDay = () => {
    if (!started || !attendanceComplete) return;
    setCompletedDays((items) => items.includes(currentDay) ? items : [...items, currentDay]);
    setSavedNote(note.trim());
    setNote('');
    setStarted(false);

    if (currentDay < DEMO_DAYS.length) {
      const next = currentDay + 1;
      setCurrentDay(next);
      setViewingDay(next);
      setAttendance(EMPTY_ATTENDANCE());
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
    setAttendance(EMPTY_ATTENDANCE());
    setCheckoffs({ ...INITIAL_CHECKOFFS });
  };

  return (
    <div className="shell">
      <div className="demo-banner">NURSING DEMONSTRATION · SYNTHETIC DATA ONLY · NOT AN APPROVED NURSING CURRICULUM</div>

      <header>
        <div className="brand-block">
          <div className="brand-mark">LTG</div>
          <div>
            <div className="eyebrow">Education Operating System · Health Sciences Demo</div>
            <h1>Nursing Program Demonstration</h1>
            <p className="subtitle">One LTG platform configured for a different department, instructional language, evidence model, and visual identity.</p>
          </div>
        </div>
        <div className="actions">
          <button onClick={() => router.push('/demo/programs')}>Program Demos</button>
          <button onClick={() => router.push('/demo')}>Welding Demo</button>
          <button onClick={resetDemo}>Reset Nursing Demo</button>
          <button className="solid" onClick={() => router.push('/login')}>Live Login</button>
        </div>
      </header>

      <main>
        <section className="identity-card">
          <div className="identity-title"><span>LTG Demonstration Institute</span><strong>Health Sciences · Nursing</strong></div>
          <div className="identity-meta">
            <Meta label="Course" value="NUR 101" detail="Fundamentals of Nursing Practice" />
            <Meta label="Section" value="Cohort A" detail="8 synthetic learners" />
            <Meta label="Environment" value="Classroom + Skills Lab" detail="Simulation-based demo" />
            <Meta label="Curriculum" value="Protected" detail="Demo v1.0" />
          </div>
        </section>

        <section className="value-strip">
          <ValueCard label="Daily instruction" value="7 demo days" detail="Planner + instructor guidance" />
          <ValueCard label="Competency evidence" value={`${coachingCount + recheckCount} follow-up`} detail="Coaching and recheck visibility" />
          <ValueCard label="Attendance" value={`${recordedCount} / 8 recorded`} detail={attendanceComplete ? 'Ready to confirm' : 'Required before day completion'} />
          <ValueCard label="Curriculum control" value="Locked outcomes" detail="Implementation can improve safely" />
        </section>

        <nav>
          <button className={view === 'instructor' ? 'active' : ''} onClick={() => setView('instructor')}>Instructor Workspace</button>
          <button className={view === 'school' ? 'active' : ''} onClick={() => setView('school')}>Program Administration</button>
          <button className={view === 'quality' ? 'active' : ''} onClick={() => setView('quality')}>Quality & Evidence</button>
          <button className={view === 'platform' ? 'active' : ''} onClick={() => setView('platform')}>Platform Proof</button>
        </nav>

        {view === 'instructor' && (
          <div className="instructor-layout">
            <section className="panel">
              <div className="panel-head">
                <div><div className="eyebrow">Current Teaching Section</div><h2>NUR 101 · Nursing Demo Cohort A</h2></div>
                <StatusPill label={started ? 'DAY IN PROGRESS' : completedDays.includes(currentDay) ? 'COMPLETED' : 'READY'} active={started} />
              </div>

              <div className="metrics compact">
                <Metric label="Current Day" value={`${currentDay} / ${DEMO_DAYS.length}`} />
                <Metric label="Attendance" value={`${recordedCount} / ${STUDENTS.length}`} />
                <Metric label="Present / Late" value={String(presentCount)} />
                <Metric label="Needs Follow-up" value={String(coachingCount + recheckCount)} />
              </div>

              <div className="controls">
                <button className="primary" disabled={started} onClick={() => { setViewingDay(currentDay); setStarted(true); }}>Start Today</button>
                <button className="complete" disabled={!started || !attendanceComplete} onClick={completeDay}>Complete Day</button>
                <button onClick={markAllPresent}>Demo: Mark All Present</button>
              </div>

              {started && !attendanceComplete && (
                <div className="attendance-gate"><strong>Attendance confirmation required</strong><span>Record Present, Late, or Absent for all 8 students before completing the instructional day. {STUDENTS.length - recordedCount} remaining.</span></div>
              )}
              {started && attendanceComplete && (
                <div className="attendance-ready"><strong>Attendance complete</strong><span>All 8 students have a status. The day can now be completed.</span></div>
              )}

              <div className="attendance-card">
                <div className="section-title-row"><div><div className="eyebrow">Student Attendance</div><h3>Fictional Student Roster</h3></div><span className="muted">No real student or patient data</span></div>
                <div className="attendance-grid">
                  {STUDENTS.map((student) => (
                    <div className="student-row" key={student.id}>
                      <div><strong>{student.name}</strong><span>{student.id}</span></div>
                      <select value={attendance[student.id]} onChange={(event) => setAttendance((current) => ({ ...current, [student.id]: event.target.value as AttendanceStatus }))}>
                        <option>Not recorded</option><option>Present</option><option>Late</option><option>Absent</option>
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              <label>Instructor implementation note
                <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Example: Students needed a second demonstration before the transfer sequence. Consider adding a visual setup card next term." />
              </label>
              {savedNote && <div className="saved-note"><strong>Saved simulated note</strong><span>{savedNote}</span></div>}
            </section>

            <section className="panel">
              <div className="eyebrow">Daily Instructor Planner</div>
              <div className="day-nav">{DEMO_DAYS.map((item) => <button key={item.day} className={viewingDay === item.day ? 'active' : ''} onClick={() => setViewingDay(item.day)}>Day {item.day}</button>)}</div>
              <h2>Day {day.day}: {day.title}</h2>
              <GuideRow label="Learning Objective" text={day.objective} />
              <GuideRow label="Patient / Skills Safety Focus" text={day.safety} />
              <GuideRow label="Instructor Demonstration" text={day.demonstration} />
              <GuideRow label="Guided Skills Practice" text={day.practice} />
              <GuideRow label="Competency Evidence" text={day.evidence} />

              <div className="resource-box"><div className="eyebrow">Day Resources</div>{day.resources.map((resource) => <div key={resource}>• {resource}</div>)}</div>
              <div className="protected-box"><div className="lock">PROTECTED CURRICULUM</div><strong>Approved outcomes remain locked.</strong><span>Faculty can improve pacing, resources, demonstrations, sequencing, notes, and remediation guidance without silently rewriting approved outcomes.</span></div>
              <div className="checkoff-box">
                <div className="section-title-row"><div><div className="eyebrow">Skills Evidence</div><h3>Competency Validation Snapshot</h3></div><span className="muted">Demo statuses</span></div>
                {Object.entries(checkoffs).map(([skill, value]) => (
                  <div className="checkoff-row" key={skill}><span>{skill}</span><select value={value} onChange={(event) => setCheckoffs((current) => ({ ...current, [skill]: event.target.value as SkillStatus }))}><option>Ready</option><option>Needs Coaching</option><option>Recheck Required</option></select></div>
                ))}
              </div>
            </section>
          </div>
        )}

        {view === 'school' && (
          <div className="stack">
            <section className="panel"><div className="eyebrow">Program Administration</div><h2>Health Sciences · Nursing</h2><p className="lead">Section activity, attendance completion, curriculum control, instructor observations, and skills follow-up in one view.</p>
              <div className="metrics"><Metric label="Active Sections" value="1" /><Metric label="Demo Students" value="8" /><Metric label="Planner Progress" value={`${progress}%`} /><Metric label="Attendance" value={`${recordedCount}/8`} /><Metric label="Absent" value={String(absentCount)} /><Metric label="Skills Follow-up" value={String(coachingCount + recheckCount)} /></div>
              <div className="table"><div className="table-head"><span>Section</span><span>Instructor</span><span>Current Day</span><span>Attendance</span><span>Status</span></div><div className="table-row"><span>NUR 101 · Cohort A</span><span>Demo Nursing Instructor</span><span>Day {currentDay} / 7</span><span>{recordedCount} / 8 recorded</span><span>{started ? 'In Progress' : 'Ready'}</span></div></div>
            </section>
            <section className="panel two-column"><div><div className="eyebrow">Protected Course Outcomes</div><h3>What program leadership approves</h3>{PROTECTED_OUTCOMES.map((outcome, index) => <div className="outcome" key={outcome}><b>OUT-{index + 1}</b><span>{outcome}</span><em>Locked</em></div>)}</div><div><div className="eyebrow">Continuous Improvement</div><h3>What faculty can improve</h3><div className="scope-list"><span>✓ Pacing and lesson sequence</span><span>✓ Demonstration approach</span><span>✓ Skills-lab setup</span><span>✓ Teaching resources</span><span>✓ Faculty notes and coaching prompts</span><span>✓ Suggested remediation / recheck workflow</span><span className="blocked">✕ Approved outcomes cannot be changed from the classroom</span></div></div></section>
          </div>
        )}

        {view === 'quality' && (
          <div className="stack">
            <section className="panel quality-hero"><div><div className="eyebrow">Quality & Evidence</div><h2>Show where learning evidence is being produced.</h2><p className="lead">LTG can connect approved local outcomes to daily instruction, skills evidence, faculty observations, attendance, and improvement records without changing curriculum governance.</p></div><div className="quality-summary"><Metric label="Protected Outcomes" value="4" /><Metric label="Evidence Types" value="4" /><Metric label="Demo Days Mapped" value="7" /></div></section>
            <section className="panel"><div className="eyebrow">Outcome Evidence Matrix</div><h3>Local outcomes connected to observable evidence</h3><div className="quality-table"><div className="quality-head"><span>Outcome</span><span>Evidence Type</span><span>Instructional Days</span><span>Status</span></div>{QUALITY_ROWS.map(([outcome, evidence, days, status]) => <div className="quality-row" key={outcome}><b>{outcome}</b><span>{evidence}</span><span>{days}</span><em>{status}</em></div>)}</div></section>
            <section className="quality-columns">
              <div className="panel"><div className="eyebrow">External Framework Mapping</div><h3>Institution-controlled references</h3><p className="lead">Programs can map approved curriculum to frameworks or regulatory references they are authorized to use.</p><div className="framework-list"><div><strong>AACN Essentials</strong><span>External reference example</span></div><div><strong>ACEN standards</strong><span>External reference example</span></div><div><strong>State Board of Nursing requirements</strong><span>Institution-supplied mapping</span></div><div><strong>Program-specific competencies</strong><span>Local approved outcomes</span></div></div><div className="notice">The demo does not reproduce or claim endorsement by external standards organizations. Institutions control licensed or authorized reference content.</div></div>
              <div className="panel"><div className="eyebrow">Evidence Trail</div><h3>What a reviewer can follow</h3><div className="timeline"><Timeline n="1" title="Approved outcome" detail="Locked at the program level" /><Timeline n="2" title="Daily instruction" detail="Planner shows where the outcome is taught" /><Timeline n="3" title="Student evidence" detail="Attendance, checkoff, rubric, or assessment" /><Timeline n="4" title="Faculty observation" detail="Implementation note or coaching need" /><Timeline n="5" title="Program review" detail="Accepted improvements feed future planning" /></div></div>
            </section>
          </div>
        )}

        {view === 'platform' && (
          <div className="stack">
            <section className="panel hero-proof"><div className="eyebrow">Platform Proof</div><h2>Welding is one implementation. Nursing is another.</h2><p className="lead">The operating model is unchanged: organization, program, course, section, daily planner, protected outcomes, attendance, instructor notes, competency evidence, and reporting.</p><div className="architecture"><span>LTG Platform</span><b>→</b><span>School / Organization</span><b>→</b><span>Department / Program</span><b>→</b><span>Course</span><b>→</b><span>Section</span><b>→</b><span>Daily Instruction</span></div></section>
            <section className="comparison-grid"><div className="panel program-card welding-card"><span className="program-tag">IMPLEMENTATION 01</span><h3>Welding Technology</h3><p>Shop instruction, procedures, fabrication, performance testing, attendance, timekeeping, and daily planner operations.</p><button onClick={() => router.push('/demo')}>Open Welding Demo</button></div><div className="panel program-card nursing-card"><span className="program-tag">IMPLEMENTATION 02</span><h3>Nursing</h3><p>Classroom and skills-lab instruction, competency evidence, checkoffs, attendance, curriculum protection, and program-quality review.</p><button className="solid" onClick={() => setView('instructor')}>Open Nursing Workspace</button></div></section>
            <section className="panel"><div className="eyebrow">Terminology Layer</div><h3>Same platform functions, different instructional language</h3><div className="terminology-table"><div className="term-head"><span>Welding Implementation</span><span>Nursing Implementation</span></div>{TERMINOLOGY.map(([left, right]) => <div className="term-row" key={left}><span>{left}</span><span>{right}</span></div>)}</div></section>
            <section className="panel"><div className="eyebrow">Shared LTG Functions</div><h3>Program-independent capabilities</h3><div className="feature-grid">{['Daily instructor planner','Protected curriculum and outcomes','Student attendance','Instructor notes','Skills / competency evidence','School administrator reporting','Instructor timekeeping','Resource management','Multi-course / multi-section structure','Mobile browser access','Continuous-improvement review','Program analytics'].map((feature) => <div className="feature" key={feature}>{feature}</div>)}</div></section>
          </div>
        )}
      </main>

      <style jsx>{`
        .shell{min-height:100vh;background:#f4f8fa;color:#20313a}.demo-banner{position:sticky;top:0;z-index:30;padding:9px 14px;text-align:center;background:#0e6c88;color:#fff;font-size:10px;font-weight:900;letter-spacing:.08em}header{display:flex;justify-content:space-between;align-items:flex-start;gap:22px;padding:26px 32px;border-bottom:1px solid #d8e4e9;background:#fff}.brand-block{display:flex;gap:15px;align-items:flex-start}.brand-mark{width:52px;height:52px;display:grid;place-items:center;border-radius:14px;background:#0e6c88;color:#fff;font-weight:950;box-shadow:0 8px 18px rgba(14,108,136,.18)}h1,h2,h3{color:#17313c;margin:5px 0}h1{font-size:29px}h2{font-size:22px}h3{font-size:16px}.subtitle,.lead{color:#687b85;max-width:820px;margin:7px 0 0;line-height:1.55;font-size:13px}.eyebrow{color:#0e7898;font-size:10px;text-transform:uppercase;letter-spacing:.12em;font-weight:900}.actions,nav,.controls,.day-nav{display:flex;gap:8px;flex-wrap:wrap}button,select{border:1px solid #c9d9e0;background:#fff;color:#34515e;border-radius:8px;padding:9px 12px;font-weight:800}button{cursor:pointer}button:hover:not(:disabled),button.active{border-color:#0e7898;color:#0e7898;background:#f2fbfe}button.primary{border-color:#16865f;color:#16865f;background:#f2fbf7}button.complete:not(:disabled),button.solid{border-color:#0e6c88;background:#0e6c88;color:#fff}button:disabled{opacity:.42;cursor:not-allowed}main{width:min(1420px,calc(100% - 30px));margin:auto;padding:20px 0 56px}.identity-card{display:grid;grid-template-columns:.85fr 2.15fr;overflow:hidden;border:1px solid #d5e3e8;border-radius:13px;background:#fff;box-shadow:0 10px 28px rgba(44,83,99,.06);margin-bottom:12px}.identity-title{padding:20px;background:linear-gradient(135deg,#0e6c88,#2189a4);color:#fff;display:grid;align-content:center;gap:4px}.identity-title span{font-size:10px;text-transform:uppercase;letter-spacing:.1em;opacity:.75;font-weight:850}.identity-title strong{font-size:19px}.identity-meta{display:grid;grid-template-columns:repeat(4,1fr)}.meta{padding:16px;border-left:1px solid #e3ecef}.meta span,.meta small{display:block}.meta span{color:#84949c;font-size:9px;text-transform:uppercase;font-weight:850}.meta strong{display:block;color:#1f3944;font-size:13px;margin-top:4px}.meta small{color:#71828a;font-size:10px;margin-top:3px}.value-strip{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px}.value-card{padding:13px 15px;background:#fff;border:1px solid #d8e4e9;border-radius:10px}.value-card span,.value-card small{display:block}.value-card span{color:#7f9098;text-transform:uppercase;font-size:9px;font-weight:850}.value-card strong{display:block;color:#17313c;margin-top:3px;font-size:16px}.value-card small{color:#74858d;margin-top:3px}nav{border-bottom:1px solid #d5e2e7;padding-bottom:12px;margin-bottom:16px}.instructor-layout{display:grid;grid-template-columns:minmax(380px,.9fr) minmax(500px,1.1fr);gap:16px}.stack{display:grid;gap:16px}.panel{background:#fff;border:1px solid #d7e4e9;border-radius:12px;padding:20px;box-shadow:0 8px 24px rgba(44,83,99,.06)}.panel-head,.section-title-row{display:flex;justify-content:space-between;align-items:flex-start;gap:14px}.status-pill{border:1px solid #c7d8df;border-radius:999px;padding:7px 10px;color:#71838b;font-size:9px;font-weight:900;background:#f8fbfc}.status-pill.on{border-color:#16865f;color:#16865f;background:#f2fbf7}.metrics{display:grid;grid-template-columns:repeat(6,1fr);gap:8px;margin:16px 0}.metrics.compact{grid-template-columns:repeat(4,1fr)}.metric{background:#f7fafb;border:1px solid #e0eaee;border-radius:9px;padding:11px}.metric span{display:block;color:#7f9098;font-size:9px;text-transform:uppercase;font-weight:850}.metric strong{display:block;color:#17313c;margin-top:4px;font-size:18px}.controls{margin:14px 0}.attendance-gate,.attendance-ready{display:grid;gap:4px;border-radius:9px;padding:12px 14px;margin:8px 0 14px;font-size:11px}.attendance-gate{background:#fff8e9;border:1px solid #ecd9ad;color:#776846}.attendance-ready{background:#effaf5;border:1px solid #bfe1d1;color:#326b55}.attendance-card,.resource-box,.checkoff-box,.protected-box,.saved-note{background:#f8fbfc;border:1px solid #dbe7eb;border-radius:9px;padding:14px;margin-top:14px}.muted{color:#7e8f97;font-size:10px}.attendance-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:10px}.student-row{display:flex;justify-content:space-between;align-items:center;gap:8px;background:#fff;border:1px solid #e0e9ed;border-radius:8px;padding:8px}.student-row strong,.student-row span{display:block}.student-row strong{font-size:12px;color:#29434f}.student-row span{color:#87969d;font-size:9px;margin-top:2px}.student-row select{padding:6px 8px;font-size:10px}label{display:grid;gap:7px;margin-top:14px;color:#74868e;font-size:10px;font-weight:850;text-transform:uppercase}textarea{min-height:96px;resize:vertical;background:#fff;color:#28414d;border:1px solid #cadbe2;border-radius:8px;padding:11px;font:inherit}.saved-note{display:grid;gap:4px}.saved-note strong{color:#0e7898;font-size:10px;text-transform:uppercase}.saved-note span{color:#61747d;font-size:12px;line-height:1.5}.day-nav{margin:10px 0 14px}.day-nav button{padding:7px 9px;font-size:10px}.guide-row{display:grid;gap:5px;padding:12px 0;border-bottom:1px solid #e5edef}.guide-row strong{color:#0e7898;font-size:9px;text-transform:uppercase;letter-spacing:.09em}.guide-row span{color:#50646d;line-height:1.55;font-size:12px}.resource-box{color:#536973;font-size:11px;line-height:1.65;border-color:#c9e2eb;background:#f3fbfe}.protected-box{display:grid;gap:5px;border-color:#ead4a9;background:#fffaf0}.protected-box .lock{color:#a96714;font-size:9px;font-weight:900}.protected-box span{color:#75694f;font-size:11px;line-height:1.5}.checkoff-row{display:grid;grid-template-columns:1fr 170px;gap:9px;align-items:center;padding:8px 0;border-bottom:1px solid #e4edef;font-size:11px}.table{border:1px solid #d9e5e9;border-radius:9px;overflow:hidden;margin-top:16px}.table-head,.table-row{display:grid;grid-template-columns:1.5fr 1fr .8fr 1fr .8fr;gap:10px;padding:11px 12px}.table-head{background:#f4f8fa;color:#7f9098;font-size:9px;text-transform:uppercase;font-weight:850}.table-row{border-top:1px solid #dfe9ed;color:#52666f;font-size:11px}.two-column{display:grid;grid-template-columns:1.25fr .75fr;gap:22px}.outcome{display:grid;grid-template-columns:56px 1fr 52px;gap:10px;align-items:start;padding:10px 0;border-bottom:1px solid #e5edef}.outcome b{color:#0e7898;font-size:9px}.outcome span{color:#50636d;font-size:11px;line-height:1.45}.outcome em{color:#a96714;font-size:9px;font-style:normal;text-transform:uppercase;font-weight:850}.scope-list{display:grid;gap:9px;margin-top:12px;color:#50636d;font-size:11px}.scope-list .blocked{color:#a64949}.quality-hero{display:flex;justify-content:space-between;align-items:flex-start;gap:22px;background:linear-gradient(120deg,#fff,#f1fbfe)}.quality-summary{display:grid;grid-template-columns:repeat(3,145px);gap:8px}.quality-columns{display:grid;grid-template-columns:1fr 1fr;gap:16px}.quality-table{border:1px solid #d9e5e9;border-radius:9px;overflow:hidden;margin-top:14px}.quality-head,.quality-row{display:grid;grid-template-columns:.6fr 1.2fr 1fr .8fr;gap:10px;padding:11px 12px}.quality-head{background:#f4f8fa;color:#7d8e96;font-size:9px;text-transform:uppercase;font-weight:850}.quality-row{border-top:1px solid #e1e9ed;font-size:11px;color:#50636d}.quality-row b{color:#0e7898}.quality-row em{font-style:normal;color:#16865f;font-weight:800}.framework-list{display:grid;gap:8px;margin-top:14px}.framework-list div{display:flex;justify-content:space-between;gap:12px;border:1px solid #dce7eb;border-radius:8px;padding:10px;background:#f8fbfc}.framework-list strong{color:#28434f;font-size:11px}.framework-list span{color:#819098;font-size:10px;text-align:right}.notice{margin-top:12px;padding:11px;border-radius:8px;background:#fff8e9;border:1px solid #ecd9ad;color:#776846;font-size:10px;line-height:1.5}.timeline{display:grid;gap:9px;margin-top:14px}.timeline-item{display:grid;grid-template-columns:30px 1fr;gap:10px;align-items:center}.timeline-item b{width:30px;height:30px;display:grid;place-items:center;border-radius:50%;background:#e8f6fa;color:#0e7898}.timeline-item strong,.timeline-item small{display:block}.timeline-item strong{color:#29434f;font-size:11px}.timeline-item small{color:#829199;margin-top:2px}.hero-proof{background:linear-gradient(120deg,#fff,#eef9fc)}.architecture{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:18px}.architecture span{border:1px solid #c9dfe7;background:#fff;border-radius:8px;padding:9px 11px;color:#33545f;font-size:10px;font-weight:800}.architecture b{color:#8da1aa}.comparison-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.program-card{min-height:190px;display:grid;align-content:start;gap:7px}.program-card p{color:#687b85;line-height:1.55;font-size:12px}.program-tag{font-size:9px;font-weight:900;color:#7f9098}.welding-card{border-top:4px solid #38444a}.nursing-card{border-top:4px solid #0e7898}.terminology-table{margin-top:12px;border:1px solid #d8e5e9;border-radius:9px;overflow:hidden}.term-head,.term-row{display:grid;grid-template-columns:1fr 1fr}.term-head span,.term-row span{padding:10px 12px}.term-head span{background:#f4f8fa;color:#7d8f97;font-size:9px;text-transform:uppercase;font-weight:850}.term-row{border-top:1px solid #e0e9ed}.term-row span{color:#52666f;font-size:11px}.feature-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:12px}.feature{border:1px solid #dbe6ea;border-radius:8px;background:#f8fbfc;padding:11px;color:#52666f;font-size:11px}@media(max-width:1050px){.identity-card{grid-template-columns:1fr}.identity-meta{grid-template-columns:1fr 1fr}.instructor-layout,.two-column,.quality-columns{grid-template-columns:1fr}.metrics,.metrics.compact{grid-template-columns:repeat(3,1fr)}.feature-grid{grid-template-columns:1fr 1fr}.quality-hero{display:grid}}@media(max-width:720px){header{flex-direction:column;padding:20px 16px}.brand-mark{width:44px;height:44px}h1{font-size:24px}main{width:min(100% - 18px,1420px)}.identity-meta,.value-strip,.attendance-grid,.metrics,.metrics.compact,.feature-grid,.comparison-grid,.quality-summary{grid-template-columns:1fr}.table-head,.quality-head{display:none}.table-row,.quality-row{grid-template-columns:1fr}.checkoff-row{grid-template-columns:1fr}}
      `}</style>
    </div>
  );
}

function GuideRow({ label, text }: { label: string; text: string }) { return <div className="guide-row"><strong>{label}</strong><span>{text}</span></div>; }
function Metric({ label, value }: { label: string; value: string }) { return <div className="metric"><span>{label}</span><strong>{value}</strong></div>; }
function ValueCard({ label, value, detail }: { label: string; value: string; detail: string }) { return <div className="value-card"><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>; }
function Meta({ label, value, detail }: { label: string; value: string; detail: string }) { return <div className="meta"><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>; }
function StatusPill({ label, active }: { label: string; active?: boolean }) { return <div className={`status-pill ${active ? 'on' : ''}`}>{label}</div>; }
function Timeline({ n, title, detail }: { n: string; title: string; detail: string }) { return <div className="timeline-item"><b>{n}</b><span><strong>{title}</strong><small>{detail}</small></span></div>; }
