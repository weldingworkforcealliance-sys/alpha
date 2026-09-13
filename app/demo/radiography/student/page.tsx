'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type StudentDay = {
  course: string;
  title: string;
  objective: string;
  focus: string[];
  task: string;
};

const DAYS: Record<number, StudentDay> = {
  1: { course: 'RA 101', title: 'Program Orientation & Professional Practice', objective: 'Understand the Radiography learning workflow, privacy boundary, professional expectations, and when faculty direction is required.', focus: ['Protect patient and student information.', 'Use only approved course and department resources.', 'Stop, verify, and escalate when the learner is not authorized to decide.'], task: 'Complete the live professional-practice check using the join code provided by the instructor.' },
  2: { course: 'RA 101', title: 'Radiation Protection & Safety Habits', objective: 'Recognize faculty-approved safety checkpoints and explain when to pause, verify, or escalate.', focus: ['No exposure settings are provided by this demo.', 'Follow faculty and clinical-site procedures.', 'Explain the reason for each safety decision.'], task: 'Complete the live radiation-safety check using the instructor classroom code.' },
  3: { course: 'RA 101', title: 'Patient Care, Identification & Communication', objective: 'Practice a repeatable simulated workflow for identification, communication, privacy, and safe preparation.', focus: ['Simulation data only.', 'Use the approved identification sequence.', 'Communicate each verification step clearly.'], task: 'Complete the live patient-care workflow check using synthetic information only.' },
  4: { course: 'RA 102', title: 'Positioning Lab Workflow: Thorax & Abdomen', objective: 'Follow the faculty-guided lab workflow and connect practice evidence to the daily LTG record.', focus: ['Department-approved positioning references control the lab.', 'No patient-specific technique or exposure factors appear here.', 'Practice status is not the same as formal competency.'], task: 'Complete the live positioning-lab readiness check after faculty-guided practice.' },
  5: { course: 'RA 102', title: 'Extremity Positioning Practice & Image Critique', objective: 'Use faculty feedback to improve repeatability and participate in structured image critique.', focus: ['Use the faculty-provided critique criteria.', 'Record the coaching target after each round.', 'Do not treat practice completion as automatic competency.'], task: 'Complete the live image-critique check and submit your evidence to the instructor.' },
  6: { course: 'RA 103', title: 'Clinical Practice Evidence & Faculty Review', objective: 'Distinguish practice evidence from an authorized clinical competency decision.', focus: ['No real patient information belongs in the demo.', 'Practice Logged means evidence exists, not that competency was awarded.', 'Authorized faculty/clinical evaluators make formal decisions.'], task: 'Complete the live clinical-evidence readiness check. LTG records evidence, not a competency decision.' },
  7: { course: 'RA 101 / 102 / 103', title: 'Integrated Progress Review', objective: 'Use attendance, classroom, lab, critique, and clinical-review evidence to understand the next approved learning step.', focus: ['Separate informational evidence from formal evaluation.', 'Review one category at a time.', 'End with one clear next action.'], task: 'Complete the live integrated progress check and review the result with faculty.' },
};

export default function RadiographyStudentDisplayPage() {
  const router = useRouter();
  const [dayNumber, setDayNumber] = useState(1);
  const [joinCode, setJoinCode] = useState('');

  useEffect(() => {
    const value = Number(new URLSearchParams(window.location.search).get('day'));
    if (value >= 1 && value <= 7) setDayNumber(value);
  }, []);

  const day = DAYS[dayNumber] ?? DAYS[1];

  const joinLiveClassroom = () => {
    const code = joinCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!code) return;
    router.push(`/join/${encodeURIComponent(code)}`);
  };

  return (
    <main className="student-shell">
      <header>
        <div><span>LTG STUDENT DISPLAY · RADIOGRAPHY DEMO</span><h1>{day.course} · Day {dayNumber}</h1><p>{day.title}</p></div>
        <button onClick={() => router.push('/demo/radiography')}>Back to Instructor</button>
      </header>

      <section className="objective"><span>Today&apos;s Objective</span><h2>{day.objective}</h2></section>

      <div className="grid">
        <section className="card"><span>FOCUS BEFORE YOU START</span><ol>{day.focus.map((item) => <li key={item}>{item}</li>)}</ol></section>
        <section className="card task"><span>LIVE CLASS ACTIVITY</span><h2>{day.task}</h2><div className="status">Responses are submitted through LTG Connected Classroom and return to the instructor in real time.</div></section>
      </div>

      <section className="liveJoin">
        <div>
          <span>CONNECTED CLASSROOM</span>
          <h2>Enter the classroom join code</h2>
          <p>Your instructor starts the Day {dayNumber} session and shares the code or QR link. Your answers are saved to that live session.</p>
        </div>
        <div className="joinControls">
          <input value={joinCode} onChange={(event) => setJoinCode(event.target.value.toUpperCase())} onKeyDown={(event) => { if (event.key === 'Enter') joinLiveClassroom(); }} aria-label="Classroom join code" placeholder="JOIN CODE" maxLength={12} />
          <button className="joinButton" onClick={joinLiveClassroom} disabled={!joinCode.trim()}>Join Live Classroom</button>
        </div>
        <div className="instructorLine">
          <strong>Instructor?</strong>
          <button onClick={() => router.push(`/demo/radiography/live?day=${dayNumber}`)}>Launch Day {dayNumber} Live Classroom</button>
        </div>
      </section>

      <section className="boundary"><strong>Clinical boundary</strong><p>This demonstration contains no real patient identifiers, images, diagnoses, exposure settings, or protected health information. Faculty-approved curriculum and clinical procedures remain authoritative.</p></section>

      <style jsx>{`
        .student-shell{min-height:100vh;background:#0d1b26;color:#f1f4f6;padding:clamp(16px,3vw,38px);font-family:inherit}header{display:flex;justify-content:space-between;gap:20px;align-items:flex-start;border-bottom:1px solid #415668;padding-bottom:18px;margin-bottom:20px}header span,.objective span,.card>span,.liveJoin>div>span{color:#f0641d;font-weight:900;letter-spacing:.1em;font-size:11px}h1{font-size:clamp(30px,5vw,54px);margin:5px 0 2px}header p{color:#b4bec6;margin:0;font-size:18px}button{border:1px solid #415668;background:#233948;color:#f1f4f6;border-radius:8px;padding:10px 13px;font-weight:900;cursor:pointer}button:disabled{opacity:.45;cursor:not-allowed}.objective{border:1px solid #415668;background:#172b3a;border-radius:14px;padding:20px;margin-bottom:14px}.objective h2{font-size:clamp(21px,3vw,32px);line-height:1.3;margin:7px 0 0}.grid{display:grid;grid-template-columns:.85fr 1.15fr;gap:14px}.card,.liveJoin,.boundary{border:1px solid #415668;background:#172b3a;border-radius:14px;padding:20px}.card ol{padding-left:23px;color:#dce3e7;line-height:1.65}.task{border-top:4px solid #f0641d}.task h2{font-size:clamp(21px,3vw,31px);line-height:1.35}.status{margin-top:20px;border:1px solid #6a9aae;background:rgba(106,154,174,.13);color:#b9e2f1;border-radius:8px;padding:10px;line-height:1.5}.liveJoin{margin-top:14px;border-top:4px solid #f0641d}.liveJoin h2{font-size:24px;margin:7px 0}.liveJoin p{color:#b4bec6;line-height:1.5}.joinControls{display:grid;grid-template-columns:minmax(180px,340px) auto;gap:10px;margin-top:16px;align-items:center}.joinControls input{min-height:48px;border:1px solid #6a9aae;background:#142736;color:#f1f4f6;border-radius:9px;padding:0 14px;font:inherit;font-size:20px;font-weight:900;letter-spacing:.12em;text-transform:uppercase}.joinButton{min-height:48px;border-color:#f0641d;background:#e95d18;color:#fff}.instructorLine{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:18px;padding-top:14px;border-top:1px solid #314657;color:#b4bec6}.boundary{margin-top:14px;border-color:#6a9aae}.boundary strong{color:#b9e2f1}.boundary p{color:#b4bec6;margin-bottom:0;line-height:1.55}@media(max-width:760px){header{flex-direction:column}.grid,.joinControls{grid-template-columns:1fr}}
      `}</style>
    </main>
  );
}
