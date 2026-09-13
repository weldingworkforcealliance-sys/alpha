'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import DemoProgramWorkspace from '../_components/DemoProgramWorkspace';
import type { DemoProgram } from '../_lib/demo-types';
import {
  createDemoClassroomSession,
  endDemoClassroomSession,
  getDemoClassroomResults,
  getDemoClassroomSubmissionReport,
  type DemoResultsPayload,
  type DemoSubmissionReport,
} from './_lib/demo-classroom-api';

type GenericLiveSession = {
  activityKey: string;
  title: string;
  courseCode: string;
  dayNumber: number;
  startedAt: number;
  joinCode: string;
};

type GenericDemoState = {
  activeModule?: string;
  currentDay?: number;
  selectedCourseCode?: string;
  liveSession?: GenericLiveSession | null;
};

type RemoteOwnerSession = {
  sessionId: string;
  instructorToken: string;
  joinCode: string;
  activityKey: string;
  title: string;
  courseCode: string;
  dayNumber: number;
  startedAt: number;
};

function genericStorageKey(programId: string) {
  return `ltg_demo_${programId}_full_system_v1`;
}

function ownerStorageKey(programId: string, startedAt: number) {
  return `ltg_demo_remote_owner_${programId}_${startedAt}`;
}

function summaryStorageKey(programId: string) {
  return `ltg_demo_classroom_summary_${programId}`;
}

function readGenericState(programId: string): GenericDemoState | null {
  try {
    const raw = sessionStorage.getItem(genericStorageKey(programId));
    return raw ? JSON.parse(raw) as GenericDemoState : null;
  } catch {
    return null;
  }
}

export default function WeldingDemoLiveWorkspace({ program }: { program: DemoProgram }) {
  const [genericState, setGenericState] = useState<GenericDemoState | null>(null);
  const [owner, setOwner] = useState<RemoteOwnerSession | null>(null);
  const [results, setResults] = useState<DemoResultsPayload | null>(null);
  const [report, setReport] = useState<DemoSubmissionReport | null>(null);
  const [copyStatus, setCopyStatus] = useState('');
  const [sessionError, setSessionError] = useState('');
  const [creating, setCreating] = useState(false);
  const creatingFor = useRef<number | null>(null);

  useEffect(() => {
    const sync = () => setGenericState(readGenericState(program.id));
    sync();
    const id = window.setInterval(sync, 300);
    return () => window.clearInterval(id);
  }, [program.id]);

  const live = genericState?.liveSession ?? null;
  const liveStart = live?.startedAt ?? null;
  const liveActivity = live?.activityKey ?? '';
  const liveTitle = live?.title ?? '';
  const liveCourse = live?.courseCode ?? '';
  const liveDay = live?.dayNumber ?? 0;

  useEffect(() => {
    let cancelled = false;

    const ensureRemoteSession = async () => {
      if (!liveStart || !liveActivity || !liveDay) {
        if (owner) {
          try {
            await endDemoClassroomSession(owner.sessionId, owner.instructorToken);
          } catch {
            // Expired/reset demo sessions are already inaccessible and can be discarded locally.
          }
          sessionStorage.removeItem(ownerStorageKey(program.id, owner.startedAt));
        }
        if (!cancelled) {
          setOwner(null);
          setResults(null);
          setReport(null);
          setSessionError('');
        }
        return;
      }

      if (owner?.startedAt === liveStart) return;
      if (creatingFor.current === liveStart) return;
      creatingFor.current = liveStart;
      setCreating(true);
      setSessionError('');

      const key = ownerStorageKey(program.id, liveStart);
      try {
        const saved = sessionStorage.getItem(key);
        if (saved) {
          const restored = JSON.parse(saved) as RemoteOwnerSession;
          try {
            const restoredResults = await getDemoClassroomResults(restored.sessionId, restored.instructorToken);
            if (!cancelled) {
              setOwner(restored);
              setResults(restoredResults);
            }
            return;
          } catch {
            sessionStorage.removeItem(key);
          }
        }

        const created = await createDemoClassroomSession({
          activityKey: liveActivity,
          title: liveTitle || 'Live Classroom Activity',
          courseCode: liveCourse || 'DEMO',
          dayNumber: liveDay,
        });
        const nextOwner: RemoteOwnerSession = {
          sessionId: created.session_id,
          instructorToken: created.instructor_token,
          joinCode: created.join_code,
          activityKey: liveActivity,
          title: liveTitle,
          courseCode: liveCourse,
          dayNumber: liveDay,
          startedAt: liveStart,
        };
        sessionStorage.setItem(key, JSON.stringify(nextOwner));
        if (!cancelled) setOwner(nextOwner);
      } catch (cause) {
        if (!cancelled) setSessionError(cause instanceof Error ? cause.message : 'Unable to create the temporary Live Classroom session.');
      } finally {
        creatingFor.current = null;
        if (!cancelled) setCreating(false);
      }
    };

    void ensureRemoteSession();
    return () => { cancelled = true; };
  }, [liveStart, liveActivity, liveTitle, liveCourse, liveDay, owner, program.id]);

  useEffect(() => {
    if (!owner) return;
    let cancelled = false;

    const poll = async () => {
      try {
        const next = await getDemoClassroomResults(owner.sessionId, owner.instructorToken);
        if (cancelled) return;
        setResults(next);
        setSessionError('');
        sessionStorage.setItem(summaryStorageKey(program.id), JSON.stringify({
          joinCode: owner.joinCode,
          activityKey: owner.activityKey,
          title: owner.title,
          connected: next.participants.length,
          responded: next.submissions.length,
          averageScore: next.submissions.length
            ? Math.round(next.submissions.reduce((sum, item) => sum + Number(item.percent), 0) / next.submissions.length)
            : null,
          needsReview: next.submissions.filter((item) => Number(item.percent) < 80).length,
          submissions: next.submissions,
          updatedAt: Date.now(),
        }));
      } catch (cause) {
        if (!cancelled) setSessionError(cause instanceof Error ? cause.message : 'The temporary Live Classroom session is unavailable.');
      }
    };

    void poll();
    const id = window.setInterval(() => void poll(), 1000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [owner, program.id]);

  const liveMode = genericState?.activeModule === 'classroom';
  const demoActivitiesForDay = useMemo(() => {
    const dayNumber = genericState?.currentDay ?? 1;
    return program.courses.flatMap((course) =>
      (course.days.find((day) => day.dayNumber === dayNumber)?.resources ?? [])
        .filter((resource) => resource.demoActivityKey)
        .map((resource) => ({ courseCode: course.code, title: resource.title }))
    );
  }, [genericState?.currentDay, program.courses]);

  const studentUrl = useMemo(() => {
    if (!owner || typeof window === 'undefined') return '';
    return `${window.location.origin}/demo/welding/student-display?code=${encodeURIComponent(owner.joinCode)}`;
  }, [owner]);

  const averageScore = useMemo(() => {
    if (!results?.submissions.length) return null;
    return Math.round(results.submissions.reduce((sum, item) => sum + Number(item.percent), 0) / results.submissions.length);
  }, [results]);

  const launchUnderlyingSession = (index: number) => {
    const launchButtons = Array.from(document.querySelectorAll('button')).filter(
      (button) => button.textContent?.trim() === 'Launch Temporary Session' && !button.closest('.live-overlay')
    ) as HTMLButtonElement[];
    launchButtons[index]?.click();
  };

  const copyText = async (value: string, success: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopyStatus(success);
      window.setTimeout(() => setCopyStatus(''), 1800);
    } catch {
      setCopyStatus('Copy blocked by browser');
    }
  };

  const reviewSubmission = async (submissionId: string) => {
    if (!owner) return;
    setSessionError('');
    try {
      const next = await getDemoClassroomSubmissionReport(submissionId, owner.instructorToken);
      setReport(next);
    } catch (cause) {
      setSessionError(cause instanceof Error ? cause.message : 'Unable to open the demo submission report.');
    }
  };

  const endSession = async () => {
    if (!owner) return;
    try {
      await endDemoClassroomSession(owner.sessionId, owner.instructorToken);
    } catch {
      // If the TTL already removed it, the local demo still needs to close cleanly.
    }
    sessionStorage.removeItem(ownerStorageKey(program.id, owner.startedAt));
    sessionStorage.removeItem(summaryStorageKey(program.id));
    setOwner(null);
    setResults(null);
    setReport(null);
    const underlyingEnd = Array.from(document.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'End Demo Session' && !button.closest('.live-overlay')
    ) as HTMLButtonElement | undefined;
    underlyingEnd?.click();
  };

  return (
    <>
      <DemoProgramWorkspace program={program} />

      {liveMode && (
        <div className="live-overlay" role="region" aria-label="Working Live Classroom demo">
          <div className="live-shell">
            <header className="live-header">
              <div>
                <span className="kicker">LTG LIVE CLASSROOM · CLOSED DEMO</span>
                <h1>Day {genericState?.currentDay ?? 1} connected activities</h1>
                <p>Separate phones, tablets, and computers can join this temporary session. No live school record is created.</p>
              </div>
              <span className={owner ? 'status active' : 'status'}>{owner ? 'LIVE' : creating ? 'STARTING' : 'READY'}</span>
            </header>

            {sessionError && <div className="session-error"><strong>Live Classroom notice</strong><span>{sessionError}</span></div>}

            {!owner ? (
              <div className="launch-grid">
                {demoActivitiesForDay.length ? demoActivitiesForDay.map((activity, index) => (
                  <article className="launch-card" key={`${activity.courseCode}-${activity.title}`}>
                    <span>{activity.courseCode}</span>
                    <h2>{activity.title}</h2>
                    <p>Creates a temporary 30-minute Live Classroom session with a cross-device join code and student link.</p>
                    <button className="accent" disabled={creating} onClick={() => launchUnderlyingSession(index)}>{creating ? 'Starting…' : 'Launch Temporary Session'}</button>
                  </article>
                )) : (
                  <div className="empty"><h2>No connected activity on Day {genericState?.currentDay ?? 1}</h2><p>Move to a demo day with a connected assessment. Day 1 contains the Pre-Class Welding Math Assessment and Day 5 contains Blueprint Reading — Day 1.</p></div>
                )}
              </div>
            ) : (
              <>
                <section className="session-card">
                  <div>
                    <span>{owner.courseCode} · Day {owner.dayNumber}</span>
                    <h2>{owner.title}</h2>
                  </div>
                  <div className="join-block">
                    <span>Student join code</span>
                    <strong>{owner.joinCode}</strong>
                    <button onClick={() => void copyText(owner.joinCode, 'Join code copied')}>Copy code</button>
                  </div>
                </section>

                <div className="actions">
                  <button className="accent" onClick={() => window.open(studentUrl, '_blank', 'noopener,noreferrer')}>Open Student Screen</button>
                  <button onClick={() => void copyText(studentUrl, 'Student link copied')}>Copy Student Link</button>
                  <button onClick={() => window.open(`/demo/welding/join?code=${encodeURIComponent(owner.joinCode)}`, '_blank', 'noopener,noreferrer')}>Test Join Code</button>
                  <button className="danger" onClick={() => void endSession()}>End Demo Session</button>
                  {copyStatus && <span className="copy-status">{copyStatus}</span>}
                </div>

                <section className="metrics">
                  <article><span>CONNECTED</span><strong>{results?.participants.length ?? 0}</strong><small>students</small></article>
                  <article><span>RESPONDED</span><strong>{results?.submissions.length ?? 0}</strong><small>students</small></article>
                  <article><span>NEEDS REVIEW</span><strong>{results?.submissions.filter((item) => Number(item.percent) < 80).length ?? 0}</strong><small>responses below 80%</small></article>
                  <article><span>AVERAGE SCORE</span><strong>{averageScore === null ? '—' : `${averageScore}%`}</strong><small>submitted work</small></article>
                </section>

                <section className="results-card">
                  <div className="results-heading">
                    <div><span className="kicker">INSTRUCTOR RESULTS</span><h2>Live student submissions</h2></div>
                    <small>Updates automatically while this session is active</small>
                  </div>
                  {!results?.submissions.length ? (
                    <div className="waiting"><strong>Waiting for student work</strong><span>Students can open the link or enter code <b>{owner.joinCode}</b> from another device. Connected students appear above before they submit.</span></div>
                  ) : (
                    <div className="result-table">
                      <div className="result-head"><span>Student</span><span>Status</span><span>Correct</span><span>Score</span><span>Submitted</span><span>Review</span></div>
                      {results.submissions.map((submission) => (
                        <div className="result-row" key={submission.submission_id}>
                          <strong>{submission.student_name}</strong>
                          <span className={Number(submission.percent) >= 80 ? 'pass' : 'review'}>{Number(submission.percent) >= 80 ? 'Complete' : 'Review'}</span>
                          <span>{submission.score} / {submission.possible_score}</span>
                          <strong>{Number(submission.percent)}%</strong>
                          <span>{new Date(submission.submitted_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
                          <button className="mini" onClick={() => void reviewSubmission(submission.submission_id)}>Open</button>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {report && (
                  <section className="review-card">
                    <div className="results-heading">
                      <div><span className="kicker">SUBMISSION REVIEW</span><h2>{report.submission.student_name} · {Number(report.submission.percent)}%</h2></div>
                      <button className="mini" onClick={() => setReport(null)}>Close review</button>
                    </div>
                    <div className="review-summary"><strong>{report.submission.score} / {report.submission.possible_score} correct</strong><span>{report.submission.assessment_title}</span></div>
                    <div className="review-list">
                      {report.questions.map((question) => (
                        <article className={question.is_correct ? 'review-question correct' : 'review-question missed'} key={question.key}>
                          <div className="review-question-head"><strong>{question.number}. {question.text}</strong><span>{question.is_correct ? 'Correct' : 'Needs review'}</span></div>
                          <p><b>Student:</b> {question.options?.[question.student_answer] ?? question.student_answer}</p>
                          {!question.is_correct && <p><b>Correct:</b> {question.options?.[question.correct_answer] ?? question.correct_answer}</p>}
                          {question.explanation && <small>{question.explanation}</small>}
                        </article>
                      ))}
                    </div>
                  </section>
                )}

                <div className="privacy-note">Demo classroom data is isolated from attendance, payroll, student records, and the live classroom tables. The session becomes inaccessible after 30 minutes of inactivity and is deleted from the demo store.</div>
              </>
            )}
          </div>

          <style jsx>{`
            .live-overlay { position:fixed; z-index:90; top:0; right:0; bottom:0; left:270px; overflow:auto; background:#090d10; color:#dce7eb; }
            .live-shell { min-height:100%; padding:24px 28px 40px; background:radial-gradient(circle at top right,#102a34 0,#090d10 38%); }
            .live-header { display:flex; align-items:flex-start; justify-content:space-between; gap:20px; padding:0 0 20px; border-bottom:1px solid #243139; }.live-header h1 { margin:5px 0; color:#fff; font-size:28px; }.live-header p { margin:0; color:#83959c; font-size:11px; }.kicker { color:#61dcff; font-size:9px; font-weight:950; letter-spacing:.12em; }.status { padding:8px 12px; border:1px solid #3c494f; border-radius:999px; color:#8a999f; font-size:10px; font-weight:950; }.status.active { border-color:#28764f; background:#103324; color:#71e8b4; }
            .session-error { display:flex; gap:10px; margin-top:14px; padding:12px 14px; border:1px solid #70404a; border-radius:8px; background:#28171c; color:#efa4b2; font-size:11px; }.session-error strong { color:#fff; }
            .launch-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; margin-top:20px; }.launch-card,.empty { padding:22px; border:1px solid #2a373d; border-radius:12px; background:#10171b; }.launch-card>span { color:#63dcff; font-size:9px; font-weight:900; }.launch-card h2,.empty h2 { margin:7px 0; color:#fff; }.launch-card p,.empty p { color:#91a2a8; line-height:1.6; font-size:11px; }
            button { border:1px solid #35444b; border-radius:7px; background:#182126; color:#d2dde1; padding:10px 12px; font-weight:850; cursor:pointer; }button:hover { border-color:#58d7ff; color:#fff; }button:disabled { opacity:.4; cursor:not-allowed; }.accent { border-color:#2faacb; background:#0d6d8f; color:#fff; }.danger { border-color:#70404a; background:#2a171c; color:#f0a4b2; }.mini { padding:6px 9px; font-size:9px; }
            .session-card { display:flex; justify-content:space-between; gap:20px; align-items:center; margin-top:20px; padding:18px; border:1px solid #2c3b42; border-radius:11px; background:#10181c; }.session-card>div:first-child>span,.join-block span { color:#7d9097; font-size:9px; text-transform:uppercase; letter-spacing:.08em; }.session-card h2 { margin:5px 0 0; color:#fff; font-size:20px; }.join-block { display:grid; justify-items:end; gap:5px; }.join-block strong { color:#6ce1ff; font-size:24px; letter-spacing:.12em; }.join-block button { padding:6px 9px; font-size:9px; }
            .actions { display:flex; flex-wrap:wrap; align-items:center; gap:8px; margin:12px 0 16px; }.copy-status { color:#6ee4af; font-size:10px; font-weight:800; }
            .metrics { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:10px; }.metrics article { display:grid; gap:3px; padding:16px; border:1px solid #2a373d; border-radius:9px; background:#0f171a; }.metrics span { color:#75878e; font-size:8px; font-weight:900; letter-spacing:.08em; }.metrics strong { color:#fff; font-size:28px; }.metrics small { color:#7c8d93; font-size:9px; }
            .results-card,.review-card { margin-top:16px; border:1px solid #2b3940; border-radius:11px; overflow:hidden; background:#0e1518; }.results-heading { display:flex; justify-content:space-between; gap:20px; align-items:flex-start; padding:16px 18px; border-bottom:1px solid #29363c; background:#121b1f; }.results-heading h2 { margin:4px 0 0; color:#fff; font-size:18px; }.results-heading small { color:#788991; }.waiting { display:grid; gap:6px; padding:24px 18px; color:#85979e; }.waiting strong { color:#d7e1e5; }
            .result-table { overflow:auto; }.result-head,.result-row { min-width:820px; display:grid; grid-template-columns:1.25fr .8fr .7fr .6fr 1fr .55fr; gap:12px; align-items:center; padding:11px 14px; }.result-head { color:#788a91; font-size:8px; font-weight:900; text-transform:uppercase; background:#10181c; }.result-row { border-top:1px solid #243138; color:#aebcc1; font-size:11px; }.result-row strong { color:#fff; }.pass { color:#70e5af; font-weight:900; }.review { color:#ffbe78; font-weight:900; }
            .review-summary { display:flex; justify-content:space-between; gap:14px; padding:12px 18px; color:#879aa1; font-size:11px; }.review-summary strong { color:#fff; }.review-list { display:grid; gap:8px; padding:0 18px 18px; }.review-question { padding:13px; border:1px solid #2b3940; border-radius:8px; background:#10181c; }.review-question.correct { border-left:3px solid #3a9a6c; }.review-question.missed { border-left:3px solid #c4853c; }.review-question-head { display:flex; justify-content:space-between; gap:12px; }.review-question-head strong { color:#ecf2f4; font-size:11px; }.review-question-head span { flex:0 0 auto; color:#9db0b7; font-size:9px; font-weight:900; text-transform:uppercase; }.review-question p { margin:8px 0 0; color:#aebbc0; font-size:10px; }.review-question small { display:block; margin-top:7px; color:#7f9299; }
            .privacy-note { margin-top:14px; padding:12px 14px; border:1px solid #24404b; border-radius:8px; background:#0b1c23; color:#7fa6b5; font-size:10px; line-height:1.5; }
            @media(max-width:900px) { .live-overlay { left:220px; }.metrics { grid-template-columns:1fr 1fr; }.session-card { align-items:flex-start; flex-direction:column; }.join-block { justify-items:start; } }
            @media(max-width:760px) { .live-overlay { left:0; }.live-shell { padding:18px 14px 30px; }.live-header,.results-heading,.review-summary { flex-direction:column; }.launch-grid { grid-template-columns:1fr; }.metrics { grid-template-columns:1fr 1fr; } }
            @media(max-width:520px) { .metrics { grid-template-columns:1fr; } }
          `}</style>
        </div>
      )}
    </>
  );
}
