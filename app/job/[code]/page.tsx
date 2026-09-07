'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { getSupabase } from '@/lib/supabase-browser';
import { formatErrorMessage } from '@/lib/format-error';
import type {
  JobCardEvidenceType,
  RequirementCheck,
  RecheckStatus,
  StudentJobCardPayload,
} from '@/lib/job-card-types';
import {
  correctionIsRequired,
  validateStudentJobCard,
} from '@/lib/job-card-validation';

const EVIDENCE_OPTIONS: Array<{ value: JobCardEvidenceType; label: string }> = [
  { value: 'photo', label: 'Photo' },
  { value: 'measurement', label: 'Measurement' },
  { value: 'inspection_test_result', label: 'Inspection / Test Result' },
];

export default function StudentLiveJobCardPage() {
  const { code } = useParams<{ code: string }>();
  const [supabase] = useState(getSupabase);
  const [payload, setPayload] = useState<StudentJobCardPayload | null>(null);
  const [name, setName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [started, setStarted] = useState(false);
  const [actualValues, setActualValues] = useState<Record<string, string>>({});
  const [requirementChecks, setRequirementChecks] = useState<Record<string, RequirementCheck>>({});
  const [startConfirmations, setStartConfirmations] = useState<Record<string, boolean>>({});
  const [qualityConfirmations, setQualityConfirmations] = useState<Record<string, boolean>>({});
  const [issueFound, setIssueFound] = useState('');
  const [correction, setCorrection] = useState('');
  const [recheckStatus, setRecheckStatus] = useState<RecheckStatus | ''>('');
  const [evidenceTypes, setEvidenceTypes] = useState<JobCardEvidenceType[]>([]);
  const [evidenceNote, setEvidenceNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const session = payload?.session ?? null;
  const storageKey = `ltg-job-card-${String(code).toUpperCase()}`;
  const needsCorrection = useMemo(
    () => correctionIsRequired(requirementChecks),
    [requirementChecks]
  );

  useEffect(() => {
    (async () => {
      const { data, error: rpcError } = await supabase.rpc('get_live_job_card', {
        p_join_code: String(code).toUpperCase(),
      });
      if (rpcError) {
        setError(formatErrorMessage(rpcError));
        return;
      }
      const loaded = data as StudentJobCardPayload;
      setPayload(loaded);
      try {
        const saved = JSON.parse(localStorage.getItem(storageKey) ?? '{}') as Record<string, unknown>;
        if (typeof saved.name === 'string') setName(saved.name);
        if (typeof saved.studentId === 'string') setStudentId(saved.studentId);
        if (saved.actualValues && typeof saved.actualValues === 'object') setActualValues(saved.actualValues as Record<string, string>);
        if (saved.requirementChecks && typeof saved.requirementChecks === 'object') setRequirementChecks(saved.requirementChecks as Record<string, RequirementCheck>);
        if (saved.startConfirmations && typeof saved.startConfirmations === 'object') setStartConfirmations(saved.startConfirmations as Record<string, boolean>);
        if (saved.qualityConfirmations && typeof saved.qualityConfirmations === 'object') setQualityConfirmations(saved.qualityConfirmations as Record<string, boolean>);
        if (typeof saved.issueFound === 'string') setIssueFound(saved.issueFound);
        if (typeof saved.correction === 'string') setCorrection(saved.correction);
        if (saved.recheckStatus === 'pass' || saved.recheckStatus === 'needs_more_work') setRecheckStatus(saved.recheckStatus);
        if (Array.isArray(saved.evidenceTypes)) setEvidenceTypes(saved.evidenceTypes as JobCardEvidenceType[]);
        if (typeof saved.evidenceNote === 'string') setEvidenceNote(saved.evidenceNote);
      } catch {
        // Ignore invalid local draft data.
      }
    })();
  }, [code, storageKey, supabase]);

  useEffect(() => {
    if (!session || submitted) return;
    localStorage.setItem(
      storageKey,
      JSON.stringify({
        name,
        studentId,
        actualValues,
        requirementChecks,
        startConfirmations,
        qualityConfirmations,
        issueFound,
        correction,
        recheckStatus,
        evidenceTypes,
        evidenceNote,
      })
    );
  }, [actualValues, correction, evidenceNote, evidenceTypes, issueFound, name, qualityConfirmations, recheckStatus, requirementChecks, session, startConfirmations, storageKey, studentId, submitted]);

  const setRequirementCheck = (key: string, value: RequirementCheck) => {
    setRequirementChecks((current) => ({ ...current, [key]: value }));
    if (value === 'na') setActualValues((current) => ({ ...current, [key]: '' }));
  };

  const toggleEvidence = (value: JobCardEvidenceType) => {
    setEvidenceTypes((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value]
    );
  };

  const submit = async () => {
    if (!session) return;
    const validationError = validateStudentJobCard({
      requirements: session.requirements,
      actualValues,
      requirementChecks,
      startChecks: session.start_checks,
      startConfirmations,
      qualityChecks: session.quality_checks,
      qualityConfirmations,
      issueFound,
      correction,
      recheckStatus,
    });
    if (validationError) {
      setError(validationError);
      return;
    }

    setBusy(true);
    setError('');
    try {
      const { error: rpcError } = await supabase.rpc('submit_live_job_card', {
        p_join_code: String(code).toUpperCase(),
        p_student_name: name.trim(),
        p_student_id: studentId.trim(),
        p_actual_values: actualValues,
        p_requirement_checks: requirementChecks,
        p_start_check_confirmations: startConfirmations,
        p_quality_check_confirmations: qualityConfirmations,
        p_issue_found: needsCorrection ? issueFound.trim() : null,
        p_correction: needsCorrection ? correction.trim() : null,
        p_recheck_status: needsCorrection ? recheckStatus : null,
        p_evidence_types: evidenceTypes,
        p_evidence_note: evidenceNote.trim() || null,
      });
      if (rpcError) throw rpcError;
      localStorage.removeItem(storageKey);
      setSubmitted(true);
    } catch (err) {
      setError(formatErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (error && !payload) return <main className="center"><div className="card"><h1>Unable to Open Job Card</h1><p className="error-text">{error}</p></div><style jsx>{styles}</style></main>;
  if (!session) return <main className="center">Opening Live Job Card…<style jsx>{styles}</style></main>;
  if (submitted) return <main className="center"><div className="card complete"><div className="check">✓</div><h1>Job Card Submitted</h1><p>Your instructor received your work record and will make the final review decision.</p></div><style jsx>{styles}</style></main>;

  if (!started) {
    return (
      <main className="center">
        <div className="card intro">
          <div className="eyebrow">PCCC Welding · Living Teacher Guide</div>
          <h1>{session.template_title}</h1>
          <p>Short classroom record. Your instructor has already loaded the job requirements.</p>
          <div className="job-summary"><strong>{session.job_header.jobPlannerDay}</strong><span>{session.job_header.processPosition}</span><span>{session.job_header.materialJoint}</span></div>
          {error && <div className="error">{error}</div>}
          <label>Student Name<input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" /></label>
          <label>Student ID<input value={studentId} onChange={(event) => setStudentId(event.target.value)} /></label>
          <button className="primary" disabled={!name.trim() || !studentId.trim()} onClick={() => setStarted(true)}>Open My Job Card</button>
          <small>Your entries are saved on this device until you submit.</small>
        </div>
        <style jsx>{styles}</style>
      </main>
    );
  }

  return (
    <main>
      <header className="student-top"><div><div className="eyebrow">Live Job Card</div><h1>{name}</h1></div><div className="timer">3–5 min entry</div></header>
      {error && <div className="error page-error">{error}</div>}

      <section className="card section">
        <div className="section-heading"><span>1</span><div><div className="eyebrow">Job Requirement</div><h2>Instructor / LTG preloaded</h2></div></div>
        <div className="identity-strip"><div><span>Student</span><strong>{name}</strong></div><div><span>Date</span><strong>{new Date(session.started_at).toLocaleDateString()}</strong></div><div><span>Class</span><strong>{session.class_label}</strong></div></div>
        <div className="header-grid">
          {[
            ['Job / Planner Day', session.job_header.jobPlannerDay],
            ['Drawing / Rev', session.job_header.drawingRevision || 'N/A'],
            ['WPS / SWPS', session.job_header.wpsSwps],
            ['Process / Position', session.job_header.processPosition],
            ['Material / Joint', session.job_header.materialJoint],
          ].map(([label, value]) => <div className="job-field" key={label}><span>{label}</span><strong>{value || 'N/A'}</strong></div>)}
        </div>
      </section>

      <section className="card section">
        <div className="section-heading"><span>2</span><div><div className="eyebrow">Critical Requirements</div><h2>Record only the values that matter for this job</h2></div></div>
        <div className="requirement-head"><b>Requirement</b><b>Required</b><b>Student Actual</b><b>Check</b></div>
        {session.requirements.map((requirement) => (
          <div className="requirement-row" key={requirement.key}>
            <strong>{requirement.label}</strong><span>{requirement.required}</span>
            <input value={actualValues[requirement.key] ?? ''} disabled={requirementChecks[requirement.key] === 'na'} onChange={(event) => setActualValues((current) => ({ ...current, [requirement.key]: event.target.value }))} placeholder={requirementChecks[requirement.key] === 'na' ? 'N/A' : 'Actual'} aria-label={`${requirement.label} actual value`} />
            <div className="check-buttons">{(['pass', 'correct', 'na'] as RequirementCheck[]).map((value) => <button type="button" key={value} className={requirementChecks[requirement.key] === value ? 'check-option active' : 'check-option'} onClick={() => setRequirementCheck(requirement.key, value)}>{value === 'pass' ? 'Pass' : value === 'correct' ? 'Correct' : 'N/A'}</button>)}</div>
          </div>
        ))}
      </section>

      <section className="card section">
        <div className="section-heading"><span>3</span><div><div className="eyebrow">Start Check</div><h2>Confirm before work begins</h2></div></div>
        <div className="check-grid">{session.start_checks.map((check) => <label className={startConfirmations[check] ? 'tick checked' : 'tick'} key={check}><input type="checkbox" checked={Boolean(startConfirmations[check])} onChange={(event) => setStartConfirmations((current) => ({ ...current, [check]: event.target.checked }))} /><span>{check}</span></label>)}</div>
      </section>

      <section className="card section">
        <div className="section-heading"><span>4</span><div><div className="eyebrow">Quick Quality Check</div><h2>Self-check, then send for instructor review</h2></div></div>
        <div className="quality-layout">
          <div className="check-grid one">{session.quality_checks.map((check) => <label className={qualityConfirmations[check] ? 'tick checked' : 'tick'} key={check}><input type="checkbox" checked={Boolean(qualityConfirmations[check])} onChange={(event) => setQualityConfirmations((current) => ({ ...current, [check]: event.target.checked }))} /><span>{check}</span></label>)}</div>
          <div className={needsCorrection ? 'correction active' : 'correction'}>
            <strong>{needsCorrection ? 'Correction record required' : 'If something was wrong'}</strong>
            <label>Issue Found<input value={issueFound} onChange={(event) => setIssueFound(event.target.value)} disabled={!needsCorrection} /></label>
            <label>Correction<input value={correction} onChange={(event) => setCorrection(event.target.value)} disabled={!needsCorrection} /></label>
            <div className="recheck"><button type="button" disabled={!needsCorrection} className={recheckStatus === 'pass' ? 'check-option active' : 'check-option'} onClick={() => setRecheckStatus('pass')}>Recheck PASS</button><button type="button" disabled={!needsCorrection} className={recheckStatus === 'needs_more_work' ? 'check-option active' : 'check-option'} onClick={() => setRecheckStatus('needs_more_work')}>Needs more work</button></div>
          </div>
        </div>
      </section>

      <section className="card section">
        <div className="section-heading"><span>5</span><div><div className="eyebrow">Live Classroom Evidence</div><h2>Optional</h2></div></div>
        <div className="evidence-options">{EVIDENCE_OPTIONS.map((item) => <button type="button" className={evidenceTypes.includes(item.value) ? 'evidence active' : 'evidence'} key={item.value} onClick={() => toggleEvidence(item.value)}>{item.label}</button>)}</div>
        <label className="note-label">Evidence Note (optional)<input value={evidenceNote} onChange={(event) => setEvidenceNote(event.target.value)} placeholder="Short note only" /></label>
      </section>

      <button className="submit" disabled={busy} onClick={submit}>{busy ? 'Submitting…' : 'Submit for Instructor Review'}</button>
      <p className="disclaimer">Classroom instructional record. The applicable drawing, WPS/SWPS, acceptance criteria, and formal qualification/test records remain controlling.</p>
      <style jsx>{styles}</style>
    </main>
  );
}

const styles = `
main{min-height:100vh;background:#0c141d;color:#dbe2e8;padding:18px;font-family:Arial,sans-serif}.center{display:grid;place-items:center}.card{box-sizing:border-box;width:min(880px,100%);margin:0 auto 14px;padding:18px;border:1px solid #30404d;border-radius:12px;background:#172532;box-shadow:0 12px 32px rgba(0,0,0,.16)}.intro{max-width:640px}.eyebrow{color:#ff681d;text-transform:uppercase;letter-spacing:.12em;font-size:10px;font-weight:900}h1,h2{color:#fff}.intro h1{margin:5px 0;font-size:28px}.intro p{color:#9aa8b4;line-height:1.5}.job-summary{display:grid;gap:6px;margin:14px 0;padding:13px;border:1px solid #344653;border-radius:9px;background:#101d27}.job-summary span{color:#aeb9c3}.intro label,.correction label,.note-label{display:grid;gap:6px;margin-top:13px;color:#aeb9c3;font-size:11px;font-weight:800;text-transform:uppercase}input{box-sizing:border-box;width:100%;padding:12px;border:1px solid #3c4d5b;border-radius:8px;background:#0e1a24;color:#f3f5f7;font:inherit}input:disabled{opacity:.5}.primary,.submit,.check-option,.evidence{padding:11px 13px;border:1px solid #425462;border-radius:8px;background:#14232e;color:#e6ebef;font-weight:850;cursor:pointer}.primary,.submit{width:100%;margin-top:16px;border-color:#ff681d;background:#e95916;color:#fff;padding:14px}.intro small{display:block;margin-top:10px;text-align:center;color:#7f8d98}.error{padding:11px 13px;border:1px solid #7b3c3c;border-radius:8px;background:#2a171a;color:#ffb0b0}.error-text{color:#ffb0b0}.page-error{width:min(880px,100%);box-sizing:border-box;margin:0 auto 14px}.student-top{display:flex;justify-content:space-between;align-items:center;width:min(880px,100%);margin:0 auto 14px;padding:4px}.student-top h1{margin:3px 0;font-size:23px}.timer{padding:7px 10px;border:1px solid #684328;border-radius:999px;background:#2a201a;color:#ffad7c;font-weight:850;font-size:11px}.section-heading{display:flex;gap:11px;align-items:center;margin-bottom:14px}.section-heading>span{display:grid;place-items:center;width:32px;height:32px;border-radius:50%;background:#e95916;color:white;font-weight:900}.section-heading h2{margin:3px 0;font-size:18px}.identity-strip{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:8px}.identity-strip>div{display:grid;gap:4px;padding:9px 11px;border:1px solid #344653;border-radius:8px;background:#101d27}.identity-strip span{color:#84919c;font-size:9px;text-transform:uppercase;font-weight:850}.identity-strip strong{color:#f0f3f5;font-size:12px}.header-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px}.job-field{display:grid;gap:5px;padding:11px;border:1px solid #344653;border-radius:8px;background:#101d27}.job-field span{color:#84919c;font-size:9px;text-transform:uppercase;font-weight:850}.job-field strong{font-size:13px;color:#f0f3f5}.requirement-head,.requirement-row{display:grid;grid-template-columns:1.25fr .9fr .9fr 1.35fr;gap:8px;align-items:center}.requirement-head{padding:0 8px 7px;color:#84919c;font-size:10px;text-transform:uppercase}.requirement-row{padding:9px 0;border-top:1px solid #2e3d49}.requirement-row>strong{font-size:12px}.requirement-row>span{color:#ffb185;font-weight:800;font-size:12px}.check-buttons,.recheck{display:grid;grid-template-columns:repeat(3,1fr);gap:5px}.check-option{padding:9px 6px;font-size:11px}.check-option.active,.evidence.active{border-color:#ff681d;background:#3b251c;color:#ffb184}.check-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.check-grid.one{grid-template-columns:1fr}.tick{display:flex;gap:9px;align-items:center;padding:11px;border:1px solid #344653;border-radius:8px;background:#101d27;color:#c9d1d7;font-size:12px;font-weight:750}.tick.checked{border-color:#4d765b;background:#13271d}.tick input{width:auto;accent-color:#ff681d}.quality-layout{display:grid;grid-template-columns:1fr 1fr;gap:12px}.correction{padding:13px;border:1px solid #344653;border-radius:9px;background:#101d27;opacity:.65}.correction.active{border-color:#725036;background:#251e19;opacity:1}.correction>strong{color:#ffad7c}.recheck{grid-template-columns:1fr 1fr;margin-top:10px}.evidence-options{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.evidence{font-size:12px}.submit{display:block;width:min(880px,100%);margin:18px auto}.disclaimer{width:min(880px,100%);margin:0 auto 40px;color:#71808b;font-size:10px;line-height:1.4;text-align:center}.complete{text-align:center;max-width:600px}.complete .check{font-size:56px;color:#78e7a0}.complete p{color:#9da9b4}@media(max-width:720px){main{padding:12px}.identity-strip,.header-grid,.check-grid,.quality-layout,.evidence-options{grid-template-columns:1fr}.requirement-head{display:none}.requirement-row{grid-template-columns:1fr}.check-buttons{grid-template-columns:repeat(3,1fr)}.student-top{align-items:flex-start}.section-heading h2{font-size:16px}}
`;
