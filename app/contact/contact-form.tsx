'use client';
import { useEffect, useRef, useState } from 'react';
import { contactLimits, inquiryTypes } from '@/lib/contact';

export default function ContactForm() {
  const [challenge, setChallenge] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const [interest, setInterest] = useState<string>('General information');
  const status = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    if (query.get('interest') === 'demo') setInterest('LTG demonstration');
    let active = true;
    fetch('/api/contact', { cache: 'no-store' }).then(async r => { const data = await r.json(); if (active) { if (!r.ok) setError(data.error); else setChallenge(data.challenge); } }).catch(() => { if (active) setError('Unable to load the form. Please refresh and try again.'); });
    return () => { active = false; };
  }, []);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return; setBusy(true); setError('');
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    const query = new URLSearchParams(window.location.search);
    // Keep URLs free of arbitrary query values that could include personal information.
    let referrer = ''; try { if (document.referrer) { const url = new URL(document.referrer); referrer = `${url.origin}${url.pathname}`.slice(0,500); } } catch { /* no referrer */ }
    const attribution: Record<string,string> = { source_page: query.get('source') === 'home-nav' ? '/#navigation' : query.get('source') === 'home-cta' ? '/#contact' : '/contact', referrer };
    for (const key of ['utm_source','utm_medium','utm_campaign','utm_term','utm_content']) attribution[key] = (query.get(key) || '').slice(0,200);
    try {
      const response = await fetch('/api/contact', { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ ...fields, ...attribution, challenge }) });
      const data = await response.json();
      if (!response.ok) setError(data.error || 'Unable to save your inquiry. Please try again.');
      else setSuccess(true);
    } catch { setError('Connection interrupted. Please try again; your inquiry will not be duplicated.'); }
    finally { setBusy(false); setTimeout(() => status.current?.focus(), 0); }
  }
  if (success) return <div className="contact-card" ref={status} tabIndex={-1} role="status"><p className="contact-eyebrow">INQUIRY RECEIVED</p><h2>Thank you for reaching out.</h2><p>Your inquiry has been saved. The LTG team will follow up using the contact details you provided.</p><a href="/">Return to LTG</a></div>;
  return <form onSubmit={submit} className="contact-card"><h2>Contact LTG</h2><p>Fields marked * are required.</p>
    <div className="contact-fields">{([
      ['name','Name','name',true],['institution','Institution / Organization','organization',true],['job_title','Job Title','organization-title',false],['email','Work Email','email',true],['phone','Phone','tel',false],['department','Program or Department','off',false],
    ] as const).map(([name,label,autoComplete,required]) => <label key={name} htmlFor={name}>{label}{required ? ' *' : ''}<input id={name} name={name} required={required} autoComplete={autoComplete} type={name === 'email' ? 'email' : name === 'phone' ? 'tel' : 'text'} maxLength={contactLimits[name]} /></label>)}</div>
    <label htmlFor="inquiry_type">What are you interested in? *<select id="inquiry_type" name="inquiry_type" required value={interest} onChange={e=>setInterest(e.target.value)}>{inquiryTypes.map(x=><option key={x}>{x}</option>)}</select></label>
    <label htmlFor="message">Message<textarea id="message" name="message" rows={5} maxLength={5000} /></label>
    <label htmlFor="heard_about">How did you hear about LTG?<input id="heard_about" name="heard_about" maxLength={300} /></label>
    <div className="contact-trap" aria-hidden="true"><label>Leave this empty<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
    <p className="contact-privacy">We use these details to respond to your inquiry and discuss LTG with you. Please don’t include student records or sensitive personal information.</p>
    <div ref={status} tabIndex={-1} role="alert">{error && <p className="contact-error">{error}</p>}</div>
    <button type="submit" disabled={busy || !challenge}>{busy ? 'Sending…' : 'Request Information'}</button>
  </form>;
}
