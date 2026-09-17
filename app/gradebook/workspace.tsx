'use client';

import { useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabase-browser';
import { Gradebook, linkedGradebook, scoreLabel, readGradebookRows } from '@/lib/gradebook';
import { formatError } from '@/lib/format-error';
import styles from './workspace.module.css';

type Student = { student_id: string; active: boolean; display_name: string };
type Item = { id: string; title: string; category_id: string };
type Category = { id: string; code: string; label: string; active: boolean };
type Status = { code: string; label: string; active: boolean; requires_score: boolean };
type Attempt = { id: string; item_id: string; student_id: string; status_label: string; status_code: string;
  score: number | null; possible_score: number | null; attempted_at: string; note: string; revision_id: number };
type Revision = { id: number; status_label: string; score: number | null; possible_score: number | null; recorded_at: string; note: string };
type BookData = { book: Gradebook; students: Student[]; items: Item[]; categories: Category[]; statuses: Status[]; attempts: Attempt[]; unresolved: number };

export default function GradebookWorkspace() {
  const [client] = useState(getSupabase);
  const [books, setBooks] = useState<Gradebook[]>([]);
  const [selected, setSelected] = useState('');
  const [program, setProgram] = useState('');
  const [level, setLevel] = useState('');
  const [semester, setSemester] = useState('');
  const [panels, setPanels] = useState<BookData[]>([]);
  const [linked, setLinked] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  const [history, setHistory] = useState<Revision[] | null>(null);
  const [historyTitle, setHistoryTitle] = useState('');
  const [edit, setEdit] = useState<{ book: string; attempt: Attempt } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void readGradebookRows<Gradebook>((from, to) => client.from('gradebook_directory').select('*').order('section_name').order('id').range(from, to)).then(rows => {
      if (cancelled) return;
      setBooks(rows); setSelected(rows.find(row => row.section_status === 'active')?.id ?? rows[0]?.id ?? '');
      if (!rows.length) setLoading(false);
    }).catch(() => { if (!cancelled) { setError('Gradebooks could not load. Verify that the gradebook migrations are installed.'); setLoading(false); } });
    return () => { cancelled = true; };
  }, [client]);

  useEffect(() => {
    let cancelled = false;
    const book = books.find(row => row.id === selected);
    if (!book) { setPanels([]); setLoading(false); return; }
    setLoading(true); setError(''); setPanels([]); setHistory(null); setEdit(null);
    async function load(one: Gradebook): Promise<BookData> {
      const refreshed = await client.rpc('refresh_gradebook', { p_gradebook_id: one.id });
      if (refreshed.error) throw refreshed.error;
      const results = await Promise.all([
        readGradebookRows<Student>((from, to) => client.from('gradebook_roster').select('student_id,active,display_name').eq('gradebook_id', one.id).order('student_id').range(from, to)),
        readGradebookRows<Item>((from, to) => client.from('gradebook_items').select('id,title,category_id').eq('gradebook_id', one.id).order('created_at').order('id').range(from, to)),
        readGradebookRows<Category>((from, to) => client.from('gradebook_categories').select('*').eq('gradebook_id', one.id).order('id').range(from, to)),
        readGradebookRows<Status>((from, to) => client.from('gradebook_statuses').select('*').eq('gradebook_id', one.id).order('code').range(from, to)),
        readGradebookRows<Attempt>((from, to) => client.from('gradebook_latest_attempts').select('*').eq('gradebook_id', one.id).order('attempted_at', { ascending: false }).order('id').range(from, to)),
      ]);
      const students = results[0];
      return { book: one, students: students.sort((a, b) => a.display_name.localeCompare(b.display_name)),
        items: results[1], categories: results[2], statuses: results[3], attempts: results[4],
        unresolved: Number(refreshed.data?.unresolved ?? 0) };
    }
    const partner = linked ? linkedGradebook(book, books) : null;
    void Promise.all((partner ? [book, partner] : [book]).map(load)).then(data => {
      if (!cancelled) setPanels(data);
    }).catch(() => { if (!cancelled) setError('Unable to refresh this gradebook. Classroom and attendance continue independently. Try again.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [books, selected, linked, client, reload]);

  async function mutate(name: string, args: Record<string, unknown>) {
    setBusy(true); setError('');
    try {
      const result = await client.rpc(name, args);
      if (result.error) throw result.error;
      setReload(value => value + 1);
    } catch (cause) {
      setError(formatError(cause, 'The change could not be saved. Check the fields and try again.'));
    } finally { setBusy(false); }
  }

  const available = books.filter(book => (!program || book.program_id === program) && (!level || book.level_id === level) && (!semester || book.semester_id === semester));
  const chosen = books.find(book => book.id === selected);
  function chooseFilter(kind: string, value: string) {
    const nextProgram = kind === 'program' ? value : program;
    const nextLevel = kind === 'program' ? '' : kind === 'level' ? value : level;
    const nextSemester = kind === 'semester' ? value : '';
    setProgram(nextProgram); setLevel(nextLevel); setSemester(nextSemester);
    setSelected(books.find(book => (!nextProgram || book.program_id === nextProgram) && (!nextLevel || book.level_id === nextLevel) && (!nextSemester || book.semester_id === nextSemester))?.id ?? '');
  }
  const options = (rows: Gradebook[], key: 'program_id' | 'level_id' | 'semester_id', label: 'program_name' | 'level_name' | 'semester_name') =>
    Array.from(new Map(rows.filter(row => row[key]).map(row => [row[key]!, row[label]])).entries()).map(([id, text]) => <option key={id} value={id}>{text}</option>);

  return <main className={styles.workspace}>
    <header><h1>Course gradebooks</h1><p>Separate course records · shared enrollment · complete attempt history</p></header>
    <div className={styles.filters}>
      <label>Program<select disabled={busy} value={program} onChange={e => chooseFilter('program', e.target.value)}>{<option value="">All programs</option>}{options(books, 'program_id', 'program_name')}</select></label>
      <label>Level<select disabled={busy} value={level} onChange={e => chooseFilter('level', e.target.value)}><option value="">All levels</option>{options(books.filter(b => !program || b.program_id === program), 'level_id', 'level_name')}</select></label>
      <label>Semester<select disabled={busy} value={semester} onChange={e => chooseFilter('semester', e.target.value)}><option value="">All semesters</option>{options(books.filter(b => (!program || b.program_id === program) && (!level || b.level_id === level)), 'semester_id', 'semester_name')}</select></label>
      <label>Class<select disabled={busy} value={selected} onChange={e => setSelected(e.target.value)}>{!available.length && <option value="">No classes</option>}{available.map(book => <option key={book.id} value={book.id}>{book.course_code} · {book.section_name}{book.section_status !== 'active' ? ' (archived)' : ''}</option>)}</select></label>
      <label><input type="checkbox" disabled={busy} checked={linked} onChange={e => setLinked(e.target.checked)} /> Show linked course</label>
      <button disabled={loading || busy || !selected} onClick={() => setReload(value => value + 1)}>Refresh roster and theory grades</button>
    </div>
    {error && <p role="alert">{error}</p>}
    {loading && <p role="status">Loading gradebooks…</p>}
    {!loading && !books.length && !error && <p>No gradebooks are available for your assigned sections.</p>}
    {linked && chosen && !linkedGradebook(chosen, books) && <p>No unique linked course is available in this cohort and term, or you do not have access to it.</p>}
    <div className={linked ? styles.pair : ''}>{panels.map(panel => <section key={panel.book.id} className={styles.panel}>
      <h2>{panel.book.course_code} · {panel.book.section_name}</h2>
      <p>{[panel.book.program_name, panel.book.level_name, panel.book.semester_name].filter(Boolean).join(' / ')}</p>
      {!panel.book.course_pair_id && <p>Academic pair mapping is pending. A school administrator must configure this section before theory import.</p>}
      <p>Official course grade: not calculated. Category weights and attempt-selection rules have not been configured.</p>
      {panel.unresolved > 0 && <p role="status">{panel.unresolved} assessment submission(s) need identity or score review before import. No student matches were guessed.</p>}
      <h3>Students and attempts</h3>
      {!panel.students.length && <p>No enrolled students yet. Students appear from the existing class enrollment roster.</p>}
      <div className={styles.scroll}><table><thead><tr><th>Student</th><th>Assessment</th><th>Attempt / status</th><th>Score</th><th>History</th></tr></thead><tbody>
        {panel.students.flatMap(student => {
          const attempts = panel.attempts.filter(attempt => attempt.student_id === student.student_id);
          if (!attempts.length) return [<tr key={student.student_id}><td>{student.display_name}{!student.active && ' (inactive)'}</td><td colSpan={4}>No grades recorded</td></tr>];
          return attempts.map(attempt => <tr key={attempt.id}><td>{student.display_name}{!student.active && ' (inactive)'}</td><td>{panel.items.find(item => item.id === attempt.item_id)?.title}</td><td>{new Date(attempt.attempted_at).toLocaleString()}<br />{attempt.status_label}</td><td>{scoreLabel(attempt.score, attempt.possible_score)}</td><td>
            <button disabled={busy} onClick={async () => {
              setBusy(true); setError(''); setHistory(null); setHistoryTitle(student.display_name);
              try {
                const rows = await readGradebookRows<Revision>((from, to) => client.from('gradebook_revisions').select('*').eq('gradebook_id', panel.book.id).eq('attempt_id', attempt.id).order('id', { ascending: false }).range(from, to));
                setHistory(rows);
              } catch { setError('Attempt history could not load.'); } finally { setBusy(false); }
            }}>View history</button>
            <button disabled={busy} onClick={() => setEdit({ book: panel.book.id, attempt })}>Correct</button>
          </td></tr>);
        })}
      </tbody></table></div>
      <details><summary>Gradebook setup</summary>
        <p>Configure labels and statuses here. No lab rubric or category weights are supplied.</p>
        <form onSubmit={e => { e.preventDefault(); const data = new FormData(e.currentTarget); void mutate('configure_gradebook', {
          p_gradebook_id: panel.book.id, p_kind: data.get('kind'), p_code: data.get('code'), p_label: data.get('label'), p_active: data.get('active') === 'on', p_requires_score: data.get('requires') === 'on',
        }); }}>
          <label>Type<select name="kind"><option value="category">Category</option><option value="status">Status</option></select></label>
          <label>Code<input name="code" pattern="[a-z][a-z0-9_]*" required placeholder="e.g. practical_work" /></label>
          <label>Label<input name="label" required /></label>
          <label><input name="active" type="checkbox" defaultChecked /> Active</label>
          <label><input name="requires" type="checkbox" /> Status requires score</label>
          <button disabled={busy}>Save configuration</button>
        </form>
        <p>Categories: {panel.categories.map(c => `${c.label} (${c.code}${c.active ? '' : ', inactive'})`).join(', ') || 'None'}</p>
        <p>Statuses: {panel.statuses.map(s => `${s.label} (${s.code}${s.active ? '' : ', inactive'})`).join(', ')}</p>
        <form onSubmit={e => { e.preventDefault(); const data = new FormData(e.currentTarget); void mutate('create_gradebook_item', { p_gradebook_id: panel.book.id, p_category_id: data.get('category'), p_title: data.get('title') }); }}>
          <label>Assessment title<input name="title" required /></label>
          <label>Category<select name="category" required><option value="">Choose category</option>{panel.categories.filter(c => c.active).map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</select></label>
          <button disabled={busy}>Add assessment</button>
        </form>
      </details>
      <details open={edit?.book === panel.book.id}><summary>{edit?.book === panel.book.id ? 'Correct an existing attempt' : 'Record an attempt'}</summary>
        <form key={edit?.book === panel.book.id ? edit.attempt.id : 'new'} onSubmit={e => {
          e.preventDefault(); const data = new FormData(e.currentTarget); const correction = edit?.book === panel.book.id ? edit.attempt : null;
          void mutate('record_gradebook_attempt', { p_gradebook_id: panel.book.id, p_item_id: correction?.item_id ?? data.get('item'), p_student_id: correction?.student_id ?? data.get('student'),
            p_status_code: data.get('status'), p_score: data.get('score') === '' ? null : Number(data.get('score')),
            p_possible_score: data.get('possible') === '' ? null : Number(data.get('possible')), p_note: data.get('note'), p_attempt_id: correction?.id ?? null });
        }}>
          <label>Student<select name="student" required disabled={edit?.book === panel.book.id} defaultValue={edit?.book === panel.book.id ? edit.attempt.student_id : ''}><option value="">Choose student</option>{panel.students.map(s => <option key={s.student_id} value={s.student_id} disabled={!s.active && edit?.book !== panel.book.id}>{s.display_name}</option>)}</select></label>
          <label>Assessment<select name="item" required disabled={edit?.book === panel.book.id} defaultValue={edit?.book === panel.book.id ? edit.attempt.item_id : ''}><option value="">Choose assessment</option>{panel.items.map(i => <option key={i.id} value={i.id}>{i.title}</option>)}</select></label>
          <label>Status<select name="status" defaultValue={edit?.book === panel.book.id ? edit.attempt.status_code : 'graded'}>{panel.statuses.filter(s => s.active).map(s => <option key={s.code} value={s.code}>{s.label}</option>)}</select></label>
          <label>Score<input name="score" type="number" min="0" step="any" defaultValue={edit?.book === panel.book.id ? edit.attempt.score ?? '' : ''} /></label>
          <label>Possible score<input name="possible" type="number" min="0.01" step="any" defaultValue={edit?.book === panel.book.id ? edit.attempt.possible_score ?? '' : ''} /></label>
          <label>{edit?.book === panel.book.id ? 'Correction reason (required)' : 'Note'}<input name="note" required={edit?.book === panel.book.id} /></label>
          <button disabled={busy}>Save {edit?.book === panel.book.id ? 'correction' : 'attempt'}</button>
          {edit?.book === panel.book.id && <button type="button" onClick={() => setEdit(null)}>Cancel correction</button>}
        </form>
      </details>
    </section>)}</div>
    {history && <section className={styles.panel}><h2>Attempt history · {historyTitle}</h2><button onClick={() => setHistory(null)}>Close history</button>
      <ol>{history.map(r => <li key={r.id}>{new Date(r.recorded_at).toLocaleString()} · {r.status_label} · {scoreLabel(r.score, r.possible_score)}<p>{r.note}</p></li>)}</ol>
    </section>}
  </main>;
}


