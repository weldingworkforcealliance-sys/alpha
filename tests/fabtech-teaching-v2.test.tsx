// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import FabtechTeachingDayV2 from '../app/demo/_components/FabtechTeachingDayV2';
import FabtechGradingPracticeV2, { scoredSampleCount } from '../app/demo/_components/FabtechGradingPracticeV2';
import { WELDING_DEMO_PROGRAM } from '../app/demo/_data/welding-program';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const day = WELDING_DEMO_PROGRAM.courses[0].days[0];

describe('FABTECH teaching workflow v2 is a safe opt-in experiment', () => {
  it('uses the original WLD 105/110 5-day curriculum snapshot, untouched', () => {
    expect(WELDING_DEMO_PROGRAM.courses.map((course) => [course.code, course.days.length])).toEqual([
      ['WLD 105', 5], ['WLD 110', 5],
    ]);
    expect(day.title).toBe('Welcome to Welding + Welding Safety Video Day');
    const route = readFileSync('app/demo/welding/ux-lab/page.tsx', 'utf8');
    expect(route).toContain("process.env.NEXT_PUBLIC_DEPLOYMENT_ENV !== 'staging'");
    expect(route).toContain('notFound()');
    expect(route).toContain('WELDING_DEMO_PROGRAM');
    const publicRoute = readFileSync('app/demo/welding/page.tsx','utf8');
    expect(publicRoute).not.toContain('uxLab');
  });

  it('shows the teaching objective, steps, safety, and actions first; support starts collapsed', () => {
    const onStart=vi.fn(),onAttendance=vi.fn(),onComplete=vi.fn(),onGrade=vi.fn();
    render(<FabtechTeachingDayV2
      courseCode="WLD 105" day={day} dayCount={5}
      started={false} completed={false} elapsed="0:00" attendanceFinalized={false}
      note="" followUp={false} gradedCount={0}
      onDay={vi.fn()} onStart={onStart} onComplete={onComplete}
      onAttendance={onAttendance} onGrade={onGrade} onClassroom={vi.fn()}
      onResources={vi.fn()} onLaunch={vi.fn()} onNote={vi.fn()} onFollowUp={vi.fn()}
    />);
    expect(screen.getByText(day.title)).toBeTruthy();
    expect(screen.getByText(day.objective)).toBeTruthy();
    expect(screen.getByText('Teaching Plan')).toBeTruthy();
    expect(screen.getAllByText(/Safety/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Instructor Toolkit/).closest('details')?.open).toBe(false);
    expect(screen.getByRole('button',{name:'Complete Day'})).toHaveProperty('disabled',true);
    fireEvent.click(screen.getByRole('button',{name:'Start Today'}));
    expect(onStart).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button',{name:/Attendance · Needed/}));
    expect(onAttendance).toHaveBeenCalledOnce();
    const classActions = screen.getByRole('region', { name: "Today's class actions" });
    expect(within(classActions).getByRole('button',{name:'Grading'})).toBeTruthy();
    expect(within(classActions).queryByRole('button',{name:/Punch (In|Out)/})).toBeNull();
    fireEvent.click(within(classActions).getByRole('button',{name:'Grading'}));
    expect(onGrade).toHaveBeenCalledOnce();
  });

  it('uses a bounded five-criterion sample grade only, not a real gradebook call', () => {
    expect(scoredSampleCount({}, ['Demo A','Demo B'])).toBe(0);
    expect(scoredSampleCount({'Demo A':[19,19,15,19,19]}, ['Demo A','Demo B'])).toBe(1);
    const onScore=vi.fn();
    render(<FabtechGradingPracticeV2
      students={['Demo A','Demo B']}
      scoresByStudent={{}}
      onScore={onScore}
      onToday={vi.fn()}
    />);
    expect(screen.getByText(/does not change the live gradebook/)).toBeTruthy();
    expect(screen.getAllByRole('combobox')).toHaveLength(6);
    fireEvent.change(screen.getByRole('combobox',{name:'Safety and PPE points'}),{target:{value:'19'}});
    expect(onScore).toHaveBeenCalledWith('Demo A',0,19);
  });

  it('retains original demo while testing reduced menu density and attendance completion gate', () => {
    const app=readFileSync('app/demo/_components/DemoProgramWorkspace.tsx','utf8');
    expect(app).toContain("designMode === 'v2'");
    expect(app).toContain("state.activeModule === 'planner' && (isV2 ?");
    expect(app).toContain("if (!currentAttendance.finalized)");
    expect(app).toContain("update({ activeModule: 'attendance' })");
    expect(app).toContain('FabtechGradingPracticeV2');
    expect(app).toContain('V2_PRIMARY_MODULES');
    expect(app).toContain('v2-mobile-nav');
    expect(app).toContain('Instructor Punch Clock');
    expect(app).toContain("onClick={punchClock}");
    expect(app).toContain("className=\"v2-mobile-punch\"");
    expect(app).toContain("'timeclock', 'Time Clock'");

    expect(app).toContain("sessionStorage.setItem(storageKey, JSON.stringify(state))");
    expect(app).toContain('Original FABTECH');
    expect(app).not.toContain("public.planner_days");
  });
});
