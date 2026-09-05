import { describe, expect, it } from 'vitest';
import {
  PAYROLL_ROLES,
  REVIEW_QUEUE_ROLES,
  SCHOOL_DASHBOARD_ROLES,
  roleAllowed,
} from '../lib/access-roles';

describe('access role policy', () => {
  it('does not grant payroll authority to viewer', () => {
    expect(roleAllowed('viewer', PAYROLL_ROLES)).toBe(false);
  });

  it('allows the intended payroll management roles', () => {
    for (const role of ['school_admin', 'program_lead', 'lead_instructor']) {
      expect(roleAllowed(role, PAYROLL_ROLES)).toBe(true);
    }
  });

  it('keeps review queue narrower than school dashboard access', () => {
    expect(roleAllowed('lead_instructor', REVIEW_QUEUE_ROLES)).toBe(false);
    expect(roleAllowed('viewer', SCHOOL_DASHBOARD_ROLES)).toBe(true);
  });
});
