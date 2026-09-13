'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import DemoProgramWorkspace from '../_components/DemoProgramWorkspace';
import type { DemoProgram } from '../_lib/demo-types';

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

type DemoParticipant = {
  name: string;
  connectedAt: number;
  lastSeenAt: number;
};

type ClassroomRecord = {
  id: string;
  activityKey: string;
  title: string;
  courseCode: string;
  dayNumber: number;
  joinCode: string;
  startedAt: number;
  lastActivityAt: number;
  submissions: DemoSubmission[];
  participants: DemoParticipant[];
};

const DEMO_TIMEOUT_MS = 30 * 60 * 1000;

function genericStorageKey(programId: string) {
  return `ltg_demo_${programId}_full_system_v1`;
}

function classroomStorageKey(sessionId: string) {
  return `ltg_demo_classroom_${sessionId}`;
}

function makeSessionId(live: GenericLiveSession) {
  return `${live.activityKey}-${live.courseCode.replace(/\W+/g, '').toLowerCase()}-${live.dayNumber}-${live.startedAt}`;
}

function makeJoinCode(live: GenericLiveSession) {
  const course = live.courseCode.replace(/\D/g, '') || 'LTG';
  const suffix = String(live.startedAt).slice(-4);
  return `LTG-${course}-${suffix}`;
}

function readGenericState(programId: string): GenericDemoState | null {
  try {
    const raw = sessionStorage.getItem(genericStorageKey(programId));
    return raw ? JSON.parse(raw) as GenericDemoState : null;
  } catch {
    return null;
  }
}

function readClassroomRecord(sessionId: string): ClassroomRecord | null {
  try {
    const raw = localStorage.getItem(classroomStorageKey(sessionId));
    return raw ? JSON.parse(raw) as ClassroomRecord : null;
  } catch {
    return null;
  }
}

export default function WeldingDemoLiveWorkspace({ program }: { program: DemoProgram }) {
  const [genericState, setGenericState] = useState<GenericDemoState | null>(null);
  const [session, setSession] = useState<ClassroomRecord | null>(null);
  const [copyStatus, setCopyStatus] = useState('');
  const lastMirroredStart = useRef<number | null>(null);

  useEffect(() => {
    const sync = () => setGenericState(readGenericState(program.id));
    sync();
    const id = window.setInterval(sync, 250);
    return () => window.clearInterval(id);
  }, [program.id]);

  useEffect(() => {
    const live = genericState?.liveSession;
    if (!live) {
      setSession(null);
      lastMirroredStart.current = null;
      return;
    }

    const id = makeSessionId(live);
    const existing = readClassroomRecord(id);
    if (existing && Date.now() - existing.lastActivityAt <= DEMO_TIMEOUT_MS) {
      setSession(existing);
      lastMirroredStart.current = live.startedAt;
      return;
    }

    if (lastMirroredStart.current === live.startedAt && session?.id === id) return;

    const created: ClassroomRecord = {
      id,
      activityKey: live.activityKey,
      title: live.title,
      courseCode: live.courseCode,
      dayNumber: live.dayNumber,
      joinCode: makeJoinCode(live),
      startedAt: live.startedAt,
      lastActivityAt: Date.now(),
      submissions: [],
      participants: [],
    };
    try {
      localStorage.setItem(classroomStorageKey(id), JSON.stringify(created));
    } catch {
      // Demo remains usable as an instructor preview if browser storage is blocked.
    }
    lastMirroredStart.current = live.startedAt;
    setSession(created);
  }, [genericState?.liveSession, session?.id]);

  useEffect(() => {
    if (!session) return;
    const key = classroomStorageKey(session.id);
    const sync = () => {
      const latest = readClassroomRecord(session.id);
      if (!latest) return;
      if (Date.now() - latest.lastActivityAt > DEMO_TIMEOUT_MS) {
        localStorage.removeItem(key);
        setSession(null);
        return;
      }
      setSession(latest);
    };
    const id = window.setInterval(sync, 500);
    window.addEventListener('storage', sync);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('storage', sync);
    };
  }, [session?.id]);

  const liveMode = genericState?.activeModule === 'classroom';
  const studentUrl = useMemo(() => {
    if (!session || typeof window === 'undefined') return '';
    return `${window.location.origin}/demo/welding/student-display?session=${encodeURIComponent(session.id)}&activity=${encodeURIComponent(session.activityKey)}`;
  }, [session]);

  const uniqueParticipants = useMemo(() => {
    if (!session) return [] as DemoParticipant[];
    const byName = new Map<string, DemoParticipant>();
    session.participants?.forEach((participant) => byName.set(participant.name, participant));
    session.submissions.forEach((submission) => {
      if (!byName.has(submission.studentName)) {
        byName.set(submission.studentName, { name: submission.studentName, connectedAt: submission.submittedAt, lastSeenAt: submission.submittedAt });
      }
    });
    return Array.from(byName.values());
  }, [session]);

  const averageScore = useMemo(() => {
    if (!session?.submissions.length) return 0;
    return Math.round(session.submissions.reduce((sum, item) => sum + item.score, 0) / session.submissions.length);
  }, [session]);

  const copyLink = async () => {
    if (!studentUrl) return;
    try {
      await navigator.clipboard.writeText(studentUrl);
      setCopyStatus('Student link copied');
      window.setTimeout(() => setCopyStatus(''), 1800);
    } catch {
      setCopyStatus('Copy blocked by browser');
    }
  };

  const copyCode = async () => {
    if (!session) return;
    try {
      await navigator.clipboard.writeText(session.joinCode);
      setCopyStatus('Join code copied');
      window.setTimeout(() => setCopyStatus(''), 1800);
    } catch {
      setCopyStatus('Copy blocked by browser');
    }
  };

  const endSession = () => {
    if (session) localStorage.removeItem(classroomStorageKey(session.id));
    setSession(null);
    try {
      const raw = sessionStorage.getItem(genericStorageKey(program.id));
      if (raw) {
        const parsed = JSON.parse(raw);
        parsed.liveSession = null;
        sessionStorage.setItem(genericStorageKey(program.id), JSON.stringify(parsed));
      }
    } catch {
      // Temporary demo state only.
    }
    const endButton = Array.from(document.querySelectorAll('button')).find((button) => button.textContent?.trim() === 'End Demo Session') as HTMLButtonElement | undefined;
    endButton?.click();
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
                <p>Student work is temporary browser-session data. No live school records are used.</p>
              </div>
              <span className={session ? 'status active' : 'status'}>{session ? 'LIVE' : 'READY'}</span>
            </header>

            {!session ? (
              <div className="empty">
                <h2>Launch a connected activity</h2>
                <p>Use the activity card underneath this demo view, or return to Planner and select <strong>Launch Connected Activity</strong>. LTG will create a temporary session and student link automatically.</p>
                <button onClick={() => {
                  const planner = Array.from(document.querySelectorAll('button')).find((button) => button.textContent?.trim() === 'Planner') as HTMLButtonElement | undefined;
                  planner?.click();
                }}>Return to Planner</button>
              </div>
            ) : (
              <>
                <section className="session-card">
                  <div>
                    <span>{session.courseCode} · Day {session.dayNumber}</span>
                    <h2>{session.title}</h2>
                  </div>
                  <div className="join-block">
                    <span>Student join code</span>
                    <strong>{session.joinCode}</strong>
                    <button onClick={copyCode}>Copy code</button>
                  </div>
                </section>

                <div className="actions">
                  <button className="accent" onClick={() => window.open(studentUrl, '_blank', 'noopener,noreferrer')}>Open Student Screen</button>
                  <button onClick={copyLink}>Copy Student Link</button>
                  <button onClick={() => window.open(`/demo/welding/join?code=${encodeURIComponent(session.joinCode)}`, '_blank', 'noopener,noreferrer')}>Test Join Code</button>
                  <button className="danger" onClick={endSession}>End Demo Session</button>
                  {copyStatus && <span className="copy-status">{copyStatus}</span>}
                </div>

                <section className="metrics">
                  <article><span>CONNECTED</span><strong>{uniqueParticipants.length}</strong><small>students</small></article>
                  <article><span>RESPONDED</span><strong>{session.submissions.length}</strong><small>students</small></article>
                  <article><span>NEEDS REVIEW</span><strong>{session.submissions.filter((item) => item.score < 80).length}</strong><small>responses below 80%</small></article>
                  <article><span>AVERAGE SCORE</span><strong>{session.submissions.length ? `${averageScore}%` : '—'}</strong><small>submitted work</small></article>
                </section>

                <section className="results-card">
                  <div className="results-heading">
                    <div><span className="kicker">INSTRUCTOR RESULTS</span><h2>Live student submissions</h2></div>
                    <small>Updates automatically while this session is open</small>
                  </div>
                  {session.submissions.length === 0 ? (
                    <div className="waiting"><strong>Waiting for student work</strong><span>Open the Student Screen in another tab, complete the activity, and submit it. The result will appear here automatically.</span></div>
                  ) : (
                    <div className="result-table">
                      <div className="result-head"><span>Student</span><span>Status</span><span>Correct</span><span>Score</span><span>Submitted</span></div>
                      {session.submissions.slice().sort((a, b) => b.submittedAt - a.submittedAt).map((submission) => (
                        <div className="result-row" key={`${submission.studentName}-${submission.submittedAt}`}>
                          <strong>{submission.studentName}</strong>
                          <span className={submission.score >= 80 ? 'pass' : 'review'}>{submission.score >= 80 ? 'Complete' : 'Review'}</span>
                          <span>{submission.correct} / {submission.total}</span>
                          <strong>{submission.score}%</strong>
                          <span>{new Date(submission.submittedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <div className="privacy-note">Demo classroom data expires after 30 minutes of inactivity and is never written to the live LTG school database.</div>
              </>
            )}
          </div>

          <style jsx>{`
            .live-overlay { position:fixed; z-index:90; top:0; right:0; bottom:0; left:270px; overflow:auto; background:#090d10; color:#dce7eb; }
            .live-shell { min-height:100%; padding:24px 28px 40px; background:radial-gradient(circle at top right,#102a34 0,#090d10 38%); }
            .live-header { display:flex; align-items:flex-start; justify-content:space-between; gap:20px; padding:0 0 20px; border-bottom:1px solid #243139; }.live-header h1 { margin:5px 0 5px; color:#fff; font-size:28px; }.live-header p { margin:0; color:#83959c; font-size:11px; }.kicker { color:#61dcff; font-size:9px; font-weight:950; letter-spacing:.12em; }.status { padding:8px 12px; border:1px solid #3c494f; border-radius:999px; color:#8a999f; font-size:10px; font-weight:950; }.status.active { border-color:#28764f; background:#103324; color:#71e8b4; }
            .empty { margin-top:22px; padding:28px; border:1px solid #2a373d; border-radius:12px; background:#10171b; }.empty h2 { margin:0 0 8px; color:#fff; }.empty p { max-width:760px; color:#91a2a8; line-height:1.6; }
            button { border:1px solid #35444b; border-radius:7px; background:#182126; color:#d2dde1; padding:10px 12px; font-weight:850; cursor:pointer; }button:hover { border-color:#58d7ff; color:#fff; }.accent { border-color:#2faacb; background:#0d6d8f; color:#fff; }.danger { border-color:#70404a; background:#2a171c; color:#f0a4b2; }
            .session-card { display:flex; justify-content:space-between; gap:20px; align-items:center; margin-top:20px; padding:18px; border:1px solid #2c3b42; border-radius:11px; background:#10181c; }.session-card>div:first-child>span,.join-block span { color:#7d9097; font-size:9px; text-transform:uppercase; letter-spacing:.08em; }.session-card h2 { margin:5px 0 0; color:#fff; font-size:20px; }.join-block { display:grid; justify-items:end; gap:5px; }.join-block strong { color:#6ce1ff; font-size:24px; letter-spacing:.08em; }.join-block button { padding:6px 9px; font-size:9px; }
            .actions { display:flex; flex-wrap:wrap; align-items:center; gap:8px; margin:12px 0 16px; }.copy-status { color:#6ee4af; font-size:10px; font-weight:800; }
            .metrics { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:10px; }.metrics article { display:grid; gap:3px; padding:16px; border:1px solid #2a373d; border-radius:9px; background:#0f171a; }.metrics span { color:#75878e; font-size:8px; font-weight:900; letter-spacing:.08em; }.metrics strong { color:#fff; font-size:28px; }.metrics small { color:#7c8d93; font-size:9px; }
            .results-card { margin-top:16px; border:1px solid #2b3940; border-radius:11px; overflow:hidden; background:#0e1518; }.results-heading { display:flex; justify-content:space-between; gap:20px; align-items:flex-start; padding:16px 18px; border-bottom:1px solid #29363c; background:#121b1f; }.results-heading h2 { margin:4px 0 0; color:#fff; font-size:18px; }.results-heading small { color:#788991; }.waiting { display:grid; gap:6px; padding:24px 18px; color:#85979e; }.waiting strong { color:#d7e1e5; }.result-table { overflow:auto; }.result-head,.result-row { min-width:720px; display:grid; grid-template-columns:1.3fr .8fr .7fr .6fr 1fr; gap:12px; align-items:center; padding:11px 14px; }.result-head { color:#788a91; font-size:8px; font-weight:900; text-transform:uppercase; background:#10181c; }.result-row { border-top:1px solid #243138; color:#aebcc1; font-size:11px; }.result-row strong { color:#fff; }.pass { color:#70e5af; font-weight:900; }.review { color:#ffbe78; font-weight:900; }
            .privacy-note { margin-top:14px; padding:12px 14px; border:1px solid #24404b; border-radius:8px; background:#0b1c23; color:#7fa6b5; font-size:10px; }
            @media(max-width:900px) { .live-overlay { left:220px; }.metrics { grid-template-columns:1fr 1fr; }.session-card { align-items:flex-start; flex-direction:column; }.join-block { justify-items:start; } }
            @media(max-width:760px) { .live-overlay { left:0; top:0; }.live-shell { padding:18px 14px 30px; }.live-header { flex-direction:column; }.metrics { grid-template-columns:1fr 1fr; } }
            @media(max-width:520px) { .metrics { grid-template-columns:1fr; } }
          `}</style>
        </div>
      )}
    </>
  );
}
