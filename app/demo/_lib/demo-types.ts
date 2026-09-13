export type DemoModule =
  | 'planner'
  | 'agenda'
  | 'resources'
  | 'classroom'
  | 'attendance'
  | 'review'
  | 'timeclock'
  | 'reports'
  | 'training'
  | 'school';

export type DemoRole = 'instructor' | 'lead_instructor' | 'program_lead' | 'school_admin';

export type DemoPlanRow = {
  id: string;
  time: string;
  instructor: string;
  students?: string | null;
  kind?: 'core' | 'math' | 'assessment';
};

export type DemoOutcome = {
  id: string;
  code: string;
  text: string;
};

export type DemoResource = {
  id: string;
  title: string;
  type: string;
  url?: string | null;
  notes?: string | null;
  required?: boolean;
  studentSafe?: boolean;
  demoActivityKey?: string | null;
};

export type DemoSupport = {
  instructorPrep?: string | null;
  safetyFocus?: string | null;
  openingReview?: string | null;
  demonstration?: string | null;
  guidedPractice?: string | null;
  independentPractice?: string | null;
  instructorChecks?: string | null;
  assessment?: string | null;
  commonProblems?: string | null;
  teachingTips?: string | null;
  materialsEquipment?: string | null;
  correspondingApplication?: string | null;
  evidenceCheck?: string | null;
  weeklyCoachingFocus?: string | null;
  coachingFocus?: string | null;
  ifStudentsStruggle?: string | null;
  keepMomentum?: string | null;
  awsAlignment?: string | null;
  awsKeyIndicators?: string | null;
  safetyGate?: string | null;
  procedureVariableFocus?: string | null;
  evidenceType?: string | null;
  inspectionAcceptanceFocus?: string | null;
  focusedRetry?: string | null;
  recordLinkExpectation?: string | null;
  qualificationGuardrail?: string | null;
};

export type DemoCourseDay = {
  dayNumber: number;
  title: string;
  objective: string;
  formatLabel: string;
  outcomes: DemoOutcome[];
  rows: DemoPlanRow[];
  resources: DemoResource[];
  support: DemoSupport;
};

export type DemoCourse = {
  code: string;
  name: string;
  roleLabel: string;
  days: DemoCourseDay[];
};

export type DemoSectionConfig = {
  courseCode: string;
  sectionName: string;
  sectionCode: string;
  plannedInstructionalDays: number;
  plannedMinutesPerDay: number;
  isAttendancePrimary: boolean;
  isAttendanceCompletion: boolean;
};

export type DemoAttendancePairConfig = {
  pairName: string;
  mode: 'standard' | 'pvhs';
  reportDelayMinutes: number;
  reportingEnabled: boolean;
  recipientLabel: string;
};

export type DemoCohort = {
  id: string;
  name: string;
  code: string;
  dailyStartTime: string;
  dailyEndTime: string;
  plannedInstructionalDays: number;
  demoDates?: string[];
  sections: DemoSectionConfig[];
  attendance: DemoAttendancePairConfig;
  students: string[];
};

export type DemoImplementation = {
  id: string;
  name: string;
  schoolName: string;
  description?: string;
  cohorts: DemoCohort[];
  defaultRole?: DemoRole;
};

export type DemoProgram = {
  id: string;
  name: string;
  schoolName: string;
  sectionLabel: string;
  instructorName: string;
  description: string;
  courses: DemoCourse[];
  students: string[];
  cohorts?: DemoCohort[];
  defaultRole?: DemoRole;
};
