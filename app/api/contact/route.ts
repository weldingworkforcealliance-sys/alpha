import { NextResponse } from 'next/server';
import { parseContact } from '@/lib/contact';
import { contactChallenge, contactFingerprint, contactService, notifyLead, sameOrigin, verifyChallenge } from '@/lib/contact-server';

export const runtime = 'nodejs';
const reply = (body: object, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
export async function GET() {
  try { contactService(); return reply({ challenge: contactChallenge() }); }
  catch { return reply({ error: 'Contact requests are temporarily unavailable. Please try again later.' }, 503); }
}
export async function POST(request: Request) {
  if (!sameOrigin(request)) return reply({ error: 'Please submit from the LTG contact page.' }, 403);
  if (!request.headers.get('content-type')?.startsWith('application/json')) return reply({ error: 'Invalid request format.' }, 415);
  // Bound the stream, including requests without a Content-Length header.
  const reader = request.body?.getReader();
  if (!reader) return reply({ error: 'Empty request.' }, 400);
  let size = 0; let raw = ''; const decoder = new TextDecoder();
  try {
    while (true) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > 20000) { await reader.cancel(); return reply({ error: 'Inquiry is too large.' }, 413); } raw += decoder.decode(value, { stream: true }); }
    raw += decoder.decode();
    const body = JSON.parse(raw);
    if (!body || typeof body !== 'object') return reply({ error: 'Invalid inquiry.' }, 400);
    if (body.website) return reply({ ok: true });
    if (!verifyChallenge(body.challenge)) return reply({ error: 'Please wait a moment and try again, or refresh this page if it has been open for over an hour.' }, 400);
    const lead = parseContact(body);
    // Netlify overwrites this header. Never trust a caller-supplied X-Forwarded-For.
    const ip = process.env.NETLIFY === 'true' ? request.headers.get('x-nf-client-connection-ip') : 'local-development';
    if (!ip) return reply({ error: 'Unable to verify request. Please try again.' }, 503);
    const db = contactService();
    const { data, error } = await db.rpc('submit_contact_lead', { p_lead: lead, p_fingerprint: contactFingerprint(ip), p_submission: body.challenge.split('.')[1] });
    if (error) { console.error('LTG contact persistence failed'); return reply({ error: 'We could not save your inquiry. Please try again.' }, 503); }
    if (data.rate_limited) return reply({ error: 'Too many requests. Please try again in an hour.' }, 429);
    if (!data.duplicate) await notifyLead(data.id, lead);
    return reply({ ok: true });
  } catch (error) {
    if (error instanceof SyntaxError) return reply({ error: 'Invalid inquiry.' }, 400);
    const message = error instanceof Error ? error.message : '';
    if (/^(Invalid |Enter |Choose |Name and)/.test(message)) return reply({ error: message }, 400);
    return reply({ error: 'Contact requests are temporarily unavailable. Please try again later.' }, 503);
  }
}
