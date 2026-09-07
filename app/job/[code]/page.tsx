'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { getSupabase } from '@/lib/supabase-browser';
import { getJobCardByCode, submitJobCard } from '@/lib/job-card-session';
import type {
  JobCardEvidenceType,
  JobCardPublicSession,
  JobCardQualityCheck,
  JobCardRequirementInput,
  JobCardRequirementStatus,
  JobCardStartCheck,
  JobCardStudentRequirement,
} from '@/lib/job-card-types';
import {
  validateQualityCheck,
  validateStartCheck,
  validateStudentRequirements,
} from '@/lib/job-card-validation';
import { formatError } from '@/lib/format-error';

type DraftRequirement = JobCardRequirementInput & {
  actualValue: string;
  status: JobCardRequirementStatus | '';
  issue: string;
  correction: string;
  recheck: string;
};

type SavedDraft = {
  studentName?: string;
  studentId?: string;
  startCheck?: Partial<JobCardStartCheck>;
  qualityCheck?: Partial<JobCardQualityCheck>;
  requirementResults?: Array<Partial<DraftRequirement> & { key?: string }>;
  evidenceType?: JobCardEvidenceType;
  evidenceNote?: string;
};

const blankStartCheck: JobCardStartCheck = {
  drawingReviewed: false,
  procedureReviewed: false,
  materialJointVerified: false,
};

const blankQualityCheck: JobCardQualityCheck = {
  requirementsChecked: false,
  correctionsRecorded: false,
  readyForInstructor: false,
};

function buildRequirements(
  requirements: JobCardRequirementInput[],
  saved?: SavedDraft['requirementResults']
): DraftRequirement[] {
  const savedByKey = new Map((saved ?? []).map((item) => [item.key, item]));
  return requirements.map((requirement) => {
    const prior = savedByKey.get(requirement.key);
    const priorStatus = prior?.status;
    const status: DraftRequirement['status'] =
      priorStatus === 'pass' || priorStatus === 'correct' || priorStatus === 'na'
        ? priorStatus
        : '';
    return {
      ...requirement,
      actualValue: typeof prior?.actualValue === 'string' ? prior.actualValue : '',
      status,
      issue: typeof prior?.issue === 'string' ? prior.issue : '',
      correction: typeof prior?.correction === 'string' ? prior.correction : '',
      recheck: typeof prior?.recheck === 'string' ? prior.recheck : '',
    };
  });
}

function checkLabel(value: string | null, fallback: string) {
  return value?.trim() || fallback;
}

export default function StudentJobCardPage() {
  const { code } = useParams<{ code: string }>();
  const [supabase] = useState(getSupabase);
  const joinCode = String(code ?? '').trim().toUpperCase();
  const storageKey = `ltg-live-job-card-${joinCode}`;

  const [session, setSession] = useState<JobCardPublicSession | null>(null);
  const [studentName, setStudentName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [startCheck, setStartCheck] = useState<JobCardStartCheck>(blankStartCheck);
  const [qualityCheck, setQualityCheck] = useState<JobCardQualityCheck>(blankQualityCheck);
  const [requirementResults, setRequirementResults] = useState<DraftRequirement[]>([]);
  const [evidenceType, setEvidenceType] = useState<JobCardEvidenceType>('none');
  const [evidenceNote, setEvidenceNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const loaded = await getJobCardByCode(supabase, joinCode);
        setSession(loaded);

        let saved: SavedDraft = {};
        try {
          saved = JSON.parse(localStorage.getItem(storageKey) ?? '{}') as SavedDraft;
        } catch {
          saved = {};
        }

        setStudentName(typeof saved.studentName === 'string' ? saved.studentName : '');
        setStudentId(typeof saved.studentId === 'string' ? saved.studentId : '');
        setStartCheck({ ...blankStartCheck, ...(saved.startCheck ?? {}) });
        setQualityCheck({ ...blankQualityCheck, ...(saved.qualityCheck ?? {}) });
        setEvidenceType(
          saved.evidenceType === 'photo' ||
            saved.evidenceType === 'measurement' ||
            saved.evidenceType === 'inspection_test_result'
            ? saved.evidenceType
            : 'none'
        );
        setEvidenceNote(typeof saved.evidenceNote === 'string' ? saved.evidenceNote : '');
        setRequirementResults(buildRequirements(loaded.requirements, saved.requirementResults));
      } catch (err) {
        setError(formatError(err));
      } finally {
        setLoading(false);
      }
    })();
  }, [joinCode, storageKey, supabase]);

  useEffect(() => {
    if (!session || loading || submitted) return;
    const draft: SavedDraft = {
      studentName,
      studentId,
      startCheck,
      qualityCheck,
      requirementResults,
      evidenceType,
      evidenceNote,
    };
    localStorage.setItem(storageKey, JSON.stringify(draft));
  }, [
    evidenceNote,
    evidenceType,
    loading,
    qualityCheck,
    requirementResults,
    session,
    startCheck,
    storageKey,
    studentId,
    studentName,
    submitted,
  ]);

  const completedRequirements = useMemo(
    () => requirementResults.filter((item) => item.status).length,
    [requirementResults]
  );

  const patchRequirement = (index: number, patch: Partial<DraftRequirement>) => {
    setRequirementResults((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              ...patch,
              ...(patch.status === 'na'
                ? { actualValue: '', issue: '', correction: '', recheck: '' }
                : patch.status === 'pass'
                  ? { issue: '', correction: '', recheck: '' }
                  : {}),
            }
          : item
      )
    );
  };

  const submit = async () => {
    if (!session) return;
    if (!studentName.trim()) {
      setError('Student name is required.');
      return;
    }
    if (!studentId.trim()) {
      setError('Student ID is required.');
      return;
    }

    const startError = validateStartCheck(startCheck);
    if (startError) {
      setError(startError);
      return;
    }

    const missingStatus = requirementResults.find((item) => !item.status);
    if (missingStatus) {
      setError(`${missingStatus.label}: choose Pass, Correct, or N/A.`);
      return;
    }

    const normalizedRequirements = requirementResults as JobCardStudentRequirement[];
    const requirementError = validateStudentRequirements(normalizedRequirements);
    if (requirementError) {
      setError(requirementError);
      return;
    }

    const qualityError = validateQualityCheck(qualityCheck);
    if (qualityError) {
      setError(qualityError);
      return;
    }

    setBusy(true);
    setError('');
    try {
      await submitJobCard(supabase, {
        joinCode,
        studentName,
        studentId,
        startCheck,
        qualityCheck,
        requirementResults: normalizedRequirements,
        evidenceType,
        evidenceNote,
      });
      localStorage.removeItem(storageKey);
      setSubmitted(true);
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <main className="center">
        Opening Live Job Card…
        <style jsx>{styles}</style>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="center">
        <section className="card narrow">
          <div className="eyebrow">LTG Connected Classroom</div>
          <h1>Unable to Join</h1>
          <p>{error || 'This Live Job Card code is invalid or expired.'}</p>
        </section>
        <style jsx>{styles}</style>
      </main>
    );
  }

  if (submitted) {
    return (
      <main className="center">
        <section className="card narrow submitted">
          <div className="check">✓</div>
          <div className="eyebrow">Submission Received</div>
          <h1>Live Job Card Submitted</h1>
          <p>Your instructor now has your Job Card for review.</p>
          <strong>{session.jobTitle}</strong>
          <small>
            This is an instructional classroom record. Qualification and certification records are handled separately.
          </small>
        </section>
        <style jsx>{styles}</style>
      </main>
    );
  }

  return (
    <main>
      <header className="topbar">
        <div>
          <div className="eyebrow">LTG Connected Classroom · Live Job Card</div>
          <h1>{session.jobTitle}</h1>
          <p>{checkLabel(session.sectionLabel, 'Welding Class')}</p>
        </div>
        <div className="codeBox">
          <span>Code</span>
          <strong>{session.joinCode}</strong>
        </div>
      </header>

      {error && <div className="error">{error}</div>}

      <section className="card">
        <div className="sectionHead">
          <div>
            <span className="step">1</span>
            <div>
              <div className="eyebrow">Student</div>
              <h2>Identify your work</h2>
            </div>
          </div>
          {session.plannerDayNumber && <small>Planner Day {session.plannerDayNumber}</small>}
        </div>
        <div className="grid2">
          <label>
            Student Name
            <input value={studentName} onChange={(event) => setStudentName(event.target.value)} autoComplete="name" />
          </label>
          <label>
            Student ID
            <input value={studentId} onChange={(event) => setStudentId(event.target.value)} inputMode="numeric" />
          </label>
        </div>
      </section>

      <section className="card">
        <div className="sectionHead">
          <div>
            <span className="step">2</span>
            <div>
              <div className="eyebrow">Instructor-Provided Requirement</div>
              <h2>Review the job information</h2>
            </div>
          </div>
        </div>
        <div className="jobGrid">
          <div><span>Drawing</span><strong>{checkLabel(session.drawingRef, 'Not specified')}</strong></div>
          <div><span>Revision</span><strong>{checkLabel(session.drawingRevision, 'Not specified')}</strong></div>
          <div><span>WPS / SWPS</span><strong>{checkLabel(session.wpsSwpsRef, 'Not specified')}</strong></div>
          <div><span>Process</span><strong>{checkLabel(session.process, 'Not specified')}</strong></div>
          <div><span>Position</span><strong>{checkLabel(session.position, 'Not specified')}</strong></div>
          <div><span>Material / Joint</span><strong>{checkLabel(session.materialJoint, 'Not specified')}</strong></div>
        </div>
        <div className="checkList">
          <label><input type="checkbox" checked={startCheck.drawingReviewed} onChange={(event) => setStartCheck((current) => ({ ...current, drawingReviewed: event.target.checked }))} /> Drawing / print reviewed</label>
          <label><input type="checkbox" checked={startCheck.procedureReviewed} onChange={(event) => setStartCheck((current) => ({ ...current, procedureReviewed: event.target.checked }))} /> Procedure / WPS reviewed</label>
          <label><input type="checkbox" checked={startCheck.materialJointVerified} onChange={(event) => setStartCheck((current) => ({ ...current, materialJointVerified: event.target.checked }))} /> Material and joint verified</label>
        </div>
      </section>

      <section className="card">
        <div className="sectionHead">
          <div>
            <span className="step">3</span>
            <div>
              <div className="eyebrow">Student Actuals</div>
              <h2>Record the work you actually completed</h2>
            </div>
          </div>
          <small>{completedRequirements}/{requirementResults.length} status checks selected</small>
        </div>

        <div className="requirements">
          {requirementResults.map((item, index) => (
            <article key={item.key} className="requirement">
              <div className="requirementTitle">
                <div>
                  <span>Requirement {index + 1}</span>
                  <h3>{item.label}</h3>
                </div>
                <strong>{item.requiredValue}</strong>
              </div>

              <div className="grid2 compact">
                <label>
                  Student Actual
                  <input
                    value={item.actualValue}
                    onChange={(event) => patchRequirement(index, { actualValue: event.target.value })}
                    disabled={item.status === 'na'}
                    placeholder={item.status === 'na' ? 'Not applicable' : 'Enter measured / observed actual'}
                  />
                </label>
                <label>
                  Status
                  <select
                    value={item.status}
                    onChange={(event) => patchRequirement(index, { status: event.target.value as DraftRequirement['status'] })}
                  >
                    <option value="">Choose status…</option>
                    <option value="pass">Pass</option>
                    <option value="correct">Correct</option>
                    <option value="na">N/A</option>
                  </select>
                </label>
              </div>

              {item.status === 'correct' && (
                <div className="correctionGrid">
                  <label>
                    Issue Found
                    <textarea rows={2} value={item.issue} onChange={(event) => patchRequirement(index, { issue: event.target.value })} />
                  </label>
                  <label>
                    Correction Made
                    <textarea rows={2} value={item.correction} onChange={(event) => patchRequirement(index, { correction: event.target.value })} />
                  </label>
                  <label>
                    Recheck Result
                    <textarea rows={2} value={item.recheck} onChange={(event) => patchRequirement(index, { recheck: event.target.value })} />
                  </label>
                </div>
              )}
            </article>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="sectionHead">
          <div>
            <span className="step">4</span>
            <div>
              <div className="eyebrow">Quick Quality Check</div>
              <h2>Confirm before sending to the instructor</h2>
            </div>
          </div>
        </div>
        <div className="checkList">
          <label><input type="checkbox" checked={qualityCheck.requirementsChecked} onChange={(event) => setQualityCheck((current) => ({ ...current, requirementsChecked: event.target.checked }))} /> All listed requirements were checked</label>
          <label><input type="checkbox" checked={qualityCheck.correctionsRecorded} onChange={(event) => setQualityCheck((current) => ({ ...current, correctionsRecorded: event.target.checked }))} /> Any required corrections were recorded and rechecked</label>
          <label><input type="checkbox" checked={qualityCheck.readyForInstructor} onChange={(event) => setQualityCheck((current) => ({ ...current, readyForInstructor: event.target.checked }))} /> Job Card is ready for instructor review</label>
        </div>

        <div className="grid2 evidence">
          <label>
            Evidence Type
            <select value={evidenceType} onChange={(event) => setEvidenceType(event.target.value as JobCardEvidenceType)}>
              <option value="none">None / instructor observation</option>
              <option value="measurement">Measurement</option>
              <option value="inspection_test_result">Inspection / test result</option>
              <option value="photo">Photo reference</option>
            </select>
          </label>
          <label>
            Evidence Note
            <input value={evidenceNote} onChange={(event) => setEvidenceNote(event.target.value)} placeholder="Optional measurement, photo name, or inspection note" />
          </label>
        </div>
      </section>

      <section className="submitCard">
        <div>
          <strong>Ready for instructor review?</strong>
          <p>Your draft stays on this device until you submit or the session expires.</p>
        </div>
        <button type="button" disabled={busy} onClick={submit}>
          {busy ? 'Submitting…' : 'Submit Live Job Card'}
        </button>
      </section>

      <p className="recordNote">
        Instructional classroom record only. This Job Card does not by itself create an AWS qualification or certification record.
      </p>
      <style jsx>{styles}</style>
    </main>
  );
}

const styles = `
  main{min-height:100vh;background:#090d0b;color:#dce5e0;padding:20px;font-family:Arial,sans-serif}
  .center{display:grid;place-items:center}
  .topbar{width:min(980px,100%);box-sizing:border-box;margin:0 auto 18px;padding:18px 20px;display:flex;justify-content:space-between;gap:18px;align-items:center;border:1px solid #314038;border-radius:12px;background:#121914}
  .topbar h1{margin:5px 0 2px}.topbar p{margin:0;color:#99a69f}
  .codeBox{min-width:135px;padding:10px 14px;border:1px solid #42604b;border-radius:9px;text-align:center;background:#0b120d}.codeBox span{display:block;color:#8ca097;font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:.12em}.codeBox strong{display:block;margin-top:3px;color:#9aedac;font-size:24px;letter-spacing:.1em}
  .card,.submitCard,.error,.recordNote{width:min(980px,100%);box-sizing:border-box;margin:0 auto 14px}
  .card{padding:19px;border:1px solid #314038;border-radius:12px;background:#121914}.narrow{max-width:620px}.submitted{text-align:center}.submitted>strong{display:block;color:#fff;margin:14px}.submitted small{display:block;color:#8d9d95;line-height:1.5}.check{color:#73df8c;font-size:56px}
  .eyebrow{color:#73df8c;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:.1em}h1,h2,h3{color:#fff}h1{font-size:25px}h2{margin:2px 0;font-size:19px}h3{margin:3px 0;font-size:16px}.card p{color:#9aa8a1;line-height:1.5}
  .sectionHead,.sectionHead>div,.requirementTitle{display:flex;justify-content:space-between;gap:12px;align-items:center}.sectionHead{margin-bottom:12px}.sectionHead small{color:#8e9c95}.step{display:grid;place-items:center;width:32px;height:32px;border:1px solid #4fcf6e;border-radius:50%;color:#93eda8;font-weight:900}
  .grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px}.compact{margin-top:12px}.jobGrid{display:grid;grid-template-columns:repeat(3,1fr);gap:9px}.jobGrid div{padding:10px;border:1px solid #2e3d35;border-radius:8px;background:#0b110d}.jobGrid span,.requirementTitle span{display:block;color:#87968e;font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:.08em}.jobGrid strong{display:block;margin-top:4px;color:#eef4f0;font-size:13px}
  label{display:grid;gap:6px;color:#91a098;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:.04em}input,select,textarea{box-sizing:border-box;width:100%;padding:11px;border:1px solid #394b42;border-radius:7px;background:#090d0b;color:#fff;font:inherit;font-size:14px}textarea{resize:vertical}input:disabled{opacity:.55}
  .checkList{display:grid;gap:8px;margin-top:15px}.checkList label{display:flex;gap:9px;align-items:flex-start;padding:10px;border:1px solid #2e3d35;border-radius:8px;background:#0b110d;color:#d1dad5;text-transform:none;font-size:13px;font-weight:700;letter-spacing:0}.checkList input{width:auto;margin:1px 0 0;accent-color:#73df8c}
  .requirements{display:grid;gap:11px}.requirement{padding:14px;border:1px solid #34463c;border-radius:10px;background:#0c130f}.requirementTitle>strong{max-width:48%;padding:6px 9px;border-radius:6px;background:#17231b;color:#a8efb8;text-align:right}.correctionGrid{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;margin-top:10px}.evidence{margin-top:15px}
  .submitCard{display:flex;justify-content:space-between;align-items:center;gap:16px;padding:17px 19px;border:1px solid #4c7657;border-radius:12px;background:#111b14}.submitCard strong{color:#fff}.submitCard p{margin:4px 0 0;color:#8e9b94;font-size:12px}.submitCard button{min-width:230px;padding:13px 16px;border:1px solid #4fcf6e;border-radius:8px;background:#19301f;color:#a4f2b5;font-weight:900;cursor:pointer}.submitCard button:disabled{opacity:.45}
  .error{padding:12px;border:1px solid #7a444b;border-radius:8px;background:#30171a;color:#ffb0b6}.recordNote{padding:0 8px 28px;color:#78867f;font-size:11px;line-height:1.5;text-align:center}
  @media(max-width:720px){main{padding:12px}.topbar,.sectionHead,.submitCard{align-items:flex-start;flex-direction:column}.codeBox{align-self:stretch}.grid2,.jobGrid,.correctionGrid{grid-template-columns:1fr}.requirementTitle{align-items:flex-start;flex-direction:column}.requirementTitle>strong{max-width:100%;text-align:left}.submitCard button{width:100%;min-width:0}}
`;
