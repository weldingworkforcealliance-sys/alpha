import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function read(path: string) {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

describe('Radiography cross-discipline demo', () => {
  it('uses the same teaching console as the live LTG planner', () => {
    const page = read('app/demo/radiography/page.tsx');

    expect(page).toContain("from '@/app/components/planner/PlannerTeachingConsole'");
    expect(page).toContain('<PlannerTeachingConsole');
    expect(page).toContain('Current Day Controls');
    expect(page).toContain('Student Attendance');
    expect(page).toContain('Radiography Practice Evidence');
    expect(page).toContain('Start Current Day');
    expect(page).toContain('Complete Day');
  });

  it('keeps the Radiography proof set protected and faculty-governed', () => {
    const page = read('app/demo/radiography/page.tsx');

    expect(page).toContain('RADIOGRAPHY DEMONSTRATION');
    expect(page).toContain('Synthetic data only');
    expect(page).toContain('Department review required before curriculum use');
    expect(page).toContain("course: 'RA 101'");
    expect(page).toContain("course: 'RA 102'");
    expect(page).toContain("course: 'RA 103'");
    expect(page).toContain('LTG does not self-authorize clinical practice.');
    expect(page).toContain('Authorized faculty and clinical evaluators remain the decision-makers.');
    expect(page).toContain('no real patient identifiers, images, diagnoses, exposure settings, or protected health information');
  });

  it('has a working student display instead of placeholder launch controls', () => {
    const page = read('app/demo/radiography/page.tsx');
    const student = read('app/demo/radiography/student/page.tsx');

    expect(page).toContain("studentDisplayUrl={`/demo/radiography/student?day=${day.day}`}");
    expect(page).toContain("url: '/demo/radiography/student?day=1'");
    expect(student).toContain('LTG STUDENT DISPLAY · RADIOGRAPHY DEMO');
    expect(student).toContain('LIVE CLASS ACTIVITY');
    expect(student).toContain('Clinical boundary');
  });

  it('connects the Radiography demo without deleting Nursing', () => {
    const selector = read('app/demo/programs/page.tsx');
    const home = read('app/page.tsx');

    expect(selector).toContain("router.push('/demo/radiography')");
    expect(selector).toContain('ACTIVE HEALTH SCIENCES DEMONSTRATION');
    expect(selector).toContain("router.push('/demo/nursing')");
    expect(selector).toContain('FUTURE HEALTH SCIENCES DEMONSTRATION');
    expect(home).toContain('<h3>Radiography</h3>');
    expect(home).toContain('<h3>Nursing</h3>');
  });

  it('preserves live-LTG presentation parity after the redesign', () => {
    const styles = read('app/demo/radiography/radiography-demo.module.css');
    expect(styles).toContain('#0d1b26');
    expect(styles).toContain('#f0641d');
    expect(styles).toContain('.controlPanel');
    expect(styles).toContain('.evidencePanel');
  });
});
