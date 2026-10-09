// WLD 205 instructor presentation only. Canonical course guides and outcomes
// remain unchanged. No student-facing or assessment data depends on this module.
export type PlannerViewPreset = 'standard' | 'anthony_wld205_v1';
export type PlannerViewChoice = PlannerViewPreset | 'inherit';
export type PlannerViewScope = 'school' | 'instructor';

export type PlannerViewRevision = {
  id: string;
  scope: PlannerViewScope;
  instructor_id: string | null;
  preset: string;
  changed_at: string;
};

export type PlannerViewSection = {
  school_id: string;
  section_id: string;
  course_code: string | null;
  section_code: string | null;
};

export const ANTHONY_WLD205_PCCC_SECTION_CODE = 'PCCC-DAY-L2-WLD205-2627';
export const ANTHONY_WLD205_PRESET: PlannerViewPreset = 'anthony_wld205_v1';

export function isAnthonyWld205PilotSection(
  section: Pick<PlannerViewSection, 'course_code' | 'section_code'> | null,
  staging = false
): boolean {
  if (!section || (section.course_code ?? '').replace(/\s+/g, '').toUpperCase() !== 'WLD205') {
    return false;
  }
  // Only the 30-day PCCC day class in production; staging uses synthetic sections.
  return section.section_code === ANTHONY_WLD205_PCCC_SECTION_CODE || staging;
}

export function resolvePlannerViewPreset(
  revisions: readonly PlannerViewRevision[],
  userId: string
): { preset: PlannerViewPreset; source: 'school' | 'instructor' | 'core' } {
  // A teacher's latest revision wins over school defaults; an explicit
  // "standard" revision overrides a school's streamlined configuration.
  const latest = (scope: PlannerViewScope) =>
    revisions
      .filter((row) =>
        row.scope === scope && (scope === 'school' || row.instructor_id === userId)
      )
      .sort((a, b) =>
        b.changed_at.localeCompare(a.changed_at) || b.id.localeCompare(a.id)
      )[0];

  const teacher = latest('instructor');
  const school = latest('school');
  const chosen = teacher?.preset === 'inherit' ? school : teacher || school;
  return {
    preset: chosen?.preset === ANTHONY_WLD205_PRESET ? ANTHONY_WLD205_PRESET : 'standard',
    source: chosen?.scope ?? 'core',
  };
}

export function usableMathBookReference(text: string | null | undefined): string | null {
  const value = text?.trim();
  if (!value || /^No textbook exercises reproduced;\s*page references omitted\.?$/i.test(value)) {
    return null;
  }
  return value;
}

export function anthonyMathDisplayText(text: string | null | undefined, dayNumber: number) {
  if (!text || (dayNumber !== 10 && dayNumber !== 11)) return text;
  // Correct the ambiguous rounding instruction in the *display*, never the core.
  return text.replace(
    /\b(?:k)?eep guard digits until the requested final precision\b/gi,
    'Instructor specifies the final decimal precision. Keep full precision in intermediate calculations; round only the final result'
  );
}

export function anthonyDaySupport(dayNumber: number): Array<{ label: string; body: string }> {
  if (dayNumber === 2) {
    return [{
      label: 'Chasan reference',
      body: 'CHASAN refers to Practical Problems in Mathematics for Welders (6th edition). The linked or school-approved edition remains the source.',
    }];
  }
  if (dayNumber === 3) {
    return [{
      label: 'Blueprint approval needed',
      body: 'Anthony and Fin may prepare a FreeCAD drawing from an existing upstairs object. Use it only after school approval; attach the approved drawing to the resource library.',
    }];
  }
  return [];
}
