'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { getSupabase } from '@/lib/supabase-browser';

type Student = { id: string; name: string; active: boolean };
type Section = { id: string; name: string; course: string; held: boolean; students: Student[] };
type Criterion = { criterion: string; required: string; observed: string; met: boolean };
type Signoff = { id: string; gate: string; decision: string; evidence_reference: string; criteria_reference: string;
  observation: string; criterion_results: Criterion[]; bend_result: string | null; expires_at: string | null;
  instructor_name: string; recorded_at: string; release_valid: boolean; can_proceed: boolean };
type Review = { enrolled: boolean; instruction_available: boolean; history: Signoff[] };
type Target = { section: string; student: string; scope: string };
const gates: Record<string, { key: string; label: string }[]> = {
  'WLD 114': [{ key: 'cnc', label: 'CNC machine authorization' }],
  'WLD 120': [{ key: 'qc20', label: 'Day 20 QC release' }, { key: 'qc30', label: 'Day 30 QC release' }, { key: 'qc40', label: 'Day 40 QC release' }],
  'WLD 150': [{ key: 'bend31', label: 'Day 31 bend-test review' }],
};
const blankRow = () => ({ criterion: '', required: '', observed: '', met: '' });
const targetKey = (t: Target) => JSON.stringify([t.section, t.student, t.scope.trim()]);

export default function SignoffsPage() {
  const [supabase] = useState(getSupabase);
  const [sections, setSections] = useState<Section[]>([]);
  const [target, setTarget] = useState<Target>({ section: '', student: '', scope: '' });
  const [loadedTarget, setLoadedTarget] = useState<Target | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const [gate, setGate] = useState('');
  const [decision, setDecision] = useState('hold');
  const [evidence, setEvidence] = useState('');
  const [criteria, setCriteria] = useState('');
  const [observation, setObservation] = useState('');
  const [rows, setRows] = useState([blankRow()]);
  const [bend, setBend] = useState('');
  const [expiry, setExpiry] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const request = useRef(0);
  // Server RPCs restrict access to assigned PVHS sections and authorized reviewers.
  const selected = sections.find(s => s.id === target.section);
  const loaded = !!review && !!loadedTarget && targetKey(target) === targetKey(loadedTarget);

  const loadCatalog = async () => {
    setBusy(true); setError('');
    try {
      const result = await supabase.rpc('pvhs55_signoff_catalog');
      if (result.error) throw result.error;
      setSections((result.data ?? []) as Section[]);
    } catch { setError('Unable to load signoff sections. Sign in as an assigned instructor or school reviewer, then retry.'); }
    finally { setBusy(false); }
  };
  useEffect(() => { void loadCatalog(); }, [supabase]);

  const clearForm = () => {
    setDecision('hold'); setEvidence(''); setCriteria(''); setObservation(''); setRows([blankRow()]); setBend(''); setExpiry('');
  };
  const changeTarget = (next: Target) => {
    request.current += 1; setTarget(next); setReview(null); setLoadedTarget(null); setMessage(''); setError(''); clearForm();
    setGate(gates[sections.find(s => s.id === next.section)?.course ?? '']?.[0]?.key ?? '');
  };
  const loadHistory = async () => {
    const captured = { ...target, scope: target.scope.trim() };
    const token = ++request.current;
    setBusy(true); setError(''); setReview(null); setLoadedTarget(null); setMessage('');
    try {
      const result = await supabase.rpc('pvhs55_signoff_read', { p_section: captured.section, p_student: captured.student, p_scope: captured.scope });
      if (result.error) throw result.error;
      if (token !== request.current) return;
      setReview(result.data as Review); setLoadedTarget(captured);
    } catch { if (token === request.current) setError('Unable to load this student’s signoffs. Check enrollment, section access and the machine or job name.'); }
    finally { if (token === request.current) setBusy(false); }
  };
  const saveSignoff = async () => {
    if (!loadedTarget || !review || targetKey(target) !== targetKey(loadedTarget) || busy) return;
    if (!evidence.trim() || !criteria.trim() || !observation.trim() || rows.some(r => !r.criterion.trim() || !r.required.trim() || !r.observed.trim() || !['yes', 'no'].includes(r.met))) {
      setError('Complete the evidence, acceptance reference, observation and each criterion decision.'); return;
    }
    if (decision === 'release' && (rows.some(r => r.met !== 'yes') || (gate === 'bend31' && bend !== 'passed'))) {
      setError('Release requires every criterion to be met and a passed bend test when applicable.'); return;
    }
    const captured = { ...loadedTarget };
    const previous = review.history.find(h => h.gate === gate)?.id ?? null;
    setBusy(true); setError(''); setMessage('');
    let saved = false;
    try {
      const result = await supabase.rpc('pvhs55_signoff_record', {
        p_section: captured.section, p_student: captured.student, p_scope: captured.scope,
        p_gate: gate, p_decision: decision, p_evidence: evidence.trim(), p_criteria: criteria.trim(), p_observation: observation.trim(),
        p_results: rows.map(r => ({ criterion: r.criterion.trim(), required: r.required.trim(), observed: r.observed.trim(), met: r.met === 'yes' })),
        p_bend_result: gate === 'bend31' ? bend || null : null,
        p_expires_at: gate === 'cnc' && expiry ? new Date(expiry).toISOString() : null,
        p_expected_previous: previous,
      });
      if (result.error) throw result.error;
      saved = true;
      const refreshed = await supabase.rpc('pvhs55_signoff_read', { p_section: captured.section, p_student: captured.student, p_scope: captured.scope });
      if (refreshed.error) throw refreshed.error;
      setReview(refreshed.data as Review); clearForm();
      setMessage('Instructor signoff saved. Earlier reviews remain in the history. No grade or calendar date was changed.');
    } catch (err) {
      setLoadedTarget(null); setReview(null);
      const code = typeof err === 'object' && err && 'code' in err ? String(err.code) : '';
      setError(saved ? 'Signoff saved, but its updated history could not be loaded. Reload signoffs before recording another review.' : code === '40001' ? 'Another instructor changed this gate. Reload signoffs and review the latest decision before signing.' : 'Signoff was not confirmed. Reload and check the history, required QC predecessor, evidence, enrollment and access before trying again.');
    } finally { setBusy(false); }
  };

  return <main className="signoff-page">
    <style>{`.signoff-page{max-width:1050px;margin:24px auto;padding:24px}.signoff-page label{display:block;margin:14px 0}.signoff-page input,.signoff-page select,.signoff-page textarea{display:block;width:100%;padding:10px;margin-top:5px;font:inherit;box-sizing:border-box}.signoff-page fieldset{border:1px solid #8b949e;padding:16px;margin:18px 0}.signoff-page button{padding:10px 16px;margin:6px 10px 6px 0;font:inherit}.signoff-page .notice{border-left:5px solid #b37400;padding:14px;background:#fff2cf;color:#262014}.signoff-page .criterion{border-bottom:1px solid #8b949e;padding-bottom:12px}.signoff-page details{padding:12px;border:1px solid #8b949e;margin:10px 0}.signoff-page pre{white-space:pre-wrap;overflow-wrap:anywhere}.signoff-page [role=alert]{color:#b32020;font-weight:700}.signoff-page .columns{display:grid;grid-template-columns:1fr 1fr;gap:16px}@media(max-width:700px){.signoff-page{padding:12px}.signoff-page .columns{grid-template-columns:1fr}}`}</style>
    <Link href="/planner">Return to planner</Link>
    <h1>Instructor safety and QC signoffs</h1>
    <p className="notice">PVHS 55-day courses. Scheduled dates and section holds remain in force. A signoff records an instructor decision; it does not assign a grade, complete a lesson or issue a welding certification.</p>
    {error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}
    <button disabled={busy} onClick={() => void loadCatalog()}>Refresh sections</button>
    {!sections.length && <p>No assigned PVHS signoff sections are available. Sign in as an assigned instructor or school reviewer.</p>}
    <fieldset disabled={busy}><legend>Choose the student and work</legend>
      <label>Section<select value={target.section} onChange={e => changeTarget({ section: e.target.value, student: '', scope: '' })}><option value="">Choose section</option>{sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      <label>Student<select value={target.student} onChange={e => changeTarget({ ...target, student: e.target.value })}><option value="">Choose student</option>{selected?.students.map(s => <option key={s.id} value={s.id}>{s.name}{s.active ? '' : ' — inactive; history/revocation only'}</option>)}</select></label>
      {selected && !selected.students.length && <p>This section has no enrolled students or signoff history. Enrollment must be recorded separately before a new authorization can be issued.</p>}
      <label>Machine or job scope<input maxLength={200} value={target.scope} onChange={e => changeTarget({ ...target, scope: e.target.value })} placeholder="Exact machine + authorized operation, or job ID + drawing revision" /></label>
      <p>Use the identical job and revision for QC Days 20, 30 and 40. A different machine, job or revision has a separate release history.</p>
      <button disabled={!target.section || !target.student || !target.scope.trim()} onClick={() => void loadHistory()}>Load signoffs</button>
    </fieldset>
    {loaded && review && <>
      {!review.instruction_available && <p className="notice">Instruction remains blocked by the section/calendar hold. Valid review signoffs do not remove that hold.</p>}
      <fieldset disabled={busy}><legend>Record an instructor review</legend>
        <label>Checkpoint<select value={gate} onChange={e => { setGate(e.target.value); clearForm(); }}>{(gates[selected?.course ?? ''] ?? []).map(g => <option key={g.key} value={g.key}>{g.label}</option>)}</select></label>
        <label>Decision<select value={decision} onChange={e => setDecision(e.target.value)}><option value="hold">Hold — more work or evidence required</option><option value="release" disabled={!review.enrolled}>Release — requirements demonstrated</option><option value="revoke">Revoke previous authorization or release</option></select></label>
        <label>Evidence reference<textarea value={evidence} onChange={e => setEvidence(e.target.value)} maxLength={4000} placeholder="Evidence ID, specimen/part ID, measurements, inspection record or secure evidence location" /></label>
        <label>Acceptance reference<textarea value={criteria} onChange={e => setCriteria(e.target.value)} maxLength={4000} placeholder="Approved procedure/manual/drawing, revision and acceptance limits" /></label>
        <label>Instructor observation and reason<textarea value={observation} onChange={e => setObservation(e.target.value)} maxLength={4000} /></label>
        <h2>Criterion observations</h2>
        {rows.map((row, i) => <div className="criterion" key={i}>
          <label>Criterion {i + 1}<input value={row.criterion} maxLength={1000} onChange={e => setRows(rows.map((r, j) => j === i ? { ...r, criterion: e.target.value } : r))} /></label>
          <div className="columns"><label>Required result<input value={row.required} maxLength={1000} onChange={e => setRows(rows.map((r, j) => j === i ? { ...r, required: e.target.value } : r))} /></label>
          <label>Observed result<input value={row.observed} maxLength={1000} onChange={e => setRows(rows.map((r, j) => j === i ? { ...r, observed: e.target.value } : r))} /></label></div>
          <label>Requirement met?<select value={row.met} onChange={e => setRows(rows.map((r, j) => j === i ? { ...r, met: e.target.value } : r))}><option value="">Instructor must decide</option><option value="yes">Yes — demonstrated</option><option value="no">No — hold required</option></select></label>
          {rows.length > 1 && <button onClick={() => setRows(rows.filter((_, j) => j !== i))}>Remove criterion {i + 1}</button>}
        </div>)}
        <button disabled={rows.length >= 30} onClick={() => setRows([...rows, blankRow()])}>Add criterion</button>
        {gate === 'bend31' && <label>Bend-test result<select value={bend} onChange={e => setBend(e.target.value)}><option value="">Choose observed result</option><option value="passed">Passed named acceptance criteria</option><option value="failed">Failed — correction/retest needed</option><option value="invalid">Invalid test — repeat needed</option></select></label>}
        {gate === 'cnc' && <label>Authorization expiry, if required (your local time)<input type="datetime-local" value={expiry} onChange={e => setExpiry(e.target.value)} /></label>}
        <p>Recording uses your signed-in instructor identity and the current time. Previous decisions and criterion observations cannot be overwritten.</p>
        <button onClick={() => void saveSignoff()}>Record instructor signoff</button>
      </fieldset>
      <h2>Review history</h2>
      {!review.history.length && <p>No signoffs exist for this student and work scope. No authorization or release is implied.</p>}
      {review.history.map(h => <details key={h.id}><summary>{gates[selected?.course ?? '']?.find(g => g.key === h.gate)?.label ?? h.gate} · {h.decision} · {h.release_valid ? h.can_proceed ? 'release valid' : 'release valid; instruction held' : 'not a current valid release'} · {h.instructor_name} · {new Date(h.recorded_at).toLocaleString()}</summary>
        <p><strong>Evidence:</strong> {h.evidence_reference}</p><p><strong>Acceptance reference:</strong> {h.criteria_reference}</p><p>{h.observation}</p>
        {h.bend_result && <p>Bend result: {h.bend_result}</p>}{h.expires_at && <p>Authorization expiry: {new Date(h.expires_at).toLocaleString()}</p>}
        <ul>{h.criterion_results.map((r, i) => <li key={i}>{r.criterion}: required {r.required}; observed {r.observed}; {r.met ? 'met' : 'not met'}.</li>)}</ul>
      </details>)}
    </>}
  </main>;
}
