import type { DemoProgram } from '../_lib/demo-types';
import { WELDING_DEMO_PROGRAM } from './welding-program';

const DEMO_PROGRAMS: Record<string, DemoProgram> = {
  welding: WELDING_DEMO_PROGRAM,
};

export function getDemoProgram(programId: string) {
  return DEMO_PROGRAMS[programId] ?? null;
}

export function listDemoPrograms() {
  return Object.values(DEMO_PROGRAMS);
}
