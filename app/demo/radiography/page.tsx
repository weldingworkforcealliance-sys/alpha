'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import PlannerTeachingConsole, {
  type PlannerDayOption,
  type PlannerLaunchResource,
  type PlannerPlanRow,
  type PlannerSupportItem,
} from '@/app/components/planner/PlannerTeachingConsole';
import styles from './radiography-demo.module.css';

type AttendanceStatus = 'Present' | 'Late' | 'Absent' | 'Not recorded';
type EvidenceStatus = 'Not started' | 'Practice logged' | 'Ready for faculty review' | 'Faculty reviewed';

type DemoDay = {
  id: string;
  day: number;
  course: 'RA 101' | 'RA 102' | 'RA 103' | 'RA 101 / 102 / 103';
  title: string;
  objective: string;
  format: string;
  outcomes: string[];
  rows: PlannerPlanRow[];
  resources: PlannerLaunchResource[];
  support: {
    safety: string;
    prep: string;
    checks: string;
    evidence: string;
    struggle: string;
    momentum: string;
  };
};

const OUTCOMES = [
  { id: 'rad-out-1', code: 'RAD-1', text: 'Follow department-approved radiation-protection and patient-safety expectations during classroom, lab, and supervised clinical learning.' },
  { id: 'rad-out-2', code: 'RAD-2', text: 'Use professional communication, patient-care preparation, privacy practices, and appropriate escalation to faculty or clinical supervision.' },
  { id: 'rad-out-3', code: 'RAD-3', text: 'Build positioning, equipment-readiness, and image-critique evidence through supervised practice without LTG replacing faculty competency decisions.' },
  { id: 'rad-out-4', code: 'RAD-4', text: 'Connect attendance, practice evidence, faculty review, critique participation, and instructor observations in one progress record.' },
];

const DAYS: DemoDay[] = [
  {
    id: 'rad-day-1', day: 1, course: 'RA 101', title: 'Program Orientation & Professional Practice',
    objective: 'Establish the Radiography learning workflow, professional expectations, privacy boundaries, and the difference between approved curriculum, faculty implementation, and LTG evidence tracking.',
    format: 'Classroom + guided orientation', outcomes: ['RAD-1', 'RAD-2', 'RAD-4'],
    rows: [
      { id: 'd1-1', time: '0–10 min', instructor: 'Opening brief: course purpose, clinical boundaries, privacy expectations, and today’s evidence requirements.', students: 'Review the daily objective, identify required safety/privacy behaviors, and prepare questions.' },
      { id: 'd1-2', time: '10–25 min', instructor: 'Model how approved Radiography curriculum becomes a daily LTG teaching plan without altering approved outcomes.', students: 'Follow the demonstration and identify which items are protected curriculum versus implementation choices.' },
      { id: 'd1-3', time: '25–45 min', instructor: 'Facilitate a synthetic professionalism and privacy scenario. Pause at decision points for faculty-guided discussion.', students: 'Work through the synthetic scenario and identify when to proceed, stop, verify, or escalate.' },
      { id: 'd1-4', time: '45–60 min', instructor: 'Check understanding and document coaching needs. Launch the student reflection resource.', students: 'Complete the reflection prompt and explain the required next step in the scenario.' },
      { id: 'd1-5', time: '60–70 min', instructor: 'Close the session: confirm attendance, evidence captured, follow-up needs, and Day 2 preview.', students: 'Confirm assigned follow-up and review the next-day focus.' },
    ],
    resources: [
      { id: 'd1-student', title: 'Day 1 Student Screen', url: '/demo/radiography/student?day=1', type: 'student_display', notes: 'Synthetic orientation scenario', required: true },
      { id: 'd1-handout', title: 'Professional Practice Reflection', url: '/demo/radiography/student?day=1#reflection', type: 'handout', notes: 'Student-facing prompt' },
      { id: 'd1-faculty', title: 'Faculty Observation Notes', type: 'instructor_only', notes: 'Instructor-only demonstration record' },
    ],
    support: {
      safety: 'Synthetic data only. Do not enter patient names, identifiers, diagnoses, images, exposure settings, or protected health information.',
      prep: 'Have the department-approved handbook, privacy expectations, and local orientation materials available. The demo content is a workflow example, not approved Radiography curriculum.',
      checks: 'Can the learner explain what information belongs in LTG, what must stay out, and when faculty or clinical supervision must make the decision?',
      evidence: 'Attendance, orientation acknowledgement, faculty observation, reflection response, and implementation note.',
      struggle: 'Return to one scenario at a time. Ask the learner to identify the protected rule first, then the action, then what evidence should be recorded.',
      momentum: 'Keep the lesson focused on operating discipline: safe workflow, clear documentation, and faculty-controlled decisions.'
    }
  },
  {
    id: 'rad-day-2', day: 2, course: 'RA 101', title: 'Radiation Protection & Safety Habits',
    objective: 'Use faculty-approved safety scenarios to practice recognizing radiation-protection checkpoints, stop conditions, and required escalation without prescribing exposure factors or patient-specific technique.',
    format: 'Classroom + safety scenario lab', outcomes: ['RAD-1', 'RAD-2'],
    rows: [
      { id: 'd2-1', time: '0–10 min', instructor: 'Opening retrieval: review Day 1 privacy boundary and introduce today’s radiation-protection checkpoints.', students: 'Recall yesterday’s stop/verify/escalate pattern and apply it to a new safety context.' },
      { id: 'd2-2', time: '10–25 min', instructor: 'Demonstrate how a faculty-approved safety scenario is presented, observed, and documented inside LTG.', students: 'Identify the safety checkpoint, expected action, and evidence faculty would review.' },
      { id: 'd2-3', time: '25–50 min', instructor: 'Run guided scenario rotations and coach decision-making language.', students: 'Work through synthetic scenarios and explain when to pause, verify, or escalate.' },
      { id: 'd2-4', time: '50–65 min', instructor: 'Conduct a short knowledge check and record students needing more coaching.', students: 'Complete the check and explain one safety decision in plain language.' },
      { id: 'd2-5', time: '65–75 min', instructor: 'Summarize evidence and assign follow-up resources.', students: 'Review feedback and acknowledge the assigned next step.' },
    ],
    resources: [
      { id: 'd2-student', title: 'Day 2 Safety Scenario Screen', url: '/demo/radiography/student?day=2', type: 'student_display', notes: 'No exposure settings included', required: true },
      { id: 'd2-check', title: 'Radiation Protection Knowledge Check', url: '/demo/radiography/student?day=2#check', type: 'assessment', notes: 'Synthetic formative check' },
      { id: 'd2-rubric', title: 'Faculty Safety Observation Rubric', type: 'instructor_only', notes: 'Department criteria placeholder' },
    ],
    support: {
      safety: 'This demonstration intentionally omits exposure factors and patient-specific technique. Local policy, faculty direction, and clinical-site protocol govern actual practice.',
      prep: 'Replace demo scenarios with department-approved radiation-protection material before any real course use.',
      checks: 'Does the learner identify the safety checkpoint, the correct stop/verify/escalate response, and the appropriate faculty role?',
      evidence: 'Scenario response, faculty observation, formative knowledge check, coaching flag.',
      struggle: 'Reduce the scenario to one decision point and ask what must be verified before anything proceeds.',
      momentum: 'Use rapid scenario rounds. Keep explanations short and force the learner to state the reason for the safety decision.'
    }
  },
  {
    id: 'rad-day-3', day: 3, course: 'RA 101', title: 'Patient Care, Identification & Communication',
    objective: 'Practice a repeatable simulated workflow for identification, communication, privacy, movement preparation, and faculty escalation using synthetic patient scenarios only.',
    format: 'Simulation lab', outcomes: ['RAD-1', 'RAD-2', 'RAD-4'],
    rows: [
      { id: 'd3-1', time: '0–10 min', instructor: 'Toolbox-style safety brief: identification, privacy, communication, and movement-preparation checkpoints.', students: 'Review the checkpoints and identify which require faculty confirmation.' },
      { id: 'd3-2', time: '10–25 min', instructor: 'Model a synthetic patient-preparation sequence and narrate each verification step.', students: 'Observe and record the sequence using the student checklist.' },
      { id: 'd3-3', time: '25–55 min', instructor: 'Coach paired simulation practice and stop the sequence when a required checkpoint is missed.', students: 'Practice the sequence using fictional data and restart correctly after coaching.' },
      { id: 'd3-4', time: '55–70 min', instructor: 'Observe one complete sequence per learner and record readiness/coaching evidence.', students: 'Complete the assigned sequence and respond to faculty feedback.' },
      { id: 'd3-5', time: '70–80 min', instructor: 'Close with documentation review and next-step assignment.', students: 'Check documentation for completeness and acknowledge follow-up.' },
    ],
    resources: [
      { id: 'd3-student', title: 'Synthetic Patient Preparation Screen', url: '/demo/radiography/student?day=3', type: 'student_display', required: true },
      { id: 'd3-checklist', title: 'Communication & Identification Checklist', url: '/demo/radiography/student?day=3#checklist', type: 'handout' },
      { id: 'd3-faculty', title: 'Faculty Observation Record', type: 'instructor_only', notes: 'No real patient data' },
    ],
    support: {
      safety: 'Simulation only. Actual patient handling and care remain under approved program policy and direct clinical supervision.',
      prep: 'Use fictional names/identifiers and simulation equipment only. Confirm no real patient data is present in demo materials.',
      checks: 'Identification sequence, communication clarity, privacy awareness, safe preparation, and appropriate escalation.',
      evidence: 'Observed sequence, communication note, checklist, coaching/recheck status.',
      struggle: 'Stop the sequence and have the learner verbalize the next verification step before moving again.',
      momentum: 'Rotate roles quickly so every learner alternates between performing, observing, and identifying missed checkpoints.'
    }
  },
  {
    id: 'rad-day-4', day: 4, course: 'RA 102', title: 'Positioning Lab Workflow: Thorax & Abdomen',
    objective: 'Show how LTG can structure faculty-guided positioning lab practice, readiness checks, critique preparation, and evidence capture while approved positioning instruction remains under department control.',
    format: 'Radiography lab', outcomes: ['RAD-1', 'RAD-3', 'RAD-4'],
    rows: [
      { id: 'd4-1', time: '0–10 min', instructor: 'Pre-lab safety brief and equipment-readiness check using department-approved procedures.', students: 'Inspect the simulated station and confirm required readiness checkpoints.' },
      { id: 'd4-2', time: '10–30 min', instructor: 'Faculty demonstration using the approved positioning reference. LTG records the teaching sequence, not the clinical authority.', students: 'Observe, annotate the student checklist, and prepare questions.' },
      { id: 'd4-3', time: '30–65 min', instructor: 'Run guided positioning practice and coach preparation, communication, and repeatability.', students: 'Complete assigned simulated positioning practice under faculty guidance.' },
      { id: 'd4-4', time: '65–80 min', instructor: 'Facilitate image-critique preparation using approved examples or placeholders.', students: 'Identify the critique criteria assigned by faculty and record observations.' },
      { id: 'd4-5', time: '80–90 min', instructor: 'Record practice evidence and assign recheck/follow-up where needed.', students: 'Review faculty feedback and the next practice target.' },
    ],
    resources: [
      { id: 'd4-student', title: 'Day 4 Lab Student Screen', url: '/demo/radiography/student?day=4', type: 'student_display', required: true },
      { id: 'd4-ref', title: 'Approved Positioning Reference Placeholder', type: 'student_resource', notes: 'Department source required before live use' },
      { id: 'd4-critique', title: 'Image Critique Prompt', url: '/demo/radiography/student?day=4#critique', type: 'handout' },
      { id: 'd4-review', title: 'Faculty Practice Review', type: 'instructor_only' },
    ],
    support: {
      safety: 'Faculty-approved positioning and equipment procedures control the lab. No exposure settings or patient-specific technique are supplied by this demo.',
      prep: 'Attach the department-approved positioning reference, lab setup checklist, and faculty evaluation criteria before course use.',
      checks: 'Preparation, equipment readiness, communication, repeatability, and whether the learner is ready for further faculty review.',
      evidence: 'Practice logged, instructor coaching note, critique participation, follow-up target.',
      struggle: 'Break the task into setup, communication, positioning preparation, and verification. Rebuild one checkpoint at a time.',
      momentum: 'Keep students moving through short faculty-observed practice rounds rather than long passive explanations.'
    }
  },
  {
    id: 'rad-day-5', day: 5, course: 'RA 102', title: 'Extremity Positioning Practice & Image Critique',
    objective: 'Connect supervised positioning practice, critique discussion, faculty feedback, and follow-up evidence in one daily teaching workflow.',
    format: 'Radiography lab + critique seminar', outcomes: ['RAD-3', 'RAD-4'],
    rows: [
      { id: 'd5-1', time: '0–10 min', instructor: 'Opening review of prior lab coaching targets and today’s faculty checkpoints.', students: 'State the prior coaching target and today’s personal practice goal.' },
      { id: 'd5-2', time: '10–25 min', instructor: 'Demonstrate the assigned approved positioning workflow or review common setup errors.', students: 'Observe and compare the demonstration with the prior practice record.' },
      { id: 'd5-3', time: '25–60 min', instructor: 'Coach supervised practice rotations and flag evidence needing faculty re-evaluation.', students: 'Perform assigned simulated practice and incorporate coaching.' },
      { id: 'd5-4', time: '60–80 min', instructor: 'Lead structured image-critique discussion using approved images or synthetic placeholders.', students: 'Apply the faculty-provided critique criteria and explain observations.' },
      { id: 'd5-5', time: '80–90 min', instructor: 'Update practice status and assign next steps.', students: 'Review the evidence record and acknowledge follow-up.' },
    ],
    resources: [
      { id: 'd5-student', title: 'Day 5 Student Screen', url: '/demo/radiography/student?day=5', type: 'student_display', required: true },
      { id: 'd5-tracker', title: 'Positioning Practice Tracker', url: '/demo/radiography/student?day=5#tracker', type: 'handout' },
      { id: 'd5-critique', title: 'Critique Discussion Guide', url: '/demo/radiography/student?day=5#critique', type: 'student_resource' },
      { id: 'd5-recheck', title: 'Faculty Re-evaluation Queue', type: 'instructor_only' },
    ],
    support: {
      safety: 'All positioning performance remains faculty supervised and evaluated against department-approved criteria.',
      prep: 'Prepare the approved positioning reference, critique examples, and the specific faculty checkpoints for the day.',
      checks: 'Can the learner repeat the preparation workflow consistently and explain the critique criteria being applied?',
      evidence: 'Practice status, critique participation, faculty note, re-evaluation flag.',
      struggle: 'Return to the last correctly performed checkpoint and rebuild from there rather than repeating the entire task blindly.',
      momentum: 'Use visible individual practice targets so each learner knows exactly what improvement is expected in the next round.'
    }
  },
  {
    id: 'rad-day-6', day: 6, course: 'RA 103', title: 'Clinical Practice Evidence & Faculty Review',
    objective: 'Demonstrate how LTG can organize supervised clinical-practice evidence and faculty-review readiness without automatically declaring clinical competency.',
    format: 'Clinical practicum evidence review', outcomes: ['RAD-1', 'RAD-2', 'RAD-3', 'RAD-4'],
    rows: [
      { id: 'd6-1', time: '0–10 min', instructor: 'Review the clinical evidence boundary: what may be recorded, what must stay out, and who may make formal competency decisions.', students: 'Identify prohibited patient information and the authorized evaluator role.' },
      { id: 'd6-2', time: '10–25 min', instructor: 'Demonstrate a synthetic practice record moving from Practice Logged to Ready for Faculty Review.', students: 'Follow the workflow and identify what evidence is still missing.' },
      { id: 'd6-3', time: '25–50 min', instructor: 'Facilitate synthetic clinical-log review and coaching.', students: 'Review sample records, identify gaps, and prepare questions for faculty.' },
      { id: 'd6-4', time: '50–65 min', instructor: 'Conduct faculty review simulation using department-controlled criteria placeholders.', students: 'Present the evidence record and respond to faculty questions.' },
      { id: 'd6-5', time: '65–75 min', instructor: 'Document the next step without self-certifying competency.', students: 'Acknowledge whether the next step is more practice, faculty review, or completion by an authorized evaluator.' },
    ],
    resources: [
      { id: 'd6-student', title: 'Clinical Evidence Student Screen', url: '/demo/radiography/student?day=6', type: 'student_display', required: true },
      { id: 'd6-log', title: 'Synthetic Clinical Practice Log', url: '/demo/radiography/student?day=6#clinical-log', type: 'student_resource' },
      { id: 'd6-review', title: 'Faculty Review Queue', type: 'instructor_only', notes: 'Authorized evaluator action only' },
    ],
    support: {
      safety: 'LTG does not self-authorize clinical practice. Authorized faculty and clinical evaluators remain the decision-makers. The demo intentionally uses no real patient identifiers, images, diagnoses, exposure settings, or protected health information.',
      prep: 'Define the department-approved clinical evidence fields and authorized evaluator roles before any live configuration.',
      checks: 'Can the learner distinguish practice evidence from a formal competency decision and identify who must perform the final evaluation?',
      evidence: 'Synthetic practice record, faculty-review status, documented next step, instructor note.',
      struggle: 'Ask the learner to separate three questions: What happened? What evidence exists? Who has authority to decide the formal result?',
      momentum: 'Use a clear review queue so faculty can see which learners need practice, review, or follow-up without searching separate records.'
    }
  },
  {
    id: 'rad-day-7', day: 7, course: 'RA 101 / 102 / 103', title: 'Integrated Progress Review',
    objective: 'Bring classroom attendance, lab practice, clinical evidence, critique participation, faculty observations, and follow-up needs into one program-level progress conversation.',
    format: 'Integrated faculty / learner review', outcomes: ['RAD-1', 'RAD-2', 'RAD-3', 'RAD-4'],
    rows: [
      { id: 'd7-1', time: '0–10 min', instructor: 'Set review expectations and explain which evidence is informational versus formally evaluated.', students: 'Prepare personal questions and review assigned evidence.' },
      { id: 'd7-2', time: '10–30 min', instructor: 'Review attendance, classroom checks, lab practice, critique participation, and clinical review status.', students: 'Compare current progress with faculty feedback and identify incomplete evidence.' },
      { id: 'd7-3', time: '30–50 min', instructor: 'Conduct focused coaching conversations and assign next actions.', students: 'Record one strength, one priority, and one assigned next step.' },
      { id: 'd7-4', time: '50–65 min', instructor: 'Review program-level patterns without exposing unnecessary student or patient information.', students: 'Complete the final synthetic reflection.' },
      { id: 'd7-5', time: '65–75 min', instructor: 'Close the demo cycle and capture implementation notes for department review.', students: 'Acknowledge follow-up and complete the review cycle.' },
    ],
    resources: [
      { id: 'd7-student', title: 'Integrated Progress Student Screen', url: '/demo/radiography/student?day=7', type: 'student_display', required: true },
      { id: 'd7-summary', title: 'Synthetic Progress Summary', url: '/demo/radiography/student?day=7#progress', type: 'student_resource' },
      { id: 'd7-program', title: 'Program Review Notes', type: 'instructor_only', notes: 'Implementation improvement only' },
    ],
    support: {
      safety: 'The progress review summarizes evidence only. It does not replace faculty judgment, clinical evaluation, or approved competency requirements.',
      prep: 'Have the department-approved grading, clinical evaluation, and progression rules available so the final implementation can map to them accurately.',
      checks: 'Can each learner identify current evidence, remaining faculty actions, and the next approved learning step?',
      evidence: 'Integrated progress snapshot, instructor note, learner reflection, follow-up assignment.',
      struggle: 'Narrow the review to one evidence category at a time: attendance, classroom, lab, clinical, then faculty follow-up.',
      momentum: 'End with one clear next action per learner and one implementation improvement for the next teaching cycle.'
    }
  },
];

const STUDENTS = Array.from({ length: 8 }, (_, index) => ({
  id: `RAD-${String(index + 1).padStart(2, '0')}`,
  label: `Student ${String(index + 1).padStart(2, '0')}`,
}));

const EVIDENCE_ITEMS = [
  'Radiation protection / safety habits',
  'Patient identification / communication',
  'Positioning preparation / equipment readiness',
  'Clinical practice documentation',
  'Image critique participation',
];

function emptyAttendance() {
  return Object.fromEntries(STUDENTS.map((student) => [student.id, 'Not recorded'])) as Record<string, AttendanceStatus>;
}

function initialEvidence() {
  return {
    'Radiation protection / safety habits': 'Practice logged',
    'Patient identification / communication': 'Ready for faculty review',
    'Positioning preparation / equipment readiness': 'Practice logged',
    'Clinical practice documentation': 'Not started',
    'Image critique participation': 'Not started',
  } as Record<string, EvidenceStatus>;
}

function elapsed(startedAt: number | null, now: number) {
  if (!startedAt) return '00:00:00';
  const seconds = Math.max(0, Math.floor((now - startedAt) / 1000));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map((part) => String(part).padStart(2, '0')).join(':');
}

export default function RadiographyDemoPage() {
  const router = useRouter();
  const [viewingDay, setViewingDay] = useState(1);
  const [currentDay, setCurrentDay] = useState(1);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [timerNow, setTimerNow] = useState(Date.now());
  const [completedDays, setCompletedDays] = useState<number[]>([]);
  const [attendance, setAttendance] = useState<Record<string, AttendanceStatus>>(emptyAttendance);
  const [evidence, setEvidence] = useState<Record<string, EvidenceStatus>>(initialEvidence);
  const [note, setNote] = useState('');
  const [followUp, setFollowUp] = useState(false);
  const [savedMessage, setSavedMessage] = useState('');

  useEffect(() => {
    const value = Number(new URLSearchParams(window.location.search).get('day'));
    if (value >= 1 && value <= DAYS.length) setViewingDay(value);
  }, []);

  useEffect(() => {
    if (!startedAt) return;
    const timer = window.setInterval(() => setTimerNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [startedAt]);

  const day = DAYS.find((item) => item.day === viewingDay) ?? DAYS[0];
  const attendanceComplete = Object.values(attendance).every((status) => status !== 'Not recorded');
  const recordedCount = Object.values(attendance).filter((status) => status !== 'Not recorded').length;
  const presentCount = Object.values(attendance).filter((status) => status === 'Present' || status === 'Late').length;
  const isCurrentDay = viewingDay === currentDay;
  const dayOptions: PlannerDayOption[] = DAYS.map((item) => ({ id: item.id, dayNumber: item.day, title: item.title }));
  const protectedOutcomes = OUTCOMES.filter((outcome) => day.outcomes.includes(outcome.code));
  const liveClassroomResource: PlannerLaunchResource = {
    id: `d${day.day}-live-classroom`,
    title: `Launch Day ${day.day} Live Classroom`,
    url: `/demo/radiography/live?day=${day.day}`,
    type: 'assessment',
    notes: 'Starts the real LTG Connected Classroom session for this Radiography day',
    required: true,
  };

  const supportItems = useMemo<PlannerSupportItem[]>(() => [
    { key: 'safety', label: 'Safety / Clinical Boundary', body: day.support.safety },
    { key: 'prep', label: 'Instructor Preparation', body: day.support.prep },
    { key: 'checks', label: 'Instructor Checks', body: day.support.checks },
    { key: 'evidence', label: 'Evidence / Check for Understanding', body: day.support.evidence },
    { key: 'struggle', label: 'If Students Struggle', body: day.support.struggle },
    { key: 'momentum', label: 'Keep Momentum', body: day.support.momentum },
  ], [day]);

  const markAllPresent = () => setAttendance(
    Object.fromEntries(STUDENTS.map((student) => [student.id, 'Present'])) as Record<string, AttendanceStatus>
  );

  const startDay = () => {
    if (!isCurrentDay || startedAt || completedDays.includes(currentDay)) return;
    setStartedAt(Date.now());
    setTimerNow(Date.now());
    setSavedMessage('');
  };

  const completeDay = () => {
    if (!isCurrentDay || !startedAt || !attendanceComplete) return;
    setCompletedDays((days) => days.includes(currentDay) ? days : [...days, currentDay]);
    setSavedMessage(note.trim() ? 'Instructor note saved for this demo day.' : 'Demo day completed.');
    setStartedAt(null);
    setNote('');
    setFollowUp(false);
    if (currentDay < DAYS.length) {
      const next = currentDay + 1;
      setCurrentDay(next);
      setViewingDay(next);
      setAttendance(emptyAttendance());
    }
  };

  const resetDemo = () => {
    setViewingDay(1);
    setCurrentDay(1);
    setStartedAt(null);
    setCompletedDays([]);
    setAttendance(emptyAttendance());
    setEvidence(initialEvidence());
    setNote('');
    setFollowUp(false);
    setSavedMessage('');
  };

  return (
    <main className={styles.page}>
      <div className={styles.demoBar}>
        <div>
          <strong>RADIOGRAPHY DEMONSTRATION</strong>
          <span>Synthetic data only · Department review required before curriculum use</span>
        </div>
        <div className={styles.demoActions}>
          <button type="button" onClick={() => router.push('/demo/programs')}>Program Demos</button>
          <button type="button" onClick={resetDemo}>Reset Demo</button>
          <button type="button" onClick={() => router.push('/login')}>Live Login</button>
        </div>
      </div>

      <PlannerTeachingConsole
        courseLabel={day.course}
        sectionLabel="Radiography · Phase 2 Demo Cohort"
        dayNumber={day.day}
        totalDays={DAYS.length}
        title={day.title}
        objective={day.objective}
        formatLabel={day.format}
        protectedOutcomes={protectedOutcomes}
        rows={day.rows}
        resources={[liveClassroomResource, ...day.resources]}
        supportItems={supportItems}
        dayOptions={dayOptions}
        selectedGuideDayId={day.id}
        isCurrentDay={isCurrentDay}
        onPrevious={() => setViewingDay((value) => Math.max(1, value - 1))}
        onNext={() => setViewingDay((value) => Math.min(DAYS.length, value + 1))}
        onSelectDay={setViewingDay}
        onReturnCurrent={() => setViewingDay(currentDay)}
        studentDisplayUrl={`/demo/radiography/student?day=${day.day}`}
        actionPanel={
          <section className={styles.controlPanel}>
            <div className={styles.controlHead}>
              <div>
                <span>Current Day Controls</span>
                <strong>{startedAt ? `Class in progress · ${elapsed(startedAt, timerNow)}` : completedDays.includes(currentDay) ? 'Current day completed' : 'Ready to teach'}</strong>
              </div>
              <div className={styles.controlButtons}>
                <button type="button" className={styles.startButton} disabled={!isCurrentDay || Boolean(startedAt) || completedDays.includes(currentDay)} onClick={startDay}>Start Current Day</button>
                <button type="button" className={styles.completeButton} disabled={!isCurrentDay || !startedAt || !attendanceComplete} onClick={completeDay}>Complete Day</button>
              </div>
            </div>

            {!isCurrentDay && <div className={styles.notice}>Preview mode. Attendance, timer, and completion controls stay attached to Day {currentDay}.</div>}
            {isCurrentDay && startedAt && !attendanceComplete && <div className={styles.warning}>Attendance confirmation required before this class day can be completed. {STUDENTS.length - recordedCount} student status{STUDENTS.length - recordedCount === 1 ? '' : 'es'} remaining.</div>}

            <div className={styles.attendanceHead}>
              <div><span>Student Attendance</span><strong>{recordedCount} / {STUDENTS.length} recorded · {presentCount} present/late</strong></div>
              <button type="button" onClick={markAllPresent}>Mark All Present</button>
            </div>
            <div className={styles.roster}>
              {STUDENTS.map((student) => (
                <label key={student.id}>
                  <span>{student.label}</span>
                  <select value={attendance[student.id]} onChange={(event) => setAttendance((current) => ({ ...current, [student.id]: event.target.value as AttendanceStatus }))}>
                    <option>Not recorded</option>
                    <option>Present</option>
                    <option>Late</option>
                    <option>Absent</option>
                  </select>
                </label>
              ))}
            </div>

            <div className={styles.noteGrid}>
              <label>
                <span>Instructor implementation note</span>
                <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="What helped, what slowed the class down, what should change next cycle?" />
              </label>
              <div className={styles.followUpBox}>
                <label><input type="checkbox" checked={followUp} onChange={(event) => setFollowUp(event.target.checked)} /> Follow-up needed</label>
                <p>Implementation notes can improve pacing, resources, demonstrations, sequencing, and coaching. They cannot silently rewrite approved outcomes or clinical requirements.</p>
                {savedMessage && <strong>{savedMessage}</strong>}
              </div>
            </div>
          </section>
        }
        footerPanel={
          <section className={styles.evidencePanel}>
            <div className={styles.evidenceHead}>
              <div>
                <span>Radiography Practice Evidence</span>
                <strong>Practice → Faculty Review → Authorized Result</strong>
              </div>
              <p>LTG does not self-authorize clinical practice. Authorized faculty and clinical evaluators remain the decision-makers.</p>
            </div>
            <div className={styles.evidenceGrid}>
              {EVIDENCE_ITEMS.map((item) => (
                <label key={item}>
                  <span>{item}</span>
                  <select value={evidence[item]} onChange={(event) => setEvidence((current) => ({ ...current, [item]: event.target.value as EvidenceStatus }))}>
                    <option>Not started</option>
                    <option>Practice logged</option>
                    <option>Ready for faculty review</option>
                    <option>Faculty reviewed</option>
                  </select>
                </label>
              ))}
            </div>
            <div className={styles.dataBoundary}>No real student or patient data is used in this demonstration. The demo intentionally uses no real patient identifiers, images, diagnoses, exposure settings, or protected health information.</div>
          </section>
        }
      />
    </main>
  );
}
