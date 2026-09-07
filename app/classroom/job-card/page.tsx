'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import QRCode from 'qrcode';
import { getSupabase } from '@/lib/supabase-browser';
import { formatErrorMessage } from '@/lib/format-error';
import {
  endJobCardSession,
  expireJobCardSessions,
  findActiveJobCardSession,
  listJobCardTemplates,
  loadJobCardSubmissions,
  reviewJobCardSubmission,
  startJobCardSession,
  subscribeJobCardSubmissions,
} from '@/lib/job-card-session';
import type {
  JobCardDecision,
  JobCardHeader,
  JobCardRequirement,
  JobCardSession,
  JobCardSubmission,
  JobCardTemplate,
} from '@/lib/job-card-types';
import {
  JOB_CARD_MAX_STUDENTS,
  makeRequirementRows,
  validateInstructorJobSetup,
} from '@/lib/job-card-validation';

type Section = {
  section_id: string;
  section_name: string | null;
  section_code: string | null;
  course_code: string | null;
  course_name: string | null;
};

const EMPTY_HEADER: JobCardHeader = {
  jobPlannerDay: '',
  drawingRevision: 'N/A',
  wpsSwps: '',
  processPosition: '',
  materialJoint: '',
};

const DECISIONS: Array<{ value: JobCardDecision; label: string }> = [
  { value: 'pass_move_on', label: 'PASS - Move On' },
  { value: 'continue_practice', label: 'Continue Practice' },
  { value: 'rework_retry', label: 'Rework / Retry' },
];

export default function LiveJobCardInstructorPage() {
  const router = useRouter();
  const [supabase] = useState(getSupabase);
  const [sections, setSections] = useState<Section[]>([]);
  const [templates, setTemplates] = useState<JobCardTemplate[]>([]);
  const [sectionId, setSectionId] = useState('');
  const [templateSlug, setTemplateSlug] = useState('level2_school_job_card');
  const [header, setHeader] = useState<JobCardHeader>(EMPTY_HEADER);
  const [requirements, setRequirements] = useState<JobCardRequirement[]>([]);
  const [expectedStudents, setExpectedStudents] = useState(JOB_CARD_MAX_STUDENTS);
  const [session, setSession] = useState<JobCardSession | null>(null);
  const [submissions, setSubmissions] = useState<JobCardSubmission[]>([]);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState('');
  const [decision, setDecision] = useState<JobCardDecision>('pass_move_on');
  const [instructorNote, setInstructorNote] = useState('');
  const [qr, setQr] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.slug === templateSlug) ?? null,
    [templateSlug, templates]
  );
  const selectedSection = useMemo(
    () => sections.find((section) => section.section_id === sectionId) ?? null,
    [sectionId, sections]
  );
  const selectedSubmission = useMemo(
    () => submissions.find((submission) => submission.id === selectedSubmissionId) ?? null,
    [selectedSubmissionId, submissions]
  );
  const joinUrl =
    session?.status === 'active' && typeof window !== 'undefined'
      ? `${window.location.origin}/job/${session.join_code}`
      : '';
  const reviewedCount = submissions.filter((submission) => submission.reviewed_at).length;

  useEffect(() => {
    (async () => {
      try {
        const { data: auth } = await supabase.auth.getSession();
        if (!auth.session) {
          router.replace('/login');
          return;
        }

        await expireJobCardSessions(supabase);
        const [sectionResult, templateRows] = await Promise.all([
          supabase
            .from('current_teaching_sections')
            .select('section_id,section_name,section_code,course_code,course_name'),
          listJobCardTemplates(supabase),
        ]);
        if (sectionResult.error) throw sectionResult.error;

        const sectionRows = (sectionResult.data ?? []) as Section[];
        setSections(sectionRows);
        setTemplates(templateRows);

        const params = new URLSearchParams(window.location.search);
        const requestedSection = params.get('section');
        const requestedTemplate = params.get('template') || 'level2_school_job_card';
        const requestedDay = params.get('day');
        const validSection =
          requestedSection && sectionRows.some((row) => row.section_id === requestedSection)
            ? requestedSection
            : sectionRows[0]?.section_id || '';
        const validTemplate = templateRows.some((row) => row.slug === requestedTemplate)
          ? requestedTemplate
          : templateRows[0]?.slug || '';

        setSectionId(validSection);
        setTemplateSlug(validTemplate);
        if (requestedDay) {
          setHeader((current) => ({ ...current, jobPlannerDay: `Planner Day ${requestedDay}` }));
        }

        const template = templateRows.find((row) => row.slug === validTemplate);
        if (template) setRequirements(makeRequirementRows(template.default_requirement_labels));

        if (validSection) {
          const restored = await findActiveJobCardSession(supabase, {
            sectionId: validSection,
            templateSlug: validTemplate || undefined,
          });
          if (restored) {
            setSession(restored);
            setHeader(restored.job_header);
            setRequirements(restored.requirements);
            setExpectedStudents(restored.expected_students);
          }
        }
      } catch (err) {
        setError(formatErrorMessage(err));
      } finally {
        setLoading(false);
      }
    })();
  }, [router, supabase]);

  useEffect(() => {
    if (session || !selectedTemplate) return;
    setRequirements(makeRequirementRows(selectedTemplate.default_requirement_labels));
  }, [selectedTemplate, session]);

  useEffect(() => {
    if (!session || session.status !== 'active' || !joinUrl) {
      setQr('');
      return;
    }

    QRCode.toDataURL(joinUrl, {
      width: 340,
      margin: 2,
      color: { dark: '#050505', light: '#ffffff' },
    })
      .then(setQr)
      .catch((err) => setError(formatErrorMessage(err)));

    const refresh = () =>
      loadJobCardSubmissions(supabase, session.id)
        .then((rows) => {
          setSubmissions(rows);
          setSelectedSubmissionId((current) =>
            current && rows.some((row) => row.id === current) ? current : rows[0]?.id || ''
          );
        })
        .catch((err) => setError(formatErrorMessage(err)));

    refresh();
    return subscribeJobCardSubmissions(supabase, session.id, refresh);
  }, [joinUrl, session, supabase]);

  useEffect(() => {
    if (!selectedSubmission) return;
    setDecision(selectedSubmission.final_decision ?? 'pass_move_on');
    setInstructorNote(selectedSubmission.instructor_note ?? '');
  }, [selectedSubmission]);

  const updateRequirement = (index: number, field: 'label' | 'required', value: string) => {
    setRequirements((current) =>
      current.map((row, rowIndex) => (rowIndex === index ? { ...row, [field]: value } : row))
    );
  };

  const start = async () => {
    if (!sectionId || !templateSlug) return;
    const validationError = validateInstructorJobSetup({ header, requirements, expectedStudents });
    if (validationError) {
      setError(validationError);
      return;
    }

    setBusy(true);
    setError('');
    setNotice('');
    try {
      const created = await startJobCardSession(supabase, {
        sectionId,
        templateSlug,
        jobHeader: header,
        requirements,
        expectedStudents,
      });
      setSession(created);
      setSubmissions([]);
      setSelectedSubmissionId('');
      setNotice('Live Job Card opened for students.');
    } catch (err) {
      setError(formatErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const end = async () => {
    if (!session) return;
    setBusy(true);
    setError('');
    try {
      await endJobCardSession(supabase, session.id);
      setSession({ ...session, status: 'ended', ended_at: new Date().toISOString() });
      setNotice('Job Card session ended. The join code is no longer valid.');
    } catch (err) {
      setError(formatErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const saveReview = async () => {
    if (!selectedSubmission) return;
    setBusy(true);
    setError('');
    try {
      await reviewJobCardSubmission(supabase, {
        submissionId: selectedSubmission.id,
        decision,
        instructorNote,
      });
      const rows = await loadJobCardSubmissions(supabase, session?.id ?? '');
      setSubmissions(rows);
      setNotice(`Instructor review saved for ${selectedSubmission.student_name}.`);
    } catch (err) {
      setError(formatErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setSession(null);
    setSubmissions([]);
    setSelectedSubmissionId('');
    setHeader(EMPTY_HEADER);
    setExpectedStudents(JOB_CARD_MAX_STUDENTS);
    if (selectedTemplate) setRequirements(makeRequirementRows(selectedTemplate.default_requirement_labels));
    setNotice('');
    setError('');
  };

  if (loading) {
    return <main className="loading">Opening Live Job Card…<style jsx>{styles}</style></main>;
  }

  return (
    <div className="shell">
      <header className="topbar">
        <div>
          <div className="eyebrow">Living Teacher Guide · Live Classroom</div>
          <h1>Level II Live Job Card</h1>
          <p>3–5 minute student entry · instructor-controlled requirement-to-evidence record</p>
        </div>
        <button onClick={() => router.push('/planner')}>Back to Planner</button>
      </header>

      <main>
        {error && <div className="error">{error}</div>}
        {notice && <div className="notice">{notice}</div>}

        {!session ? (
          <section className="panel setup">
            <div className="section-title">
              <div><span>Instructor setup</span><h2>Preload the job. Students only enter the actual evidence.</h2></div>
              <strong>MAX {JOB_CARD_MAX_STUDENTS} STUDENTS</strong>
            </div>

            <div className="grid two">
              <label>Class
                <select value={sectionId} onChange={(event) => setSectionId(event.target.value)}>
                  {sections.map((section) => (
                    <option key={section.section_id} value={section.section_id}>
                      {section.course_code ?? ''} · {section.section_name ?? section.section_code ?? 'Class'}
                    </option>
                  ))}
                </select>
              </label>
              <label>Job Card Template
                <select value={templateSlug} onChange={(event) => setTemplateSlug(event.target.value)}>
                  {templates.map((template) => (
                    <option key={template.slug} value={template.slug}>{template.title}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="job-header">
              <label>Job / Planner Day<input value={header.jobPlannerDay} onChange={(event) => setHeader({ ...header, jobPlannerDay: event.target.value })} placeholder="Job # / Day #" /></label>
              <label>Drawing / Rev<input value={header.drawingRevision} onChange={(event) => setHeader({ ...header, drawingRevision: event.target.value })} placeholder="Drawing ID + Rev or N/A" /></label>
              <label>WPS / SWPS<input value={header.wpsSwps} onChange={(event) => setHeader({ ...header, wpsSwps: event.target.value })} placeholder="Procedure ID or N/A" /></label>
              <label>Process / Position<input value={header.processPosition} onChange={(event) => setHeader({ ...header, processPosition: event.target.value })} placeholder="e.g., SMAW / 3G" /></label>
              <label>Material / Joint<input value={header.materialJoint} onChange={(event) => setHeader({ ...header, materialJoint: event.target.value })} placeholder="Material + joint" /></label>
              <label>Expected Students<input type="number" min={1} max={JOB_CARD_MAX_STUDENTS} value={expectedStudents} onChange={(event) => setExpectedStudents(Math.min(JOB_CARD_MAX_STUDENTS, Math.max(1, Number(event.target.value) || 1)))} /></label>
            </div>

            <div className="requirements">
              <div className="section-title compact"><div><span>Critical requirements</span><h3>Only the few values that matter for this job</h3></div></div>
              {requirements.map((requirement, index) => (
                <div className="requirement-row" key={requirement.key}>
                  <strong>{index + 1}</strong>
                  <input value={requirement.label} onChange={(event) => updateRequirement(index, 'label', event.target.value)} aria-label={`Requirement ${index + 1} label`} />
                  <input value={requirement.required} onChange={(event) => updateRequirement(index, 'required', event.target.value)} placeholder="Required value / range / N/A" aria-label={`Requirement ${index + 1} required value`} />
                </div>
              ))}
            </div>

            <div className="preview-strip">
              <div><strong>Student Start Check</strong><small>{selectedTemplate?.start_checks.length ?? 0} confirmations</small></div>
              <div><strong>Quick Quality Check</strong><small>{selectedTemplate?.quality_checks.length ?? 0} confirmations</small></div>
              <div><strong>Student workload</strong><small>{selectedTemplate?.estimated_student_minutes ?? 5} minutes target</small></div>
            </div>

            <button className="primary full" disabled={busy || !sectionId || !templateSlug} onClick={start}>
              {busy ? 'Opening…' : 'Start Live Job Card'}
            </button>
            {!sections.length && <p className="muted">No assigned teaching sections were found for this account.</p>}
          </section>
        ) : (
          <>
            <section className="panel live-panel">
              <div className="live-main">
                <div className={session.status === 'active' ? 'live' : 'ended'}>● {session.status === 'active' ? 'LIVE' : 'ENDED'}</div>
                <div className="eyebrow">{selectedSection?.course_code} · {selectedSection?.section_name ?? selectedSection?.section_code}</div>
                <h2>{session.job_header.jobPlannerDay}</h2>
                <p>{session.job_header.processPosition} · {session.job_header.materialJoint}</p>
                {session.status === 'active' ? (
                  <>
                    <div className="code">{session.join_code}</div>
                    <a href={joinUrl} target="_blank" rel="noreferrer">{joinUrl}</a>
                    <small>Valid until {new Date(session.expires_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</small>
                  </>
                ) : <p className="muted">The student join code is no longer valid.</p>}
                <div className="actions">
                  {session.status === 'active' && <button onClick={() => navigator.clipboard.writeText(joinUrl)}>Copy Student Link</button>}
                  <button className="danger" disabled={busy || session.status !== 'active'} onClick={end}>End Session</button>
                  {session.status === 'ended' && <button className="primary" onClick={reset}>New Job Card</button>}
                </div>
              </div>
              <div className="qr">{session.status === 'active' && qr && <img src={qr} alt="QR code to open the live job card" />}</div>
            </section>

            <section className="panel">
              <div className="section-title">
                <div><span>Live progress</span><h2>{submissions.length} submitted · {reviewedCount} reviewed</h2></div>
                <strong>{Math.max(session.expected_students - submissions.length, 0)} remaining</strong>
              </div>
              <div className="submission-list">
                {submissions.map((submission) => (
                  <button className={selectedSubmissionId === submission.id ? 'submission selected' : 'submission'} key={submission.id} onClick={() => setSelectedSubmissionId(submission.id)}>
                    <span><strong>{submission.student_name}</strong><small>{submission.student_id}</small></span>
                    <span>{submission.final_decision ? decisionLabel(submission.final_decision) : 'Awaiting instructor review'}</span>
                    <time>{new Date(submission.submitted_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</time>
                  </button>
                ))}
                {!submissions.length && <div className="empty">Waiting for student job cards…</div>}
              </div>
            </section>

            {selectedSubmission && (
              <section className="panel review">
                <div className="section-title"><div><span>Instructor review</span><h2>{selectedSubmission.student_name}</h2><p>ID {selectedSubmission.student_id}</p></div><strong>{selectedSubmission.reviewed_at ? 'REVIEWED' : 'READY'}</strong></div>
                <div className="review-grid">
                  {session.requirements.map((requirement) => (
                    <div className="review-item" key={requirement.key}>
                      <span>{requirement.label}</span>
                      <strong>Required: {requirement.required}</strong>
                      <b>Actual: {selectedSubmission.actual_values[requirement.key] || 'N/A'}</b>
                      <em>{checkLabel(selectedSubmission.requirement_checks[requirement.key])}</em>
                    </div>
                  ))}
                </div>
                {(selectedSubmission.issue_found || selectedSubmission.correction) && (
                  <div className="correction-box"><strong>Correction record</strong><p>Issue: {selectedSubmission.issue_found || '—'}</p><p>Correction: {selectedSubmission.correction || '—'}</p><p>Recheck: {selectedSubmission.recheck_status === 'pass' ? 'PASS' : 'Needs more work'}</p></div>
                )}
                {selectedSubmission.evidence_types.length > 0 && (
                  <div className="evidence"><strong>Evidence marked by student:</strong> {selectedSubmission.evidence_types.map(evidenceLabel).join(' · ')}{selectedSubmission.evidence_note ? ` · ${selectedSubmission.evidence_note}` : ''}</div>
                )}
                <div className="decision-grid">
                  {DECISIONS.map((item) => (
                    <button key={item.value} className={decision === item.value ? 'decision active' : 'decision'} onClick={() => setDecision(item.value)}>{item.label}</button>
                  ))}
                </div>
                <label>Instructor Note (optional)<textarea value={instructorNote} onChange={(event) => setInstructorNote(event.target.value)} placeholder="Short note only" /></label>
                <button className="primary full" disabled={busy} onClick={saveReview}>{busy ? 'Saving…' : 'Save Instructor Review'}</button>
                <p className="auto-record">Instructor identity, class, date and time are recorded automatically by LTG.</p>
              </section>
            )}
          </>
        )}
      </main>
      <style jsx>{styles}</style>
    </div>
  );
}

function checkLabel(value: string | undefined) {
  if (value === 'pass') return 'Pass';
  if (value === 'correct') return 'Corrected';
  return 'N/A';
}

function evidenceLabel(value: string) {
  if (value === 'inspection_test_result') return 'Inspection/Test Result';
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function decisionLabel(value: JobCardDecision) {
  return DECISIONS.find((item) => item.value === value)?.label ?? value;
}

const styles = `
.shell{min-height:100vh;background:#0c141d;color:#d9e0e7;font-family:Arial,sans-serif}.loading{min-height:100vh;display:grid;place-items:center;background:#0c141d;color:#aeb8c2}.topbar{display:flex;justify-content:space-between;gap:20px;align-items:center;padding:22px 28px;border-bottom:1px solid #2c3945;background:#142230}.topbar h1{margin:4px 0 2px;color:#fff;font-size:30px}.topbar p{margin:0;color:#9eabb7}.eyebrow,.section-title span{color:#ff681d;text-transform:uppercase;letter-spacing:.13em;font-size:10px;font-weight:900}main{width:min(1120px,calc(100% - 28px));margin:auto;padding:24px 0 60px}.panel{margin-bottom:16px;padding:20px;border:1px solid #30404d;border-radius:12px;background:#172532;box-shadow:0 12px 35px rgba(0,0,0,.18)}.setup{max-width:960px;margin:28px auto}.section-title{display:flex;justify-content:space-between;gap:16px;align-items:flex-start}.section-title h2,.section-title h3{margin:5px 0;color:#fff}.section-title p{margin:4px 0;color:#9ba8b4}.section-title>strong{padding:7px 10px;border:1px solid #784624;border-radius:999px;color:#ff9b63;background:#2b201b;font-size:11px}.compact{margin-top:22px}.grid.two{display:grid;grid-template-columns:1fr 1fr;gap:12px}.job-header{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.setup label,.review label{display:grid;gap:7px;margin-top:16px;color:#aeb9c3;font-size:11px;font-weight:800;text-transform:uppercase}input,select,textarea{box-sizing:border-box;width:100%;padding:12px;border:1px solid #3c4d5b;border-radius:8px;background:#0e1a24;color:#f2f5f7;font:inherit}textarea{min-height:88px;resize:vertical}.requirements{margin-top:8px}.requirement-row{display:grid;grid-template-columns:38px 1.3fr 1fr;gap:10px;align-items:center;margin-top:8px}.requirement-row>strong{display:grid;place-items:center;width:32px;height:32px;border-radius:50%;background:#2d3943;color:#ff8a4c}.preview-strip{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:20px 0}.preview-strip>div{display:grid;gap:4px;padding:13px;border:1px solid #344552;border-radius:9px;background:#101d27}.preview-strip small{color:#8795a1}.primary,button{padding:11px 14px;border:1px solid #41505b;border-radius:8px;background:#1a2a36;color:#e6ebef;font-weight:800;cursor:pointer}.primary{border-color:#ff681d;background:#e95916;color:#fff}.danger{border-color:#774044;color:#ffb0b4;background:#2b1c22}.full{width:100%;margin-top:16px;padding:14px}.error,.notice{margin-bottom:14px;padding:12px 14px;border-radius:8px}.error{border:1px solid #7d3b3b;background:#2b171a;color:#ffb0b0}.notice{border:1px solid #376d56;background:#122a22;color:#9fe0bd}.live-panel{display:grid;grid-template-columns:1fr 320px;gap:20px}.live,.ended{margin-bottom:8px;font-weight:900;letter-spacing:.08em}.live{color:#76e89a}.ended{color:#ff9c9c}.live-main h2{margin:6px 0;color:#fff;font-size:27px}.live-main p,.live-main small{color:#9ca9b5}.code{margin:12px 0 4px;color:#fff;font-size:48px;font-weight:950;letter-spacing:.16em}.live-main a{color:#ff9a61}.actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px}.qr{display:grid;place-items:center}.qr img{width:min(100%,280px);padding:8px;border-radius:10px;background:white}.submission-list{display:grid;gap:8px;margin-top:14px}.submission{display:grid;grid-template-columns:1fr 220px 90px;gap:12px;align-items:center;text-align:left;background:#101d27}.submission.selected{border-color:#ff681d;box-shadow:0 0 0 1px #ff681d inset}.submission span:first-child{display:grid}.submission small{color:#8794a0}.submission span:nth-child(2){color:#c8d1d8}.submission time{color:#8794a0;text-align:right}.empty{padding:22px;text-align:center;color:#7f8c97;border:1px dashed #3a4b58;border-radius:9px}.review-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-top:14px}.review-item{display:grid;gap:5px;padding:13px;border:1px solid #344653;border-radius:9px;background:#101d27}.review-item span{color:#9ba7b2;font-size:11px}.review-item strong,.review-item b{color:#eef2f5}.review-item em{color:#ff9b63;font-style:normal;font-weight:800}.correction-box,.evidence{margin-top:12px;padding:13px;border:1px solid #5d4934;border-radius:9px;background:#231e19}.correction-box p{margin:5px 0;color:#c4cbd1}.decision-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;margin-top:16px}.decision.active{border-color:#ff681d;background:#3b251c;color:#ffb184}.auto-record{margin:10px 0 0;text-align:center;color:#7f8d98;font-size:11px}.muted{color:#8794a0}@media(max-width:760px){.topbar{align-items:flex-start}.job-header,.grid.two,.preview-strip,.review-grid,.decision-grid{grid-template-columns:1fr}.requirement-row{grid-template-columns:30px 1fr}.requirement-row input:last-child{grid-column:2}.live-panel{grid-template-columns:1fr}.submission{grid-template-columns:1fr}.submission time{text-align:left}.qr{order:-1}.code{font-size:38px}.section-title{display:grid}}
`;
