import type { DemoCohort } from '../_lib/demo-types';

/**
 * Public-demo mirror of the current PVHS Level 1 operating configuration.
 * Structural values mirror production. Student identities and the report recipient
 * are intentionally synthetic so the public demo cannot expose live school records.
 */
export const PVHS_LEVEL1_DEMO_COHORTS: DemoCohort[] = [
  {
    id: 'pvhs-b-l1-2627-demo',
    name: 'PVHS Cohort B - Level 1',
    code: 'PVHS-B-L1-2627',
    dailyStartTime: '8:30 AM',
    dailyEndTime: '11:30 AM',
    plannedInstructionalDays: 165,
    sections: [
      {
        courseCode: 'WLD 105',
        sectionName: 'PVHS B - WLD 105',
        sectionCode: 'PVHS-B-WLD105-2627',
        plannedInstructionalDays: 55,
        plannedMinutesPerDay: 60,
        isAttendancePrimary: true,
        isAttendanceCompletion: false,
      },
      {
        courseCode: 'WLD 110',
        sectionName: 'PVHS B - WLD 110',
        sectionCode: 'PVHS-B-WLD110-2627',
        plannedInstructionalDays: 55,
        plannedMinutesPerDay: 120,
        isAttendancePrimary: false,
        isAttendanceCompletion: true,
      },
    ],
    attendance: {
      pairName: 'PVHS Level 1 B · WLD 105/110',
      mode: 'pvhs',
      reportDelayMinutes: 30,
      reportingEnabled: true,
      recipientLabel: 'Configured PVHS attendance recipient',
    },
    students: [
      'PVHS B Demo Student 01',
      'PVHS B Demo Student 02',
      'PVHS B Demo Student 03',
      'PVHS B Demo Student 04',
      'PVHS B Demo Student 05',
      'PVHS B Demo Student 06',
    ],
  },
  {
    id: 'pvhs-c-l1-2627-demo',
    name: 'PVHS Cohort C - Level 1',
    code: 'PVHS-C-L1-2627',
    dailyStartTime: '11:30 AM',
    dailyEndTime: '2:30 PM',
    plannedInstructionalDays: 165,
    sections: [
      {
        courseCode: 'WLD 105',
        sectionName: 'PVHS C - WLD 105',
        sectionCode: 'PVHS-C-WLD105-2627',
        plannedInstructionalDays: 55,
        plannedMinutesPerDay: 60,
        isAttendancePrimary: true,
        isAttendanceCompletion: false,
      },
      {
        courseCode: 'WLD 110',
        sectionName: 'PVHS C - WLD 110',
        sectionCode: 'PVHS-C-WLD110-2627',
        plannedInstructionalDays: 55,
        plannedMinutesPerDay: 120,
        isAttendancePrimary: false,
        isAttendanceCompletion: true,
      },
    ],
    attendance: {
      pairName: 'PVHS Level 1 C · WLD 105/110',
      mode: 'pvhs',
      reportDelayMinutes: 10,
      reportingEnabled: true,
      recipientLabel: 'Configured PVHS attendance recipient',
    },
    students: [
      'PVHS C Demo Student 01',
      'PVHS C Demo Student 02',
      'PVHS C Demo Student 03',
      'PVHS C Demo Student 04',
      'PVHS C Demo Student 05',
      'PVHS C Demo Student 06',
      'PVHS C Demo Student 07',
    ],
  },
];
