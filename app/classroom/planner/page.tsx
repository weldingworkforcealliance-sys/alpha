'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import QRCode from 'qrcode';
import { getSupabase } from '@/lib/supabase-browser';
import { MAX_WELDING_CLASS_CAPACITY } from '@/lib/program-constraints';
import {
  type ClassroomSession,
  type ClassroomSubmission,
  createClassroomSession,
  endClassroomSession,
  expireClassroomSessions,
  findActiveClassroomSession,
  loadClassroomSubmissions,
  subscribeClassroomSubmissions,
} from '@/lib/classroom-session';

type Section = {
  section_id: string;
  section_name: string | null;
  section_code: string | null;
  course_code: string | null;
  course_name: string | null;
};

type Assessment = {
  slug: string;
  title: string;
  description: string | null;
  category: string;
  estimated_minutes: number | null;
  question_count: number;
  instructions: string | null;
  allow_team_members: boolean;
};

type Session = ClassroomSession;

type Submission = ClassroomSubmission;

export default function PlannerAssessmentLauncher() {
  const router = useRouter();
  const [supabase] = useState(getSupabase);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [section, setSection] = useState<Section | null>(null);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [expectedStudents, setExpectedStudents] = useState(MAX_WELDING_CLASS_CAPACITY);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [qr, setQr] = useState('');

  const joinUrl = useMemo(() => {
    if (!session || session.status !== 'active' || typeof window === 'undefined') return '';
    return `${window.location.origin}/join/${session.join_code}`;
  }, [session]);

  const submitted = submissions.length;
  const remaining = Math.max((session?.expected_students ?? expectedStudents) - submitted, 0);


  useEffect(() => {
    let alive = true;

    const initialize = async () => {
      try {
        const { data: auth } = await supabase.auth.getSession();
        if (!auth.session) {
          router.replace('/login');
          return;
        }

        const params = new URLSearchParams(window.location.search);
        const requestedSection = params.get('section')?.trim() ?? '';
        const requestedAssessment = params.get('assessment')?.trim() ?? '';

        if (!requestedSection || !requestedAssessment) {
          throw new Error('This planner assessment link is incomplete. Return to the planner and open the assessment from the assigned day.');
        }

        await expireClassroomSessions(supabase);

        const [sectionResult, assessmentResult] = await Promise.all([
          supabase
            .from('current_teaching_sections')
            .select('section_id,section_name,section_code,course_code,course_name')
            .eq('section_id', requestedSection)
            .maybeSingle(),
          supabase.rpc('list_assessment_modules_v2'),
        ]);

        if (sectionResult.error) throw sectionResult.error;
        if (assessmentResult.error) throw assessmentResult.error;

        const exactSection = sectionResult.data as Section | null;
        const assessmentRows = (assessmentResult.data ?? []) as Assessment[];
        const exactAssessment = assessmentRows.find((row) => row.slug === requestedAssessment) ?? null;

        if (!exactSection) {
          throw new Error('This planner assessment is not available for this signed-in instructor/class. Open it from the correct class planner.');
        }
        if (!exactAssessment) {
          throw new Error('The assessment linked to this planner day is not available.');
        }

        if (!alive) return;
        setSection(exactSection);
        setAssessment(exactAssessment);

        const restored = await findActiveClassroomSession(supabase, {
          sectionId: requestedSection,
          assessmentSlug: requestedAssessment,
        });

        if (restored && alive) {
          setSession(restored);
          setExpectedStudents(restored.expected_students);
        }
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : 'Unable to open this planner assessment.');
      } finally {
        if (alive) setLoading(false);
      }
    };

    initialize();
    return () => {
      alive = false;
    };
  }, [router, supabase]);

  useEffect(() => {
    if (!session || session.status !== 'active' || !joinUrl) {
      setQr('');
      return;
    }

    QRCode.toDataURL(joinUrl, {
      width: 360,
      margin: 2,
      color: { dark: '#050505', light: '#ffffff' },
    })
      .then(setQr)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));

    const refreshSubmissions = () =>
      loadClassroomSubmissions(supabase, session.id)
        .then(setSubmissions)
        .catch((err) => setError(err instanceof Error ? err.message : String(err)));

    refreshSubmissions();
    return subscribeClassroomSubmissions(
      supabase,
      session.id,
      refreshSubmissions,
      'planner-classroom'
    );
  }, [joinUrl, session?.id, session?.status, supabase]);

  const startAssessment = async () => {
    if (!section || !assessment) return;

    setBusy(true);
    setError('');
    setNotice('');

    try {
      const created = await createClassroomSession(supabase, {
        sectionId: section.section_id,
        assessmentSlug: assessment.slug,
        expectedStudents,
      });
      setSubmissions([]);
      setSession(created);
      setNotice('Assessment is live. Students may scan the QR code now.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start this assessment.');
    } finally {
      setBusy(false);
    }
  };

  const endAssessment = async () => {
    if (!session) return;
    setBusy(true);
    setError('');
    setNotice('');

    try {
      await endClassroomSession(supabase, session.id);
      setSession({ ...session, status: 'ended' });
      setQr('');
      setNotice('Assessment session ended. The student join code is no longer valid.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to end this assessment.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <main className="locked-loading">Opening planner assessment…</main>;
  }

  return (
    <div className="locked-shell">
      <header>
        <div>
          <div className="eyebrow">Living Teacher Guide · Planner Assessment</div>
          <h1>{assessment?.title ?? 'Planner Assessment'}</h1>
        </div>
        <button onClick={() => router.push('/dashboard')}>Back to Planner</button>
      </header>

      <main>
        {error && <div className="error">{error}</div>}
        {notice && <div className="notice">{notice}</div>}

        {!error && section && assessment && !session && (
          <section className="panel locked-launch">
            <div className="locked-badge">LOCKED TO THIS PLANNER DAY</div>
            <h2>{assessment.title}</h2>
            <p className="description">{assessment.description ?? 'This assessment is assigned to the current planner day.'}</p>

            <div className="facts">
              <div><span>Class</span><strong>{section.course_code ?? ''} · {section.section_name ?? section.section_code ?? 'Class'}</strong></div>
              <div><span>Assessment</span><strong>{assessment.title}</strong></div>
              <div><span>Questions</span><strong>{assessment.question_count}</strong></div>
              <div><span>Estimated Time</span><strong>{assessment.estimated_minutes ? `${assessment.estimated_minutes} min` : '—'}</strong></div>
            </div>

            {assessment.instructions && (
              <details>
                <summary>Instructor directions</summary>
                <p>{assessment.instructions}</p>
              </details>
            )}

            <label>
              Expected Students
              <input
                type="number"
                min={1}
                max={60}
                value={expectedStudents}
                onChange={(event) =>
                  setExpectedStudents(Math.min(60, Math.max(1, Number(event.target.value) || 1)))
                }
              />
            </label>

            <button className="start" disabled={busy} onClick={startAssessment}>
              {busy ? 'Starting…' : `Start ${assessment.title}`}
            </button>
            <p className="locked-note">No other assessment can be selected from this planner link.</p>
          </section>
        )}

        {!error && section && assessment && session && (
          <>
            <section className="panel live-grid">
              <div>
                <div className={session.status === 'active' ? 'live' : 'ended'}>
                  ● {session.status === 'active' ? 'LIVE' : 'ENDED'}
                </div>
                <div className="eyebrow">{section.course_code} · {section.section_name ?? section.section_code}</div>
                <h2>{assessment.title}</h2>

                {session.status === 'active' ? (
                  <>
                    <div className="code">{session.join_code}</div>
                    <a href={joinUrl} target="_blank" rel="noreferrer">{joinUrl}</a>
                    <p className="muted">
                      Join code valid until {new Date(session.expires_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.
                    </p>
                  </>
                ) : (
                  <p className="muted">This session has ended. Its student join code is no longer valid.</p>
                )}

                <div className="actions">
                  {session.status === 'active' && (
                    <button onClick={() => navigator.clipboard.writeText(joinUrl)}>Copy Student Link</button>
                  )}
                  {session.status === 'active' && (
                    <button className="danger" disabled={busy} onClick={endAssessment}>End Session</button>
                  )}
                  {session.status === 'ended' && (
                    <button className="start" onClick={() => { setSession(null); setSubmissions([]); setNotice(''); }}>Start New Session</button>
                  )}
                </div>
              </div>

              <div className="qr">
                {session.status === 'active' && qr && (
                  <img src={qr} alt="QR code for students to join this planner assessment" />
                )}
              </div>
            </section>

            <section className="panel">
              <div className="results-head">
                <div>
                  <div className="eyebrow">Live Progress</div>
                  <h2>{submitted} submitted · {remaining} remaining</h2>
                </div>
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Student</th><th>ID / Team</th><th>Score</th><th>Percent</th><th>Submitted</th></tr>
                  </thead>
                  <tbody>
                    {submissions.map((submission) => (
                      <tr key={submission.id}>
                        <td>{submission.student_name}</td>
                        <td>{submission.student_id}{submission.team_members && <small>{submission.team_members}</small>}</td>
                        <td>{submission.score}/{submission.possible_score}</td>
                        <td><strong>{Math.round((100 * submission.score) / Math.max(submission.possible_score, 1))}%</strong></td>
                        <td>{new Date(submission.submitted_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!submissions.length && <div className="empty">Waiting for student submissions…</div>}
              </div>
            </section>
          </>
        )}
      </main>

      <style jsx>{`
        .locked-shell{min-height:100vh;background:#080808;color:#ddd}
        .locked-loading{min-height:100vh;display:grid;place-items:center;background:#080808;color:#aaa}
        header{display:flex;justify-content:space-between;align-items:center;gap:18px;padding:20px 28px;border-bottom:1px solid #292929;background:#111}
        main{width:min(1050px,calc(100% - 28px));margin:auto;padding:28px 0 54px}
        h1,h2{margin:5px 0;color:#fff}
        .eyebrow{color:#9adf4b;text-transform:uppercase;letter-spacing:.12em;font-size:10px;font-weight:900}
        button{padding:11px 15px;border:1px solid #3b3b3b;border-radius:8px;background:#151515;color:#ddd;font-weight:850;cursor:pointer}
        button:disabled{opacity:.45;cursor:not-allowed}
        .panel{margin-bottom:16px;padding:22px;border:1px solid #292929;border-radius:12px;background:#131313}
        .locked-launch{max-width:780px;margin:38px auto}
        .locked-badge{display:inline-block;padding:6px 9px;border:1px solid #5d812e;border-radius:999px;background:rgba(154,223,75,.08);color:#caff77;font-size:10px;font-weight:900;letter-spacing:.08em}
        .description,.muted,.locked-note,details p{color:#8f8f8f;line-height:1.5}
        .facts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:20px 0}
        .facts>div{padding:13px;border:1px solid #292929;border-radius:8px;background:#0d0d0d}
        .facts span{display:block;margin-bottom:5px;color:#777;font-size:10px;font-weight:850;text-transform:uppercase;letter-spacing:.06em}
        .facts strong{color:#eee}
        details{margin:16px 0;color:#caff77}
        label{display:grid;gap:7px;margin:18px 0;color:#888;font-size:11px;font-weight:850;text-transform:uppercase}
        input{box-sizing:border-box;width:180px;padding:12px;border:1px solid #333;border-radius:7px;background:#090909;color:#eee;font-size:16px}
        .start{width:100%;border-color:#9adf4b;background:rgba(154,223,75,.08);color:#caff77}
        .locked-note{text-align:center;font-size:11px}
        .error,.notice{margin-bottom:15px;padding:13px;border-radius:8px}
        .error{border:1px solid #713333;background:#1c0c0c;color:#ff9999}
        .notice{border:1px solid #285d44;background:#0d2118;color:#a7f3ca}
        .live-grid{display:grid;grid-template-columns:1fr 380px;gap:28px;align-items:center}
        .live{color:#00ff88;font-weight:900}.ended{color:#ffb35c;font-weight:900}
        .code{margin:18px 0 8px;color:#fff;font-size:50px;font-weight:900;letter-spacing:.15em}
        a{color:#8edfff;overflow-wrap:anywhere}
        .actions{display:flex;gap:9px;flex-wrap:wrap;margin-top:18px}
        .danger{border-color:#7b3333;color:#ff9696}
        .qr{text-align:center}.qr img{width:min(100%,360px);border-radius:9px;background:#fff}
        .results-head{display:flex;justify-content:space-between;align-items:center;gap:15px}
        .table-wrap{overflow-x:auto}table{width:100%;border-collapse:collapse;margin-top:14px}
        th,td{padding:11px;border-bottom:1px solid #292929;text-align:left}
        th{color:#777;font-size:10px;text-transform:uppercase}td small{display:block;margin-top:3px;color:#888}
        .empty{text-align:center;padding:34px;color:#666}
        @media(max-width:760px){header{align-items:flex-start;flex-direction:column}.facts,.live-grid{grid-template-columns:1fr}.qr{order:-1}.code{font-size:36px}input{width:100%}}
      `}</style>
    </div>
  );
}
