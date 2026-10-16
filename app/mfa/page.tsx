'use client';

import { useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabase-browser';
import { safePostLoginRoute } from '@/lib/auth-routes';
import { finishPasswordSignIn } from '@/lib/mfa-login';

export default function MfaPage() {
  const [supabase] = useState(getSupabase);
  const [factors, setFactors] = useState<Array<{ id: string; friendly_name?: string }>>([]);
  const [factorId, setFactorId] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const target = () => safePostLoginRoute(new URLSearchParams(window.location.search).get('next'));

  useEffect(() => {
    let active = true;
    const load = async () => {
      setError('');
      setReady(false);
      try {
        const { data: user, error: userError } = await supabase.auth.getUser();
        if (userError || !user.user) {
          if (active) window.location.replace(`/login?next=${encodeURIComponent(target())}`);
          return;
        }
        const { data, error: assuranceError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (assuranceError || !data?.currentLevel) throw new Error('Could not check account verification. Please retry.');
        if (data.currentLevel === 'aal2' || data.nextLevel !== 'aal2') {
          const destination = await finishPasswordSignIn(supabase, target());
          if (active) window.location.replace(destination);
          return;
        }
        const { data: enrolled, error: factorError } = await supabase.auth.mfa.listFactors();
        if (factorError) throw new Error('Could not load your authenticator. Please retry.');
        const verified = (enrolled?.totp ?? []).filter((factor: { id: string; status: string; friendly_name?: string }) => factor.status === 'verified');
        if (!active) return;
        setFactors(verified);
        setFactorId(verified[0]?.id ?? '');
        setReady(true);
        if (!verified.length) setError('Your account requires another verification method. Contact your account administrator for help.');
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Could not check account verification. Please retry.');
      }
    };
    void load();
    return () => { active = false; };
  }, [supabase, attempt]);

  const verify = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!ready || busy || !factorId) return;
    if (!/^\d{6}$/.test(code)) { setError('Enter the six-digit code from your authenticator app.'); return; }
    setBusy(true);
    setError('');
    try {
      const { error: verificationError } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
      setCode('');
      if (verificationError) throw new Error('That code was not accepted. Enter the current code from your authenticator app.');
      const { data, error: assuranceError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (assuranceError || data?.currentLevel !== 'aal2') throw new Error('Verification is incomplete. Please try a new code.');
      const destination = await finishPasswordSignIn(supabase, target());
      // A full navigation uses the refreshed AAL2 cookies and discards prefetched AAL1 pages.
      window.location.replace(destination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed. Please retry.');
    } finally { setBusy(false); }
  };

  const signOut = async () => {
    setBusy(true);
    const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' });
    if (signOutError) { setError('Could not sign out. Please retry.'); setBusy(false); return; }
    window.location.replace('/login');
  };

  return <main className="shell"><section className="card" style={{ maxWidth: 520, margin: '48px auto', padding: 24 }}>
    <h1>Verify your sign-in</h1>
    <p>Enter the six-digit code from your authenticator app. This is not an email code.</p>
    {!ready && !error && <p role="status">Checking account verification…</p>}
    {error && <p role="alert">{error}</p>}
    {ready && factors.length > 0 && <form onSubmit={verify}>
      {factors.length > 1 && <label>Authenticator<select value={factorId} disabled={busy} onChange={e => { setFactorId(e.target.value); setCode(''); }}>
        {factors.map((factor, index) => <option key={factor.id} value={factor.id}>{factor.friendly_name || `Authenticator ${index + 1}`}</option>)}
      </select></label>}
      <label>Authenticator Code<input value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" maxLength={6} disabled={busy} required /></label>
      <button type="submit" disabled={busy}>{busy ? 'Verifying…' : 'Verify and continue'}</button>
    </form>}
    {error && <button type="button" disabled={busy} onClick={() => setAttempt(value => value + 1)}>Retry verification check</button>}
    <p>If you no longer have your authenticator, contact your account administrator.</p>
    <button type="button" disabled={busy} onClick={signOut}>Sign out</button>
  </section></main>;
}

