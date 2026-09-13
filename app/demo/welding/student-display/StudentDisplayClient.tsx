'use client';

import { useEffect, useMemo, useState } from 'react';
import ParticipantHeartbeat from './ParticipantHeartbeat';

type DemoQuestion = {
  id: string;
  prompt: string;
  options: string[];
  correctIndex: number;
};

type DemoActivity = {
  key: string;
  title: string;
  subtitle: string;
  questions: DemoQuestion[];
};

type DemoSubmission = {
  studentName: string;
  activityKey: string;
  title: string;
  answers: number[];
  score: number;
  correct: number;
  total: number;
  submittedAt: number;
};

const ACTIVITIES: Record<string, DemoActivity> = {
  preclass_math: {
    key: 'preclass_math',
    title: 'Pre-Class Welding Math Assessment',
    subtitle: 'Diagnostic baseline · Demo student activity',
    questions: [
      { id: 'm1', prompt: 'Which decimal is equal to 1/2 inch?', options: ['0.25', '0.50', '0.75', '0.33'], correctIndex: 1 },
      { id: 'm2', prompt: 'What is 7/8 inch as a decimal?', options: ['0.875', '0.625', '0.0875', '0.857'], correctIndex: 0 },
      { id: 'm3', prompt: 'A plate is 6 1/2 inches long. Which value is equivalent?', options: ['6.05', '6.25', '6.50', '6.75'], correctIndex: 2 },
      { id: 'm4', prompt: 'What is 24 + 37?', options: ['51', '61', '71', '81'], correctIndex: 1 },
      { id: 'm5', prompt: 'What is 2 × (6 + 4)?', options: ['16', '18', '20', '24'], correctIndex: 2 },
    ],
  },
  blueprint_day1: {
    key: 'blueprint_day1',
    title: 'Blueprint Reading Review · Day 1',
    subtitle: 'Connected Live Classroom assessment · Demo student activity',
    questions: [
      { id: 'b1', prompt: 'Why are multiple orthographic views used on a welding drawing?', options: ['To show different sides clearly', 'To decorate the print', 'To replace dimensions', 'To avoid using notes'], correctIndex: 0 },
      { id: 'b2', prompt: 'Which three views are standard orthographic views?', options: ['Front, top, side', 'Front, weld, material', 'Top, note, title', 'Side, scale, section'], correctIndex: 0 },
      { id: 'b3', prompt: 'Where should a welder look first for drawing identification, scale, and general information?', options: ['Title block', 'Centerline', 'Weld bead', 'Cut list only'], correctIndex: 0 },
      { id: 'b4', prompt: 'A hidden line usually represents what?', options: ['An edge not visible in the current view', 'A finished weld', 'A center point', 'A dimension extension'], correctIndex: 0 },
      { id: 'b5', prompt: 'Before fabricating from a print, what should the welder verify?', options: ['Material, dimensions, notes, and weld requirements', 'Only the picture', 'Only the material color', 'Only the overall length'], correctIndex: 0 },
    ],
  },
};

function storageKey(sessionId: string) {
  return `ltg_demo_classroom_${sessionId}`;
}

export default function StudentDisplayClient({ sessionId, activityKey }: { sessionId: string; activityKey: string }) {
  const activity = ACTIVITIES[activityKey] ?? ACTIVITIES.preclass_math;
  const [studentName, setStudentName] = useState('Demo Student');
  const [answers, setAnswers] = useState<number[]>(() => activity.questions.map(() => -1));
  const [submitted, setSubmitted] = useState<DemoSubmission | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!sessionId) {
      setReady(true);
      return;
    }
    try {
      const raw = localStorage.getItem(storageKey(sessionId));
      if (raw) {
        const parsed = JSON.parse(raw) as { submissions?: DemoSubmission[] };
        const existing = parsed.submissions?.find((item) => item.activityKey === activity.key && item.studentName === studentName);
        if (existing) setSubmitted(existing);
      }
    } catch {
      // Demo storage is intentionally disposable.
    } finally {
      setReady(true);
    }
  }, [sessionId, activity.key, studentName]);

  const answeredCount = useMemo(() => answers.filter((answer) => answer >= 0).length, [answers]);

  const submit = () => {
    if (!sessionId || answeredCount !== activity.questions.length) return;
    const correct = activity.questions.reduce((sum, question, index) => sum + (answers[index] === question.correctIndex ? 1 : 0), 0);
    const score = Math.round((correct / activity.questions.length) * 100);
    const submission: DemoSubmission = {
      studentName: studentName.trim() || 'Demo Student',
      activityKey: activity.key,
      title: activity.title,
      answers,
      score,
      correct,
      total: activity.questions.length,
      submittedAt: Date.now(),
    };

    const key = storageKey(sessionId);
    try {
      const raw = localStorage.getItem(key);
      const current = raw ? JSON.parse(raw) : {};
      const submissions = Array.isArray(current.submissions) ? current.submissions.filter((item: DemoSubmission) => item.studentName !== submission.studentName) : [];
      localStorage.setItem(key, JSON.stringify({ ...current, lastActivityAt: Date.now(), submissions: [...submissions, submission] }));
    } catch {
      return;
    }
    setSubmitted(submission);
  };

  if (!ready) return <main className="student-shell"><div className="student-card">Loading demo activity…</div></main>;

  if (!sessionId) {
    return (
      <main className="student-shell">
        <div className="student-card error-card">
          <span className="kicker">LTG LIVE CLASSROOM</span>
          <h1>No active demo session</h1>
          <p>Launch a connected activity from the instructor demo first. A student link is created for that temporary session.</p>
        </div>
        <style jsx>{styles}</style>
      </main>
    );
  }

  if (submitted) {
    return (
      <main className="student-shell">
        <ParticipantHeartbeat sessionId={sessionId} studentName={studentName} />
        <div className="student-card result-card">
          <span className="kicker">ACTIVITY COMPLETED</span>
          <h1>{activity.title}</h1>
          <div className="score">{submitted.score}%</div>
          <p><strong>{submitted.correct} of {submitted.total}</strong> questions correct.</p>
          <p>Your instructor demo dashboard has received this result for the active session.</p>
          <div className="result-grid"><div><span>Student</span><strong>{submitted.studentName}</strong></div><div><span>Questions answered</span><strong>{submitted.total} / {submitted.total}</strong></div></div>
        </div>
        <style jsx>{styles}</style>
      </main>
    );
  }

  return (
    <main className="student-shell">
      <ParticipantHeartbeat sessionId={sessionId} studentName={studentName} />
      <div className="student-card">
        <span className="kicker">LTG LIVE CLASSROOM · TEMPORARY DEMO</span>
        <h1>{activity.title}</h1>
        <p className="subtitle">{activity.subtitle}</p>
        <label className="name-field">Student name<input value={studentName} onChange={(event) => setStudentName(event.target.value)} /></label>
        <div className="progress"><span>{answeredCount} of {activity.questions.length} answered</span><strong>{Math.round((answeredCount / activity.questions.length) * 100)}%</strong></div>
        <div className="questions">
          {activity.questions.map((question, questionIndex) => (
            <section className="question" key={question.id}>
              <h2>{questionIndex + 1}. {question.prompt}</h2>
              <div className="options">
                {question.options.map((option, optionIndex) => (
                  <button key={option} className={answers[questionIndex] === optionIndex ? 'option selected' : 'option'} onClick={() => setAnswers((current) => current.map((value, index) => index === questionIndex ? optionIndex : value))}>
                    <span>{String.fromCharCode(65 + optionIndex)}</span>{option}
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
        <button className="submit" disabled={answeredCount !== activity.questions.length} onClick={submit}>Submit Activity</button>
        <p className="temporary-note">This demo stores only temporary browser data and does not write to live school records.</p>
      </div>
      <style jsx>{styles}</style>
    </main>
  );
}

const styles = `
  :global(body) { margin:0; background:#091014; color:#dbe6ea; font-family:Arial,Helvetica,sans-serif; }
  * { box-sizing:border-box; }
  .student-shell { min-height:100vh; padding:28px 16px; background:radial-gradient(circle at top,#12303b 0,#091014 45%); }
  .student-card { width:min(860px,100%); margin:0 auto; padding:28px; border:1px solid #2a4048; border-radius:16px; background:#10191e; box-shadow:0 22px 60px rgba(0,0,0,.34); }
  .kicker { color:#65dfff; font-size:11px; font-weight:900; letter-spacing:.13em; }
  h1 { margin:8px 0 8px; color:#fff; font-size:30px; } .subtitle,.temporary-note,p { color:#9aabb1; line-height:1.55; }
  .name-field { display:grid; gap:7px; margin:22px 0; color:#b9c8cd; font-size:12px; font-weight:800; }
  .name-field input { padding:12px; border:1px solid #344850; border-radius:8px; background:#0a1216; color:#fff; font-size:15px; }
  .progress { display:flex; justify-content:space-between; gap:20px; margin:0 0 18px; padding:12px 14px; border:1px solid #27404b; border-radius:9px; background:#0c171c; color:#8ca0a8; }.progress strong { color:#69dfff; }
  .questions { display:grid; gap:14px; }.question { padding:18px; border:1px solid #283a42; border-radius:11px; background:#0d1519; }.question h2 { margin:0 0 13px; font-size:16px; color:#f4f8fa; line-height:1.4; }
  .options { display:grid; grid-template-columns:1fr 1fr; gap:9px; }.option { display:flex; gap:10px; align-items:center; padding:12px; border:1px solid #32454d; border-radius:8px; background:#121d22; color:#c8d4d8; text-align:left; cursor:pointer; }.option span { width:24px; height:24px; display:grid; place-items:center; border-radius:50%; background:#223139; color:#73defd; font-weight:900; }.option.selected { border-color:#59d6ff; background:#12303b; color:#fff; box-shadow:0 0 0 1px rgba(89,214,255,.16) inset; }
  .submit { width:100%; margin-top:18px; padding:14px; border:1px solid #39acd0; border-radius:9px; background:#0c7296; color:#fff; font-size:14px; font-weight:900; cursor:pointer; }.submit:disabled { opacity:.38; cursor:not-allowed; }
  .result-card { text-align:center; }.result-card .score { margin:28px auto 16px; font-size:72px; font-weight:950; color:#72e4b2; }.result-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:24px; }.result-grid div { display:grid; gap:4px; padding:14px; border:1px solid #2b3d45; border-radius:9px; background:#0c1519; }.result-grid span { color:#81939a; font-size:10px; text-transform:uppercase; }.result-grid strong { color:#fff; }
  .error-card { margin-top:10vh; text-align:center; }
  @media(max-width:650px) { .student-card { padding:20px; }.options,.result-grid { grid-template-columns:1fr; } h1 { font-size:24px; }.result-card .score { font-size:56px; } }
`;
