'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type StudentDay = {
  course: string;
  title: string;
  objective: string;
  focus: string[];
  task: string;
  reflection: string;
};

const DAYS: Record<number, StudentDay> = {
  1: { course: 'RA 101', title: 'Program Orientation & Professional Practice', objective: 'Understand the Radiography learning workflow, privacy boundary, professional expectations, and when faculty direction is required.', focus: ['Protect patient and student information.', 'Use only approved course and department resources.', 'Stop, verify, and escalate when the learner is not authorized to decide.'], task: 'Work through the fictional professionalism/privacy scenario presented by the instructor. Identify the protected rule, the next safe action, and what evidence should be recorded.', reflection: 'In one sentence: what information should never be entered into this demonstration environment?' },
  2: { course: 'RA 101', title: 'Radiation Protection & Safety Habits', objective: 'Recognize faculty-approved safety checkpoints and explain when to pause, verify, or escalate.', focus: ['No exposure settings are provided by this demo.', 'Follow faculty and clinical-site procedures.', 'Explain the reason for each safety decision.'], task: 'Review each synthetic safety scenario. State whether the correct response is proceed, pause, verify, or escalate to faculty.', reflection: 'Describe one situation where the safest action is to stop and ask for faculty review.' },
  3: { course: 'RA 101', title: 'Patient Care, Identification & Communication', objective: 'Practice a repeatable simulated workflow for identification, communication, privacy, and safe preparation.', focus: ['Simulation data only.', 'Use the approved identification sequence.', 'Communicate each verification step clearly.'], task: 'Complete the synthetic preparation sequence assigned by the instructor. Your observer records missed checkpoints, not clinical judgments.', reflection: 'Which verification step is easiest to skip when moving too quickly, and how will you prevent that?' },
  4: { course: 'RA 102', title: 'Positioning Lab Workflow: Thorax & Abdomen', objective: 'Follow the faculty-guided lab workflow and connect practice evidence to the daily LTG record.', focus: ['Department-approved positioning references control the lab.', 'No patient-specific technique or exposure factors appear here.', 'Practice status is not the same as formal competency.'], task: 'Use the department-approved reference provided by faculty. Complete the assigned simulated setup and identify the evidence the instructor will review.', reflection: 'What must be confirmed before a practice attempt is considered ready for faculty review?' },
  5: { course: 'RA 102', title: 'Extremity Positioning Practice & Image Critique', objective: 'Use faculty feedback to improve repeatability and participate in structured image critique.', focus: ['Use the faculty-provided critique criteria.', 'Record the coaching target after each round.', 'Do not treat practice completion as automatic competency.'], task: 'Complete the assigned simulation practice, then use the instructor-provided critique criteria to explain one strength and one area requiring improvement.', reflection: 'What is your single next practice target?' },
  6: { course: 'RA 103', title: 'Clinical Practice Evidence & Faculty Review', objective: 'Distinguish practice evidence from an authorized clinical competency decision.', focus: ['No real patient information belongs in the demo.', 'Practice Logged means evidence exists, not that competency was awarded.', 'Authorized faculty/clinical evaluators make formal decisions.'], task: 'Review the synthetic clinical practice record. Identify what evidence exists, what is missing, and who is authorized to determine the formal result.', reflection: 'Complete this sentence: LTG can organize evidence, but only ______ may record the approved clinical result.' },
  7: { course: 'RA 101 / 102 / 103', title: 'Integrated Progress Review', objective: 'Use attendance, classroom, lab, critique, and clinical-review evidence to understand the next approved learning step.', focus: ['Separate informational evidence from formal evaluation.', 'Review one category at a time.', 'End with one clear next action.'], task: 'Review the synthetic progress summary with the instructor. Identify one strength, one priority, and one assigned next step.', reflection: 'What evidence do you need next before moving forward?' },
};

export default function RadiographyStudentDisplayPage() {
  const router = useRouter();
  const [dayNumber, setDayNumber] = useState(1);

  useEffect(() => {
    const value = Number(new URLSearchParams(window.location.search).get('day'));
    if (value >= 1 && value <= 7) setDayNumber(value);
  }, []);

  const day = DAYS[dayNumber] ?? DAYS[1];

  return (
    <main className="student-shell">
      <header>
        <div><span>LTG STUDENT DISPLAY · RADIOGRAPHY DEMO</span><h1>{day.course} · Day {dayNumber}</h1><p>{day.title}</p></div>
        <button onClick={() => router.push('/demo/radiography')}>Back to Instructor</button>
      </header>

      <section className="objective"><span>Today&apos;s Objective</span><h2>{day.objective}</h2></section>

      <div className="grid">
        <section className="card"><span>FOCUS BEFORE YOU START</span><ol>{day.focus.map((item) => <li key={item}>{item}</li>)}</ol></section>
        <section className="card task"><span>LIVE CLASS ACTIVITY</span><h2>{day.task}</h2><div className="status">Follow instructor direction · Synthetic data only</div></section>
      </div>

      <section className="reflection" id="reflection"><span>CHECK FOR UNDERSTANDING / REFLECTION</span><h2>{day.reflection}</h2><textarea aria-label="Student reflection" placeholder="Demo response area..." /></section>

      <section className="boundary" id="check"><strong>Clinical boundary</strong><p>This demonstration contains no real patient identifiers, images, diagnoses, exposure settings, or protected health information. Faculty-approved curriculum and clinical procedures remain authoritative.</p></section>

      <style jsx>{`
        .student-shell{min-height:100vh;background:#0d1b26;color:#f1f4f6;padding:clamp(16px,3vw,38px);font-family:inherit}header{display:flex;justify-content:space-between;gap:20px;align-items:flex-start;border-bottom:1px solid #415668;padding-bottom:18px;margin-bottom:20px}header span,.objective span,.card>span,.reflection>span{color:#f0641d;font-weight:900;letter-spacing:.1em;font-size:11px}h1{font-size:clamp(30px,5vw,54px);margin:5px 0 2px}header p{color:#b4bec6;margin:0;font-size:18px}button{border:1px solid #415668;background:#233948;color:#f1f4f6;border-radius:8px;padding:10px 13px;font-weight:900;cursor:pointer}.objective{border:1px solid #415668;background:#172b3a;border-radius:14px;padding:20px;margin-bottom:14px}.objective h2{font-size:clamp(21px,3vw,32px);line-height:1.3;margin:7px 0 0}.grid{display:grid;grid-template-columns:.85fr 1.15fr;gap:14px}.card,.reflection,.boundary{border:1px solid #415668;background:#172b3a;border-radius:14px;padding:20px}.card ol{padding-left:23px;color:#dce3e7;line-height:1.65}.task{border-top:4px solid #f0641d}.task h2{font-size:clamp(21px,3vw,31px);line-height:1.35}.status{margin-top:20px;border:1px solid #6a9aae;background:rgba(106,154,174,.13);color:#b9e2f1;border-radius:8px;padding:10px}.reflection{margin-top:14px}.reflection h2{font-size:22px}.reflection textarea{width:100%;min-height:140px;border:1px solid #415668;background:#142736;color:#f1f4f6;border-radius:9px;padding:12px;font:inherit}.boundary{margin-top:14px;border-color:#6a9aae}.boundary strong{color:#b9e2f1}.boundary p{color:#b4bec6;margin-bottom:0;line-height:1.55}@media(max-width:760px){header{flex-direction:column}.grid{grid-template-columns:1fr}}
      `}</style>
    </main>
  );
}
