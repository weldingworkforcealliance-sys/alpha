import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import PlannerTimeBudget from '../app/planner-time-budget';
import { getPlannerTimeBudget, TRANSPORT_ALLOWANCE_NOTE } from '../lib/planner-time-budget';

describe('usable lab time', () => {
  it('separates work, additional cleanup and bus loss without changing scheduled time', () => {
    const teaching = [
      { planned_minutes: 15, segment_type: 'demonstration' },
      { planned_minutes: 50, segment_type: 'guided_practice' },
      { planned_minutes: 25, segment_type: 'independent_practice' },
      { planned_minutes: 10, segment_type: 'closure' },
    ];
    const budget = getPlannerTimeBudget([...teaching, { planned_minutes: 20, segment_type: 'other', notes: TRANSPORT_ALLOWANCE_NOTE }]);
    expect(budget.teachingSegments).toEqual(teaching);
    expect(budget.workMinutes).toBe(90);
    expect(budget.closeoutMinutes).toBe(10);
    expect(budget.usableMinutes).toBe(100);
    expect(budget.scheduledMinutes).toBe(120);
    expect(budget.transportMinutes).toBe(20);
  });

  it('does not classify ordinary notes as transport or change an ordinary course total', () => {
    const budget = getPlannerTimeBudget([{ planned_minutes: 160, notes: 'Talk about bus arrival.' }, { planned_minutes: 30, segment_type: 'closure' }]);
    expect(budget.usableMinutes).toBe(190);
    expect(budget.transportMinutes).toBe(0);
    expect(budget.teachingSegments).toHaveLength(2);
  });

  it('shows work and cleanup separately and labels the bus window as an estimate', () => {
    const html = renderToStaticMarkup(createElement(PlannerTimeBudget, { usableMinutes: 100, workMinutes: 90, closeoutMinutes: 10, scheduledMinutes: 120, transportMinutes: 20 }));
    expect(html).toContain('90 min work + 10 min safe cleanup');
    expect(html).toContain('100 min usable');
    expect(html).toContain('120 min scheduled');
    expect(html).toContain('20 min bus allowance');
    expect(html).toContain('Planning estimate');
    expect(html).toContain('Finish safe closeout before pickup');
  });

  it('leaves ordinary planner days without a transport banner', () => {
    expect(renderToStaticMarkup(createElement(PlannerTimeBudget, { usableMinutes: 190, workMinutes: 160, closeoutMinutes: 30, scheduledMinutes: 190, transportMinutes: 0 }))).toBe('');
  });
});
