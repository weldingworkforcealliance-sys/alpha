'use client';

import { useEffect, useMemo, useState } from 'react';
import { getSupabase } from '@/lib/supabase-browser';
import { readGradebookRows, type Gradebook } from '@/lib/gradebook';
import { readSelectedSectionId, subscribeSelectedSection } from '@/lib/section-selection';
import {
  nextPlannerFabricationSession,
  plannerWld105FabricationGradebook,
} from '@/lib/planner-fabrication-grading';
import { formatError } from '@/lib/format-error';
import styles from './planner-fabrication-grading-panel.module.css';

type Student = { student_id: string; display_name: string; active: boolean };
type FabricationAttempt = {
  id: string;
  student_id: string;
  project_code: string;
  attempt_number: number;
  percent_score: number;
  earned_score: number;
  possible_score: number;
  recorded_at: string;
};
type TowerStudent = {
  student_id: string;
  display_name: string;
  active: boolean;
  homework_avg: number | null;
  classroom_avg: number | null;
  fabrication_avg: number | null;
  current_grade: number | null;
};
type CriterionKey = 'layout' | 'prep' | 'fitup' | 'welding' | 'finish';

const PROJECTS = [
  { code: 'm', label: 'M Fabrication Project' },
  { code: 'dice', label: 'Dice Fabrication Project' },
  { code: 'n', label: 'N Fabrication Project' },
  { code: 'tube_cube', label: 'Tube Cube Fabrication Project' },
] as const;

const CRITERIA: Array<{ key: CriterionKey; label: string }> = [
  { key: 'layout', label: 'Blueprint / Layout Accuracy' },
  { key: 'prep', label: 'Cutting & Material Preparation' },
  { key: 'fitup', label: 'Fit-Up / Squareness / Alignment' },
  { key: 'welding', label: 'Welding / Assembly Quality' },
  { key: 'finish', label: 'Finished Product / Workmanship' },
];

function pct(value: number | null) {
  return value === null || value === undefined ? '—' : `${Number(value).toFixed(1)}%`;
}

export default function PlannerFabricationGradingPanel({ pathname }: { pathname: string }) {
  const [client] = useState(getSupabase);
  const [sectionId, setSectionId] = useState(readSelectedSectionId);
  const [books, setBooks] = useState<Gradebook[]>([]);
  const [session, setSession] = useState<Gradebook | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [attempts, setAttempts] = useState<FabricationAttempt[]>([]);
  const [tower, setTower] = useState<TowerStudent[]>([]);
  const [studentId, setStudentId] = useState('');
  const [projectCode, setProjectCode] = useState<(typeof PROJECTS)[number]['code']>('m');
  const [attemptNumber, setAttemptNumber] = useState(1);
  const [scores, setScores] = useState<Record<CriterionKey, string>>({
    layout: '', prep: '', fitup: '', welding: '', finish: '',
  });
  const [na, setNa] = useState<Record<CriterionKey, boolean>>({
    layout: false, prep: false, fitup: false, welding: false, finish: false,
  });
  const [note, setNote] = useState('');
  const [open, setOpen] = useState(false);
  const [saveBlocked, setSaveBlocked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const [reload, setReload] = useState(0);
  const enabled = process.env.NEXT_PUBLIC_GRADEBOOK_ENABLED === 'true';

  useEffect(() => {
    if (!enabled) return;
    setSectionId(readSelectedSectionId());
    return subscribeSelectedSection(setSectionId);
  }, [enabled, pathname]);

  useEffect(() => {
    if (!enabled || pathname !== '/dashboard') return;
    let alive = true;
    void readGradebookRows<Gradebook>((from, to) => client
      .from('gradebook_directory')
      .select('*')
      .eq('course_role', 'theory')
      .eq('course_code', 'WLD 105')
      .eq('section_status', 'active')
      .order('id')
      .range(from, to))
      .then(rows => { if (alive) setBooks(rows); })
      .catch(() => { if (alive) setError('WLD 105 fabrication grading could not load.'); });
    return () => { alive = false; };
  }, [client, enabled, pathname]);

  const requested = plannerWld105FabricationGradebook(books, sectionId);
  useEffect(() => {
    const next = nextPlannerFabricationSession(session, requested, saveBlocked);
    if (next?.id === session?.id) return;
    setSession(next);
    setOpen(false);
    setStudentId('');
    setError('');
    setSaved('');
  }, [requested, saveBlocked, session]);

  useEffect(() => {
    if (!session || pathname !== '/dashboard') return;
    let alive = true;
    setLoading(true);
    setError('');
    void (async () => {
      const setup = await client.rpc('ensure_wld105_gradebook_setup', { p_gradebook_id: session.id });
      if (setup.error) throw setup.error;
      const refresh = await client.rpc('refresh_gradebook', { p_gradebook_id: session.id });
      if (refresh.error) throw refresh.error;
      const [rosterResult, attemptsResult, towerResult] = await Promise.all([
        client.from('gradebook_roster')
          .select('student_id,display_name,active')
          .eq('gradebook_id', session.id)
          .order('display_name'),
        client.from('wld105_fabrication_attempts')
          .select('id,student_id,project_code,attempt_number,percent_score,earned_score,possible_score,recorded_at')
          .eq('gradebook_id', session.id)
          .order('recorded_at', { ascending: false }),
        client.rpc('get_wld105_grade_tower', { p_gradebook_id: session.id }),
      ]);
      if (rosterResult.error) throw rosterResult.error;
      if (attemptsResult.error) throw attemptsResult.error;
      if (towerResult.error) throw towerResult.error;
      if (!alive) return;
      const roster = (rosterResult.data ?? []) as Student[];
      setStudents(roster);
      setAttempts((attemptsResult.data ?? []) as FabricationAttempt[]);
      setTower(((towerResult.data as { students?: TowerStudent[] } | null)?.students ?? []));
      setStudentId(current => current || roster.find(s => s.active)?.student_id || '');
    })().catch(cause => {
      if (alive) setError(formatError(cause, 'Fabrication grading could not load.'));
    }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [client, session, pathname, reload]);

  const selectedTower = tower.find(row => row.student_id === studentId);
  const selectedAttempts = attempts.filter(row =>
    row.student_id === studentId && row.project_code === projectCode
  );
  const usedAttempts = new Set(selectedAttempts.map(row => row.attempt_number));

  useEffect(() => {
    if (!usedAttempts.has(1)) setAttemptNumber(1);
    else if (!usedAttempts.has(2)) setAttemptNumber(2);
  }, [studentId, projectCode, attempts]);

  const preview = useMemo(() => {
    let earned = 0;
    let possible = 0;
    for (const criterion of CRITERIA) {
      if (na[criterion.key]) continue;
      const value = Number(scores[criterion.key]);
      if (scores[criterion.key] === '' || !Number.isFinite(value)) continue;
      earned += value;
      possible += 20;
    }
    return { earned, possible, percent: possible ? earned / possible * 100 : null };
  }, [scores, na]);

  function resetForm() {
    setScores({ layout: '', prep: '', fitup: '', welding: '', finish: '' });
    setNa({ layout: false, prep: false, fitup: false, welding: false, finish: false });
    setNote('');
  }

  async function saveGrade() {
    if (!session || !studentId) return;
    setSaveBlocked(true);
    setError('');
    setSaved('');
    try {
      const args: Record<string, unknown> = {
        p_gradebook_id: session.id,
        p_student_id: studentId,
        p_project_code: projectCode,
        p_attempt_number: attemptNumber,
        p_note: note,
      };
      for (const criterion of CRITERIA) {
        args[`p_${criterion.key}_score`] = na[criterion.key] || scores[criterion.key] === ''
          ? null : Number(scores[criterion.key]);
        args[`p_${criterion.key}_na`] = na[criterion.key];
      }
      const result = await client.rpc('record_wld105_fabrication_grade', args);
      if (result.error) throw result.error;
      const percent = Number((result.data as { percent?: number } | null)?.percent ?? preview.percent ?? 0);
      setSaved(`Saved ${PROJECTS.find(p => p.code === projectCode)?.label}: ${percent.toFixed(1)}%`);
      resetForm();
      setReload(value => value + 1);
    } catch (cause) {
      setError(formatError(cause, 'The fabrication grade could not be saved.'));
    } finally {
      setSaveBlocked(false);
    }
  }

  if (!enabled || (pathname !== '/dashboard' && !saveBlocked)) return null;
  if (!session) return null;

  return <section className={styles.panel} aria-label="WLD 105 fabrication grading">
    <button type="button" className={styles.summary} aria-expanded={open}
      onClick={() => setOpen(value => !value)}>
      <span>
        <strong>WLD 105 Grade Tower</strong>
        <small>{session.section_name} · Homework 50% · Live Classroom 25% · Fabrication 25%</small>
      </span>
      <span className={styles.action}>{saveBlocked ? 'Saving…' : open ? 'Close' : 'Open grading'}</span>
    </button>

    {open && <div className={styles.body}>
      {error && <p className={styles.error} role="alert">{error}</p>}
      {saved && <p className={styles.saved} role="status">{saved}</p>}
      {loading ? <p>Loading WLD 105 grade tower…</p> : <>
        <div className={styles.tower}>
          <label>Student
            <select value={studentId} onChange={e => setStudentId(e.target.value)} disabled={saveBlocked}>
              <option value="">Choose student</option>
              {students.map(student => <option key={student.student_id} value={student.student_id} disabled={!student.active}>
                {student.display_name}{student.active ? '' : ' (inactive)'}
              </option>)}
            </select>
          </label>
          <div className={styles.metrics}>
            <div><span>AWS / Homework</span><strong>{pct(selectedTower?.homework_avg ?? null)}</strong><small>50%</small></div>
            <div><span>Live Classroom</span><strong>{pct(selectedTower?.classroom_avg ?? null)}</strong><small>25%</small></div>
            <div><span>Fabrication</span><strong>{pct(selectedTower?.fabrication_avg ?? null)}</strong><small>25%</small></div>
            <div><span>Current Grade</span><strong>{pct(selectedTower?.current_grade ?? null)}</strong><small>available work</small></div>
          </div>
        </div>

        <div className={styles.projectRow}>
          <label>Fabrication project
            <select value={projectCode} onChange={e => setProjectCode(e.target.value as (typeof PROJECTS)[number]['code'])} disabled={saveBlocked}>
              {PROJECTS.map(project => <option key={project.code} value={project.code}>{project.label}</option>)}
            </select>
          </label>
          <label>Attempt
            <select value={attemptNumber} onChange={e => setAttemptNumber(Number(e.target.value))} disabled={saveBlocked}>
              <option value={1} disabled={usedAttempts.has(1)}>Attempt 1{usedAttempts.has(1) ? ' — saved' : ''}</option>
              <option value={2} disabled={usedAttempts.has(2)}>Attempt 2{usedAttempts.has(2) ? ' — saved' : ''}</option>
            </select>
          </label>
        </div>

        <div className={styles.rubric}>
          {CRITERIA.map(criterion => <div className={styles.criterion} key={criterion.key}>
            <div>
              <strong>{criterion.label}</strong>
              <small>0–20 points</small>
            </div>
            <input aria-label={`${criterion.label} score`} type="number" min="0" max="20" step="0.5"
              value={scores[criterion.key]} disabled={na[criterion.key] || saveBlocked}
              onChange={e => setScores(current => ({ ...current, [criterion.key]: e.target.value }))} />
            <label className={styles.na}>
              <input type="checkbox" checked={na[criterion.key]} disabled={saveBlocked}
                onChange={e => {
                  const checked = e.target.checked;
                  setNa(current => ({ ...current, [criterion.key]: checked }));
                  if (checked) setScores(current => ({ ...current, [criterion.key]: '' }));
                }} />
              N/A
            </label>
          </div>)}
        </div>

        <div className={styles.preview}>
          <span>Rubric result</span>
          <strong>{preview.possible ? `${preview.earned} / ${preview.possible} · ${preview.percent?.toFixed(1)}%` : 'Enter rubric scores'}</strong>
          <small>N/A criteria are removed from the denominator, never scored as zero.</small>
        </div>

        <label className={styles.notes}>Instructor note
          <textarea value={note} onChange={e => setNote(e.target.value)}
            placeholder="Optional project note, rework direction, or measurement observation" disabled={saveBlocked} />
        </label>

        <button type="button" className={styles.save} onClick={() => void saveGrade()}
          disabled={saveBlocked || !studentId || !preview.possible || usedAttempts.has(attemptNumber)}>
          Save fabrication grade
        </button>

        {selectedAttempts.length > 0 && <div className={styles.history}>
          <strong>Saved attempts for this project</strong>
          {selectedAttempts.map(attempt => <span key={attempt.id}>
            Attempt {attempt.attempt_number}: {Number(attempt.percent_score).toFixed(1)}%
            <small>{new Date(attempt.recorded_at).toLocaleString()}</small>
          </span>)}
        </div>}
      </>}
    </div>}
  </section>;
}
