export const inquiryTypes = ['LTG demonstration', 'Founding/Beta partnership', 'Using LTG at my school', 'Pricing/licensing', 'Consulting/configuration', 'General information'] as const;
export const leadStatuses = ['New', 'Contacted', 'Demo Scheduled', 'Pilot Discussion', 'Partner', 'Closed'] as const;
export type LeadStatus = typeof leadStatuses[number];
export type ContactInput = {
  name: string; institution: string; job_title: string; email: string; phone: string;
  department: string; inquiry_type: string; message: string; heard_about: string;
  source_page: string; referrer: string; utm_source: string; utm_medium: string;
  utm_campaign: string; utm_term: string; utm_content: string;
};
export const contactLimits: Record<keyof ContactInput, number> = {
  name: 120, institution: 200, job_title: 120, email: 254, phone: 50,
  department: 160, inquiry_type: 60, message: 5000, heard_about: 300,
  source_page: 500, referrer: 500, utm_source: 200, utm_medium: 200,
  utm_campaign: 200, utm_term: 200, utm_content: 200,
};
export function parseContact(value: unknown): ContactInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid inquiry.');
  const body = value as Record<string, unknown>;
  const result = {} as ContactInput;
  for (const key of Object.keys(contactLimits) as (keyof ContactInput)[]) {
    if (body[key] != null && typeof body[key] !== 'string') throw new Error(`Invalid ${key}.`);
    const text = ((body[key] ?? '') as string).trim();
    if (text.length > contactLimits[key] || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text)) throw new Error(`Invalid ${key}.`);
    result[key] = text;
  }
  if (!result.name || !result.institution) throw new Error('Name and institution are required.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.email)) throw new Error('Enter a valid work email.');
  if (!(inquiryTypes as readonly string[]).includes(result.inquiry_type)) throw new Error('Choose an inquiry type.');
  result.email = result.email.toLowerCase();
  // Attribution is descriptive, never an authorization or redirect destination.
  if (!result.source_page.startsWith('/') || result.source_page.startsWith('//')) result.source_page = '/contact';
  return result;
}
