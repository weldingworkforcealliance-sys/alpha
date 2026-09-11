'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase-browser';

export default function AccountSetupPage() {
  const router = useRouter();

  const [supabase] = useState(getSupabase);

  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    const prepare = async () => {
      setError('');

      try {
        /*
          Supabase's built-in confirmation email uses the implicit browser
          flow when the account is created by the isolated signup client in
          /accounts. After verification, Supabase redirects to this page with
          access_token and refresh_token in the URL fragment. The SSR browser
          client does not consume those implicit-flow tokens automatically, so
          establish the session explicitly here.
        */
        const hashParams = new URLSearchParams(
          window.location.hash.startsWith('#')
            ? window.location.hash.slice(1)
            : window.location.hash
        );
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        const hashError = hashParams.get('error_description');

        if (hashError) {
          throw new Error(hashError);
        }

        if (accessToken && refreshToken) {
          const { data: sessionData, error: sessionError } =
            await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });

          if (sessionError) {
            throw sessionError;
          }

          if (sessionData.user?.email) {
            setEmail(sessionData.user.email);
          }

          window.history.replaceState({}, '', window.location.pathname);
          setReady(true);
          setMessage('Invitation link verified. Create your password below.');
          return;
        }

        const params = new URLSearchParams(window.location.search);
        const tokenHash = params.get('token_hash');
        const code = params.get('code');

        // Future-compatible token-hash flow for custom SMTP/templates.
        if (tokenHash) {
          const { data: verifyData, error: verifyError } =
            await supabase.auth.verifyOtp({
              token_hash: tokenHash,
              type: 'email',
            });

          if (verifyError) {
            throw verifyError;
          }

          if (verifyData.user?.email) {
            setEmail(verifyData.user.email);
          }

          window.history.replaceState({}, '', window.location.pathname);
          setReady(true);
          setMessage('Invitation link verified. Create your password below.');
          return;
        }

        // Legacy PKCE callback support.
        if (code) {
          const { error: exchangeError } =
            await supabase.auth.exchangeCodeForSession(code);

          if (!exchangeError) {
            const { data: userData } = await supabase.auth.getUser();
            if (userData.user?.email) {
              setEmail(userData.user.email);
            }
            window.history.replaceState({}, '', window.location.pathname);
            setReady(true);
            setMessage('Invitation link verified. Create your password below.');
            return;
          }
        }

        const { data } = await supabase.auth.getSession();

        if (data.session) {
          if (data.session.user.email) {
            setEmail(data.session.user.email);
          }
          setReady(true);
          setMessage('Invitation link verified. Create your password below.');
        }
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'This invitation link could not be verified. Request a new invitation.'
        );
      }
    };

    prepare();
  }, [supabase]);

  const verifyCode = async () => {
    setError('');
    setMessage('');

    if (!email.trim()) {
      setError('Enter the email address that received the invitation.');
      return;
    }

    if (!/^\d{6,10}$/.test(otp.trim())) {
      setError('Enter the verification code from your email.');
      return;
    }

    setBusy(true);

    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: otp.trim(),
        type: 'email',
      });

      if (verifyError) throw verifyError;

      setReady(true);
      setMessage('Email verified. Create your password below.');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'The verification code could not be verified.'
      );
    } finally {
      setBusy(false);
    }
  };

  const finishSetup = async () => {
    setError('');
    setMessage('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setBusy(true);

    try {
      const { error: passwordError } = await supabase.auth.updateUser({
        password,
      });

      if (passwordError) throw passwordError;

      const { data: activatedCount, error: activateError } =
        await supabase.rpc('activate_my_invited_memberships');

      if (activateError) throw activateError;

      setMessage(
        `${activatedCount ?? 0} school membership${
          activatedCount === 1 ? '' : 's'
        } activated. Opening your dashboard…`
      );

      window.setTimeout(() => {
        router.push('/dashboard');
      }, 1300);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="shell">
      <section className="card">
        <div className="eyebrow">Living Teacher Planner</div>
        <h1>Complete Account Setup</h1>

        {!ready ? (
          <>
            <p>
              Open the invitation email and click its confirmation link. That is
              the normal setup path. If your email includes a numeric verification
              code instead, you can enter it below.
            </p>

            <div className="info">
              No code in the email? That is normal for link-based invitations.
              Use the confirmation link in the email and this page will continue
              to password setup automatically.
            </div>

            {error && <div className="error">{error}</div>}
            {message && <div className="success">{message}</div>}

            <div className="fallback-label">Optional code fallback</div>
            <div className="form">
              <label>
                Email
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </label>

              <label>
                Verification Code
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={10}
                  value={otp}
                  onChange={(e) =>
                    setOtp(e.target.value.replace(/\D/g, '').slice(0, 10))
                  }
                  autoComplete="one-time-code"
                />
              </label>

              <button disabled={busy} onClick={verifyCode}>
                {busy ? 'Verifying…' : 'Verify Code'}
              </button>
            </div>
          </>
        ) : (
          <>
            <p>
              Create your password. Your invited school access becomes active
              after this step is completed.
            </p>

            {error && <div className="error">{error}</div>}
            {message && <div className="success">{message}</div>}

            <div className="form">
              <label>
                New Password
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </label>

              <label>
                Confirm Password
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </label>

              <button disabled={busy} onClick={finishSetup}>
                {busy ? 'Activating Account…' : 'Activate My Account'}
              </button>
            </div>
          </>
        )}
      </section>

      <style jsx>{`
        .shell {
          min-height: 100vh;
          display: grid;
          place-items: center;
          padding: 24px;
          background:
            radial-gradient(
              circle at 20% 0%,
              rgba(0, 255, 136, 0.08),
              transparent 28rem
            ),
            #080808;
          color: #ddd;
        }

        .card {
          width: min(470px, 100%);
          padding: 30px;
          border: 1px solid #292929;
          border-radius: 11px;
          background: #141414;
        }

        .eyebrow {
          color: #00ff88;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          font-size: 10px;
          font-weight: 900;
        }

        h1 {
          margin: 5px 0 7px;
          color: white;
          font-size: 28px;
        }

        p {
          color: #888;
          line-height: 1.5;
          margin: 0 0 20px;
        }

        .info {
          margin-bottom: 18px;
          padding: 11px;
          border: 1px solid #2f3a3a;
          border-radius: 7px;
          background: #101616;
          color: #a8c5c5;
          font-size: 13px;
          line-height: 1.45;
        }

        .fallback-label {
          margin: 18px 0 10px;
          color: #777;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          font-size: 10px;
          font-weight: 850;
        }

        .form {
          display: grid;
          gap: 15px;
        }

        label {
          display: grid;
          gap: 7px;
          color: #aaa;
          font-size: 12px;
          font-weight: 750;
        }

        input {
          padding: 12px;
          border: 1px solid #303030;
          border-radius: 7px;
          background: #0d0d0d;
          color: #eee;
          font: inherit;
        }

        button {
          padding: 12px;
          border: 1px solid rgba(0, 255, 136, 0.5);
          border-radius: 7px;
          background: rgba(0, 255, 136, 0.07);
          color: #00ff88;
          font-weight: 850;
          cursor: pointer;
        }

        button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .error,
        .success {
          margin-bottom: 16px;
          padding: 11px;
          border-radius: 7px;
          font-size: 13px;
          line-height: 1.4;
        }

        .error {
          border: 1px solid rgba(255, 80, 80, 0.4);
          background: rgba(255, 80, 80, 0.08);
          color: #ff9898;
        }

        .success {
          border: 1px solid rgba(0, 255, 136, 0.35);
          background: rgba(0, 255, 136, 0.07);
          color: #7dffbd;
        }
      `}</style>
    </main>
  );
}
