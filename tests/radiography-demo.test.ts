import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function read(path: string) {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

describe('Radiography cross-discipline demo', () => {
  it('uses a protected synthetic radiography proof set', () => {
    const page = read('app/demo/radiography/page.tsx');

    expect(page).toContain('RADIOGRAPHY DEMONSTRATION');
    expect(page).toContain('SYNTHETIC DATA ONLY');
    expect(page).toContain('DEPARTMENT REVIEW REQUIRED BEFORE CURRICULUM USE');
    expect(page).toContain('RA 101');
    expect(page).toContain('RA 102');
    expect(page).toContain('RA 103');
  });

  it('keeps clinical judgment with authorized faculty', () => {
    const page = read('app/demo/radiography/page.tsx');

    expect(page).toContain('LTG does not self-authorize clinical practice.');
    expect(page).toContain('Authorized faculty and clinical evaluators remain the decision-makers.');
    expect(page).toContain('No real student or patient data');
    expect(page).toContain('The demo intentionally uses no real patient identifiers, images, diagnoses, exposure settings, or protected health information.');
  });

  it('connects the radiography demo from the program selector without deleting nursing', () => {
    const selector = read('app/demo/programs/page.tsx');

    expect(selector).toContain("router.push('/demo/radiography')");
    expect(selector).toContain('ACTIVE HEALTH SCIENCES DEMONSTRATION');
    expect(selector).toContain("router.push('/demo/nursing')");
    expect(selector).toContain('FUTURE HEALTH SCIENCES DEMONSTRATION');
  });

  it('makes radiography the active public next demo while retaining nursing on the roadmap', () => {
    const home = read('app/page.tsx');

    expect(home).toContain('<h3>Radiography</h3>');
    expect(home).toContain('Active next demonstration');
    expect(home).toContain('<h3>Nursing</h3>');
    expect(home).toContain('Retained on the roadmap');
  });
});
