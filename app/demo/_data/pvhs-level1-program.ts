import type { DemoProgram } from '../_lib/demo-types';
import { PVHS_LEVEL1_DEMO_COHORTS } from './pvhs-level1-config';
import { WELDING_DEMO_PROGRAM } from './welding-program';

/**
 * The public welding demo is the real PVHS Level 1 operating model limited to the
 * first five WLD 105 / WLD 110 instructional days. Curriculum content comes from
 * the active 2026-2027 PVHS guide snapshot. Operational state is disposable.
 */
export const PVHS_LEVEL1_DEMO_PROGRAM: DemoProgram = {
  ...WELDING_DEMO_PROGRAM,
  id: 'pvhs-level1',
  name: 'PVHS Level 1 Welding',
  schoolName: 'Passaic County Community College',
  sectionLabel: 'PVHS Level 1 · WLD 105 / WLD 110 · First Five Instructional Days',
  instructorName: 'PVHS Level 1 Instructor',
  description:
    'Exact PVHS Level 1 workflow for the first five paired WLD 105 / WLD 110 instructional days. Course content and operating rules mirror the live implementation; student identities, attendance delivery, grades, notes and time-clock activity are isolated demo data and are discarded after inactivity.',
  students: PVHS_LEVEL1_DEMO_COHORTS[0].students,
  cohorts: PVHS_LEVEL1_DEMO_COHORTS,
  defaultRole: 'instructor',
};
