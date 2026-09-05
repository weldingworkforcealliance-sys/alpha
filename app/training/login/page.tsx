'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase-browser';

export default function TrainingLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [supabase] = useState(getSupabase);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace('/training');
    });
  }, [router, supabase]);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (authError) throw authError;
      await supabase.rpc('activate_my_invited_memberships');
      router.push('/training');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="shell">
      <section className="card training-card">
        <div className="training-banner">TRAINING MODE · ISOLATED FROM PRODUCTION</div>
        <div className="body">
          <div className="training-brand">
            <div className="brand-mark">LTG</div>
            <div>
              <div className="eyebrow">Living Teacher Planner</div>
              <h1>Training Sign In</h1>
            </div>
          </div>

          <p className="intro">
            Use your normal authorized school account. Training progress, notes, timers,
            and reports stay inside the temporary sandbox and do not change live class records.
          </p>

          <div className="safety-strip">
            <span>Production curriculum</span><strong>Protected</strong>
            <span>Live class progress</span><strong>Unaffected</strong>
          </div>

          <form onSubmit={signIn}>
            <label>
              Email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                disabled={busy}
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                disabled={busy}
              />
            </label>
            {error && <div className="error">{error}</div>}
            <button className="primary" type="submit" disabled={busy}>
              {busy ? 'Signing in…' : 'Enter Training Center'}
            </button>
          </form>

          <div className="links">
            <button onClick={() => router.push('/login')}>Back to Live Sign In</button>
            <button className="demo" onClick={() => router.push('/demo')}>Try Public Demo</button>
          </div>
        </div>
      </section>

      <style jsx>{`
        .shell {
          min-height: 100vh;
          display: grid;
          place-items: center;
          padding: 28px;
          background: transparent;
          color: #e4e0da;
        }
        .training-card {
          width: min(560px, 100%);
          overflow: hidden;
          border: 1px solid #2b3d45;
          border-radius: 14px;
          background: #10191e;
          box-shadow: 0 28px 80px rgba(0,0,0,.44);
        }
        .training-banner {
          padding: 10px;
          text-align: center;
          background: linear-gradient(90deg, #6f432f, #8d5638, #6f432f);
          color: #f5e9df;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: .10em;
        }
        .body { padding: 30px; }
        .training-brand { display: flex; align-items: center; gap: 14px; }
        .brand-mark {
          width: 48px;
          height: 54px;
          display: grid;
          place-items: center;
          flex: 0 0 auto;
          color: #f0b184;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: .07em;
          border: 2px solid #d8844d;
          clip-path: polygon(50% 0, 92% 18%, 92% 68%, 50% 100%, 8% 68%, 8% 18%);
          background: #111d22;
        }
        .eyebrow {
          color: #d8844d;
          font-size: 9px;
          text-transform: uppercase;
          letter-spacing: .13em;
          font-weight: 900;
        }
        h1 { margin: 4px 0 0; color: #eee9e2; font-size: 28px; letter-spacing: -.025em; }
        .intro { color: #8d9aa0; line-height: 1.55; margin: 21px 0 18px; font-size: 12px; }
        .safety-strip {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 6px 18px;
          padding: 12px 13px;
          margin-bottom: 20px;
          border: 1px solid #293a41;
          border-radius: 8px;
          background: #0d161a;
          font-size: 10px;
        }
        .safety-strip span { color: #77868c; }
        .safety-strip strong { color: #9dc7b7; }
        form { display: grid; gap: 14px; }
        label {
          display: grid;
          gap: 7px;
          color: #a3afb3;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: .05em;
          text-transform: uppercase;
        }
        input {
          min-height: 44px;
          padding: 11px 12px;
          border-radius: 7px;
          border: 1px solid #304149;
          background: #0b1418;
          color: #e9e4de;
          font: inherit;
        }
        input:focus { outline: none; border-color: #4c9fac; box-shadow: 0 0 0 3px rgba(76,159,172,.10); }
        button { font: inherit; cursor: pointer; }
        button:disabled { opacity: .5; cursor: not-allowed; }
        form button {
          min-height: 44px;
          border-radius: 7px;
          border: 1px solid rgba(216,132,77,.62);
          background: rgba(169,106,72,.12);
          color: #efad80;
          font-weight: 850;
        }
        .error {
          padding: 10px 11px;
          border-radius: 7px;
          border: 1px solid rgba(195,109,90,.42);
          color: #eca08f;
          background: rgba(195,109,90,.08);
          font-size: 11px;
          line-height: 1.4;
        }
        .links { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 17px; }
        .links button {
          padding: 10px;
          border-radius: 7px;
          border: 1px solid #304149;
          background: #111c21;
          color: #aeb9bd;
          font-weight: 750;
        }
        .links button:hover { border-color: #d8844d; color: #efb28a; }
        .links .demo { border-color: rgba(76,159,172,.38); }
        .links .demo:hover { border-color: #4c9fac; color: #8bc5ce; }
        @media (max-width: 560px) {
          .shell { padding: 0; place-items: stretch; }
          .training-card { min-height: 100vh; width: 100%; border: 0; border-radius: 0; }
          .body { padding: 27px 22px; }
          .links { grid-template-columns: 1fr; }
        }
      `}</style>
    </main>
  );
}
