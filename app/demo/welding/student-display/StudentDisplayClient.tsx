'use client';

import { useEffect, useMemo, useState } from 'react';
import ParticipantHeartbeat from './ParticipantHeartbeat';
import {
  connectDemoClassroomStudent,
  getDemoClassroomAssessment,
  submitDemoClassroomAssessment,
  type DemoAssessmentPayload,
} from '../_lib/demo-classroom-api';

type SubmitResult = {
  score: number;
  possible_score: number;
  percent: number;
};

export default function StudentDisplayClient({ joinCode }: { joinCode: string }) {
  const normalizedCode = joinCode.trim().toUpperCase();
  const [assessment, setAssessment] = useState<DemoAssessmentPayload | null>(null);
  const [studentName, setStudentName] = useState('');
  const [joined, setJoined] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!normalizedCode) {
        setError('No demo join code was provided. Launch a connected activity from the instructor demo first.');
        setLoading(false);
        return;
      }
      try {
        const payload = await getDemoClassroomAssessment(normalizedCode);
        if (!cancelled) setAssessment(payload);
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'This demo classroom session is unavailable.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [normalizedCode]);

  const answeredCount = useMemo(
    () => assessment?.questions.filter((question) => (answers[question.key] ?? '').trim().length > 0).length ?? 0,
    [answers, assessment]
  );

  const enterActivity = async () => {
    const name = studentName.trim();
    if (name.length < 2) {
      setError('Enter a student name to join the demo activity.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await connectDemoClassroomStudent(normalizedCode, name);
      setStudentName(name);
      setJoined(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to join this demo classroom session.');
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (!assessment || answeredCount !== assessment.questions.length) return;
    setBusy(true);
    setError('');
    try {
      const submitted = await submitDemoClassroomAssessment(normalizedCode, studentName, answers);
      setResult(submitted);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to submit this demo activity.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <main className="student-shell"><div className="student-card"><span className="kicker">LTG LIVE CLASSROOM</span><h1>Opening demo activity…</h1></div><style jsx>{styles}</style></main>;
  }

  if (error && !assessment) {
    return (
      <main className="student-shell">
        <div className="student-card error-card"><span className="kicker">LTG LIVE CLASSROOM</span><h1>Demo session unavailable</h1><p>{error}</p></div>
        <style jsx>{styles}</style>
      </main>
    );
  }

  if (!assessment) return null;

  if (result) {
    return (
      <main className="student-shell">
        <ParticipantHeartbeat joinCode={normalizedCode} studentName={studentName} enabled={joined} />
        <div className="student-card result-card">
          <span className="kicker">ACTIVITY COMPLETED</span>
          <h1>{assessment.session.title}</h1>
          <div className="score">{result.percent}%</div>
          <p><strong>{result.score} of {result.possible_score}</strong> questions correct.</p>
          <p>Your instructor Live Classroom dashboard received this result automatically.</p>
          <div className="result-grid">
            <div><span>Student</span><strong>{studentName}</strong></div>
            <div><span>Questions answered</span><strong>{result.possible_score} / {result.possible_score}</strong></div>
          </div>
          <div className="temporary-note">Closed demo system · temporary session only · no live school record is created.</div>
        </div>
        <style jsx>{styles}</style>
      </main>
    );
  }

  if (!joined) {
    return (
      <main className="student-shell">
        <div className="student-card join-card">
          <span className="kicker">LTG LIVE CLASSROOM · TEMPORARY DEMO</span>
          <h1>{assessment.session.title}</h1>
          <p>{assessment.session.course_code} · Day {assessment.session.day_number} · {assessment.questions.length} questions</p>
          <div className="code-panel"><span>Join code</span><strong>{assessment.session.join_code}</strong></div>
          <label className="name-field">Student name<input autoFocus value={studentName} onChange={(event) => { setStudentName(event.target.value); setError(''); }} placeholder="Enter your name" /></label>
          {error && <div className="inline-error">{error}</div>}
          <button className="submit" disabled={busy || studentName.trim().length < 2} onClick={enterActivity}>{busy ? 'Joining…' : 'Enter Activity'}</button>
          <p className="temporary-note">This session is isolated from live school records and expires after 30 minutes of inactivity.</p>
        </div>
        <style jsx>{styles}</style>
      </main>
    );
  }

  return (
    <main className="student-shell">
      <ParticipantHeartbeat joinCode={normalizedCode} studentName={studentName} enabled={joined} />
      <div className="student-card">
        <span className="kicker">LTG LIVE CLASSROOM · TEMPORARY DEMO</span>
        <h1>{assessment.session.title}</h1>
        <p className="subtitle">{assessment.session.course_code} · Day {assessment.session.day_number} · {assessment.questions.length} questions</p>
        <div className="student-row"><span>Student</span><strong>{studentName}</strong><span>Code</span><strong>{assessment.session.join_code}</strong></div>
        <div className="progress"><span>{answeredCount} of {assessment.questions.length} answered</span><strong>{Math.round((answeredCount / Math.max(assessment.questions.length, 1)) * 100)}%</strong></div>
        <div className="questions">
          {assessment.questions.map((question) => {
            const options = Object.entries(question.options ?? {}).sort(([a], [b]) => a.localeCompare(b));
            return (
              <section className="question" key={question.key}>
                <div className="domain">{question.domain}</div>
                <h2>{question.number}. {question.text}</h2>
                {question.type === 'mc' ? (
                  <div className="options">
                    {options.map(([optionKey, option]) => (
                      <button
                        key={optionKey}
                        className={answers[question.key] === optionKey ? 'option selected' : 'option'}
                        onClick={() => setAnswers((current) => ({ ...current, [question.key]: optionKey }))}
                      >
                        <span>{optionKey}</span>{option}
                      </button>
                    ))}
                  </div>
                ) : (
                  <input
                    className="text-answer"
                    value={answers[question.key] ?? ''}
                    onChange={(event) => setAnswers((current) => ({ ...current, [question.key]: event.target.value }))}
                    placeholder="Enter your answer"
                  />
                )}
              </section>
            );
          })}
        </div>
        {error && <div className="inline-error submit-error">{error}</div>}
        <button className="submit" disabled={busy || answeredCount !== assessment.questions.length} onClick={submit}>{busy ? 'Submitting…' : 'Submit Activity'}</button>
        <p className="temporary-note">Scoring happens on the temporary demo backend. Correct answers are not sent to the student screen before submission.</p>
      </div>
      <style jsx>{styles}</style>
    </main>
  );
}

const styles = `
  :global(body) { margin:0; background:#091014; color:#dbe6ea; font-family:Arial,Helvetica,sans-serif; }
  * { box-sizing:border-box; }
  .student-shell { min-height:100vh; padding:28px 16px; background:radial-gradient(circle at top,#12303b 0,#091014 45%); }
  .student-card { width:min(900px,100%); margin:0 auto; padding:28px; border:1px solid #2a4048; border-radius:16px; background:#10191e; box-shadow:0 22px 60px rgba(0,0,0,.34); }
  .kicker { color:#65dfff; font-size:11px; font-weight:900; letter-spacing:.13em; }
  h1 { margin:8px 0; color:#fff; font-size:30px; } p,.subtitle,.temporary-note { color:#9aabb1; line-height:1.55; }
  .join-card { margin-top:7vh; }.code-panel { display:grid; gap:4px; margin:20px 0; padding:14px; border:1px solid #2a4651; border-radius:9px; background:#0c1b21; }.code-panel span,.student-row span { color:#7d929a; font-size:9px; text-transform:uppercase; }.code-panel strong { color:#69dfff; font-size:24px; letter-spacing:.1em; }
  .name-field { display:grid; gap:7px; margin:20px 0 14px; color:#b9c8cd; font-size:12px; font-weight:800; }.name-field input,.text-answer { padding:12px; border:1px solid #344850; border-radius:8px; background:#0a1216; color:#fff; font-size:15px; }.text-answer { width:100%; }
  .student-row { display:grid; grid-template-columns:auto 1fr auto 1fr; gap:8px 12px; align-items:center; margin:18px 0; padding:12px 14px; border:1px solid #263942; border-radius:9px; background:#0c171c; }.student-row strong { color:#e8f1f4; overflow:hidden; text-overflow:ellipsis; }
  .progress { display:flex; justify-content:space-between; gap:20px; margin:0 0 18px; padding:12px 14px; border:1px solid #27404b; border-radius:9px; background:#0c171c; color:#8ca0a8; }.progress strong { color:#69dfff; }
  .questions { display:grid; gap:14px; }.question { padding:18px; border:1px solid #283a42; border-radius:11px; background:#0d1519; }.domain { margin-bottom:6px; color:#67dfff; font-size:9px; font-weight:900; text-transform:uppercase; letter-spacing:.08em; }.question h2 { margin:0 0 13px; font-size:16px; color:#f4f8fa; line-height:1.4; }
  .options { display:grid; grid-template-columns:1fr 1fr; gap:9px; }.option { display:flex; gap:10px; align-items:center; padding:12px; border:1px solid #32454d; border-radius:8px; background:#121d22; color:#c8d4d8; text-align:left; cursor:pointer; }.option span { flex:0 0 24px; width:24px; height:24px; display:grid; place-items:center; border-radius:50%; background:#223139; color:#73defd; font-weight:900; }.option.selected { border-color:#59d6ff; background:#12303b; color:#fff; box-shadow:0 0 0 1px rgba(89,214,255,.16) inset; }
  .submit { width:100%; margin-top:18px; padding:14px; border:1px solid #39acd0; border-radius:9px; background:#0c7296; color:#fff; font-size:14px; font-weight:900; cursor:pointer; }.submit:disabled { opacity:.38; cursor:not-allowed; }.inline-error { padding:11px; border:1px solid #75404b; border-radius:8px; background:#29171c; color:#f0a7b4; font-size:11px; line-height:1.45; }.submit-error { margin-top:16px; }
  .result-card { margin-top:5vh; text-align:center; }.result-card .score { margin:28px auto 16px; font-size:72px; font-weight:950; color:#72e4b2; }.result-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:24px; }.result-grid div { display:grid; gap:4px; padding:14px; border:1px solid #2b3d45; border-radius:9px; background:#0c1519; }.result-grid span { color:#81939a; font-size:10px; text-transform:uppercase; }.result-grid strong { color:#fff; }
  .error-card { margin-top:10vh; text-align:center; }
  @media(max-width:650px) { .student-card { padding:20px; }.options,.result-grid { grid-template-columns:1fr; }.student-row { grid-template-columns:auto 1fr; } h1 { font-size:24px; }.result-card .score { font-size:56px; } }
`;
