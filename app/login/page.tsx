'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [supabase] = useState(() =>
    createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
    )
  );

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
    <main className="shell">
      <section className="card">
        <div className="eyebrow">Living Teacher Planner</div>
        <h1>Sign In</h1>
        <p className="sub">Live production access</p>

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

          <button className="primary" type="submit" disabled={isLoading}>
            {isLoading ? 'Signing in…' : 'Sign In to Live Platform'}
          </button>
        </form>

        <div className="account-help">
          <button onClick={() => router.push('/account-setup')}>
            <strong>First-Time Setup</strong>
            <span>Use the verification code from your invitation email.</span>
          </button>
          <button onClick={() => router.push('/reset-password')}>
            <strong>Reset Password</strong>
            <span>Already activated? Set a new password by email code.</span>
          </button>
        </div>

        <div className="divider"><span>OR</span></div>

        <div className="alternate-grid">
          <button className="demo" onClick={() => router.push('/demo')}>
            <strong>Try Demo</strong>
            <span>Public · limited sample · nothing saved</span>
          </button>

          <button className="training" onClick={() => router.push('/training/login')}>
            <strong>Training Mode</strong>
            <span>Authorized users · full training workspace</span>
          </button>
        </div>
      </section>

      <style jsx>{`
        .shell {
          min-height: 100vh;
          display: grid;
          place-items: center;
          padding: 24px;
          background:
            radial-gradient(circle at 12% 0%, rgba(0,255,136,.09), transparent 28rem),
            radial-gradient(circle at 88% 12%, rgba(0,180,255,.07), transparent 26rem),
            #080808;
          color: #e8e8e8;
        }
        .card {
          width: min(500px, 100%);
          padding: 32px;
          border: 1px solid #2a2a2a;
          border-radius: 12px;
          background: #141414;
          box-shadow: 0 24px 80px rgba(0,0,0,.35);
        }
        .eyebrow {
          color: #00ff88;
          text-transform: uppercase;
          letter-spacing: .12em;
          font-size: 11px;
          font-weight: 800;
        }
        h1 { margin: 6px 0 2px; color: white; font-size: 32px; }
        .sub { margin: 0 0 24px; color: #888; }
        form { display: grid; gap: 15px; }
        label {
          display: grid;
          gap: 7px;
          color: #aaa;
          font-size: 12px;
          font-weight: 700;
        }
        input {
          width: 100%;
          padding: 12px 13px;
          border: 1px solid #303030;
          border-radius: 8px;
          background: #0d0d0d;
          color: #eee;
          font: inherit;
        }
        input:focus { outline: none; border-color: #00ff88; }
        button { font: inherit; cursor: pointer; }
        button:disabled { opacity: .5; cursor: not-allowed; }
        .primary {
          padding: 13px 15px;
          border-radius: 8px;
          border: 1px solid rgba(0,255,136,.55);
          background: rgba(0,255,136,.08);
          color: #00ff88;
          font-weight: 800;
        }
        .account-help {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-top: 16px;
        }
        .account-help button {
          display: grid;
          gap: 5px;
          text-align: left;
          padding: 13px;
          border: 1px solid #343434;
          border-radius: 8px;
          background: #101010;
          color: #ddd;
        }
        .account-help strong { color: #00ff88; font-size: 13px; }
        .account-help span { color: #888; font-size: 10px; line-height: 1.4; }
        .divider {
          display: flex;
          align-items: center;
          gap: 12px;
          margin: 24px 0 18px;
          color: #666;
          font-size: 10px;
          font-weight: 800;
        }
        .divider::before, .divider::after {
          content: '';
          height: 1px;
          background: #292929;
          flex: 1;
        }
        .alternate-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .alternate-grid button {
          min-height: 94px;
          display: grid;
          align-content: center;
          gap: 5px;
          text-align: left;
          padding: 15px;
          border-radius: 9px;
          background: #101010;
        }
        .alternate-grid strong { font-size: 14px; }
        .alternate-grid span { color: #777; font-size: 10px; line-height: 1.4; }
        .demo { border: 1px solid rgba(0,180,255,.35); color: #55cfff; }
        .training { border: 1px solid rgba(255,154,82,.4); color: #ffad70; }
        .error {
          padding: 10px 12px;
          border: 1px solid rgba(255,80,80,.35);
          border-radius: 7px;
          background: rgba(255,80,80,.08);
          color: #ff9090;
          font-size: 12px;
          line-height: 1.4;
        }
        @media (max-width: 520px) {
          .account-help, .alternate-grid { grid-template-columns: 1fr; }
          .card { padding: 24px; }
        }
      `}</style>
    </main>
  );
}
