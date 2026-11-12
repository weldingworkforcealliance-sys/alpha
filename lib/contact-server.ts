import { createClient } from '@supabase/supabase-js';
import { createHmac, timingSafeEqual, randomUUID } from 'node:crypto';
import type { ContactInput } from './contact';

export function contactService() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.CONTACT_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Contact service is not configured.');
  // Fail closed if a preview is accidentally given a production database URL.
  if (process.env.CONTEXT === 'deploy-preview' && new URL(url).hostname !== 'ezlvivmeneefiiwqwgqd.supabase.co') throw new Error('Contact staging target mismatch.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
function sign(value: string) {
  const key = process.env.CONTACT_SIGNING_SECRET;
  if (!key || key.length < 32) throw new Error('Contact signing secret is not configured.');
  return createHmac('sha256', key).update(value).digest('hex');
}
export function contactChallenge(now = Date.now()) {
  const payload = `${now}.${randomUUID()}`;
  return `${payload}.${sign(payload)}`;
}
export function verifyChallenge(token: unknown, now = Date.now()) {
  if (typeof token !== 'string' || token.length > 160) return false;
  const [stamp, nonce, signature] = token.split('.');
  if (!/^\d+$/.test(stamp ?? '') || !/^[a-f0-9-]{36}$/.test(nonce ?? '') || !/^[a-f0-9]{64}$/.test(signature ?? '')) return false;
  const age = now - Number(stamp);
  return age >= 2000 && age <= 3600000 && timingSafeEqual(Buffer.from(signature), Buffer.from(sign(`${stamp}.${nonce}`)));
}
export function contactFingerprint(ip: string) { return sign(`contact-ip:${ip}`); }
export function sameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  // Hosting adapters may give Request an internal origin. Use our configured
  // public origin rather than trusting caller-supplied forwarding headers.
  const expected = process.env.CONTACT_SITE_ORIGIN || new URL(request.url).origin;
  try { return Boolean(origin && origin === new URL(expected).origin); }
  catch { return false; }
}

export async function notifyLead(id: string, lead: ContactInput) {
  const db = contactService();
  const key = process.env.CONTACT_RESEND_API_KEY;
  const from = process.env.CONTACT_FROM_EMAIL;
  const to = process.env.CONTACT_NOTIFICATION_EMAIL;
  let sent = false;
  try {
    if (!key || !from || !to) throw new Error('Notification configuration missing');
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST', signal: AbortSignal.timeout(10000),
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'Idempotency-Key': `ltg-contact/${id}` },
      body: JSON.stringify({ from, to: [to], reply_to: lead.email,
        subject: `${process.env.NEXT_PUBLIC_DEPLOYMENT_ENV === 'staging' ? '[STAGING] ' : ''}New LTG inquiry`,
        text: `New inquiry ${id}\n\n${Object.entries(lead).map(([k,v]) => `${k.replaceAll('_', ' ')}: ${v || '—'}`).join('\n')}\n\nOpen LTG → Administration → Prospective Schools to follow up.`,
      }),
    });
    sent = response.ok;
  } catch { /* Keep the saved lead and expose a retry in the owner pipeline. */ }
  const { error } = await db.from('contact_leads').update({ notification_status: sent ? 'sent' : 'failed', notified_at: sent ? new Date().toISOString() : null }).eq('id', id);
  if (error) console.error('LTG contact notification status could not be saved');
  return sent;
}
