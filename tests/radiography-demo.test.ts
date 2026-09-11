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

  it('connects students to the real LTG join-code submission route', () => {
    const student = read('app/demo/radiography/student/page.tsx');
    expect(student).toContain('Join Live Classroom');
    expect(student).toContain('router.push(`/join/${encodeURIComponent(code)}`)');
    expect(student).toContain('answers are saved to that live session');
    expect(student).not.toContain('<textarea');
  });

  it('maps every Radiography day to a real Connected Classroom assessment and staging section', () => {
    const live = read('app/demo/radiography/live/page.tsx');
    for (const slug of [
      'rad_demo_d1_orientation',
      'rad_demo_d2_radiation_safety',
      'rad_demo_d3_patient_care',
      'rad_demo_d4_positioning_lab',
      'rad_demo_d5_image_critique',
      'rad_demo_d6_clinical_evidence',
      'rad_demo_d7_progress_review',
    ]) expect(live).toContain(slug);
    expect(live).toContain("sectionCode: 'RAD-RA101'");
    expect(live).toContain("sectionCode: 'RAD-RA102'");
    expect(live).toContain("sectionCode: 'RAD-RA103'");
    expect(live).toContain('router.replace(`/classroom?section=${encodeURIComponent(section.section_id)}&assessment=${encodeURIComponent(config.assessmentSlug)}`)');
  });

  it('connects the Radiography demo while retaining Nursing for future use', () => {
    const selector = read('app/demo/programs/page.tsx');
    const home = read('app/page.tsx');
    expect(selector).toContain("router.push('/demo/radiography')");
    expect(selector).toContain('ACTIVE HEALTH SCIENCES DEMONSTRATION');
    expect(selector).toContain("router.push('/demo/nursing')");
    expect(selector).toContain('FUTURE HEALTH SCIENCES DEMONSTRATION');
    expect(home).toContain('<h3>Radiography</h3>');
    expect(home).toContain('NEXT DEMONSTRATION');
    expect(home).toContain('Beyond one department');
  });

  it('preserves live-LTG presentation parity after the redesign', () => {
    const styles = read('app/demo/radiography/radiography-demo.module.css');
    expect(styles).toContain('#0d1b26');
    expect(styles).toContain('#f0641d');
    expect(styles).toContain('.controlPanel');
    expect(styles).toContain('.evidencePanel');
  });
});
