'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type AttendanceStatus = 'Present' | 'Late' | 'Absent' | 'Not recorded';
type EvidenceStatus = 'Not started' | 'Practice logged' | 'Ready for faculty review' | 'Demo complete';
type View = 'instructor' | 'clinical' | 'program' | 'proof';

type DemoDay = {
  day: number;
  course: string;
  title: string;
  objective: string;
  safety: string;
  instructor: string;
  learner: string;
  evidence: string;
  resources: string[];
};

const DEMO_DAYS: DemoDay[] = [
  {
    day: 1,
    course: 'RA 101',
    title: 'Program Orientation & Professional Practice',
    objective: 'Introduce the LTG daily workflow using Radiography program expectations, professional communication, privacy, and department-approved safety practices.',
    safety: 'Use only approved department procedures and simulation materials. No real patient information or clinical decision-making is part of this demonstration.',
    instructor: 'Review the course workflow, explain protected curriculum versus implementation notes, and model how faculty evidence is recorded without changing approved outcomes.',
    learner: 'Complete a synthetic orientation scenario and identify where faculty guidance, safety stops, and documentation belong in the workflow.',
    evidence: 'Attendance, orientation acknowledgement, instructor observation, and implementation note.',
    resources: ['Program orientation card', 'Professional conduct prompt', 'Synthetic documentation example', 'Department review checklist'],
  },
  {
    day: 2,
    course: 'RA 101',
    title: 'Radiation Protection & Safety Habits',
    objective: 'Reinforce radiation-protection concepts and the expectation that learners follow approved faculty and clinical-site procedures before proceeding.',
    safety: 'This demo does not prescribe exposure factors or patient-specific technique. All clinical technique remains governed by faculty, program policy, and clinical-site protocol.',
    instructor: 'Use an approved safety scenario to demonstrate where the instructor records observation, coaching, and recheck needs inside LTG.',
    learner: 'Work through synthetic safety scenarios and identify when the correct action is to pause, verify, or escalate to faculty.',
    evidence: 'Radiation-safety observation status and faculty coaching note.',
    resources: ['Radiation protection scenario', 'Safety-stop checklist', 'Faculty observation rubric', 'Student reflection prompt'],
  },
  {
    day: 3,
    course: 'RA 101',
    title: 'Patient Care, Identification & Body Mechanics',
    objective: 'Practice a repeatable simulated workflow for patient identification, communication, movement preparation, privacy, and basic care expectations.',
    safety: 'Use simulation only. Actual patient handling remains subject to approved program policy and clinical supervision.',
    instructor: 'Model a synthetic patient-preparation sequence and show how LTG captures readiness, coaching, and follow-up evidence.',
    learner: 'Complete the simulated sequence, communicate each verification step, and document the fictional encounter using the demo form.',
    evidence: 'Patient-care workflow status, communication note, and follow-up flag when needed.',
    resources: ['Synthetic patient card', 'Communication checklist', 'Body-mechanics review card', 'Demo documentation form'],
  },
  {
    day: 4,
    course: 'RA 102',
    title: 'Positioning Lab Workflow: Thorax & Abdomen',
    objective: 'Show how LTG supports faculty-guided positioning lab instruction, practice tracking, and image-critique preparation without replacing approved positioning instruction.',
    safety: 'Faculty-approved positioning and equipment procedures control the lab. The demo intentionally omits procedural exposure settings and patient-specific technique.',
    instructor: 'Launch the positioning lab sequence, reference the approved course material, and record observed readiness or coaching needs.',
    learner: 'Complete the assigned simulation or lab preparation steps and submit the required evidence identified by faculty.',
    evidence: 'Practice logged, faculty observation status, and critique-preparation evidence.',
    resources: ['Approved positioning reference placeholder', 'Lab preparation checklist', 'Image critique prompt', 'Faculty coaching note'],
  },
  {
    day: 5,
    course: 'RA 102',
    title: 'Extremity Positioning & Image Critique',
    objective: 'Demonstrate how positioning practice, critique discussion, and faculty feedback can be connected to the same learner progress record.',
    safety: 'All positioning performance is faculty supervised and evaluated against department-approved criteria, not this demo page.',
    instructor: 'Facilitate the approved lab activity and use LTG to record whether more practice, faculty review, or completion evidence is needed.',
    learner: 'Complete assigned simulated positioning practice and participate in a structured image-critique discussion.',
    evidence: 'Positioning practice status plus critique participation and instructor note.',
    resources: ['Positioning practice tracker', 'Critique discussion guide', 'Faculty review rubric placeholder', 'Recheck plan'],
  },
  {
    day: 6,
    course: 'RA 103',
    title: 'Clinical Practice Evidence & Faculty Review',
    objective: 'Connect clinical-practicum evidence to the instructor and program view while preserving the distinction between practice and formal competency validation.',
    safety: 'No real patient data is entered. Clinical competency decisions remain with authorized program faculty and clinical evaluators.',
    instructor: 'Review synthetic practice evidence and show how a learner can move from practice logged to ready for faculty review without LTG self-certifying competency.',
    learner: 'Review the synthetic clinical record, identify missing evidence, and prepare questions for faculty review.',
    evidence: 'Practice record, faculty review status, and documented next step.',
    resources: ['Synthetic clinical log', 'Faculty review queue', 'Practice-to-review workflow', 'Clinical note template'],
  },
  {
    day: 7,
    course: 'RA 101 / 102 / 103',
    title: 'Integrated Progress Review',
    objective: 'Demonstrate program-level visibility across classroom, lab, attendance, practice evidence, clinical review, and instructor notes.',
    safety: 'The review summarizes evidence only. It does not replace faculty judgment, clinical evaluation, or approved competency requirements.',
    instructor: 'Review attendance, lab evidence, clinical readiness, coaching needs, and implementation notes before determining the learner next step.',
    learner: 'Review personal progress and faculty feedback using synthetic data, then acknowledge the assigned next step.',
    evidence: 'Integrated progress snapshot and program-administration review.',
    resources: ['Progress review dashboard', 'Evidence summary', 'Faculty follow-up queue', 'Program review note'],
  },
];

const STUDENTS = Array.from({ length: 8 }, (_, index) => ({
  id: `RAD-DEMO-${String(index + 1).padStart(2, '0')}`,
  name: `Student ${String(index + 1).padStart(2, '0')}`,
}));

const EMPTY_ATTENDANCE = () => Object.fromEntries(
  STUDENTS.map((student) => [student.id, 'Not recorded'])
) as Record<string, AttendanceStatus>;

const INITIAL_EVIDENCE: Record<string, EvidenceStatus> = {
  'Radiation protection / safety habits': 'Practice logged',
  'Patient identification / communication': 'Ready for faculty review',
  'Positioning preparation / equipment readiness': 'Practice logged',
  'Clinical practice documentation': 'Not started',
  'Image critique participation': 'Not started',
};

const COURSE_MAP = [
  {
    code: 'RA 101',
    title: 'Introduction to Radiologic Science',
    environment: 'Classroom + Lab',
    demoUse: 'Orientation, radiation protection, patient care, professional practice, terminology, and foundational lab workflow.',
  },
  {
    code: 'RA 102',
    title: 'Principles of Radiologic Science I',
    environment: 'Classroom + Lab',
    demoUse: 'Faculty-guided positioning practice, procedure preparation, practice evidence, and image-critique workflow.',
  },
  {
    code: 'RA 103',
    title: 'Radiologic Practicum and Film Critique Seminar I',
    environment: 'Clinical Practicum',
    demoUse: 'Clinical practice evidence, faculty review readiness, attendance, notes, and progress visibility.',
  },
];

const DEMO_OUTCOMES = [
  'Apply approved radiation-protection and patient-safety expectations during classroom, lab, and clinical learning.',
  'Demonstrate professional communication, patient-care preparation, and appropriate escalation to faculty or clinical supervision.',
  'Build positioning and equipment-readiness evidence through supervised practice without LTG replacing faculty competency decisions.',
  'Connect attendance, practice evidence, clinical review status, critique participation, and instructor notes in one progress record.',
];

const SOURCE_MAP = [
  ['PCCC Radiography program page', 'Two-phase A.A.S.; every Phase 2 semester includes clinical education', 'Program structure'],
  ['RA 101 public course description', 'Introduction, radiation protection, patient care, professional practice, lab', 'Days 1–3'],
  ['RA 102 public course description', 'Radiographic examinations with faculty-guided lab practice', 'Days 4–5'],
  ['RA 103 public course description', 'Supervised clinical application and critique seminar', 'Days 6–7'],
  ['PCCC public clinical competency materials', 'Practice, faculty evaluation, radiation protection, positioning, patient care', 'Clinical Evidence view'],
];

const TERMINOLOGY = [
  ['Shop / lab', 'Radiography lab / clinical setting'],
  ['Performance test', 'Faculty review / clinical competency evaluation'],
  ['Fabrication task', 'Positioning practice / clinical learning activity'],
  ['Job card evidence', 'Practice / clinical evidence record'],
  ['Safety gate', 'Radiation / patient-safety stop and faculty escalation'],
  ['Rework / retest', 'Additional practice / coaching / faculty re-evaluation'],
];

export default function RadiographyDemoPage() {
  const router = useRouter();
  const [view, setView] = useState<View>('instructor');
  const [viewingDay, setViewingDay] = useState(1);
  const [currentDay, setCurrentDay] = useState(1);
  const [started, setStarted] = useState(false);
  const [completedDays, setCompletedDays] = useState<number[]>([]);
  const [note, setNote] = useState('');
  const [savedNote, setSavedNote] = useState('');
  const [attendance, setAttendance] = useState<Record<string, AttendanceStatus>>(EMPTY_ATTENDANCE);
  const [evidence, setEvidence] = useState<Record<string, EvidenceStatus>>({ ...INITIAL_EVIDENCE });

  const day = DEMO_DAYS.find((item) => item.day === viewingDay) ?? DEMO_DAYS[0];
  const recordedCount = Object.values(attendance).filter((status) => status !== 'Not recorded').length;
  const presentCount = Object.values(attendance).filter((status) => status === 'Present' || status === 'Late').length;
  const reviewReadyCount = Object.values(evidence).filter((status) => status === 'Ready for faculty review').length;
  const practiceCount = Object.values(evidence).filter((status) => status === 'Practice logged').length;
  const attendanceComplete = recordedCount === STUDENTS.length;
  const progress = useMemo(() => Math.round((completedDays.length / DEMO_DAYS.length) * 100), [completedDays]);

  const markAllPresent = () => setAttendance(
    Object.fromEntries(STUDENTS.map((student) => [student.id, 'Present'])) as Record<string, AttendanceStatus>
  );

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
    setEvidence({ ...INITIAL_EVIDENCE });
  };

  return (
    <div className="shell">
      <div className="demo-banner">RADIOGRAPHY DEMONSTRATION · SYNTHETIC DATA ONLY · DEPARTMENT REVIEW REQUIRED BEFORE CURRICULUM USE</div>

      <header>
        <div className="brand-block">
          <div className="brand-mark">LTG</div>
          <div>
            <div className="eyebrow">Education Operating System · Radiography Demo</div>
            <h1>Radiography Program Demonstration</h1>
            <p className="subtitle">A PCCC-aligned proof of how LTG can connect classroom, lab, clinical evidence, attendance, faculty review, and program oversight.</p>
          </div>
        </div>
        <div className="actions">
          <button onClick={() => router.push('/demo/programs')}>Program Demos</button>
          <button onClick={() => router.push('/demo')}>Welding Demo</button>
          <button onClick={() => router.push('/demo/nursing')}>Nursing Demo</button>
          <button onClick={resetDemo}>Reset Radiography Demo</button>
          <button className="solid" onClick={() => router.push('/login')}>Live Login</button>
        </div>
      </header>

      <main>
        <section className="identity-card">
          <div className="identity-title"><span>LTG Demonstration Institute</span><strong>Health Sciences · Radiography</strong></div>
          <div className="identity-meta">
            <Meta label="Proof Set" value="RA 101 / 102 / 103" detail="Classroom + lab + clinical" />
            <Meta label="Section" value="Phase 2 Demo Cohort" detail="8 synthetic learners" />
            <Meta label="Environment" value="Lab + Clinical" detail="No real patient data" />
            <Meta label="Curriculum" value="Protected" detail="Department verification required" />
          </div>
        </section>

        <section className="value-strip">
          <ValueCard label="Daily instruction" value="7 demo days" detail="Planner + faculty guidance" />
          <ValueCard label="Clinical evidence" value={`${practiceCount + reviewReadyCount} active`} detail="Practice and faculty-review visibility" />
          <ValueCard label="Attendance" value={`${recordedCount} / 8 recorded`} detail={attendanceComplete ? 'Ready to confirm' : 'Required before day completion'} />
          <ValueCard label="Curriculum control" value="Faculty governed" detail="LTG tracks evidence, not clinical judgment" />
        </section>

        <nav>
          <button className={view === 'instructor' ? 'active' : ''} onClick={() => setView('instructor')}>Instructor Workspace</button>
          <button className={view === 'clinical' ? 'active' : ''} onClick={() => setView('clinical')}>Clinical Evidence</button>
          <button className={view === 'program' ? 'active' : ''} onClick={() => setView('program')}>Program Administration</button>
          <button className={view === 'proof' ? 'active' : ''} onClick={() => setView('proof')}>Platform Proof</button>
        </nav>

        {view === 'instructor' && (
          <div className="two-column">
            <section className="panel">
              <div className="panel-head">
                <div><div className="eyebrow">Current Teaching Section</div><h2>Radiography · Phase 2 Demo Cohort</h2></div>
                <StatusPill label={started ? 'DAY IN PROGRESS' : completedDays.includes(currentDay) ? 'COMPLETED' : 'READY'} active={started} />
              </div>

              <div className="metrics">
                <Metric label="Current Day" value={`${currentDay} / ${DEMO_DAYS.length}`} />
                <Metric label="Attendance" value={`${recordedCount} / ${STUDENTS.length}`} />
                <Metric label="Present / Late" value={String(presentCount)} />
                <Metric label="Faculty Review Ready" value={String(reviewReadyCount)} />
              </div>

              <div className="controls">
                <button className="primary" disabled={started} onClick={() => { setViewingDay(currentDay); setStarted(true); }}>Start Today</button>
                <button className="complete" disabled={!started || !attendanceComplete} onClick={completeDay}>Complete Day</button>
                <button onClick={markAllPresent}>Demo: Mark All Present</button>
              </div>

              {started && !attendanceComplete && (
                <div className="gate warning"><strong>Attendance confirmation required</strong><span>Record a status for all 8 synthetic learners before completing the instructional day.</span></div>
              )}
              {started && attendanceComplete && (
                <div className="gate ready"><strong>Attendance complete</strong><span>The instructional day can now be completed.</span></div>
              )}

              <div className="attendance-card">
                <div className="section-title-row"><div><div className="eyebrow">Student Attendance</div><h3>Synthetic Roster</h3></div><span className="muted">No real student or patient data</span></div>
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

              <label>Faculty implementation note
                <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Example: Learners needed more guided practice before faculty review. Add a visual preparation card next cycle." />
              </label>
              {savedNote && <div className="saved-note"><strong>Saved simulated note</strong><span>{savedNote}</span></div>}
            </section>

            <section className="panel">
              <div className="eyebrow">Living Teacher Guide</div>
              <div className="day-nav">{DEMO_DAYS.map((item) => <button key={item.day} className={viewingDay === item.day ? 'active' : ''} onClick={() => setViewingDay(item.day)}>Day {item.day}</button>)}</div>
              <div className="course-tag">{day.course}</div>
              <h2>Day {day.day}: {day.title}</h2>
              <GuideRow label="Learning Objective" text={day.objective} />
              <GuideRow label="Safety / Clinical Boundary" text={day.safety} />
              <GuideRow label="Faculty Demonstration / Guidance" text={day.instructor} />
              <GuideRow label="Learner Activity" text={day.learner} />
              <GuideRow label="Evidence Captured" text={day.evidence} />

              <div className="resource-box"><div className="eyebrow">Day Resources</div>{day.resources.map((resource) => <div key={resource}>• {resource}</div>)}</div>
              <div className="protected-box"><div className="lock">PROTECTED CURRICULUM</div><strong>LTG does not self-authorize clinical practice.</strong><span>Faculty can improve pacing, resources, notes, sequencing, and coaching workflow. Approved course outcomes, clinical requirements, and competency decisions remain under department control.</span></div>
            </section>
          </div>
        )}

        {view === 'clinical' && (
          <section className="panel">
            <div className="panel-head">
              <div><div className="eyebrow">Clinical Evidence</div><h2>Practice → Faculty Review → Program Record</h2></div>
              <StatusPill label="SYNTHETIC EVIDENCE" active />
            </div>
            <p className="intro">This view demonstrates how LTG can organize clinical-practice evidence without declaring a learner clinically competent on its own. Authorized faculty and clinical evaluators remain the decision-makers.</p>

            <div className="evidence-grid">
              {Object.entries(evidence).map(([label, status]) => (
                <div className="evidence-card" key={label}>
                  <strong>{label}</strong>
                  <select value={status} onChange={(event) => setEvidence((current) => ({ ...current, [label]: event.target.value as EvidenceStatus }))}>
                    <option>Not started</option>
                    <option>Practice logged</option>
                    <option>Ready for faculty review</option>
                    <option>Demo complete</option>
                  </select>
                  <span>{status === 'Ready for faculty review' ? 'Faculty action required before any formal competency record.' : 'Synthetic demonstration status only.'}</span>
                </div>
              ))}
            </div>

            <div className="clinical-flow">
              <FlowStep number="01" title="Practice Logged" detail="Learner activity and supporting evidence are recorded." />
              <FlowStep number="02" title="Faculty Review" detail="Authorized faculty evaluates the evidence using approved criteria." />
              <FlowStep number="03" title="Competency Record" detail="Only the approved evaluator records the official result." />
              <FlowStep number="04" title="Program Visibility" detail="Administration can see completion, follow-up, and trends without exposing unnecessary patient information." />
            </div>

            <div className="notice"><strong>Clinical-data boundary</strong><span>The demo intentionally uses no real patient identifiers, images, diagnoses, exposure settings, or protected health information.</span></div>
          </section>
        )}

        {view === 'program' && (
          <section className="panel">
            <div className="panel-head"><div><div className="eyebrow">Program Administration</div><h2>Radiography Proof Set</h2></div><span className="progress-label">Demo progress {progress}%</span></div>
            <div className="course-grid">
              {COURSE_MAP.map((course) => (
                <article key={course.code}>
                  <div className="course-code">{course.code}</div>
                  <h3>{course.title}</h3>
                  <span>{course.environment}</span>
                  <p>{course.demoUse}</p>
                </article>
              ))}
            </div>

            <div className="subpanel">
              <div className="eyebrow">Demo Protected Outcomes · Department Verification Required</div>
              {DEMO_OUTCOMES.map((outcome, index) => <div className="outcome-row" key={outcome}><strong>OUT-{index + 1}</strong><span>{outcome}</span><b>LOCKED IN DEMO</b></div>)}
            </div>

            <div className="subpanel">
              <div className="eyebrow">Source-to-Demo Map</div>
              <div className="source-table">
                {SOURCE_MAP.map(([source, basis, use]) => <div key={source}><strong>{source}</strong><span>{basis}</span><b>{use}</b></div>)}
              </div>
            </div>
          </section>
        )}

        {view === 'proof' && (
          <section className="panel">
            <div className="panel-head"><div><div className="eyebrow">Platform Proof</div><h2>Same LTG engine. Different instructional language.</h2></div><StatusPill label="PROGRAM-NEUTRAL" active /></div>
            <p className="intro">The Radiography demo changes the terminology, evidence model, instructional environment, and reporting context. The underlying LTG operating model stays the same.</p>

            <div className="translation-grid">
              {TERMINOLOGY.map(([from, to]) => <div key={from}><span>{from}</span><b>→</b><strong>{to}</strong></div>)}
            </div>

            <div className="proof-grid">
              <ProofCard title="Living Teacher Guide" text="Daily faculty guidance, resources, pacing, notes, and protected outcomes." />
              <ProofCard title="Attendance" text="Classroom, lab, or clinical attendance can feed the same history and reporting model." />
              <ProofCard title="Evidence" text="Practice evidence and faculty-review status stay visible without LTG substituting for clinical judgment." />
              <ProofCard title="Administration" text="Program leaders can review progress, follow-up needs, and implementation notes across courses." />
              <ProofCard title="Quality" text="Source mapping makes it clear what is approved, what is demonstration content, and what requires formal review." />
              <ProofCard title="Scale" text="The same multi-school and role-based platform can support another department without welding-specific assumptions." />
            </div>

            <div className="notice"><strong>Why Radiography is a strong proof case</strong><span>It forces LTG to support classroom instruction, skills lab, clinical practice, evidence review, attendance, safety boundaries, and program oversight in one department.</span></div>
          </section>
        )}
      </main>

      <style jsx>{`
        .shell { min-height:100vh; background:#eef4f7; color:#243b46; }
        .demo-banner { background:#173f59; color:#e7f6ff; padding:8px 16px; text-align:center; font-size:9px; font-weight:900; letter-spacing:.11em; }
        header { display:flex; justify-content:space-between; gap:24px; align-items:center; padding:26px max(22px,calc((100vw - 1260px)/2)); background:white; border-bottom:1px solid #d7e3e9; }
        .brand-block { display:flex; align-items:center; gap:14px; } .brand-mark { width:58px; height:58px; border-radius:14px; display:grid; place-items:center; background:#102a3b; color:white; font-weight:950; letter-spacing:.05em; }
        .eyebrow { color:#28789b; font-size:9px; font-weight:950; letter-spacing:.12em; text-transform:uppercase; } h1,h2,h3,p { margin-top:0; } h1 { margin:4px 0; font-size:28px; color:#17384b; } .subtitle { color:#6c8089; font-size:12px; margin-bottom:0; }
        .actions { display:flex; flex-wrap:wrap; justify-content:flex-end; gap:7px; } button,select,textarea { font:inherit; } button { border:1px solid #c9d8df; background:white; color:#31515f; border-radius:7px; padding:9px 11px; font-size:10px; font-weight:850; cursor:pointer; } button:hover { border-color:#4c98b8; } button:disabled { opacity:.45; cursor:not-allowed; } button.solid,.primary { background:#176d94; color:white; border-color:#176d94; } .complete { background:#225f4f; color:white; border-color:#225f4f; }
        main { width:min(1260px,calc(100% - 30px)); margin:auto; padding:22px 0 60px; }
        .identity-card,.value-strip,.panel,nav { background:white; border:1px solid #d7e4e9; box-shadow:0 10px 25px rgba(37,72,89,.06); }
        .identity-card { border-radius:12px; padding:18px 20px; display:flex; justify-content:space-between; gap:24px; align-items:center; } .identity-title span { display:block; color:#79909b; font-size:10px; } .identity-title strong { color:#183a4c; font-size:17px; }
        .identity-meta { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; flex:1; max-width:820px; }
        .meta { border-left:2px solid #2a86ab; padding-left:10px; } .meta span,.meta small { display:block; } .meta span { color:#80929a; font-size:8px; text-transform:uppercase; font-weight:850; letter-spacing:.06em; } .meta strong { display:block; color:#274653; font-size:11px; margin:2px 0; } .meta small { color:#8da0a8; font-size:8px; }
        .value-strip { margin-top:12px; border-radius:12px; padding:14px; display:grid; grid-template-columns:repeat(4,1fr); gap:10px; } .value-card { background:#f7fafb; border:1px solid #e0eaee; border-radius:8px; padding:12px; } .value-card span,.value-card small { display:block; } .value-card span { color:#78909b; text-transform:uppercase; font-size:8px; font-weight:900; } .value-card strong { display:block; color:#193b4b; margin:4px 0; font-size:16px; } .value-card small { color:#83959d; font-size:9px; line-height:1.4; }
        nav { margin:12px 0; padding:7px; border-radius:10px; display:flex; gap:6px; } nav button { flex:1; } nav button.active { background:#173f59; color:white; border-color:#173f59; }
        .two-column { display:grid; grid-template-columns:1fr 1fr; gap:14px; } .panel { border-radius:12px; padding:20px; } .panel-head { display:flex; justify-content:space-between; gap:18px; align-items:start; margin-bottom:14px; } .panel h2 { color:#183b4d; font-size:20px; margin:4px 0; } .panel h3 { color:#284b59; margin:4px 0; }
        .status-pill { padding:7px 9px; border-radius:999px; font-size:8px; font-weight:900; border:1px solid #cfdce1; color:#70848d; white-space:nowrap; } .status-pill.active { border-color:#2d8db4; color:#166588; background:#edf8fc; }
        .metrics { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; margin:12px 0; } .metric { border:1px solid #e0e9ed; background:#f8fafb; border-radius:7px; padding:10px; } .metric span { display:block; font-size:8px; color:#84969e; text-transform:uppercase; font-weight:850; } .metric strong { display:block; font-size:16px; color:#214656; margin-top:3px; }
        .controls { display:flex; flex-wrap:wrap; gap:7px; margin-bottom:12px; } .gate { display:flex; flex-direction:column; gap:3px; border-radius:8px; padding:10px 12px; margin:10px 0; font-size:10px; } .gate.warning { background:#fff8e8; border:1px solid #ecd59b; color:#7c622a; } .gate.ready { background:#eef8f2; border:1px solid #c8e1d1; color:#35634b; }
        .attendance-card { border:1px solid #dfe9ed; border-radius:9px; padding:12px; margin-top:12px; } .section-title-row { display:flex; justify-content:space-between; gap:14px; align-items:center; } .muted { font-size:8px; color:#8da0a8; } .attendance-grid { display:grid; grid-template-columns:1fr 1fr; gap:7px; margin-top:10px; } .student-row { display:flex; align-items:center; justify-content:space-between; gap:8px; padding:8px; border-radius:6px; background:#f7fafb; border:1px solid #e5ecef; } .student-row strong,.student-row span { display:block; } .student-row strong { font-size:9px; } .student-row span { font-size:8px; color:#92a1a7; } select { border:1px solid #cfdde3; border-radius:6px; background:white; color:#3e5c68; padding:6px; font-size:9px; }
        label { display:block; margin-top:12px; font-size:9px; font-weight:900; color:#4a6671; } textarea { margin-top:5px; width:100%; min-height:82px; resize:vertical; border:1px solid #cedde3; border-radius:7px; padding:9px; color:#304d59; } .saved-note { margin-top:9px; border-left:3px solid #3f93b6; background:#f1f8fb; padding:9px 11px; font-size:9px; } .saved-note strong,.saved-note span { display:block; }
        .day-nav { display:flex; gap:5px; flex-wrap:wrap; margin:9px 0 12px; } .day-nav button { padding:6px 8px; } .day-nav button.active { color:white; background:#1b7196; border-color:#1b7196; } .course-tag { display:inline-block; background:#e9f5fa; border:1px solid #c8e3ee; color:#17698d; border-radius:999px; padding:5px 8px; font-size:8px; font-weight:900; margin-bottom:5px; }
        .guide-row { border-top:1px solid #e4ecef; padding:11px 0; } .guide-row strong { display:block; color:#476772; font-size:9px; text-transform:uppercase; letter-spacing:.05em; } .guide-row p { color:#627982; font-size:10px; line-height:1.55; margin:4px 0 0; }
        .resource-box,.protected-box,.notice,.subpanel { margin-top:14px; border-radius:9px; padding:13px; } .resource-box { background:#f5fafc; border:1px solid #dcebef; font-size:10px; line-height:1.7; color:#506c77; } .protected-box { background:#eef4f7; border:1px solid #d2e0e6; display:flex; flex-direction:column; gap:4px; } .protected-box .lock { color:#816327; font-size:8px; font-weight:950; letter-spacing:.08em; } .protected-box strong { color:#294d5c; } .protected-box span { color:#617981; font-size:9px; line-height:1.5; }
        .intro { color:#617780; font-size:11px; line-height:1.65; max-width:900px; } .evidence-grid { display:grid; grid-template-columns:repeat(5,1fr); gap:10px; margin:15px 0; } .evidence-card { border:1px solid #dbe7eb; background:#f8fbfc; border-radius:9px; padding:12px; display:grid; gap:9px; } .evidence-card strong { color:#294d5c; font-size:10px; } .evidence-card span { color:#7c9098; font-size:8px; line-height:1.5; }
        .clinical-flow { display:grid; grid-template-columns:repeat(4,1fr); gap:9px; } .flow-step { border-top:3px solid #2d83a6; background:white; border-radius:7px; padding:12px; box-shadow:0 6px 16px rgba(37,72,89,.07); } .flow-step b { color:#4c91ad; font-size:10px; } .flow-step strong { display:block; color:#244856; margin:5px 0; } .flow-step span { color:#748991; font-size:9px; line-height:1.5; }
        .notice { display:flex; gap:14px; align-items:start; background:#fff9ea; border:1px solid #ead9a8; color:#705d31; font-size:10px; } .notice strong { min-width:155px; }
        .progress-label { color:#3f7d97; font-weight:900; font-size:10px; } .course-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:11px; } .course-grid article { border:1px solid #dbe6ea; background:#f9fbfc; border-radius:10px; padding:15px; } .course-code { color:#1d7194; font-weight:950; font-size:10px; } .course-grid h3 { font-size:14px; margin:5px 0 2px; } .course-grid article > span { font-size:8px; text-transform:uppercase; color:#84979f; font-weight:850; } .course-grid p { color:#6c8189; font-size:9px; line-height:1.6; margin:9px 0 0; }
        .subpanel { border:1px solid #dce7eb; background:#f9fbfc; } .outcome-row { display:grid; grid-template-columns:70px 1fr 115px; gap:10px; align-items:center; padding:9px 0; border-top:1px solid #e4ecef; font-size:9px; } .outcome-row strong { color:#256c89; } .outcome-row span { color:#607983; } .outcome-row b { color:#647b45; font-size:8px; }
        .source-table > div { display:grid; grid-template-columns:220px 1fr 170px; gap:12px; padding:9px 0; border-top:1px solid #e4ecef; align-items:center; font-size:9px; } .source-table strong { color:#294d5c; } .source-table span { color:#687e87; } .source-table b { color:#26738f; }
        .translation-grid { display:grid; grid-template-columns:1fr 1fr; gap:9px; margin:15px 0; } .translation-grid > div { display:grid; grid-template-columns:1fr 30px 1.5fr; align-items:center; padding:11px; border-radius:8px; border:1px solid #dce7eb; background:#f9fbfc; font-size:9px; } .translation-grid span { color:#83979f; } .translation-grid b { color:#5c94a9; text-align:center; } .translation-grid strong { color:#2a5363; }
        .proof-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; } .proof-card { border:1px solid #dae6ea; border-radius:9px; padding:13px; } .proof-card strong { display:block; color:#244957; margin-bottom:5px; } .proof-card p { color:#70848c; font-size:9px; line-height:1.55; margin:0; }
        @media(max-width:980px) { header { align-items:flex-start; flex-direction:column; } .actions { justify-content:flex-start; } .identity-card { align-items:flex-start; flex-direction:column; } .identity-meta,.value-strip,.metrics,.evidence-grid,.clinical-flow,.course-grid,.proof-grid { grid-template-columns:1fr 1fr; width:100%; } .two-column { grid-template-columns:1fr; } }
        @media(max-width:650px) { main { width:min(100% - 18px,1260px); } header { padding:20px 12px; } h1 { font-size:23px; } .identity-meta,.value-strip,.metrics,.attendance-grid,.evidence-grid,.clinical-flow,.course-grid,.translation-grid,.proof-grid { grid-template-columns:1fr; } .source-table > div,.outcome-row { grid-template-columns:1fr; } nav { overflow-x:auto; } nav button { flex:0 0 auto; } .notice { flex-direction:column; gap:5px; } }
      `}</style>
    </div>
  );
}

function Meta({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className="meta"><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>;
}

function ValueCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className="value-card"><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="metric"><span>{label}</span><strong>{value}</strong></div>;
}

function StatusPill({ label, active = false }: { label: string; active?: boolean }) {
  return <span className={`status-pill ${active ? 'active' : ''}`}>{label}</span>;
}

function GuideRow({ label, text }: { label: string; text: string }) {
  return <div className="guide-row"><strong>{label}</strong><p>{text}</p></div>;
}

function FlowStep({ number, title, detail }: { number: string; title: string; detail: string }) {
  return <div className="flow-step"><b>{number}</b><strong>{title}</strong><span>{detail}</span></div>;
}

function ProofCard({ title, text }: { title: string; text: string }) {
  return <div className="proof-card"><strong>{title}</strong><p>{text}</p></div>;
}
