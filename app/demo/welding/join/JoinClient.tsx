'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getDemoClassroomAssessment } from '../_lib/demo-classroom-api';

export default function JoinClient({ initialCode }: { initialCode: string }) {
  const router = useRouter();
  const [code, setCode] = useState(initialCode.toUpperCase());
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const join = async (event?: FormEvent) => {
    event?.preventDefault();
    const normalized = code.trim().toUpperCase();
    if (!normalized) {
      setError('Enter the demo join code shown by the instructor.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await getDemoClassroomAssessment(normalized);
      router.push(`/demo/welding/student-display?code=${encodeURIComponent(normalized)}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'That demo join code is invalid or has expired.');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!initialCode) return;
    const id = window.setTimeout(() => void join(), 0);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="join-shell">
      <form className="join-card" onSubmit={join}>
        <span>LTG LIVE CLASSROOM · DEMO</span>
        <h1>Join classroom activity</h1>
        <p>Enter the temporary join code shown on the instructor Live Classroom screen. It works from a separate phone, tablet, or computer.</p>
        <label>Join code<input autoFocus value={code} onChange={(event) => { setCode(event.target.value.toUpperCase()); setError(''); }} placeholder="A1B2C3" /></label>
        {error && <div className="error">{error}</div>}
        <button type="submit" disabled={busy}>{busy ? 'Checking code…' : 'Join Activity'}</button>
        <small>Closed demo system · temporary session only · expires after 30 minutes of inactivity</small>
      </form>
      <style jsx>{`
        :global(body) { margin:0; background:#091014; font-family:Arial,Helvetica,sans-serif; }
        * { box-sizing:border-box; }.join-shell { min-height:100vh; display:grid; place-items:center; padding:20px; color:#dce7eb; background:radial-gradient(circle at top,#15333f 0,#091014 45%); }.join-card { width:min(520px,100%); display:grid; gap:14px; padding:30px; border:1px solid #2b414a; border-radius:15px; background:#10191e; box-shadow:0 20px 60px rgba(0,0,0,.35); }.join-card>span { color:#62dcff; font-size:10px; font-weight:950; letter-spacing:.12em; }.join-card h1 { margin:0; color:#fff; font-size:28px; }.join-card p { margin:0; color:#91a3aa; line-height:1.55; }.join-card label { display:grid; gap:7px; color:#b9c7cc; font-size:11px; font-weight:850; }.join-card input { padding:13px; border:1px solid #364a52; border-radius:8px; background:#0b1317; color:#fff; font-size:18px; letter-spacing:.12em; text-transform:uppercase; }.join-card button { padding:13px; border:1px solid #36abd0; border-radius:8px; background:#0c7195; color:#fff; font-weight:900; cursor:pointer; }.join-card button:disabled { opacity:.5; cursor:not-allowed; }.join-card small { color:#74878f; line-height:1.5; }.error { padding:11px; border:1px solid #75404b; border-radius:8px; background:#29171c; color:#f0a7b4; font-size:11px; line-height:1.45; }
      `}</style>
    </main>
  );
}
