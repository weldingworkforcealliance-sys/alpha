export const SCHOOL_MANAGEMENT_ROLES = new Set([
  'school_admin',
  'program_lead',
  'lead_instructor',
]);

export const PAYROLL_ROLES = SCHOOL_MANAGEMENT_ROLES;

export const SCHOOL_DASHBOARD_ROLES = new Set([
  'school_admin',
  'program_lead',
  'lead_instructor',
  'viewer',
]);

export function roleAllowed(
  role: string | null | undefined,
  allowedRoles: ReadonlySet<string>
) {
  return Boolean(role && allowedRoles.has(role));
}
