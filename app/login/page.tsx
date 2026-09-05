'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase-browser';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [supabase] = useState(getSupabase);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (signInError) {
        setError(
          signInError.message === 'Invalid login credentials'
            ? 'Email/password not recognized. First-time users should complete account setup. Existing users can reset their password below.'
            : signInError.message || 'Failed to sign in'
        );
        return;
      }

      await supabase.rpc('activate_my_invited_memberships');
      router.push('/dashboard');
    } catch (err) {
      console.error(err);
      setError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="login-shell">
      <section className="login-frame">
        <aside className="brand-panel">
          <div className="brand-lockup">
            <div className="brand-mark">LTG</div>
            <div>
              <div className="brand-name">Living Teacher</div>
              <div className="brand-name">Planner</div>
            </div>
          </div>

          <div className="brand-copy">
            <div className="eyebrow">Night Shift Workspace</div>
            <h1>Teach the plan.<br />Capture what works.</h1>
            <p>
              One working space for daily instruction, protected curriculum,
              connected assessments, and school-level learning.
            </p>
          </div>

          <div className="mode-stack" aria-label="Platform access modes">
            <div className="mode-row live">
              <span className="mode-dot" />
              <div><strong>Live Platform</strong><small>Production planner and reporting</small></div>
            </div>
            <div className="mode-row training-row">
              <span className="mode-dot" />
              <div><strong>Training Mode</strong><small>Isolated practice workspace</small></div>
            </div>
            <div className="mode-row demo-row">
              <span className="mode-dot" />
              <div><strong>Public Demo</strong><small>Limited sample with nothing saved</small></div>
            </div>
          </div>

          <div className="brand-foot">Living Teacher Planner · Welding Workforce Alliance</div>
        </aside>

        <section className="signin-panel">
          <div className="signin-head">
            <div className="eyebrow">Authorized Access</div>
            <h2>Sign in to LTG</h2>
            <p>Use the account assigned to your school or program.</p>
          </div>

          <form onSubmit={handleLogin}>
            <label>
              Email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.email@example.com"
                required
                disabled={isLoading}
                autoComplete="email"
              />
            </label>

            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                disabled={isLoading}
                autoComplete="current-password"
              />
            </label>

            {error && <div className="error">{error}</div>}

            <button className="primary signin-button" type="submit" disabled={isLoading}>
              {isLoading ? 'Signing in…' : 'Enter Live Platform'}
            </button>
          </form>

          <div className="account-tools">
            <button onClick={() => router.push('/account-setup')}>
              <span>First-Time Setup</span>
              <small>Activate an invited account</small>
            </button>
            <button onClick={() => router.push('/reset-password')}>
              <span>Reset Password</span>
              <small>Recover an existing account</small>
            </button>
          </div>

          <div className="divider"><span>OTHER ACCESS</span></div>

          <div className="alternate-grid">
            <button className="training-access" onClick={() => router.push('/training/login')}>
              <span className="access-kicker">TRAINING</span>
              <strong>Open Training Mode</strong>
              <small>Full sandbox for authorized users</small>
            </button>

            <button className="demo-access" onClick={() => router.push('/demo')}>
              <span className="access-kicker">DEMO</span>
              <strong>Try Public Demo</strong>
              <small>Limited sample · nothing saved</small>
            </button>
          </div>
        </section>
      </section>

      <style jsx>{`
        .login-shell {
          min-height: 100vh;
          display: grid;
          place-items: center;
          padding: 34px;
          background: transparent;
          color: #e4e0da;
        }

        .login-frame {
          width: min(980px, 100%);
          display: grid;
          grid-template-columns: minmax(0, .9fr) minmax(420px, 1.1fr);
          overflow: hidden;
          border: 1px solid #2b3d45;
          border-radius: 16px;
          background: #10191e;
          box-shadow: 0 30px 90px rgba(0,0,0,.46);
        }

        .brand-panel {
          min-height: 650px;
          display: flex;
          flex-direction: column;
          padding: 34px;
          border-right: 1px solid #263840;
          background:
            radial-gradient(circle at 20% 82%, rgba(169,106,72,.14), transparent 18rem),
            radial-gradient(circle at 85% 14%, rgba(76,159,172,.10), transparent 18rem),
            linear-gradient(155deg, #0d181d, #0a1216 65%, #0e171b);
        }

        .brand-lockup {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .brand-mark {
          width: 57px;
          height: 64px;
          display: grid;
          place-items: center;
          flex: 0 0 auto;
          color: #f0b184;
          font-size: 14px;
          font-weight: 900;
          letter-spacing: .08em;
          border: 2px solid #d8844d;
          clip-path: polygon(50% 0, 92% 18%, 92% 68%, 50% 100%, 8% 68%, 8% 18%);
          background: #111d22;
          box-shadow: 0 0 28px rgba(169,106,72,.18);
        }

        .brand-name {
          color: #ddd9d3;
          font-size: 18px;
          font-weight: 850;
          line-height: 1.05;
          letter-spacing: .02em;
          text-transform: uppercase;
        }

        .brand-copy {
          margin: auto 0 34px;
        }

        .eyebrow {
          color: #d8844d;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: .16em;
          text-transform: uppercase;
        }

        .brand-copy h1 {
          margin: 12px 0 15px;
          color: #f0ece5;
          font-size: clamp(34px, 4vw, 48px);
          font-weight: 650;
          line-height: 1.02;
          letter-spacing: -.035em;
        }

        .brand-copy p {
          max-width: 430px;
          margin: 0;
          color: #8d9ba1;
          font-size: 14px;
          line-height: 1.65;
        }

        .mode-stack {
          display: grid;
          gap: 8px;
          padding-top: 21px;
          border-top: 1px solid #263840;
        }

        .mode-row {
          display: grid;
          grid-template-columns: 10px 1fr;
          gap: 10px;
          align-items: start;
          padding: 9px 0;
        }

        .mode-dot {
          width: 7px;
          height: 7px;
          margin-top: 5px;
          border-radius: 50%;
          background: #76a995;
          box-shadow: 0 0 10px rgba(118,169,149,.34);
        }

        .training-row .mode-dot { background: #d8844d; box-shadow: 0 0 10px rgba(216,132,77,.30); }
        .demo-row .mode-dot { background: #4c9fac; box-shadow: 0 0 10px rgba(76,159,172,.30); }
        .mode-row div { display: grid; gap: 2px; }
        .mode-row strong { color: #cbd2d3; font-size: 12px; }
        .mode-row small { color: #66757b; font-size: 10px; }

        .brand-foot {
          margin-top: 24px;
          color: #536168;
          font-size: 9px;
          letter-spacing: .08em;
          text-transform: uppercase;
        }

        .signin-panel {
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 48px 46px;
          background:
            linear-gradient(145deg, rgba(255,255,255,.014), transparent 44%),
            #10191e;
        }

        .signin-head h2 {
          margin: 7px 0 5px;
          color: #eee9e2;
          font-size: 30px;
          font-weight: 700;
          letter-spacing: -.025em;
        }

        .signin-head p {
          margin: 0 0 26px;
          color: #87959b;
          font-size: 13px;
        }

        form { display: grid; gap: 16px; }

        label {
          display: grid;
          gap: 7px;
          color: #a3afb3;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: .04em;
          text-transform: uppercase;
        }

        input {
          width: 100%;
          min-height: 46px;
          padding: 12px 13px;
          border: 1px solid #31444c;
          border-radius: 8px;
          background: #0b1317;
          color: #ece8e2;
          font: inherit;
        }

        input:focus {
          outline: none;
          border-color: #4c9fac;
          box-shadow: 0 0 0 3px rgba(76,159,172,.10);
        }

        button { font: inherit; cursor: pointer; }
        button:disabled { opacity: .5; cursor: not-allowed; }

        .signin-button {
          min-height: 46px;
          margin-top: 2px;
          border: 1px solid rgba(216,132,77,.65);
          border-radius: 8px;
          background: linear-gradient(180deg, rgba(169,106,72,.22), rgba(122,73,48,.13));
          color: #f0b88e;
          font-weight: 850;
        }

        .signin-button:hover:not(:disabled) {
          border-color: #e69a66;
          color: #ffd2b2;
        }

        .account-tools {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 9px;
          margin-top: 14px;
        }

        .account-tools button {
          display: grid;
          gap: 3px;
          text-align: left;
          padding: 12px;
          border: 1px solid #2d3e45;
          border-radius: 8px;
          background: #0d161a;
          color: #b7c1c4;
        }

        .account-tools button:hover { border-color: #4c6872; }
        .account-tools span { font-size: 11px; font-weight: 800; }
        .account-tools small { color: #68767c; font-size: 9px; }

        .divider {
          display: flex;
          align-items: center;
          gap: 12px;
          margin: 24px 0 16px;
          color: #5b6970;
          font-size: 9px;
          font-weight: 900;
          letter-spacing: .12em;
        }

        .divider::before,
        .divider::after {
          content: '';
          height: 1px;
          flex: 1;
          background: #293940;
        }

        .alternate-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 9px;
        }

        .alternate-grid button {
          min-height: 96px;
          display: grid;
          align-content: center;
          gap: 4px;
          text-align: left;
          padding: 14px;
          border-radius: 9px;
          background: #0d161a;
        }

        .access-kicker {
          font-size: 8px;
          font-weight: 900;
          letter-spacing: .13em;
        }

        .alternate-grid strong { color: #d7ddde; font-size: 12px; }
        .alternate-grid small { color: #68767c; font-size: 9px; line-height: 1.35; }
        .training-access { border: 1px solid rgba(216,132,77,.42); }
        .training-access .access-kicker { color: #d8844d; }
        .demo-access { border: 1px solid rgba(76,159,172,.42); }
        .demo-access .access-kicker { color: #4c9fac; }
        .training-access:hover { border-color: rgba(216,132,77,.76); }
        .demo-access:hover { border-color: rgba(76,159,172,.76); }

        .error {
          padding: 10px 12px;
          border: 1px solid rgba(195,109,90,.44);
          border-radius: 7px;
          background: rgba(195,109,90,.08);
          color: #eca08f;
          font-size: 11px;
          line-height: 1.45;
        }

        @media (max-width: 820px) {
          .login-shell { padding: 18px; }
          .login-frame { grid-template-columns: 1fr; }
          .brand-panel { min-height: auto; padding: 26px; border-right: 0; border-bottom: 1px solid #263840; }
          .brand-copy { margin: 46px 0 25px; }
          .brand-copy h1 { font-size: 36px; }
          .brand-foot { display: none; }
          .signin-panel { padding: 32px 26px; }
        }

        @media (max-width: 520px) {
          .login-shell { padding: 0; place-items: stretch; }
          .login-frame { border: 0; border-radius: 0; min-height: 100vh; }
          .brand-panel { padding: 22px; }
          .brand-copy { margin: 34px 0 18px; }
          .brand-copy h1 { font-size: 31px; }
          .mode-stack { display: none; }
          .signin-panel { padding: 30px 22px 38px; }
          .account-tools,
          .alternate-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </main>
  );
}
