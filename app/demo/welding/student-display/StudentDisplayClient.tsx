'use client';

import { useEffect, useMemo, useState } from 'react';
import ParticipantHeartbeat from './ParticipantHeartbeat';

type DemoQuestion = {
  id: string;
  prompt: string;
  type: 'mc' | 'text';
  options?: string[];
  correct: string[];
};

type DemoActivity = {
  key: string;
  title: string;
  subtitle: string;
  instructions?: string;
  questions: DemoQuestion[];
};

type DemoSubmission = {
  studentName: string;
  activityKey: string;
  title: string;
  answers: string[];
  score: number;
  correct: number;
  total: number;
  submittedAt: number;
};

const ACTIVITIES: Record<string, DemoActivity> = {
  preclass_math: {
    key: 'preclass_math',
    title: 'Pre-Class Welding Math Assessment',
    subtitle: 'Diagnostic baseline · 20 questions · Demo student activity',
    instructions: 'Answer every question. This baseline is used to identify support needs before the welding mathematics sequence begins.',
    questions: [
      { id: 'q1', prompt: 'Which of the following is equal to 1/2 inch in decimal form?', type: 'mc', options: ['0.25', '0.50', '0.75', '0.33'], correct: ['0.50'] },
      { id: 'q2', prompt: 'What is 7/8 inch as a decimal?', type: 'mc', options: ['0.875', '0.625', '0.0875', '0.857'], correct: ['0.875'] },
      { id: 'q3', prompt: 'Which fraction is the same as 0.375?', type: 'mc', options: ['3/8', '5/8', '7/8', '1/4'], correct: ['3/8'] },
      { id: 'q4', prompt: 'Convert 0.625 inches to a fraction.', type: 'mc', options: ['5/8', '3/4', '7/8', '1/2'], correct: ['5/8'] },
      { id: 'q5', prompt: 'Which of the following is the smallest?', type: 'mc', options: ['1/8', '0.150', '3/16', '0.25'], correct: ['1/8'] },
      { id: 'q6', prompt: 'You have a piece of metal 12 inches long. You cut off 3 5/8 inches. How much remains?', type: 'mc', options: ['8 3/8 in', '9 1/2 in', '8 1/4 in', '8 5/8 in'], correct: ['8 3/8 in'] },
      { id: 'q7', prompt: 'What is 3 3/4 in + 2 1/8 in?', type: 'mc', options: ['5 5/8 in', '5 7/8 in', '6 in', '6 1/4 in'], correct: ['5 7/8 in'] },
      { id: 'q8', prompt: 'A weld joint needs a 1/4-inch gap, but the current gap is 3/8 inch. By how much must the gap be reduced?', type: 'mc', options: ['1/8 in', '1/4 in', '3/8 in', '1/16 in'], correct: ['1/8 in'] },
      { id: 'q9', prompt: 'Multiply: 5 1/2 in × 2 = ?', type: 'mc', options: ['10 in', '11 in', '11 1/2 in', '12 in'], correct: ['11 in'] },
      { id: 'q10', prompt: 'A 48-inch plate is cut into four equal parts. What is the length of each part?', type: 'mc', options: ['12 in', '10 in', '11.5 in', '12.5 in'], correct: ['12 in'] },
      { id: 'q11', prompt: 'On a tape measure divided into 1/16-inch increments, what measurement is the fourth small line after 3 inches?', type: 'mc', options: ['3 1/4 in', '3 3/8 in', '3 5/16 in', '3 7/16 in'], correct: ['3 1/4 in'] },
      { id: 'q12', prompt: 'Which measurement is the longest?', type: 'mc', options: ['7/16 in', '3/8 in', '1/2 in', '5/16 in'], correct: ['1/2 in'] },
      { id: 'q13', prompt: 'A weld bead must start at 10 7/8 inches. Where is that location on a tape measure divided into 1/16-inch increments?', type: 'mc', options: ['Two small lines before 11 in', 'One small line after 10 3/4 in', 'At 10 1/2 in', 'Halfway between 10 1/2 in and 11 in'], correct: ['Two small lines before 11 in'] },
      { id: 'q14', prompt: 'How many 1/8-inch segments are in 1 inch?', type: 'mc', options: ['4', '6', '8', '10'], correct: ['8'] },
      { id: 'q15', prompt: 'True or False: A tape measure marked in 1/16-inch increments divides each inch into 16 equal spaces.', type: 'mc', options: ['True', 'False'], correct: ['True'] },
      { id: 'q16', prompt: 'Five holes are drilled evenly along an 18-inch plate, with the first hole at one end and the last hole at the other end. What is the spacing between adjacent holes?', type: 'mc', options: ['4 in', '3.5 in', '4.5 in', '3.6 in'], correct: ['4.5 in'] },
      { id: 'q17', prompt: 'Steel plate costs $0.30 per square inch. What is the material cost of a 12 in × 6 in piece?', type: 'mc', options: ['$2.10', '$18.00', '$21.60', '$19.50'], correct: ['$21.60'] },
      { id: 'q18', prompt: 'A steel rod is 5 feet long. How many inches is that?', type: 'mc', options: ['50', '55', '60', '65'], correct: ['60'] },
      { id: 'q19', prompt: 'A 36-inch bar is cut into 5 equal sections. What is the length of each section?', type: 'mc', options: ['6 in', '7 in', '7.2 in', '7.5 in'], correct: ['7.2 in'] },
      { id: 'q20', prompt: 'What is the decimal equivalent of 9/16 inch?', type: 'text', correct: ['0.5625', '.5625', '0.56250', '.56250'] },
    ],
  },
  blueprint_day1: {
    key: 'blueprint_day1',
    title: 'Blueprint Reading — Day 1 · Basic lines, views, notes, and dimensions',
    subtitle: 'Unit 1, pp. 1–7 · Unit 3, pp. 17–21 · Unit 4, pp. 22–37 · 20 questions',
    instructions: 'Textbook or assigned print packet is required for questions marked [Drawing]. Compare all views, notes, and dimensions before answering.',
    questions: [
      { id: 'd1q1', prompt: '[Drawing] Refer to the V-Groove Test Block. Why are three views used to show the object?', type: 'mc', options: ['To give enough information about shape, size, and features that one view alone cannot show', 'To show three different material types', 'To give each welder a separate copy', 'To avoid using dimensions'], correct: ['To give enough information about shape, size, and features that one view alone cannot show'] },
      { id: 'd1q2', prompt: '[Drawing] Which three standard orthographic views are typically shown for the V-Groove Test Block?', type: 'mc', options: ['Front, top, and right-side views', 'Isometric, exploded, and section views', 'Front, detail, and pictorial views', 'Top, bill of materials, and note view'], correct: ['Front, top, and right-side views'] },
      { id: 'd1q3', prompt: '[Drawing] In standard orthographic projection, which two views show the same length?', type: 'mc', options: ['Front and top', 'Top and right side', 'Front and right side', 'Detail and section'], correct: ['Front and top'] },
      { id: 'd1q4', prompt: '[Drawing] In standard orthographic projection, which two views show the same width or depth?', type: 'mc', options: ['Front and top', 'Top and right side', 'Front and right side', 'Front and detail'], correct: ['Top and right side'] },
      { id: 'd1q5', prompt: '[Drawing] In standard orthographic projection, which two views show the same height or thickness?', type: 'mc', options: ['Front and top', 'Top and right side', 'Front and right side', 'Top and detail'], correct: ['Front and right side'] },
      { id: 'd1q6', prompt: '[Drawing] What do the top and right-side views have in common with respect to the front view?', type: 'mc', options: ['They align with the front view to carry dimensions and features across', 'They are always drawn larger than the front view', 'They replace the need for notes', 'They remove hidden lines from the drawing'], correct: ['They align with the front view to carry dimensions and features across'] },
      { id: 'd1q7', prompt: 'What is the main purpose of an object line on a print?', type: 'mc', options: ['To show visible edges and outlines of the part', 'To show center points only', 'To show cutting planes', 'To show dimensions only'], correct: ['To show visible edges and outlines of the part'] },
      { id: 'd1q8', prompt: 'What is the main purpose of a hidden line?', type: 'mc', options: ['To show edges or features not directly visible in that view', 'To show the outside shape only', 'To show the center of a hole', 'To show a finished weld contour'], correct: ['To show edges or features not directly visible in that view'] },
      { id: 'd1q9', prompt: 'What does a centerline usually indicate?', type: 'mc', options: ['The center of a circular or symmetrical feature', 'The cutting direction for a saw', 'The surface finish required', 'The location of a title block'], correct: ['The center of a circular or symmetrical feature'] },
      { id: 'd1q10', prompt: 'What is the job of a dimension line?', type: 'mc', options: ['To show the size or distance being measured', 'To show hidden edges', 'To show a material break', 'To show the order of welding'], correct: ['To show the size or distance being measured'] },
      { id: 'd1q11', prompt: 'What is the job of an extension line?', type: 'mc', options: ['To extend from the feature out to the dimension line', 'To darken object lines', 'To replace leader lines', 'To show a weld contour'], correct: ['To extend from the feature out to the dimension line'] },
      { id: 'd1q12', prompt: 'When a drawing includes notes or specifications, why must they be checked before fabrication starts?', type: 'mc', options: ['They may include instructions not obvious from the views alone', 'They are only for office filing', 'They are used only after welding is complete', 'They replace all dimensions on the print'], correct: ['They may include instructions not obvious from the views alone'] },
      { id: 'd1q13', prompt: 'A general specification placed in or near the title block usually applies to:', type: 'mc', options: ['All or several views on the drawing', 'Only the smallest detail view', 'Only the welder who signs first', 'Only one hidden feature'], correct: ['All or several views on the drawing'] },
      { id: 'd1q14', prompt: 'On a print, the diameter symbol tells the reader that the dimension refers to:', type: 'mc', options: ['The full distance across a circle', 'Half the distance across a circle', 'The length of a slot', 'The angle of a bevel'], correct: ['The full distance across a circle'] },
      { id: 'd1q15', prompt: 'Which statement best describes why dimensions matter to welders and fabricators?', type: 'mc', options: ['Wrong dimensions affect fit-up, hole location, and final assembly', 'Dimensions only matter to machinists', 'Dimensions are optional if the shape looks right', 'Dimensions are used only for record keeping'], correct: ['Wrong dimensions affect fit-up, hole location, and final assembly'] },
      { id: 'd1q16', prompt: 'If two group members disagree on what a dimension means, the best next step is to:', type: 'mc', options: ['Go back to the view, lines, and notes and prove the answer from the print', 'Choose the answer that sounds fastest', 'Ignore the dimension and move on', 'Let the loudest person decide'], correct: ['Go back to the view, lines, and notes and prove the answer from the print'] },
      { id: 'd1q17', prompt: 'A reference dimension is usually included to:', type: 'mc', options: ['Provide extra information without controlling production size', 'Replace every required tolerance', 'Show hidden lines more clearly', 'Identify the drawing revision'], correct: ['Provide extra information without controlling production size'] },
      { id: 'd1q18', prompt: 'Which print-reading habit is strongest when learning basic views?', type: 'mc', options: ['Compare all views before making a decision', 'Read only the front view', 'Ignore notes until the end', 'Assume every line means the same thing'], correct: ['Compare all views before making a decision'] },
      { id: 'd1q19', prompt: 'If a hole appears as a circle in one view and as hidden edges in another view, that tells the reader that:', type: 'mc', options: ['The feature must be interpreted across more than one view', 'The print is automatically wrong', 'The hole is not really there', 'The dimensions can be ignored'], correct: ['The feature must be interpreted across more than one view'] },
      { id: 'd1q20', prompt: 'Why is it dangerous to rely on one view alone when reading a fabrication print?', type: 'mc', options: ['One view rarely shows all surfaces, features, and dimensions clearly', 'One view always uses the wrong scale', 'One view cannot contain object lines', 'One view is only for inspectors'], correct: ['One view rarely shows all surfaces, features, and dimensions clearly'] },
    ],
  },
};

function storageKey(sessionId: string) {
  return `ltg_demo_classroom_${sessionId}`;
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}

export default function StudentDisplayClient({ sessionId, activityKey }: { sessionId: string; activityKey: string }) {
  const activity = ACTIVITIES[activityKey] ?? ACTIVITIES.preclass_math;
  const [studentName, setStudentName] = useState('Demo Student');
  const [answers, setAnswers] = useState<string[]>(() => activity.questions.map(() => ''));
  const [submitted, setSubmitted] = useState<DemoSubmission | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setAnswers(activity.questions.map(() => ''));
    setSubmitted(null);
  }, [activity.key, activity.questions]);

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

  const answeredCount = useMemo(() => answers.filter((answer) => answer.trim().length > 0).length, [answers]);

  const submit = () => {
    if (!sessionId || answeredCount !== activity.questions.length) return;
    const correct = activity.questions.reduce((sum, question, index) => {
      const answer = normalize(answers[index]);
      return sum + (question.correct.some((accepted) => normalize(accepted) === answer) ? 1 : 0);
    }, 0);
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
        {activity.instructions && <div className="instructions">{activity.instructions}</div>}
        <label className="name-field">Student name<input value={studentName} onChange={(event) => setStudentName(event.target.value)} /></label>
        <div className="progress"><span>{answeredCount} of {activity.questions.length} answered</span><strong>{Math.round((answeredCount / activity.questions.length) * 100)}%</strong></div>
        <div className="questions">
          {activity.questions.map((question, questionIndex) => (
            <section className="question" key={question.id}>
              <h2>{questionIndex + 1}. {question.prompt}</h2>
              {question.type === 'mc' ? (
                <div className="options">
                  {(question.options ?? []).map((option, optionIndex) => (
                    <button key={option} className={answers[questionIndex] === option ? 'option selected' : 'option'} onClick={() => setAnswers((current) => current.map((value, index) => index === questionIndex ? option : value))}>
                      <span>{String.fromCharCode(65 + optionIndex)}</span>{option}
                    </button>
                  ))}
                </div>
              ) : (
                <input className="text-answer" value={answers[questionIndex]} onChange={(event) => setAnswers((current) => current.map((value, index) => index === questionIndex ? event.target.value : value))} placeholder="Enter your answer" />
              )}
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
  .student-card { width:min(900px,100%); margin:0 auto; padding:28px; border:1px solid #2a4048; border-radius:16px; background:#10191e; box-shadow:0 22px 60px rgba(0,0,0,.34); }
  .kicker { color:#65dfff; font-size:11px; font-weight:900; letter-spacing:.13em; }
  h1 { margin:8px 0 8px; color:#fff; font-size:30px; } .subtitle,.temporary-note,p { color:#9aabb1; line-height:1.55; }
  .instructions { margin:18px 0 0; padding:13px 14px; border:1px solid #2a4651; border-radius:9px; background:#0c1b21; color:#a6bbc3; font-size:12px; line-height:1.55; }
  .name-field { display:grid; gap:7px; margin:22px 0; color:#b9c8cd; font-size:12px; font-weight:800; }
  .name-field input,.text-answer { padding:12px; border:1px solid #344850; border-radius:8px; background:#0a1216; color:#fff; font-size:15px; }
  .progress { display:flex; justify-content:space-between; gap:20px; margin:0 0 18px; padding:12px 14px; border:1px solid #27404b; border-radius:9px; background:#0c171c; color:#8ca0a8; }.progress strong { color:#69dfff; }
  .questions { display:grid; gap:14px; }.question { padding:18px; border:1px solid #283a42; border-radius:11px; background:#0d1519; }.question h2 { margin:0 0 13px; font-size:16px; color:#f4f8fa; line-height:1.4; }
  .options { display:grid; grid-template-columns:1fr 1fr; gap:9px; }.option { display:flex; gap:10px; align-items:center; padding:12px; border:1px solid #32454d; border-radius:8px; background:#121d22; color:#c8d4d8; text-align:left; cursor:pointer; }.option span { flex:0 0 24px; width:24px; height:24px; display:grid; place-items:center; border-radius:50%; background:#223139; color:#73defd; font-weight:900; }.option.selected { border-color:#59d6ff; background:#12303b; color:#fff; box-shadow:0 0 0 1px rgba(89,214,255,.16) inset; }.text-answer { width:100%; }
  .submit { width:100%; margin-top:18px; padding:14px; border:1px solid #39acd0; border-radius:9px; background:#0c7296; color:#fff; font-size:14px; font-weight:900; cursor:pointer; }.submit:disabled { opacity:.38; cursor:not-allowed; }
  .result-card { text-align:center; }.result-card .score { margin:28px auto 16px; font-size:72px; font-weight:950; color:#72e4b2; }.result-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:24px; }.result-grid div { display:grid; gap:4px; padding:14px; border:1px solid #2b3d45; border-radius:9px; background:#0c1519; }.result-grid span { color:#81939a; font-size:10px; text-transform:uppercase; }.result-grid strong { color:#fff; }
  .error-card { margin-top:10vh; text-align:center; }
  @media(max-width:650px) { .student-card { padding:20px; }.options,.result-grid { grid-template-columns:1fr; } h1 { font-size:24px; }.result-card .score { font-size:56px; } }
`;
