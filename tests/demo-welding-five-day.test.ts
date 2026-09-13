import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { WELDING_DEMO_PROGRAM } from '../app/demo/_data/welding-program';

describe('Welding public demo curriculum snapshot', () => {
  it('contains exactly the first five active days of both WLD 105 and WLD 110', () => {
    const wld105 = WELDING_DEMO_PROGRAM.courses.find((course) => course.code === 'WLD 105');
    const wld110 = WELDING_DEMO_PROGRAM.courses.find((course) => course.code === 'WLD 110');

    expect(wld105?.days).toHaveLength(5);
    expect(wld110?.days).toHaveLength(5);
    expect(wld105?.days.map((day) => day.dayNumber)).toEqual([1, 2, 3, 4, 5]);
    expect(wld110?.days.map((day) => day.dayNumber)).toEqual([1, 2, 3, 4, 5]);

    expect(wld105?.days[0]?.title).toBe('Welcome to Welding + Welding Safety Video Day');
    expect(wld105?.days[4]?.title).toBe('Blueprint Reading for Welders - 4-Day Review Assessment: Day 1');
    expect(wld110?.days[0]?.title).toBe('Course Orientation + Entry Requirements');
    expect(wld110?.days[4]?.title).toBe('SMAW Equipment Inspection + Safety Checkpoint');
  });

  it('preserves the real first-day timing and WLD 110 120-minute shop structure', () => {
    const wld105 = WELDING_DEMO_PROGRAM.courses.find((course) => course.code === 'WLD 105');
    const wld110 = WELDING_DEMO_PROGRAM.courses.find((course) => course.code === 'WLD 110');

    expect(wld105?.days[0]?.rows.map((row) => row.time)).toEqual([
      '0–8 min',
      '8–12 min',
      '12–34 min',
      '34–38 min',
      '38–40 min',
      '40–60 min',
    ]);
    expect(wld110?.days[0]?.rows.map((row) => row.time)).toEqual([
      '0–25 min',
      '25–75 min',
      '75–105 min',
      '105–120 min',
    ]);
  });

  it('uses the reusable demo engine instead of keeping a copied welding UI', () => {
    const page = readFileSync('app/demo/welding/page.tsx', 'utf8');
    const augmented = readFileSync('app/demo/welding/WeldingDemoAugmentedWorkspace.tsx', 'utf8');
    const live = readFileSync('app/demo/welding/WeldingDemoLiveWorkspace.tsx', 'utf8');
    const engine = readFileSync('app/demo/_components/DemoProgramWorkspace.tsx', 'utf8');

    expect(page).toContain('WeldingDemoAugmentedWorkspace');
    expect(page).toContain('WELDING_DEMO_PROGRAM');
    expect(augmented).toContain('WeldingDemoLiveWorkspace');
    expect(live).toContain('DemoProgramWorkspace');
    expect(page).not.toContain('Orientation & Shop Readiness');
    expect(page).not.toContain('SMAW Setup & Arc Starts');
    expect(engine).toContain("`ltg_demo_${program.id}_full_system_v1`");
  });
});
