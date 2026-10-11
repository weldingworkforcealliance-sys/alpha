'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import PlannerTeachingConsole, {
  type PlannerLaunchResource,
  type PlannerPlanRow,
  type PlannerSupportItem,
} from '@/app/components/planner/PlannerTeachingConsole';
import type { DemoCourseDay, DemoModule, DemoProgram, DemoResource } from '../_lib/demo-types';
import FabtechTeachingDayV2 from './FabtechTeachingDayV2';
import FabtechGradingPracticeV2, { scoredSampleCount } from './FabtechGradingPracticeV2';

type AttendanceStatus = 'Present' | 'Late' | 'Absent' | 'Not recorded';
type AttendanceFlag = 'None' | 'Unprepared' | 'Left early' | 'Other';

type AttendanceStudent = {
  id: number;
  name: string;
  initial: AttendanceStatus;
  final: AttendanceStatus;
  flag: AttendanceFlag;
  note: string;
};

type AttendanceDay = {
  finalized: boolean;
  students: AttendanceStudent[];
};

type LiveSession = {
  activityKey: string;
  title: string;
  courseCode: string;
  dayNumber: number;
  startedAt: number;
  joinCode: string;
};

type DemoState = {
  activeModule: DemoModule;
  selectedCourseCode: string;
  currentDay: number;
  startedAtByKey: Record<string, number>;
  completedDayKeys: string[];
  notes: Record<string, string>;
  followUps: Record<string, boolean>;
  clockedInAt: number | null;
  accumulatedSeconds: number;
  liveSession: LiveSession | null;
  attendanceByDay: Record<string, AttendanceDay>;
  sampleRubricScores: Record<string, number[]>;
};

const V2_PRIMARY_MODULES: Array<[DemoModule, string]> = [
  ['planner', 'Today'],
  ['attendance', 'Attendance'],
  ['grading', 'Grading Tower'],
  ['classroom', 'Live Classroom'],
  ['resources', 'Resources'],
];

const V2_MORE_MODULES: Array<[DemoModule, string]> = [
  ['agenda', 'Paired Agenda'],
  ['timeclock', 'Time Clock'],
  ['reports', 'Reports'],
  ['school', 'School Dashboard'],
];

const V2_MOBILE_MODULES: Array<[DemoModule, string]> = V2_PRIMARY_MODULES.slice(0, 3);

const MODULES: Array<[DemoModule, string, string]> = [
  ['planner', 'Planner', 'Teaching'],
  ['agenda', 'Agenda Workspace', 'Teaching'],
  ['resources', 'Content & Resources', 'Teaching'],
  ['classroom', 'Live Classroom', 'Teaching'],
  ['attendance', 'Student Attendance', 'Classroom Tools'],
  ['timeclock', 'Employee Time Clock', 'Classroom Tools'],
  ['reports', 'Reporting & Analytics', 'Reports'],
  ['school', 'School Dashboard', 'Admin'],
];

function keyFor(courseCode: string, dayNumber: number) {
  return `${courseCode}::${dayNumber}`;
}

function formatDuration(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}m`;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function isDemoModule(value: unknown): value is DemoModule {
  return MODULES.some(([id]) => id === value) || value === 'grading';
}

function makeAttendance(program: DemoProgram): AttendanceDay {
  return {
    finalized: false,
    students: program.students.map((name, index) => ({
      id: index + 1,
      name,
      initial: 'Present',
      final: 'Not recorded',
      flag: 'None',
      note: '',
    })),
  };
}

function mapRows(day: DemoCourseDay): PlannerPlanRow[] {
  return day.rows.map((row) => ({
    id: row.id,
    time: row.time,
    instructor: row.instructor,
    students: row.students,
    kind: row.kind,
  }));
}

function mapResources(day: DemoCourseDay): PlannerLaunchResource[] {
  return day.resources.map((resource) => ({
    id: resource.id,
    title: resource.title,
    type: resource.type,
    url: resource.url ?? null,
    notes: resource.demoActivityKey
      ? `${resource.notes ?? ''}${resource.notes ? ' · ' : ''}Available in this isolated demo through Live Classroom.`
      : resource.notes ?? null,
    required: resource.required,
  }));
}

function supportItems(day: DemoCourseDay): PlannerSupportItem[] {
  const support = day.support;
  return [
    ['before', 'Before Class', support.instructorPrep],
    ['safety', 'Safety Focus', support.safetyFocus],
    ['opening', 'Opening / Retrieval', support.openingReview],
    ['demo', 'Demonstration', support.demonstration],
    ['guided', 'Guided Practice', support.guidedPractice],
    ['independent', 'Independent / Secondary Application', support.independentPractice],
    ['checks', 'Instructor Checks', support.instructorChecks],
    ['assessment', 'Assessment / Evidence', support.assessment],
    ['materials', 'Materials / Equipment', support.materialsEquipment],
    ['paired', 'Paired-Course Coordination', support.correspondingApplication],
    ['evidence', 'Evidence / Check for Understanding', support.evidenceCheck],
    ['weekly', 'Weekly Coaching Focus', support.weeklyCoachingFocus],
    ['coaching', 'Instructor Coaching', support.coachingFocus],
    ['struggle', 'If Students Struggle', support.ifStudentsStruggle],
    ['momentum', 'Keep Momentum', support.keepMomentum],
    ['problems', 'Common Problems', support.commonProblems],
    ['tips', 'Teaching Tips', support.teachingTips],
    ['aws', 'AWS Alignment', support.awsAlignment],
    ['awski', 'AWS Key Indicators', support.awsKeyIndicators],
    ['gate', 'Safety Gate', support.safetyGate],
    ['variables', 'Procedure Variable Focus', support.procedureVariableFocus],
    ['acceptance', 'Inspection / Acceptance Focus', support.inspectionAcceptanceFocus],
    ['retry', 'Focused Retry', support.focusedRetry],
    ['record', 'Record Link Expectation', support.recordLinkExpectation],
    ['guardrail', 'Qualification Guardrail', support.qualificationGuardrail],
  ].map(([key, label, body]) => ({ key: String(key), label: String(label), body: body as string | null | undefined }));
}

export default function DemoProgramWorkspace({ program, uxLab = false }: { program: DemoProgram; uxLab?: boolean }) {
  const router = useRouter();
  const storageKey = `ltg_demo_${program.id}_full_system_v1`;
  const firstCourse = program.courses[0];
  const initialState: DemoState = {
    activeModule: 'planner',
    selectedCourseCode: firstCourse.code,
    currentDay: 1,
    startedAtByKey: {},
    completedDayKeys: [],
    notes: {},
    followUps: {},
    clockedInAt: null,
    accumulatedSeconds: 0,
    liveSession: null,
    attendanceByDay: { '1': makeAttendance(program) },
    sampleRubricScores: {},
  };

  const [state, setState] = useState<DemoState>(initialState);
  const [hydrated, setHydrated] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const isLabRoute = uxLab && program.id === 'welding' && process.env.NEXT_PUBLIC_DEPLOYMENT_ENV === 'staging';
  const [designMode, setDesignMode] = useState<'original' | 'v2'>(isLabRoute ? 'v2' : 'original');
  const [moreOpen, setMoreOpen] = useState(false);
  const [workflowNotice, setWorkflowNotice] = useState('');
  const isV2 = isLabRoute && designMode === 'v2';

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<DemoState>;
        setState((current) => ({
          ...current,
          ...parsed,
          activeModule: isDemoModule(parsed.activeModule) && (isLabRoute || parsed.activeModule !== 'grading')
            ? parsed.activeModule : 'planner',
          selectedCourseCode: program.courses.some((course) => course.code === parsed.selectedCourseCode)
            ? String(parsed.selectedCourseCode)
            : firstCourse.code,
        }));
      }
    } catch {
      sessionStorage.removeItem(storageKey);
    } finally {
      setHydrated(true);
    }
  }, [storageKey, firstCourse.code, program.courses, isLabRoute]);

  useEffect(() => {
    if (!hydrated) return;
    sessionStorage.setItem(storageKey, JSON.stringify(state));
  }, [state, hydrated, storageKey]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const selectedCourse = program.courses.find((course) => course.code === state.selectedCourseCode) ?? firstCourse;
  const selectedDay = selectedCourse.days.find((day) => day.dayNumber === state.currentDay) ?? selectedCourse.days[0];
  const selectedKey = keyFor(selectedCourse.code, selectedDay.dayNumber);
  const startedAt = state.startedAtByKey[selectedKey] ?? null;
  const elapsedSeconds = startedAt ? Math.max(0, Math.floor((now - startedAt) / 1000)) : 0;
  const selectedCompleted = state.completedDayKeys.includes(selectedKey);
  const maxDay = Math.max(...program.courses.flatMap((course) => course.days.map((day) => day.dayNumber)));
  const totalCourseDays = program.courses.reduce((sum, course) => sum + course.days.length, 0);
  const completedPercent = Math.round((state.completedDayKeys.length / totalCourseDays) * 100);
  const currentAttendance = state.attendanceByDay[String(state.currentDay)] ?? makeAttendance(program);

  const attendanceCounts = useMemo(() => {
    const students = currentAttendance.students;
    const present = students.filter((student) => (student.final === 'Not recorded' ? student.initial : student.final) === 'Present').length;
    const late = students.filter((student) => (student.final === 'Not recorded' ? student.initial : student.final) === 'Late').length;
    const absent = students.filter((student) => (student.final === 'Not recorded' ? student.initial : student.final) === 'Absent').length;
    const rate = students.length ? Math.round(((present + late) / students.length) * 100) : 0;
    return { present, late, absent, rate };
  }, [currentAttendance]);

  const clockSeconds = state.accumulatedSeconds + (state.clockedInAt ? Math.max(0, Math.floor((now - state.clockedInAt) / 1000)) : 0);

  const gradedCount = scoredSampleCount(state.sampleRubricScores ?? {}, program.students);

  const switchDemoModule = (next: DemoModule) => {
    update({ activeModule: next });
    setMoreOpen(false);
    setWorkflowNotice('');
  };

  const switchDesign = (next: 'original' | 'v2') => {
    if (!isLabRoute) return;
    setDesignMode(next);
    setMoreOpen(false);
    setWorkflowNotice('');
    // The sample Grade Tower only exists in the experimental instructor view.
    if (next === 'original' && state.activeModule === 'grading') update({ activeModule: 'planner' });
  };

  const groupedModules = useMemo(() => {
    const groups = new Map<string, Array<[DemoModule, string]>>();
    MODULES.forEach(([id, label, group]) => {
      const items = groups.get(group) ?? [];
      items.push([id, label]);
      groups.set(group, items);
    });
    return Array.from(groups.entries());
  }, []);

  const update = (patch: Partial<DemoState>) => setState((current) => ({ ...current, ...patch }));

  const ensureAttendanceDay = (dayNumber: number) => {
    setState((current) => {
      const dayKey = String(dayNumber);
      if (current.attendanceByDay[dayKey]) return current;
      return {
        ...current,
        attendanceByDay: { ...current.attendanceByDay, [dayKey]: makeAttendance(program) },
      };
    });
  };

  const goToDay = (dayNumber: number) => {
    const safeDay = Math.min(maxDay, Math.max(1, dayNumber));
    ensureAttendanceDay(safeDay);
    update({ currentDay: safeDay });
  };

  const resetDemo = () => {
    sessionStorage.removeItem(storageKey);
    setState(initialState);
    setMoreOpen(false);
    setWorkflowNotice('');
  };

  const startCourseDay = () => {
    if (startedAt || selectedCompleted) return;
    setState((current) => ({
      ...current,
      startedAtByKey: { ...current.startedAtByKey, [selectedKey]: Date.now() },
    }));
  };

  const completeCourseDayV2 = () => {
    if (!startedAt || selectedCompleted) return;
    if (!currentAttendance.finalized) {
      setWorkflowNotice('Attendance must be finalized before completing the demo day. Use Carry Initial → Final, then Finalize Pair Attendance.');
      update({ activeModule: 'attendance' });
      return;
    }
    setWorkflowNotice('');
    completeCourseDay();
  };

  const gradeSample = (student: string, criterionIndex: number, points: number) => {
    if (criterionIndex < 0 || criterionIndex >= 5 || ![0, 10, 15, 19].includes(points)) return;
    if (!program.students.includes(student)) return;
    setState((current) => {
      const rubric = current.sampleRubricScores ?? {};
      const scores = [...(rubric[student] ?? [])];
      scores[criterionIndex] = points;
      return { ...current, sampleRubricScores: { ...rubric, [student]: scores } };
    });
  };

  const completeCourseDay = () => {
    if (!startedAt) return;
    setState((current) => {
      const startedAtByKey = { ...current.startedAtByKey };
      delete startedAtByKey[selectedKey];
      const completedDayKeys = current.completedDayKeys.includes(selectedKey)
        ? current.completedDayKeys
        : [...current.completedDayKeys, selectedKey];
      const courseIndex = program.courses.findIndex((course) => course.code === selectedCourse.code);
      const isLastCourse = courseIndex === program.courses.length - 1;
      const nextCourseCode = isLastCourse ? firstCourse.code : program.courses[courseIndex + 1].code;
      const nextDay = isLastCourse && current.currentDay < maxDay ? current.currentDay + 1 : current.currentDay;
      const attendanceByDay = current.attendanceByDay[String(nextDay)]
        ? current.attendanceByDay
        : { ...current.attendanceByDay, [String(nextDay)]: makeAttendance(program) };
      return {
        ...current,
        startedAtByKey,
        completedDayKeys,
        selectedCourseCode: nextCourseCode,
        currentDay: nextDay,
        attendanceByDay,
      };
    });
  };

  const launchActivity = (resource: DemoResource, courseCode = selectedCourse.code, dayNumber = selectedDay.dayNumber) => {
    if (!resource.demoActivityKey) return;
    const joinCode = `DEMO-${courseCode.replace(/\D/g, '')}-${dayNumber}`;
    update({
      activeModule: 'classroom',
      liveSession: {
        activityKey: resource.demoActivityKey,
        title: resource.title,
        courseCode,
        dayNumber,
        startedAt: Date.now(),
        joinCode,
      },
    });
  };

  const punchClock = () => {
    setState((current) => {
      if (current.clockedInAt) {
        return {
          ...current,
          accumulatedSeconds:
            current.accumulatedSeconds + Math.max(0, Math.floor((Date.now() - current.clockedInAt) / 1000)),
          clockedInAt: null,
        };
      }
      return { ...current, clockedInAt: Date.now() };
    });
  };

  const updateAttendanceStudent = (studentId: number, patch: Partial<AttendanceStudent>) => {
    setState((current) => {
      const dayKey = String(current.currentDay);
      const day = current.attendanceByDay[dayKey] ?? makeAttendance(program);
      return {
        ...current,
        attendanceByDay: {
          ...current.attendanceByDay,
          [dayKey]: {
            ...day,
            finalized: false,
            students: day.students.map((student) => (student.id === studentId ? { ...student, ...patch } : student)),
          },
        },
      };
    });
  };

  const markAllPresent = () => {
    setState((current) => {
      const dayKey = String(current.currentDay);
      const day = current.attendanceByDay[dayKey] ?? makeAttendance(program);
      return {
        ...current,
        attendanceByDay: {
          ...current.attendanceByDay,
          [dayKey]: {
            ...day,
            finalized: false,
            students: day.students.map((student) => ({ ...student, initial: 'Present' as const })),
          },
        },
      };
    });
  };

  const carryInitialToFinal = () => {
    setState((current) => {
      const dayKey = String(current.currentDay);
      const day = current.attendanceByDay[dayKey] ?? makeAttendance(program);
      return {
        ...current,
        attendanceByDay: {
          ...current.attendanceByDay,
          [dayKey]: {
            ...day,
            finalized: false,
            students: day.students.map((student) => ({ ...student, final: student.initial })),
          },
        },
      };
    });
  };

  const finalizeAttendance = () => {
    setState((current) => {
      const dayKey = String(current.currentDay);
      const day = current.attendanceByDay[dayKey] ?? makeAttendance(program);
      return {
        ...current,
        attendanceByDay: {
          ...current.attendanceByDay,
          [dayKey]: { ...day, finalized: true },
        },
      };
    });
  };

  const dayOptions = selectedCourse.days.map((day) => ({
    id: keyFor(selectedCourse.code, day.dayNumber),
    dayNumber: day.dayNumber,
    title: day.title,
  }));

  const demoActivitiesForDay = program.courses.flatMap((course) =>
    (course.days.find((day) => day.dayNumber === state.currentDay)?.resources ?? [])
      .filter((resource) => resource.demoActivityKey)
      .map((resource) => ({ course, resource }))
  );

  if (!hydrated) {
    return <div className="demo-loading">Launching isolated LTG demo workspace…</div>;
  }

  return (
    <div className={isV2 ? 'demo-app v2-mode' : 'demo-app'}>
      {isV2 ? (
        <aside className="sidebar v2-sidebar">
          <div className="brand-block">
            <div className="brand-mark">LTG</div>
            <div><strong>Teaching View v2</strong><span>FABTECH UX Lab</span></div>
          </div>
          <div className="demo-chip">STAGING TEST · NOT LIVE</div>
          <div className="v2-sidebar-clock" role="group" aria-label="Instructor Punch Clock">
            <div className="v2-sidebar-clock-top">
              <small>Instructor punch clock</small>
              <span className={state.clockedInAt ? 'v2-clock-badge punched-in' : 'v2-clock-badge'}>
                {state.clockedInAt ? 'IN' : 'OUT'}
              </span>
            </div>
            <div className="v2-sidebar-clock-row">
              <span>Today: <strong>{formatDuration(clockSeconds)}</strong></span>
              <button type="button" className={state.clockedInAt ? 'v2-punch-button punched-in' : 'v2-punch-button'}
                onClick={punchClock}>{state.clockedInAt ? 'Punch Out' : 'Punch In'}</button>
            </div>
          </div>
          <nav aria-label="Teaching View v2 main navigation">
            <div className="nav-label">Instructor Essentials</div>
            {V2_PRIMARY_MODULES.map(([id, label]) => (
              <button
                type="button"
                key={id}
                className={state.activeModule === id ? 'v2-link active' : 'v2-link'}
                aria-current={state.activeModule === id ? 'page' : undefined}
                onClick={() => switchDemoModule(id)}
              >
                {label}
                {id === 'attendance' && !currentAttendance.finalized && <small>Needs final</small>}
              </button>
            ))}
            <button className="v2-link" type="button" onClick={() => setMoreOpen((open) => !open)} aria-expanded={moreOpen}>More tools {moreOpen ? '▴' : '▾'}</button>
            {moreOpen && (
              <div className="v2-more-nav">
                {V2_MORE_MODULES.map(([id, label]) => (
                  <button key={id} type="button" className={state.activeModule === id ? 'v2-link active' : 'v2-link'} onClick={() => switchDemoModule(id)}>{label}</button>
                ))}
              </div>
            )}
          </nav>
          <div className="sidebar-footer">
            <button onClick={() => switchDesign('original')}>Compare Original Demo</button>
            <button onClick={resetDemo}>Reset Temporary Demo</button>
            <button onClick={() => router.push('/demo/programs')}>Change Program</button>
          </div>
        </aside>
      ) : (
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-mark">LTG</div>
          <div><strong>Education</strong><span>Operating System</span></div>
        </div>
        <div className="demo-chip">PUBLIC DEMO · TEMPORARY DATA</div>
        <div className="school-context">
          <small>{program.schoolName}</small>
          <strong>{program.sectionLabel}</strong>
          <span>{program.instructorName} · Instructor View</span>
        </div>

        <div className="course-switcher">
          <div className="nav-label">Course pair</div>
          {program.courses.map((course) => (
            <button
              key={course.code}
              className={state.selectedCourseCode === course.code ? 'course-button selected' : 'course-button'}
              onClick={() => update({ selectedCourseCode: course.code })}
            >
              <strong>{course.code}</strong>
              <span>{course.roleLabel}</span>
            </button>
          ))}
        </div>

        <nav aria-label="Demo workspace navigation">
          {groupedModules.map(([group, items]) => (
            <div className="nav-group" key={group}>
              <div className="nav-label">{group}</div>
              {items.map(([id, label]) => (
                <button
                  key={id}
                  className={state.activeModule === id ? 'nav-link active' : 'nav-link'}
                  onClick={() => update({ activeModule: id })}
                >
                  {label}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button onClick={resetDemo}>Reset Demo</button>
          <button onClick={() => router.push('/demo/programs')}>Change Program</button>
          <button onClick={() => router.push('/demo')}>Demo Home</button>
        </div>
      </aside>
      )}

      <main className="workspace">
        {isLabRoute && (
          <section className="v2-experiment-bar" aria-label="FABTECH teaching layout comparison">
            <div>
              <strong>FABTECH · Teaching Workflow Experiment</strong>
              <span>Same 5-day WLD 105/110 demo content and temporary browser records in both views</span>
            </div>
            <div className="v2-mode-switch" role="group" aria-label="Choose interface layout">
              <button type="button" aria-pressed={!isV2} onClick={() => switchDesign('original')} className={!isV2 ? 'selected' : ''}>Original FABTECH</button>
              <button type="button" aria-pressed={isV2} onClick={() => switchDesign('v2')} className={isV2 ? 'selected' : ''}>Teaching View v2</button>
            </div>
          </section>
        )}
        <div className="banner">
          <span>{isV2 ? 'FABTECH UX TEST · TEMPORARY DATA ONLY' : 'PUBLIC DEMO · CLOSED SYSTEM · NO LIVE SCHOOL RECORDS'}</span>
          <span>{isV2 ? 'Demo resets after 30 minutes of inactivity' : 'Demo activity is forgotten after 30 minutes of inactivity'}</span>
        </div>

        {isV2 ? (
          <header className="v2-workspace-header">
            <div className="v2-active-course">
              <label htmlFor="fabtech-v2-class">Current Class</label>
              <select
                id="fabtech-v2-class"
                value={selectedCourse.code}
                onChange={(event) => update({ selectedCourseCode: event.target.value })}
              >
                {program.courses.map((course) => (
                  <option key={course.code} value={course.code}>{course.code} · {course.name}</option>
                ))}
              </select>
              <span>{program.instructorName} · Day {state.currentDay}/{maxDay}</span>
            </div>
            <div className="v2-header-pills">
              <button onClick={() => switchDemoModule('attendance')}>{currentAttendance.finalized ? '✓ Attendance done' : 'Attendance open'}</button>
              <button type="button" className="v2-mobile-punch" onClick={punchClock}
                aria-label={state.clockedInAt ? 'Instructor Punch Out' : 'Instructor Punch In'}>
                {state.clockedInAt ? 'Punch Out' : 'Punch In'} · {formatDuration(clockSeconds)}
              </button>
            </div>
          </header>
        ) : (
        <header className="workspace-header">
          <div>
            <div className="eyebrow">{program.name}</div>
            <h1>{MODULES.find(([id]) => id === state.activeModule)?.[1] ?? 'Planner'}</h1>
          </div>
          <div className="header-status">
            <span>{selectedCourse.code}</span>
            <strong>Day {state.currentDay} of {maxDay}</strong>
            <b>{startedAt ? 'IN PROGRESS' : selectedCompleted ? 'COMPLETED' : 'READY'}</b>
          </div>
        </header>
        )}

        {!isV2 && <section className="context-strip">
          <div><span>School</span><strong>{program.schoolName}</strong></div>
          <div><span>Course</span><strong>{selectedCourse.code}</strong></div>
          <div><span>Instructor</span><strong>{program.instructorName}</strong></div>
          <div><span>Pair Day</span><strong>{state.currentDay} / {maxDay}</strong></div>
          <div><span>Attendance</span><strong>{attendanceCounts.rate}%</strong></div>
          <div><span>Clock</span><strong>{state.clockedInAt ? 'CLOCKED IN' : 'CLOCKED OUT'}</strong></div>
        </section>}

        {isV2 && workflowNotice && (
          <div className="v2-workflow-notice" role="alert">
            <span>{workflowNotice}</span>
            <button type="button" onClick={() => setWorkflowNotice('')}>Dismiss</button>
          </div>
        )}

        {state.activeModule === 'planner' && (isV2 ? (
          <div className="v2-planner-wrap">
            <FabtechTeachingDayV2
              courseCode={selectedCourse.code}
              day={selectedDay}
              dayCount={maxDay}
              started={Boolean(startedAt)}
              completed={selectedCompleted}
              elapsed={formatDuration(elapsedSeconds)}
              attendanceFinalized={currentAttendance.finalized}
              note={state.notes[selectedKey] ?? ''}
              followUp={Boolean(state.followUps[selectedKey])}
              gradedCount={gradedCount}
              onDay={goToDay}
              onStart={startCourseDay}
              onComplete={completeCourseDayV2}
              onAttendance={() => switchDemoModule('attendance')}
              onGrade={() => switchDemoModule('grading')}
              onClassroom={() => switchDemoModule('classroom')}
              onResources={() => switchDemoModule('resources')}
              onLaunch={(resource) => launchActivity(resource)}
              onNote={(value) => setState((current) => ({ ...current, notes: { ...current.notes, [selectedKey]: value } }))}
              onFollowUp={(value) => setState((current) => ({ ...current, followUps: { ...current.followUps, [selectedKey]: value } }))}
            />
          </div>
        ) : (
          <div className="planner-wrap">
            <PlannerTeachingConsole
              courseLabel={`${selectedCourse.code} · ${selectedCourse.name}`}
              sectionLabel={program.sectionLabel}
              dayNumber={selectedDay.dayNumber}
              totalDays={maxDay}
              title={selectedDay.title}
              objective={selectedDay.objective}
              formatLabel={selectedDay.formatLabel}
              protectedOutcomes={selectedDay.outcomes}
              rows={mapRows(selectedDay)}
              resources={mapResources(selectedDay)}
              supportItems={supportItems(selectedDay)}
              dayOptions={dayOptions}
              selectedGuideDayId={selectedKey}
              isCurrentDay={true}
              onPrevious={() => goToDay(state.currentDay - 1)}
              onNext={() => goToDay(state.currentDay + 1)}
              onSelectDay={goToDay}
              studentDisplayUrl={`/demo/${program.id}/student-display?course=${encodeURIComponent(selectedCourse.code)}&day=${selectedDay.dayNumber}`}
              actionPanel={(
                <div className="planner-action-panel">
                  <div className="action-status">
                    <span>Temporary instructor day record</span>
                    <strong>{startedAt ? formatDuration(elapsedSeconds) : selectedCompleted ? 'Completed' : 'Ready to start'}</strong>
                  </div>
                  <div className="action-buttons">
                    <button className="accent" onClick={startCourseDay} disabled={Boolean(startedAt) || selectedCompleted}>Start Today</button>
                    <button onClick={completeCourseDay} disabled={!startedAt}>Complete {selectedCourse.code}</button>
                    {selectedDay.resources.some((resource) => resource.demoActivityKey) && (
                      <button onClick={() => {
                        const resource = selectedDay.resources.find((item) => item.demoActivityKey);
                        if (resource) launchActivity(resource);
                      }}>Launch Connected Activity</button>
                    )}
                  </div>
                  <div className="note-grid">
                    <label>
                      Daily Comments / Deviation Summary
                      <textarea
                        value={state.notes[selectedKey] ?? ''}
                        onChange={(event) => setState((current) => ({ ...current, notes: { ...current.notes, [selectedKey]: event.target.value } }))}
                        placeholder="Record pacing, implementation differences, or instructor observations."
                      />
                    </label>
                    <label className="follow-up-row">
                      <input
                        type="checkbox"
                        checked={Boolean(state.followUps[selectedKey])}
                        onChange={(event) => setState((current) => ({ ...current, followUps: { ...current.followUps, [selectedKey]: event.target.checked } }))}
                      />
                      Follow-up needed
                    </label>
                  </div>
                </div>
              )}
            />
          </div>
        ))}

        {isV2 && state.activeModule === 'grading' && (
          <div className="v2-planner-wrap">
            <FabtechGradingPracticeV2
              students={program.students}
              scoresByStudent={state.sampleRubricScores ?? {}}
              onScore={gradeSample}
              onToday={() => switchDemoModule('planner')}
            />
          </div>
        )}

        {state.activeModule === 'agenda' && (
          <section className="panel wide-panel">
            <div className="panel-heading">
              <div><div className="eyebrow">Paired Daily Agenda</div><h2>Day {state.currentDay} · WLD 105 + WLD 110</h2></div>
              <div className="day-controls"><button onClick={() => goToDay(state.currentDay - 1)} disabled={state.currentDay <= 1}>‹ Day</button><button onClick={() => goToDay(state.currentDay + 1)} disabled={state.currentDay >= maxDay}>Day ›</button></div>
            </div>
            <div className="paired-agenda">
              {program.courses.map((course) => {
                const day = course.days.find((item) => item.dayNumber === state.currentDay);
                if (!day) return null;
                return (
                  <article className="course-agenda" key={course.code}>
                    <div className="course-heading"><span>{course.code}</span><strong>{day.title}</strong><small>{day.formatLabel}</small></div>
                    <p className="agenda-objective">{day.objective}</p>
                    <div className="agenda-rows">
                      {day.rows.map((row) => <div key={row.id}><span>{row.time}</span><p>{row.instructor}</p></div>)}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {state.activeModule === 'resources' && (
          <section className="panel wide-panel">
            <div className="panel-heading"><div><div className="eyebrow">Content & Resources</div><h2>Day {state.currentDay} course-connected resources</h2></div></div>
            <div className="resource-grid">
              {program.courses.flatMap((course) => {
                const day = course.days.find((item) => item.dayNumber === state.currentDay);
                return (day?.resources ?? []).map((resource) => (
                  <article className="resource-card" key={`${course.code}-${resource.id}`}>
                    <span>{course.code} · {resource.type}</span>
                    <h3>{resource.title}</h3>
                    <p>{resource.notes || 'Program-connected resource.'}</p>
                    {resource.url ? (
                      <a href={resource.url} target="_blank" rel="noreferrer">Open Resource</a>
                    ) : resource.demoActivityKey ? (
                      <button onClick={() => launchActivity(resource, course.code, state.currentDay)}>Launch in Demo</button>
                    ) : (
                      <b>Included / referenced by the active guide</b>
                    )}
                  </article>
                ));
              })}
              {program.courses.every((course) => (course.days.find((day) => day.dayNumber === state.currentDay)?.resources.length ?? 0) === 0) && (
                <div className="empty-state">No standalone launch resources are attached to this day. The full instructor plan remains available in Planner.</div>
              )}
            </div>
          </section>
        )}

        {state.activeModule === 'classroom' && (
          <section className="panel wide-panel">
            <div className="panel-heading">
              <div><div className="eyebrow">Live Classroom</div><h2>Day {state.currentDay} connected activities</h2></div>
              <span className={state.liveSession ? 'live-pill active' : 'live-pill'}>{state.liveSession ? 'LIVE' : 'READY'}</span>
            </div>
            {!state.liveSession ? (
              <div className="classroom-launch-grid">
                {demoActivitiesForDay.length > 0 ? demoActivitiesForDay.map(({ course, resource }) => (
                  <article className="launch-card" key={`${course.code}-${resource.id}`}>
                    <span>{course.code}</span>
                    <h3>{resource.title}</h3>
                    <p>{resource.notes}</p>
                    <button className="accent" onClick={() => launchActivity(resource, course.code, state.currentDay)}>Launch Temporary Session</button>
                  </article>
                )) : (
                  <div className="empty-state">There is no connected Live Classroom assessment scheduled in the active WLD 105/WLD 110 guide for this day.</div>
                )}
              </div>
            ) : (
              <>
                <div className="classroom-session-head">
                  <div><span>{state.liveSession.courseCode} · Day {state.liveSession.dayNumber}</span><h3>{state.liveSession.title}</h3></div>
                  <div className="join-code"><span>Student join code</span><strong>{state.liveSession.joinCode}</strong></div>
                </div>
                <div className="live-grid">
                  <article><span>CONNECTED</span><strong>{program.students.length}</strong><small>students</small></article>
                  <article><span>RESPONDED</span><strong>{Math.max(1, program.students.length - 1)}</strong><small>students</small></article>
                  <article><span>NEEDS REVIEW</span><strong>1</strong><small>response</small></article>
                  <article><span>COMPLETE</span><strong>{Math.round(((program.students.length - 1) / program.students.length) * 100)}%</strong><small>activity</small></article>
                </div>
                <div className="session-actions"><button onClick={() => update({ liveSession: null })}>End Demo Session</button></div>
              </>
            )}
          </section>
        )}

        {state.activeModule === 'attendance' && (
          <section className="panel wide-panel">
            <div className="panel-heading">
              <div><div className="eyebrow">Student Attendance</div><h2>Day {state.currentDay} · WLD 105 / 110 pair</h2><p>Initial attendance and end-of-pair confirmation are tracked separately.</p></div>
              <div className="attendance-actions"><button onClick={markAllPresent}>Mark All Present</button><button onClick={carryInitialToFinal}>Carry Initial → Final</button><button className="accent" onClick={() => {
                  finalizeAttendance();
                  if (isV2) {
                    setWorkflowNotice('Pair attendance finalized. Return to Today when ready to complete the day.');
                  }
                }}>Finalize Pair Attendance</button></div>
            </div>
            <div className="attendance-summary">
              <Metric label="Present" value={String(attendanceCounts.present)} />
              <Metric label="Late" value={String(attendanceCounts.late)} />
              <Metric label="Absent" value={String(attendanceCounts.absent)} />
              <Metric label="Attendance Rate" value={`${attendanceCounts.rate}%`} />
              <Metric label="Pair Status" value={currentAttendance.finalized ? 'Finalized' : 'Open'} />
            </div>
            <div className="student-table">
              <div className="student-head"><span>Student</span><span>Initial</span><span>Final</span><span>Flag</span><span>Instructor Note</span></div>
              {currentAttendance.students.map((student) => (
                <div className="student-row" key={student.id}>
                  <strong>{student.name}</strong>
                  <select value={student.initial} onChange={(event) => updateAttendanceStudent(student.id, { initial: event.target.value as AttendanceStatus })}>
                    {(['Present','Late','Absent','Not recorded'] as AttendanceStatus[]).map((status) => <option key={status}>{status}</option>)}
                  </select>
                  <select value={student.final} onChange={(event) => updateAttendanceStudent(student.id, { final: event.target.value as AttendanceStatus })}>
                    {(['Present','Late','Absent','Not recorded'] as AttendanceStatus[]).map((status) => <option key={status}>{status}</option>)}
                  </select>
                  <select value={student.flag} onChange={(event) => updateAttendanceStudent(student.id, { flag: event.target.value as AttendanceFlag })}>
                    {(['None','Unprepared','Left early','Other'] as AttendanceFlag[]).map((flag) => <option key={flag}>{flag}</option>)}
                  </select>
                  <input value={student.note} onChange={(event) => updateAttendanceStudent(student.id, { note: event.target.value })} placeholder="Optional note" />
                </div>
              ))}
            </div>
          </section>
        )}

        {state.activeModule === 'timeclock' && (
          <section className="panel wide-panel clock-panel">
            <div><div className="eyebrow">Employee Time Clock</div><h2>{program.instructorName}</h2><p>This behaves as a temporary instructor punch record. It is not written to payroll or the live school database.</p></div>
            <div className="clock-card">
              <span>{state.clockedInAt ? 'CURRENTLY CLOCKED IN' : 'CURRENTLY CLOCKED OUT'}</span>
              <strong>{formatDuration(clockSeconds)}</strong>
              <button className="accent" onClick={punchClock}>{state.clockedInAt ? 'Clock Out' : 'Clock In'}</button>
            </div>
          </section>
        )}

        {state.activeModule === 'reports' && (
          <section className="panel wide-panel">
            <div className="panel-heading"><div><div className="eyebrow">Reporting & Analytics</div><h2>Five-day demo operational record</h2></div></div>
            <div className="metric-grid">
              <Metric label="Course-Day Completion" value={`${completedPercent}%`} />
              <Metric label="Current Attendance" value={`${attendanceCounts.rate}%`} />
              <Metric label="Completed Course Days" value={`${state.completedDayKeys.length} / ${totalCourseDays}`} />
              <Metric label="Instructor Time" value={formatDuration(clockSeconds)} />
              <Metric label="Live Classroom" value={state.liveSession ? 'Active' : 'Idle'} />
              <Metric label="Open Follow-Ups" value={String(Object.values(state.followUps).filter(Boolean).length)} />
            </div>
            <div className="report-table">
              <div className="report-head"><span>Day</span><span>WLD 105</span><span>WLD 110</span><span>Attendance</span><span>Pair Attendance</span></div>
              {Array.from({ length: maxDay }, (_, index) => index + 1).map((dayNumber) => {
                const attendance = state.attendanceByDay[String(dayNumber)];
                const courseA = program.courses[0];
                const courseB = program.courses[1];
                return (
                  <div className="report-row" key={dayNumber}>
                    <strong>Day {dayNumber}</strong>
                    <span>{state.completedDayKeys.includes(keyFor(courseA.code, dayNumber)) ? 'Completed' : 'Open'}</span>
                    <span>{courseB && state.completedDayKeys.includes(keyFor(courseB.code, dayNumber)) ? 'Completed' : 'Open'}</span>
                    <span>{attendance ? `${Math.round((attendance.students.filter((student) => (student.final === 'Not recorded' ? student.initial : student.final) !== 'Absent').length / attendance.students.length) * 100)}%` : '—'}</span>
                    <span>{attendance?.finalized ? 'Finalized' : 'Open'}</span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {state.activeModule === 'school' && (
          <section className="panel wide-panel">
            <div className="panel-heading"><div><div className="eyebrow">School Dashboard</div><h2>{program.schoolName}</h2></div></div>
            <div className="metric-grid">
              <Metric label="Active Sections" value="1" />
              <Metric label="Students" value={String(program.students.length)} />
              <Metric label="Courses in Pair" value={String(program.courses.length)} />
              <Metric label="Current Attendance" value={`${attendanceCounts.rate}%`} />
              <Metric label="Instruction Progress" value={`${completedPercent}%`} />
              <Metric label="Open Follow-Ups" value={String(Object.values(state.followUps).filter(Boolean).length)} />
            </div>
            <div className="school-note">
              <strong>Closed demo environment</strong>
              <p>Curriculum is a read-only snapshot of the active WLD 105/WLD 110 five-day sequence. Every note, punch, attendance change, completion record, and Live Classroom session on this page exists only in the temporary demo session.</p>
            </div>
          </section>
        )}
      </main>

      {isV2 && (
        <>
          <nav className="v2-mobile-nav" aria-label="Mobile instructor navigation">
            {V2_MOBILE_MODULES.map(([id, label]) => (
              <button type="button" key={id}
                aria-current={state.activeModule === id ? 'page' : undefined}
                className={state.activeModule === id ? 'active' : ''}
                onClick={() => switchDemoModule(id)}>{label === 'Grading Tower' ? 'Grading' : label}</button>
            ))}
            <button type="button" className={moreOpen ? 'active' : ''}
              aria-expanded={moreOpen} onClick={() => setMoreOpen((open) => !open)}>More</button>
          </nav>
          {moreOpen && (
            <div className="v2-mobile-more" role="region" aria-label="More instructor tools">
              {[...V2_PRIMARY_MODULES.slice(3), ...V2_MORE_MODULES].map(([id, label]) => (
                <button type="button" key={id} onClick={() => switchDemoModule(id)}>{label}</button>
              ))}
              <button type="button" onClick={() => switchDesign('original')}>Original FABTECH view</button>
              <button type="button" onClick={resetDemo}>Reset Demo</button>
            </div>
          )}
        </>
      )}

      <style jsx>{`
        :global(body.ltg-demo-route) { margin:0; background:#090d10; color:#d8e2e6; }
        :global(body.ltg-demo-route .app-container), :global(body.ltg-demo-route .ltg-public-content) { width:100%; max-width:none; margin:0; padding:0; display:block; }
        * { box-sizing:border-box; }
        .demo-loading { min-height:100vh; display:grid; place-items:center; background:#0b0f12; color:#64d9ff; font-weight:850; }
        .demo-app { min-height:100vh; display:grid; grid-template-columns:270px minmax(0,1fr); background:#090d10; color:#d8e2e6; }
        .sidebar { position:sticky; top:0; height:100vh; overflow:auto; padding:18px 14px; border-right:1px solid #202a30; background:#10161a; }
        .brand-block { display:flex; align-items:center; gap:10px; padding:4px 6px 16px; border-bottom:1px solid #242f35; }
        .brand-mark { width:44px; height:44px; display:grid; place-items:center; border-radius:9px; background:#f36a2f; color:#fff; font-weight:950; }
        .brand-block>div:last-child { display:grid; gap:1px; }.brand-block strong { color:#fff; font-size:13px; }.brand-block span { color:#82939b; font-size:10px; }
        .demo-chip { margin:14px 6px 0; padding:7px 9px; border:1px solid #176d8b; border-radius:7px; background:#0d3342; color:#7ce2ff; text-align:center; font-size:9px; font-weight:950; letter-spacing:.1em; }
        .school-context { display:grid; gap:4px; margin:14px 6px 18px; padding:12px; border:1px solid #28343a; border-radius:8px; background:#151c20; }
        .school-context small { color:#5fd9ff; font-size:8px; font-weight:900; letter-spacing:.08em; text-transform:uppercase; }.school-context strong { color:#fff; font-size:12px; }.school-context span { color:#81929a; font-size:9px; }
        .course-switcher { margin-bottom:18px; }.course-button { width:100%; display:grid; gap:3px; margin-bottom:7px; padding:10px 11px; border:1px solid #2a353b; border-radius:7px; background:#141b1f; color:#9bacb3; text-align:left; cursor:pointer; }.course-button strong { font-size:12px; }.course-button span { font-size:8px; }.course-button.selected { border-color:#4fcfff; background:#102a35; color:#fff; box-shadow:0 0 0 1px rgba(79,207,255,.13) inset; }
        .nav-group { margin:14px 0; }.nav-label { padding:0 10px 6px; color:#64757d; font-size:8px; font-weight:900; letter-spacing:.12em; text-transform:uppercase; }
        .nav-link { width:100%; border:0; border-left:3px solid transparent; border-radius:6px; background:transparent; color:#aebbc1; padding:10px 11px; text-align:left; font-size:12px; font-weight:750; cursor:pointer; }.nav-link:hover { background:#172126; color:#fff; }.nav-link.active { border-left-color:#5ed8ff; background:#17262d; color:#fff; }
        .sidebar-footer { display:grid; gap:7px; margin-top:20px; padding-top:14px; border-top:1px solid #263138; }.sidebar-footer button { border:1px solid #2c383e; border-radius:6px; background:#151c20; color:#9cabb2; padding:9px; font-size:10px; font-weight:800; cursor:pointer; }
        .workspace { min-width:0; }.banner { display:flex; justify-content:space-between; gap:20px; padding:8px 24px; border-bottom:1px solid #0f6788; background:#0a5270; color:#dff8ff; font-size:9px; font-weight:900; letter-spacing:.08em; }
        .workspace-header { display:flex; justify-content:space-between; gap:20px; align-items:center; padding:22px 28px 18px; border-bottom:1px solid #202a2f; background:#0e1316; }.eyebrow { color:#5ddaff; font-size:9px; font-weight:950; letter-spacing:.12em; text-transform:uppercase; }h1,h2,h3,p { margin-top:0; }h1 { margin:5px 0 0; color:#fff; font-size:27px; }h2 { margin:5px 0 0; color:#fff; font-size:22px; }h3 { color:#eff6f8; }
        .header-status { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }.header-status span,.header-status strong,.header-status b { padding:7px 9px; border:1px solid #29353b; border-radius:999px; background:#141b1f; font-size:9px; }.header-status b { border-color:#26684f; color:#69e5ae; }
        .context-strip { display:grid; grid-template-columns:repeat(6,minmax(0,1fr)); gap:1px; border-bottom:1px solid #20292e; background:#20292e; }.context-strip div { min-width:0; padding:12px 16px; background:#11171a; }.context-strip span { display:block; color:#6f8088; font-size:8px; text-transform:uppercase; letter-spacing:.08em; }.context-strip strong { display:block; overflow:hidden; margin-top:3px; color:#d9e3e7; font-size:11px; text-overflow:ellipsis; white-space:nowrap; }
        .planner-wrap { padding:20px; }.panel { margin:20px; border:1px solid #28343a; border-radius:11px; background:#11171b; box-shadow:0 14px 34px rgba(0,0,0,.16); }.wide-panel { padding:22px; }.panel-heading { display:flex; justify-content:space-between; gap:18px; align-items:flex-start; margin-bottom:18px; }.panel-heading p { margin:6px 0 0; color:#83949b; font-size:11px; }.day-controls,.attendance-actions,.action-buttons,.session-actions { display:flex; flex-wrap:wrap; gap:8px; }
        button,.resource-card a { border:1px solid #334149; border-radius:7px; background:#182126; color:#c8d5da; padding:9px 11px; font-weight:800; cursor:pointer; text-decoration:none; }button:hover,.resource-card a:hover { border-color:#54d2ff; color:#fff; }button:disabled { opacity:.4; cursor:not-allowed; }.accent { border-color:#2aa4ce; background:#0d6686; color:#fff; }
        .planner-action-panel { display:grid; gap:14px; padding:18px; border:1px solid #2b383f; border-radius:10px; background:#10171b; }.action-status { display:flex; justify-content:space-between; gap:20px; align-items:center; }.action-status span { color:#81939a; font-size:10px; text-transform:uppercase; letter-spacing:.08em; }.action-status strong { color:#fff; }.note-grid { display:grid; gap:9px; }.note-grid label { display:grid; gap:6px; color:#a8b7bd; font-size:10px; font-weight:800; }.note-grid textarea { min-height:90px; resize:vertical; border:1px solid #304047; border-radius:7px; background:#0b1114; color:#e3ecef; padding:10px; }.follow-up-row { display:flex!important; grid-template-columns:auto 1fr; align-items:center; }.follow-up-row input { width:auto; }
        .paired-agenda { display:grid; grid-template-columns:1fr 1fr; gap:16px; }.course-agenda { overflow:hidden; border:1px solid #29363d; border-radius:10px; background:#0e1417; }.course-heading { display:grid; gap:3px; padding:16px; border-bottom:1px solid #26333a; background:#141c20; }.course-heading span { color:#5dd9ff; font-size:9px; font-weight:950; }.course-heading strong { color:#fff; }.course-heading small { color:#7f929a; }.agenda-objective { margin:0; padding:14px 16px; color:#afbdc2; font-size:12px; line-height:1.55; }.agenda-rows { border-top:1px solid #26333a; }.agenda-rows>div { display:grid; grid-template-columns:90px 1fr; gap:12px; padding:12px 16px; border-top:1px solid #202b30; }.agenda-rows>div:first-child { border-top:0; }.agenda-rows span { color:#5fd9ff; font-size:10px; font-weight:850; }.agenda-rows p { margin:0; color:#b9c6cb; font-size:11px; line-height:1.55; }
        .resource-grid,.classroom-launch-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; }.resource-card,.launch-card { padding:16px; border:1px solid #2a373d; border-radius:9px; background:#0e1518; }.resource-card span,.launch-card>span { color:#5fd9ff; font-size:8px; font-weight:900; text-transform:uppercase; }.resource-card h3,.launch-card h3 { margin:7px 0; font-size:14px; }.resource-card p,.launch-card p { color:#86979e; font-size:10px; line-height:1.55; }.resource-card b { color:#81939a; font-size:9px; }
        .live-pill { padding:7px 10px; border:1px solid #39464c; border-radius:999px; color:#819097; font-size:9px; font-weight:900; }.live-pill.active { border-color:#28764f; color:#6ce6ae; background:#103324; }.classroom-session-head { display:flex; justify-content:space-between; gap:18px; align-items:center; padding:16px; border:1px solid #2c393f; border-radius:9px; background:#0d1417; }.classroom-session-head span,.join-code span { color:#73858c; font-size:9px; }.classroom-session-head h3 { margin:4px 0 0; }.join-code { display:grid; gap:3px; text-align:right; }.join-code strong { color:#66dfff; font-size:20px; letter-spacing:.08em; }.live-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:10px; margin:14px 0; }.live-grid article { display:grid; gap:2px; padding:16px; border:1px solid #2b383f; border-radius:8px; background:#0e1518; }.live-grid span { color:#73868e; font-size:8px; }.live-grid strong { color:#fff; font-size:25px; }.live-grid small { color:#75868d; font-size:9px; }
        .attendance-summary,.metric-grid { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:10px; margin-bottom:16px; }.metric-grid { grid-template-columns:repeat(6,minmax(0,1fr)); }.metric { padding:15px; border:1px solid #2a373d; border-radius:8px; background:#0e1518; }.metric span { display:block; color:#71838b; font-size:8px; text-transform:uppercase; }.metric strong { display:block; margin-top:5px; color:#fff; font-size:18px; }.student-table { overflow:auto; border:1px solid #2b383e; border-radius:8px; }.student-head,.student-row { min-width:860px; display:grid; grid-template-columns:1.25fr .8fr .8fr .8fr 1.7fr; gap:8px; align-items:center; padding:10px 12px; }.student-head { background:#182126; color:#7f9198; font-size:8px; font-weight:900; text-transform:uppercase; }.student-row { border-top:1px solid #253137; }.student-row strong { font-size:11px; }.student-row select,.student-row input { min-width:0; border:1px solid #304047; border-radius:6px; background:#0b1114; color:#dbe5e9; padding:8px; font-size:10px; }
        .clock-panel { display:grid; grid-template-columns:1fr 340px; gap:24px; align-items:center; }.clock-panel p { color:#84959c; line-height:1.6; }.clock-card { display:grid; gap:8px; padding:22px; border:1px solid #2c3a40; border-radius:10px; background:#0c1316; text-align:center; }.clock-card span { color:#72dfff; font-size:8px; font-weight:900; }.clock-card strong { color:#fff; font-size:34px; }
        .report-table { overflow:auto; border:1px solid #2b383e; border-radius:8px; }.report-head,.report-row { min-width:720px; display:grid; grid-template-columns:.7fr 1fr 1fr 1fr 1fr; gap:12px; padding:11px 13px; }.report-head { background:#182126; color:#788990; font-size:8px; font-weight:900; text-transform:uppercase; }.report-row { border-top:1px solid #253137; color:#aebcc1; font-size:10px; }.report-row strong { color:#fff; }.school-note,.empty-state { padding:18px; border:1px solid #2b393f; border-radius:9px; background:#0e1518; color:#83949b; }.school-note strong { color:#fff; }.school-note p { margin:6px 0 0; line-height:1.6; }.empty-state { grid-column:1/-1; }

        /* The new layout is opt-in at /demo/welding/ux-lab and never changes
           the production public FABTECH demonstration. */
        .v2-sidebar nav { display:grid; gap:5px; }
        .v2-sidebar-clock { display:grid; gap:12px; margin:12px 6px 18px; padding:13px 12px; border:1px solid #37515d; border-radius:9px; background:#14252e; }
        .v2-sidebar-clock-top { display:flex; justify-content:space-between; gap:6px; align-items:center; }
        .v2-sidebar-clock-top small { font-size:10px; font-weight:900; color:#c3d4dd; text-transform:none; letter-spacing:0; }
        .v2-clock-badge { padding:4px 6px; border:1px solid #526772; border-radius:6px; font-size:10px!important; color:#c4d3d9!important; background:#27353c; }
        .v2-clock-badge.punched-in { border-color:#51967c; color:#a9f1d5!important; background:#173d33; }
        .v2-sidebar-clock-row { display:flex; align-items:center; gap:8px; justify-content:space-between; flex-wrap:wrap; }
        .v2-sidebar-clock-row span { color:#bccbd2; font-size:11px; }
        .v2-sidebar-clock-row strong { color:#f1f7f7; font-variant-numeric:tabular-nums; }
        .v2-punch-button { border:1px solid #6899b5; border-radius:7px; background:#1d4963; color:#e6f5ff; padding:8px 11px; min-height:38px; font-size:12px; font-weight:900; cursor:pointer; }
        .v2-punch-button.punched-in { border-color:#c58d6a; background:#57382b; color:#ffdfcb; }
        .v2-punch-button:hover { filter:brightness(1.13); }

        .v2-link { display:flex; gap:8px; justify-content:space-between; align-items:center; text-align:left; min-height:42px; border:1px solid transparent; border-radius:8px; background:#111c23; color:#d9e2e6; font-size:13px; font-weight:800; padding:10px 12px; cursor:pointer; }
        .v2-link:hover { border-color:#5d7d89; background:#1a2e39; }
        .v2-link.active { border-color:#d59b72; background:#342920; color:#ffd2a8; }
        .v2-link small { padding:3px 5px; color:#f0cf9a; background:#372b18; border-radius:4px; font-size:9px; font-weight:750; }
        .v2-more-nav { padding-left:8px; display:grid; gap:4px; border-left:1px solid #496370; }
        .v2-experiment-bar { display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:13px; padding:11px 18px; background:#202e36; border-bottom:1px solid #3b535f; }
        .v2-experiment-bar > div:first-child { display:grid; gap:3px; }
        .v2-experiment-bar strong { font-size:12px; color:#f0be9c; }
        .v2-experiment-bar span { color:#becbd0; font-size:11px; line-height:1.4; }
        .v2-mode-switch { display:flex; flex-wrap:wrap; gap:7px; }
        .v2-mode-switch button { background:#1b2b34; border:1px solid #58707b; border-radius:8px; padding:10px 13px; font-size:12px; color:#dce8ec; font-weight:800; cursor:pointer; }
        .v2-mode-switch button.selected { color:#15212a; background:#efb17f; border-color:#efb17f; }
        .v2-workspace-header { display:flex; justify-content:space-between; flex-wrap:wrap; align-items:center; gap:14px; padding:14px 20px; background:#101b23; border-bottom:1px solid #314651; }
        .v2-active-course { display:grid; gap:5px; }
        .v2-active-course label { color:#a6bac4; font-size:10px; font-weight:900; text-transform:uppercase; letter-spacing:.07em; }
        .v2-active-course select { max-width:min(460px,88vw); padding:10px 12px; border:1px solid #587381; border-radius:8px; background:#1c313d; color:#f0f5f7; font-size:13px; }
        .v2-active-course span { color:#aabec7; font-size:11px; }
        .v2-header-pills { display:flex; gap:7px; flex-wrap:wrap; }
        .v2-header-pills button { border:1px solid #486a79; border-radius:99px; padding:9px 12px; background:#18303b; color:#d8ebf3; font-size:11px; font-weight:750; cursor:pointer; }
        .v2-header-pills .v2-mobile-punch { display:none; }

        .v2-planner-wrap { padding:16px 18px 40px; }
        .v2-workflow-notice { display:flex; justify-content:space-between; gap:12px; flex-wrap:wrap; align-items:center; margin:14px 18px 0; padding:12px 14px; border:1px solid #c08f59; border-radius:8px; color:#ffe3b9; background:#3a2c1e; font-size:13px; line-height:1.5; }
        .v2-workflow-notice button { border:1px solid #ba946d; color:#ffe2b3; background:transparent; padding:6px 8px; border-radius:6px; cursor:pointer; font-size:12px; }
        .v2-mobile-nav,.v2-mobile-more { display:none; }
        .demo-app.v2-mode .panel:not(.clock-panel) { box-shadow:none; }
        @media (max-width:760px) {
          .demo-app.v2-mode { display:block; padding-bottom:66px; }
          .v2-mode .v2-sidebar { display:none; }
          .v2-mode .workspace { min-width:0; width:100%; }
          .v2-workspace-header { align-items:flex-start; gap:11px; }
          .v2-header-pills { width:100%; }
          .v2-header-pills .v2-mobile-punch { display:inline-flex; align-items:center; min-height:44px; border-color:#6899b5; background:#1d4963; color:#e6f5ff; font-weight:850; }
          .v2-planner-wrap { padding:10px 8px 30px; }
          .v2-experiment-bar { padding:10px; }
          .v2-mobile-nav { position:fixed; bottom:0; left:0; right:0; z-index:100; display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:0; border-top:2px solid #53717b; background:#101d25; padding-bottom:env(safe-area-inset-bottom,0px); box-shadow:0 -8px 25px rgba(0,0,0,.34); }
          .v2-mobile-nav button { border:0; border-radius:0; background:transparent; color:#c2d5de; padding:14px 3px; min-height:56px; font-size:12px; font-weight:800; }
          .v2-mobile-nav button.active { background:#283b41; color:#f4bd89; box-shadow:inset 0 3px #edb17f; }
          .v2-mobile-more { position:fixed; left:8px; right:8px; bottom:calc(62px + env(safe-area-inset-bottom,0px)); z-index:101; display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:7px; padding:13px; max-height:60vh; overflow:auto; border:1px solid #627984; border-radius:12px; background:#152530; box-shadow:0 -8px 30px rgba(0,0,0,.48); }
          .v2-mobile-more button { border:1px solid #3f6273; border-radius:8px; background:#223946; color:#d9ecf3; font-size:12px; padding:13px 9px; }
          .demo-app.v2-mode .student-head { display:none; }
          .demo-app.v2-mode .student-row { min-width:0; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; }
          .demo-app.v2-mode .student-row strong,.demo-app.v2-mode .student-row input { grid-column:1/-1; }
          .demo-app.v2-mode .student-table { overflow:visible; }
        }
        @media (max-width:420px) {
          .v2-active-course select { max-width:calc(100vw - 34px); }
          .v2-mode-switch button { flex:1; padding:9px 8px; }
          .v2-experiment-bar { flex-direction:column; align-items:stretch; }
          .v2-experiment-bar .v2-mode-switch { display:grid; grid-template-columns:1fr 1fr; }
        }

        @media(max-width:1100px) { .demo-app { grid-template-columns:220px minmax(0,1fr); }.context-strip { grid-template-columns:repeat(3,minmax(0,1fr)); }.paired-agenda { grid-template-columns:1fr; }.resource-grid,.classroom-launch-grid { grid-template-columns:1fr 1fr; }.metric-grid { grid-template-columns:repeat(3,minmax(0,1fr)); }.attendance-summary { grid-template-columns:repeat(3,minmax(0,1fr)); }.clock-panel { grid-template-columns:1fr; } }
        @media(max-width:760px) { .demo-app { display:block; }.sidebar { position:relative; height:auto; }.sidebar nav { display:grid; grid-template-columns:1fr 1fr; gap:8px; }.nav-group { margin:4px 0; }.workspace-header,.banner,.panel-heading,.action-status,.classroom-session-head { align-items:flex-start; flex-direction:column; }.context-strip { grid-template-columns:1fr 1fr; }.planner-wrap { padding:10px; }.panel { margin:10px; }.resource-grid,.classroom-launch-grid,.metric-grid,.attendance-summary,.live-grid { grid-template-columns:1fr 1fr; }.attendance-actions { margin-top:8px; }.course-switcher { display:grid; grid-template-columns:1fr 1fr; gap:8px; }.course-button { margin:0; } }
        @media(max-width:520px) { .context-strip,.resource-grid,.classroom-launch-grid,.metric-grid,.attendance-summary,.live-grid { grid-template-columns:1fr; }.sidebar nav { grid-template-columns:1fr; }.workspace-header { padding:18px; }.banner { padding:8px 14px; }.wide-panel { padding:16px; }.course-switcher { grid-template-columns:1fr; } }
      `}</style>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="metric"><span>{label}</span><strong>{value}</strong></div>;
}
