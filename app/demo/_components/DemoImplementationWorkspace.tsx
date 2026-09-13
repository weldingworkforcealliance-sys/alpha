'use client';

import { useEffect, useMemo, useState } from 'react';
import PlannerTeachingConsole, {
  type PlannerLaunchResource,
  type PlannerSupportItem,
} from '@/app/components/planner/PlannerTeachingConsole';
import type {
  DemoCohort,
  DemoCourse,
  DemoCourseDay,
  DemoModule,
  DemoProgram,
  DemoRole,
} from '../_lib/demo-types';
import type { DemoAssessment } from '../_data/pvhs-level1-assessments';
import styles from './DemoImplementationWorkspace.module.css';

type AttendanceStatus = 'not_recorded' | 'present' | 'absent' | 'late' | 'excused';
type AttendanceFlag = 'none' | 'unprepared' | 'left_early' | 'disappeared' | 'other';
type AttendanceRecord = {
  initial: AttendanceStatus;
  final: AttendanceStatus;
  flag: AttendanceFlag;
  note: string;
};
type AttendanceSession = {
  records: Record<string, AttendanceRecord>;
  generalNotes: string;
  finalized: boolean;
  finalizedAt?: string;
  reportStatus?: 'queued' | 'suppressed';
  reportRunAfter?: string;
  correctionLog: string[];
};
type Submission = {
  student: string;
  slug: string;
  day: number;
  score: number;
  submittedAt: string;
};
type ClockEntry = { id: string; clockIn: string; clockOut?: string; note?: string };
type PersistedState = {
  started: Record<string, boolean>;
  completed: Record<string, boolean>;
  notes: Record<string, string>;
  followups: Record<string, boolean>;
  attendance: Record<string, AttendanceSession>;
  submissions: Submission[];
  clockEntries: ClockEntry[];
  trainingChecks: Record<string, boolean>;
};

type Props = {
  program: DemoProgram;
  assessments: DemoAssessment[];
};

const STATE_KEY = 'ltg_demo_pvhs_level1_full_system_v1';
const MODULES: Array<{ id: DemoModule; label: string; group: string }> = [
  { id: 'planner', label: 'Planner', group: 'Teaching' },
  { id: 'agenda', label: 'Agenda Workspace', group: 'Teaching' },
  { id: 'resources', label: 'Content & Resources', group: 'Teaching' },
  { id: 'classroom', label: 'Live Classroom', group: 'Teaching' },
  { id: 'attendance', label: 'Student Attendance', group: 'Classroom Tools' },
  { id: 'review', label: 'Review Queue', group: 'Classroom Tools' },
  { id: 'timeclock', label: 'Employee Time Clock', group: 'Classroom Tools' },
  { id: 'reports', label: 'Reporting & Analytics', group: 'Reports' },
  { id: 'training', label: 'Training Mode', group: 'Admin' },
  { id: 'school', label: 'School Dashboard', group: 'Admin' },
];
const ROLE_LABELS: Record<DemoRole, string> = {
  instructor: 'Instructor',
  lead_instructor: 'Lead Instructor',
  program_lead: 'Program Lead',
  school_admin: 'School Admin',
};
const SUPPORT_LABELS: Record<string, string> = {
  instructorPrep: 'Instructor Prep',
  safetyFocus: 'Safety Focus',
  openingReview: 'Opening Review',
  demonstration: 'Demonstration',
  guidedPractice: 'Guided Practice',
  independentPractice: 'Independent Practice',
  instructorChecks: 'Instructor Checks',
  assessment: 'Assessment',
  commonProblems: 'Common Problems',
  teachingTips: 'Teaching Tips',
  materialsEquipment: 'Materials / Equipment',
  correspondingApplication: 'Corresponding Application',
  evidenceCheck: 'Evidence / Check',
  weeklyCoachingFocus: 'Weekly Coaching Focus',
  coachingFocus: 'Coaching Focus',
  ifStudentsStruggle: 'If Students Struggle',
  keepMomentum: 'Keep Momentum',
  awsAlignment: 'AWS Alignment',
  awsKeyIndicators: 'AWS Key Indicators',
  safetyGate: 'Safety Gate',
  procedureVariableFocus: 'Procedure / Variable Focus',
  evidenceType: 'Evidence Type',
  inspectionAcceptanceFocus: 'Inspection / Acceptance Focus',
  focusedRetry: 'Focused Retry',
  recordLinkExpectation: 'Record Link Expectation',
  qualificationGuardrail: 'Qualification Guardrail',
};

function emptyPersisted(): PersistedState {
  return {
    started: {}, completed: {}, notes: {}, followups: {}, attendance: {}, submissions: [],
    clockEntries: [], trainingChecks: {},
  };
}
function dayKey(cohort: DemoCohort, course: DemoCourse, day: number) {
  return `${cohort.id}:${course.code}:${day}`;
}
function attendanceKey(cohort: DemoCohort, day: number) {
  return `${cohort.id}:${day}`;
}
function prettyDate(value?: string) {
  if (!value) return 'Demo Day';
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  });
}
function formatClock(value: string) {
  return new Date(value).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}
function hoursBetween(start: string, end?: string) {
  return Math.max(0, (new Date(end ?? new Date().toISOString()).getTime() - new Date(start).getTime()) / 3_600_000);
}
function newAttendanceSession(cohort: DemoCohort): AttendanceSession {
  return {
    records: Object.fromEntries(cohort.students.map((student) => [student, {
      initial: 'not_recorded' as AttendanceStatus,
      final: 'not_recorded' as AttendanceStatus,
      flag: 'none' as AttendanceFlag,
      note: '',
    }])),
    generalNotes: '', finalized: false, correctionLog: [],
  };
}
function answerIsCorrect(assessment: DemoAssessment, questionKey: string, answer: string) {
  const question = assessment.questions.find((item) => item.key === questionKey);
  if (!question) return false;
  const normalized = answer.trim().toLowerCase();
  if (question.acceptedAnswers?.some((item) => item.toLowerCase() === normalized)) return true;
  return question.correctAnswer.trim().toLowerCase() === normalized;
}

export default function DemoImplementationWorkspace({ program, assessments }: Props) {
  const cohorts = program.cohorts ?? [];
  const [activeModule, setActiveModule] = useState<DemoModule>('planner');
  const [cohortId, setCohortId] = useState(cohorts[0]?.id ?? '');
  const [courseCode, setCourseCode] = useState(program.courses[0]?.code ?? '');
  const [dayNumber, setDayNumber] = useState(1);
  const [role, setRole] = useState<DemoRole>(program.defaultRole ?? 'instructor');
  const [persisted, setPersisted] = useState<PersistedState>(emptyPersisted);
  const [hydrated, setHydrated] = useState(false);
  const [attendanceTab, setAttendanceTab] = useState<'take'|'history'|'corrections'|'admin'>('take');
  const [activeAssessmentSlug, setActiveAssessmentSlug] = useState('');
  const [studentAnswers, setStudentAnswers] = useState<Record<string, string>>({});
  const [assessmentStudent, setAssessmentStudent] = useState('');
  const [now, setNow] = useState(Date.now());

  const cohort = cohorts.find((item) => item.id === cohortId) ?? cohorts[0];
  const course = program.courses.find((item) => item.code === courseCode) ?? program.courses[0];
  const day = course?.days.find((item) => item.dayNumber === dayNumber) ?? course?.days[0];
  const section = cohort?.sections.find((item) => item.courseCode === course?.code);
  const currentDate = cohort?.demoDates?.[dayNumber - 1];
  const activeAssessment = assessments.find((item) => item.slug === activeAssessmentSlug) ?? null;
  const key = cohort && course ? dayKey(cohort, course, dayNumber) : '';
  const attKey = cohort ? attendanceKey(cohort, dayNumber) : '';
  const attendanceSession = cohort ? (persisted.attendance[attKey] ?? newAttendanceSession(cohort)) : null;
  const isManager = role === 'lead_instructor' || role === 'program_lead' || role === 'school_admin';
  const canCorrect = role === 'program_lead' || role === 'school_admin';

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STATE_KEY);
      if (raw) setPersisted({ ...emptyPersisted(), ...JSON.parse(raw) });
    } catch { /* corrupt demo state is disposable */ }
    setHydrated(true);
  }, []);
  useEffect(() => {
    if (!hydrated) return;
    sessionStorage.setItem(STATE_KEY, JSON.stringify(persisted));
  }, [persisted, hydrated]);
  useEffect(() => {
    if (cohort && !assessmentStudent) setAssessmentStudent(cohort.students[0] ?? '');
  }, [cohort, assessmentStudent]);
  useEffect(() => {
    if (cohort && !cohort.students.includes(assessmentStudent)) setAssessmentStudent(cohort.students[0] ?? '');
  }, [cohort, assessmentStudent]);
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  if (!cohort || !course || !day || !section) {
    return <div className={styles.empty}>PVHS Level 1 demo configuration is unavailable.</div>;
  }

  const setPersist = (recipe: (current: PersistedState) => PersistedState) => setPersisted((current) => recipe(current));
  const updateAttendance = (recipe: (session: AttendanceSession) => AttendanceSession) => {
    setPersist((current) => ({
      ...current,
      attendance: { ...current.attendance, [attKey]: recipe(current.attendance[attKey] ?? newAttendanceSession(cohort)) },
    }));
  };
  const openAssessment = (slug: string) => {
    setActiveAssessmentSlug(slug);
    setStudentAnswers({});
    setActiveModule('classroom');
  };
  const resetDemo = () => {
    if (!window.confirm('Reset all temporary PVHS demo activity? Curriculum and configuration will remain.')) return;
    sessionStorage.removeItem(STATE_KEY);
    setPersisted(emptyPersisted());
    setActiveAssessmentSlug('');
    setStudentAnswers({});
    setDayNumber(1);
    setCourseCode(program.courses[0]?.code ?? '');
    setActiveModule('planner');
  };

  const supportItems: PlannerSupportItem[] = Object.entries(day.support)
    .filter(([, body]) => Boolean(body))
    .map(([supportKey, body]) => ({ key: supportKey, label: SUPPORT_LABELS[supportKey] ?? supportKey, body }));
  const dayOptions = course.days.map((item) => ({ id: `${course.code}-${item.dayNumber}`, dayNumber: item.dayNumber, title: item.title }));
  const started = Boolean(persisted.started[key]);
  const completed = Boolean(persisted.completed[key]);
  const moduleGroups = Array.from(new Set(MODULES.map((item) => item.group)));
  const assessmentForDay = day.resources.map((resource) => resource.demoActivityKey).find(Boolean) ?? '';

  const plannerActionPanel = (
    <div className={styles.panel}>
      <div className={styles.attendanceToolbar}>
        <div>
          <div className={styles.eyebrow}>Daily Workflow</div>
          <strong>{prettyDate(currentDate)} · {section.sectionName}</strong>
        </div>
        <div className={styles.rowControls}>
          <button className={styles.primaryButton} onClick={() => setPersist((current) => ({ ...current, started: { ...current.started, [key]: true } }))} disabled={started}>Start Today</button>
          <button className={styles.button} onClick={() => setPersist((current) => ({ ...current, completed: { ...current.completed, [key]: true } }))} disabled={!started || completed}>Complete Day</button>
          <button className={styles.button} onClick={() => setActiveModule('attendance')}>Attendance</button>
        </div>
      </div>
      <label>
        <span className={styles.statusLabel}>Instructor completion note</span>
        <textarea className={styles.noteBox} value={persisted.notes[key] ?? ''} onChange={(event) => setPersist((current) => ({ ...current, notes: { ...current.notes, [key]: event.target.value } }))} placeholder="Record observation, evidence, pacing note, or next-step guidance." />
      </label>
      <label className={styles.subtle}>
        <input type="checkbox" checked={Boolean(persisted.followups[key])} onChange={(event) => setPersist((current) => ({ ...current, followups: { ...current.followups, [key]: event.target.checked } }))} /> Flag for review / follow-up
      </label>
    </div>
  );

  const renderPlanner = () => (
    <PlannerTeachingConsole
      courseLabel={course.code}
      sectionLabel={section.sectionName}
      dayNumber={day.dayNumber}
      totalDays={section.plannedInstructionalDays}
      title={day.title}
      objective={day.objective}
      formatLabel={day.formatLabel}
      protectedOutcomes={day.outcomes}
      rows={day.rows}
      resources={day.resources}
      supportItems={supportItems}
      dayOptions={dayOptions}
      selectedGuideDayId={`${course.code}-${day.dayNumber}`}
      isCurrentDay={dayNumber === 1}
      onPrevious={() => setDayNumber(Math.max(1, dayNumber - 1))}
      onNext={() => setDayNumber(Math.min(5, dayNumber + 1))}
      onSelectDay={setDayNumber}
      onReturnCurrent={() => setDayNumber(1)}
      onLaunchResource={(resource: PlannerLaunchResource) => {
        const match = day.resources.find((item) => item.id === resource.id);
        if (match?.demoActivityKey) openAssessment(match.demoActivityKey);
      }}
      studentDisplayUrl={`/demo/welding/student-display?cohort=${encodeURIComponent(cohort.id)}&course=${encodeURIComponent(course.code)}&day=${dayNumber}`}
      actionPanel={plannerActionPanel}
    />
  );

  const renderAgenda = () => (
    <>
      <div className={styles.banner}>PVHS paired-day agenda · {prettyDate(currentDate)} · {cohort.dailyStartTime}–{cohort.dailyEndTime}. WLD 105 is the 60-minute classroom/theory block; WLD 110 is the 120-minute lab/application block.</div>
      <div className={styles.grid2}>
        {program.courses.map((agendaCourse) => {
          const agendaDay = agendaCourse.days.find((item) => item.dayNumber === dayNumber)!;
          const agendaSection = cohort.sections.find((item) => item.courseCode === agendaCourse.code)!;
          return <section className={styles.panel} key={agendaCourse.code}>
            <div className={styles.eyebrow}>{agendaSection.sectionName} · {agendaSection.plannedMinutesPerDay} min</div>
            <h2>{agendaCourse.code} · {agendaDay.title}</h2>
            <p className={styles.subtle}>{agendaDay.objective}</p>
            <div className={styles.schedule}>{agendaDay.rows.map((row) => <div className={styles.scheduleRow} key={row.id}><span>{row.time}</span><div>{row.instructor}</div></div>)}</div>
          </section>;
        })}
      </div>
      {plannerActionPanel}
    </>
  );

  const renderResources = () => {
    const all = program.courses.flatMap((item) => item.days.filter((d) => d.dayNumber <= 5).flatMap((d) => d.resources.map((resource) => ({ ...resource, course: item.code, day: d.dayNumber }))));
    return <section className={styles.panel}>
      <div className={styles.eyebrow}>PVHS Level 1 · Days 1–5</div><h2>Content & Resources</h2>
      <div className={styles.resourceList}>{all.length ? all.map((resource) => <div className={styles.resource} key={`${resource.course}-${resource.day}-${resource.id}`}><div><strong>{resource.course} · Day {resource.day} · {resource.title}</strong><small>{resource.type}{resource.required ? ' · Required' : ''}{resource.studentSafe ? ' · Student-safe' : ''}</small></div><div className={styles.resourceActions}>{resource.demoActivityKey && <button className={styles.primaryButton} onClick={() => openAssessment(resource.demoActivityKey!)}>Launch in Demo</button>}{resource.url?.startsWith('http') && <a className={styles.button} href={resource.url} target="_blank" rel="noreferrer">Open Source</a>}</div></div>) : <div className={styles.empty}>No resources attached.</div>}</div>
    </section>;
  };

  const submitAssessment = () => {
    if (!activeAssessment || !assessmentStudent) return;
    const correct = activeAssessment.questions.filter((question) => answerIsCorrect(activeAssessment, question.key, studentAnswers[question.key] ?? '')).length;
    const score = Math.round((correct / activeAssessment.questions.length) * 100);
    setPersist((current) => ({ ...current, submissions: [...current.submissions.filter((item) => !(item.student === assessmentStudent && item.slug === activeAssessment.slug && item.day === dayNumber)), { student: assessmentStudent, slug: activeAssessment.slug, day: dayNumber, score, submittedAt: new Date().toISOString() }] }));
  };
  const simulateRoster = () => {
    if (!activeAssessment) return;
    const additions = cohort.students.map((student, index) => ({ student, slug: activeAssessment.slug, day: dayNumber, score: Math.max(55, 96 - index * 6), submittedAt: new Date().toISOString() }));
    setPersist((current) => ({ ...current, submissions: [...current.submissions.filter((item) => !(item.slug === activeAssessment.slug && item.day === dayNumber && cohort.students.includes(item.student))), ...additions] }));
  };
  const renderClassroom = () => {
    const dayAssessments = assessments.filter((assessment) => day.resources.some((resource) => resource.demoActivityKey === assessment.slug));
    const selected = activeAssessment ?? dayAssessments[0] ?? null;
    const results = selected ? persisted.submissions.filter((item) => item.slug === selected.slug && item.day === dayNumber && cohort.students.includes(item.student)) : [];
    const average = results.length ? Math.round(results.reduce((sum, item) => sum + item.score, 0) / results.length) : null;
    return <>
      <div className={styles.banner}>Live Classroom is isolated but functional. Join codes, answers, scores and instructor results exist only in this demo session.</div>
      <section className={styles.panel}>
        <div className={styles.attendanceToolbar}><div><div className={styles.eyebrow}>Connected activities</div><h2>Live Classroom · {course.code} · Day {dayNumber}</h2></div>{selected && <div><div className={styles.statusLabel}>Demo join code</div><div className={styles.liveCode}>{cohort.code.includes('-B-') ? 'B' : 'C'}{dayNumber}{selected.slug === 'preclass_math' ? 'MATH' : 'BLUE'}</div></div>}</div>
        <div className={styles.tabRow}>{assessments.map((assessment) => <button key={assessment.slug} className={`${styles.tab} ${selected?.slug === assessment.slug ? styles.tabActive : ''}`} onClick={() => { setActiveAssessmentSlug(assessment.slug); setStudentAnswers({}); }}>{assessment.title}</button>)}</div>
        {!selected ? <div className={styles.empty}>This planner day has no connected assessment.</div> : <div className={styles.assessmentGrid}>
          <div>
            <h3>Student simulator · {selected.estimatedMinutes} minutes</h3><p className={styles.subtle}>{selected.instructions}</p>
            <label><span className={styles.statusLabel}>Student</span><select className={styles.select} value={assessmentStudent} onChange={(event) => setAssessmentStudent(event.target.value)}>{cohort.students.map((student) => <option key={student}>{student}</option>)}</select></label>
            <div style={{marginTop:12}}>{selected.questions.map((question) => <div className={styles.question} key={question.key}><p>{question.number}. {question.text}</p>{question.type === 'mc' && question.options ? <div className={styles.options}>{Object.entries(question.options).map(([letter, option]) => <label className={styles.option} key={letter}><input type="radio" name={question.key} checked={studentAnswers[question.key] === letter} onChange={() => setStudentAnswers((current) => ({...current,[question.key]:letter}))}/><span><strong>{letter}.</strong> {option}</span></label>)}</div> : <input className={styles.textInput} value={studentAnswers[question.key] ?? ''} onChange={(event) => setStudentAnswers((current) => ({...current,[question.key]:event.target.value}))}/>}</div>)}</div>
            <button className={styles.primaryButton} onClick={submitAssessment}>Submit Student Assessment</button>
          </div>
          <aside>
            <div className={styles.panel}><div className={styles.eyebrow}>Instructor results</div><h3>{results.length}/{cohort.students.length} submitted</h3>{average !== null && <div className={styles.score}>{average}% avg</div>}<button className={styles.button} onClick={simulateRoster}>Simulate remaining roster</button><div className={styles.log} style={{marginTop:12}}>{results.map((item) => <div className={styles.logItem} key={`${item.student}-${item.slug}`}><strong>{item.student}</strong> · {item.score}%</div>)}</div></div>
          </aside>
        </div>}
      </section>
    </>;
  };

  const setAttendanceRecord = (student: string, field: keyof AttendanceRecord, value: string) => updateAttendance((session) => ({ ...session, records: { ...session.records, [student]: { ...session.records[student], [field]: value } } }));
  const finalizeAttendance = () => {
    if (course.code !== 'WLD 110') return;
    const nowIso = new Date().toISOString();
    const runAfter = new Date(Date.now() + cohort.attendance.reportDelayMinutes * 60_000).toISOString();
    updateAttendance((session) => ({ ...session, finalized: true, finalizedAt: nowIso, reportStatus: 'suppressed', reportRunAfter: runAfter, correctionLog: [...session.correctionLog, `Finalized from ${section.sectionName} at ${formatClock(nowIso)}. Public-demo delivery suppressed.`] }));
  };
  const renderAttendance = () => {
    const session = attendanceSession!;
    const history = Object.entries(persisted.attendance).filter(([sessionKey, value]) => sessionKey.startsWith(`${cohort.id}:`) && value.finalized);
    return <>
      <div className={styles.banner}>PVHS paired attendance session · {cohort.attendance.pairName}. Initial attendance belongs to WLD 105; final pair confirmation/finalization belongs to WLD 110. The public demo never emails a real recipient.</div>
      <section className={styles.panel}>
        <div className={styles.attendanceToolbar}><div><div className={styles.eyebrow}>{cohort.name}</div><h2>Student Attendance · Day {dayNumber} · {prettyDate(currentDate)}</h2><div className={styles.sectionCode}>{section.sectionCode}</div></div><div className={styles.rolePill}>{ROLE_LABELS[role]}</div></div>
        <div className={styles.tabRow}><button className={`${styles.tab} ${attendanceTab==='take'?styles.tabActive:''}`} onClick={() => setAttendanceTab('take')}>Take Attendance</button><button className={`${styles.tab} ${attendanceTab==='history'?styles.tabActive:''}`} onClick={() => setAttendanceTab('history')}>History</button><button className={`${styles.tab} ${attendanceTab==='corrections'?styles.tabActive:''}`} onClick={() => setAttendanceTab('corrections')}>Corrections</button><button className={`${styles.tab} ${attendanceTab==='admin'?styles.tabActive:''}`} onClick={() => setAttendanceTab('admin')}>Admin Setup</button></div>
        {attendanceTab === 'take' && <>
          <div className={styles.attendanceToolbar}><div className={styles.subtle}>{session.finalized ? `Finalized ${session.finalizedAt ? formatClock(session.finalizedAt) : ''}` : 'Open attendance session'}</div><div className={styles.rowControls}><button className={styles.button} disabled={session.finalized} onClick={() => updateAttendance((current) => ({...current,records:Object.fromEntries(Object.entries(current.records).map(([student,record]) => [student,{...record,initial:'present'}]))}))}>Mark All Present</button><button className={styles.button} disabled={session.finalized} onClick={() => updateAttendance(() => newAttendanceSession(cohort))}>Reset Session</button></div></div>
          <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Student</th><th>Initial (WLD 105)</th><th>Final (WLD 110)</th><th>Flag</th><th>Instructor note</th></tr></thead><tbody>{cohort.students.map((student) => { const record = session.records[student]; return <tr key={student}><td><strong>{student}</strong></td><td><select className={styles.miniSelect} disabled={session.finalized} value={record.initial} onChange={(event) => setAttendanceRecord(student,'initial',event.target.value)}>{['not_recorded','present','absent','late','excused'].map((value) => <option key={value} value={value}>{value.replace('_',' ')}</option>)}</select></td><td><select className={styles.miniSelect} disabled={session.finalized || course.code !== 'WLD 110'} value={record.final} onChange={(event) => setAttendanceRecord(student,'final',event.target.value)}>{['not_recorded','present','absent','late','excused'].map((value) => <option key={value} value={value}>{value.replace('_',' ')}</option>)}</select></td><td><select className={styles.miniSelect} disabled={session.finalized || course.code !== 'WLD 110'} value={record.flag} onChange={(event) => setAttendanceRecord(student,'flag',event.target.value)}>{['none','unprepared','left_early','disappeared','other'].map((value) => <option key={value} value={value}>{value.replace('_',' ')}</option>)}</select></td><td><input className={styles.miniInput} disabled={session.finalized} value={record.note} onChange={(event) => setAttendanceRecord(student,'note',event.target.value)}/></td></tr>; })}</tbody></table></div>
          <label><span className={styles.statusLabel}>General attendance notes</span><textarea className={styles.noteBox} disabled={session.finalized} value={session.generalNotes} onChange={(event) => updateAttendance((current) => ({...current,generalNotes:event.target.value}))}/></label>
          {course.code !== 'WLD 110' ? <div className={`${styles.banner} ${styles.warning}`}>Final confirmation is intentionally locked here. Switch to WLD 110, the completion section, to finalize the paired PVHS attendance day.</div> : <button className={styles.primaryButton} disabled={session.finalized} onClick={finalizeAttendance}>Finalize WLD 105/110 Attendance Pair</button>}
          {session.finalized && <div className={styles.queueCard}><strong>PVHS report workflow created</strong><div>Production behavior: queue after {cohort.attendance.reportDelayMinutes} minutes. Demo status: delivery suppressed. Recipient: {cohort.attendance.recipientLabel}.</div><div className={styles.subtle}>Would run after {session.reportRunAfter ? formatClock(session.reportRunAfter) : '—'}</div></div>}
        </>}
        {attendanceTab === 'history' && <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Day</th><th>Date</th><th>Present final</th><th>Flags</th><th>Report</th></tr></thead><tbody>{history.length ? history.map(([sessionKey, value]) => { const d = Number(sessionKey.split(':').pop()); const present = Object.values(value.records).filter((r) => r.final === 'present').length; const flags = Object.values(value.records).filter((r) => r.flag !== 'none').length; return <tr key={sessionKey}><td>Day {d}</td><td>{prettyDate(cohort.demoDates?.[d-1])}</td><td>{present}/{cohort.students.length}</td><td>{flags}</td><td>{value.reportStatus ?? '—'}</td></tr>; }) : <tr><td colSpan={5}>No finalized demo attendance days yet.</td></tr>}</tbody></table></div>}
        {attendanceTab === 'corrections' && <>{!canCorrect && <div className={`${styles.banner} ${styles.warning}`}>Switch demo role to Program Lead or School Admin to use correction controls.</div>}<div className={styles.log}>{history.map(([sessionKey, value]) => <div className={styles.logItem} key={sessionKey}><strong>{sessionKey.replace(`${cohort.id}:`,'Day ')}</strong> · finalized {value.finalizedAt ? formatClock(value.finalizedAt) : ''}<div className={styles.rowControls}>{canCorrect && <button className={styles.button} onClick={() => setPersist((current) => ({...current,attendance:{...current.attendance,[sessionKey]:{...value,finalized:false,correctionLog:[...value.correctionLog,`Reopened for correction by ${ROLE_LABELS[role]} at ${formatClock(new Date().toISOString())}.`]}}}))}>Reopen for Correction</button>}</div>{value.correctionLog.map((log,index) => <div className={styles.subtle} key={index}>{log}</div>)}</div>)}</div></>}
        {attendanceTab === 'admin' && <div className={`${styles.grid2} ${styles.adminOnly}`} style={{padding:14,borderRadius:10}}><div><div className={styles.statusLabel}>Attendance pair</div><strong>{cohort.attendance.pairName}</strong><p className={styles.subtle}>Mode: {cohort.attendance.mode.toUpperCase()} · Reporting: {cohort.attendance.reportingEnabled ? 'Enabled' : 'Disabled'}</p></div><div><div className={styles.statusLabel}>Production delay</div><strong>{cohort.attendance.reportDelayMinutes} minutes</strong><p className={styles.subtle}>{cohort.attendance.recipientLabel}</p></div></div>}
      </section>
    </>;
  };

  const reviewItems = [
    ...Object.entries(persisted.followups).filter(([,flag]) => flag).map(([itemKey]) => ({ title: itemKey.split(':').slice(1).join(' · '), detail: persisted.notes[itemKey] || 'Flagged instructor follow-up' })),
    ...persisted.submissions.filter((item) => item.score < 80 && cohort.students.includes(item.student)).map((item) => ({ title: `${item.student} · ${item.slug}`, detail: `Assessment score ${item.score}% · targeted review recommended.` })),
  ];
  const renderReview = () => <section className={styles.panel}><div className={styles.eyebrow}>Instructional follow-up</div><h2>Review Queue</h2><p className={styles.subtle}>Accepted curriculum is protected. Review items can adjust pacing, implementation notes, coaching and follow-up, but not approved outcomes.</p>{reviewItems.length ? reviewItems.map((item,index) => <div className={styles.reviewCard} key={`${item.title}-${index}`}><strong>{item.title}</strong><div>{item.detail}</div></div>) : <div className={styles.empty}>No follow-up items in this demo session.</div>}</section>;

  const openClock = persisted.clockEntries.find((entry) => !entry.clockOut);
  const totalClockHours = persisted.clockEntries.reduce((sum, entry) => sum + hoursBetween(entry.clockIn, entry.clockOut), 0);
  const renderTimeclock = () => <>
    <div className={styles.clockFace}><div className={styles.clockName}>Finsen Sierra Time Clock · PVHS Level 1 Demo</div><div className={styles.clockState}>{openClock ? 'Punched In' : 'Punched Out'}</div><div className={styles.clockTime}>{new Date(now).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}</div><div className={styles.clockButtons}>{!openClock ? <button className={styles.primaryButton} onClick={() => setPersist((current) => ({...current,clockEntries:[...current.clockEntries,{id:crypto.randomUUID(),clockIn:new Date().toISOString()}]}))}>Punch In</button> : <button className={styles.dangerButton} onClick={() => setPersist((current) => ({...current,clockEntries:current.clockEntries.map((entry) => entry.id===openClock.id?{...entry,clockOut:new Date().toISOString()}:entry)}))}>Punch Out</button>}</div></div>
    <section className={styles.panel}><div className={styles.attendanceToolbar}><div><div className={styles.eyebrow}>Employee record</div><h2>Weekly Time Record</h2></div><div className={styles.metric}><strong>{totalClockHours.toFixed(2)}</strong><span>demo hours</span></div></div><div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Employee</th><th>In</th><th>Out</th><th>Hours</th><th>Method</th></tr></thead><tbody>{persisted.clockEntries.length ? [...persisted.clockEntries].reverse().map((entry) => <tr key={entry.id}><td>PVHS Level 1 Instructor</td><td>{formatClock(entry.clockIn)}</td><td>{entry.clockOut?formatClock(entry.clockOut):'Active'}</td><td>{hoursBetween(entry.clockIn,entry.clockOut).toFixed(2)}</td><td>Demo punch</td></tr>) : <tr><td colSpan={5}>No demo punches yet.</td></tr>}</tbody></table></div>{isManager && <div className={`${styles.banner} ${styles.warning}`}>Manager view enabled: live LTG provides employee management, PIN controls, adjustments and payroll-ready reporting. Public demo changes remain local and cannot reach payroll.</div>}</section>
  </>;

  const finalizedSessions = Object.values(persisted.attendance).filter((item) => item.finalized).length;
  const courseCompleted = Object.entries(persisted.completed).filter(([itemKey,value]) => value && itemKey.startsWith(`${cohort.id}:`)).length;
  const cohortSubmissions = persisted.submissions.filter((item) => cohort.students.includes(item.student));
  const assessmentAverage = cohortSubmissions.length ? Math.round(cohortSubmissions.reduce((sum,item) => sum + item.score,0)/cohortSubmissions.length) : null;
  const renderReports = () => <><div className={styles.grid3}><div className={styles.metric}><strong>{courseCompleted}/10</strong><span>course-days completed in 5-day pair</span></div><div className={styles.metric}><strong>{finalizedSessions}/5</strong><span>attendance days finalized</span></div><div className={styles.metric}><strong>{assessmentAverage === null ? '—' : `${assessmentAverage}%`}</strong><span>assessment average</span></div></div><section className={styles.panel}><h2>Reporting & Analytics</h2><div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Area</th><th>PVHS Level 1 measure</th><th>Demo status</th></tr></thead><tbody><tr><td>Curriculum progress</td><td>WLD 105 + WLD 110 paired first five days</td><td>{courseCompleted}/10 course-days complete</td></tr><tr><td>Attendance</td><td>Paired initial + final confirmation</td><td>{finalizedSessions} finalized</td></tr><tr><td>Live Classroom</td><td>Connected assessment submissions</td><td>{cohortSubmissions.length} submissions</td></tr><tr><td>Employee time</td><td>Payroll-ready weekly hours</td><td>{totalClockHours.toFixed(2)} hours</td></tr></tbody></table></div></section></>;

  const trainingKeys = ['planner','classroom','attendance','timeclock','reports'];
  const renderTraining = () => <section className={styles.panel}><div className={styles.eyebrow}>Training Mode</div><h2>PVHS Level 1 Instructor Walkthrough</h2><p className={styles.subtle}>Training Mode uses the same disposable demo state. Check off each operating workflow after practicing it.</p><div className={styles.log}>{trainingKeys.map((trainingKey) => <label className={styles.logItem} key={trainingKey}><input type="checkbox" checked={Boolean(persisted.trainingChecks[trainingKey])} onChange={(event) => setPersist((current) => ({...current,trainingChecks:{...current.trainingChecks,[trainingKey]:event.target.checked}}))}/> {MODULES.find((item) => item.id===trainingKey)?.label ?? trainingKey}</label>)}</div><div className={styles.metric} style={{marginTop:14}}><strong>{trainingKeys.filter((item) => persisted.trainingChecks[item]).length}/{trainingKeys.length}</strong><span>training workflows completed</span></div></section>;

  const renderSchool = () => <><div className={`${styles.banner} ${styles.warning}`}>School Dashboard demo uses synthetic student identities and suppresses external email/payroll actions, while preserving the PVHS Level 1 operating structure.</div><div className={styles.grid2}>{cohorts.map((item) => { const sessions = Object.entries(persisted.attendance).filter(([sessionKey,value]) => sessionKey.startsWith(`${item.id}:`) && value.finalized).length; const completedCount = Object.entries(persisted.completed).filter(([itemKey,value]) => itemKey.startsWith(`${item.id}:`) && value).length; return <section className={styles.panel} key={item.id}><div className={styles.eyebrow}>{item.code}</div><h2>{item.name}</h2><p>{item.dailyStartTime}–{item.dailyEndTime} · {item.students.length} demo students</p><div className={styles.grid3}><div className={styles.metric}><strong>{completedCount}</strong><span>course-days complete</span></div><div className={styles.metric}><strong>{sessions}</strong><span>attendance finalized</span></div><div className={styles.metric}><strong>{item.attendance.reportDelayMinutes}m</strong><span>report delay</span></div></div><div className={styles.progressTrack} style={{marginTop:12}}><div className={styles.progressBar} style={{width:`${Math.min(100,(completedCount/10)*100)}%`}}/></div></section>; })}</div></>;

  const renderModule = () => {
    switch (activeModule) {
      case 'planner': return renderPlanner();
      case 'agenda': return renderAgenda();
      case 'resources': return renderResources();
      case 'classroom': return renderClassroom();
      case 'attendance': return renderAttendance();
      case 'review': return renderReview();
      case 'timeclock': return renderTimeclock();
      case 'reports': return renderReports();
      case 'training': return renderTraining();
      case 'school': return renderSchool();
      default: return renderPlanner();
    }
  };

  return <div className={styles.shell}>
    <aside className={styles.sidebar}>
      <div className={styles.brand}><div className={styles.brandMark}>LTG</div><div className={styles.brandCopy}>Education<br/>Operating System</div></div>
      <div className={styles.demoBadge}>PUBLIC DEMO · PVHS LEVEL 1 · TEMPORARY DATA</div>
      {moduleGroups.map((group) => <div className={styles.navGroup} key={group}><div className={styles.navLabel}>{group}</div>{MODULES.filter((item) => item.group===group).map((item) => <button className={`${styles.navButton} ${activeModule===item.id?styles.navButtonActive:''}`} key={item.id} onClick={() => setActiveModule(item.id)}>{item.label}</button>)}</div>)}
      <div className={styles.sideFooter}>Exact first-five-day PVHS Level 1 operating model.<br/>No live school records are read into this workspace. Demo activity is discarded after 30 minutes of inactivity.</div>
    </aside>
    <div className={styles.main}>
      <div className={styles.mobileNav}>{MODULES.map((item) => <button className={`${styles.tab} ${activeModule===item.id?styles.tabActive:''}`} key={item.id} onClick={() => setActiveModule(item.id)}>{item.label}</button>)}</div>
      <header className={styles.topbar}><div className={styles.topbarRow}><div className={styles.titleBlock}><div className={styles.eyebrow}>Passaic County Community College · PVHS Level 1</div><h1>{cohort.name}</h1><div className={styles.subtle}>{cohort.dailyStartTime}–{cohort.dailyEndTime} · {cohort.attendance.pairName}</div></div><div className={styles.controls}><select className={styles.select} value={cohort.id} onChange={(event) => {setCohortId(event.target.value);setDayNumber(1);}}>{cohorts.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select><select className={styles.select} value={course.code} onChange={(event) => setCourseCode(event.target.value)}>{program.courses.map((item) => <option key={item.code} value={item.code}>{item.code}</option>)}</select><select className={styles.select} value={dayNumber} onChange={(event) => setDayNumber(Number(event.target.value))}>{course.days.map((item) => <option value={item.dayNumber} key={item.dayNumber}>Day {item.dayNumber} · {prettyDate(cohort.demoDates?.[item.dayNumber-1])}</option>)}</select><select className={styles.select} value={role} onChange={(event) => setRole(event.target.value as DemoRole)}>{Object.entries(ROLE_LABELS).map(([value,label]) => <option value={value} key={value}>{label}</option>)}</select><button className={styles.dangerButton} onClick={resetDemo}>Reset Demo</button></div></div></header>
      <main className={styles.content}>
        <div className={styles.statusStrip}><div className={styles.statusCard}><div className={styles.statusLabel}>Section</div><div className={styles.statusValue}>{section.sectionName}</div><div className={styles.sectionCode}>{section.sectionCode}</div></div><div className={styles.statusCard}><div className={styles.statusLabel}>Instructional day</div><div className={styles.statusValue}>Day {dayNumber} · {prettyDate(currentDate)}</div></div><div className={styles.statusCard}><div className={styles.statusLabel}>Roster</div><div className={styles.statusValue}>{cohort.students.length} demo students</div></div><div className={styles.statusCard}><div className={styles.statusLabel}>Viewing as</div><div className={styles.statusValue}>{ROLE_LABELS[role]}</div></div></div>
        {renderModule()}
        <div className={styles.footerNotice}>PVHS Level 1 public demo · curriculum/configuration snapshot is read-only · all activity is browser-session data · external attendance email, payroll and school records are suppressed.</div>
      </main>
    </div>
  </div>;
}
