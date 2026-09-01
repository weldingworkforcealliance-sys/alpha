'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [supabase] = useState(() =>
    createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
    )
  );

  const [ready, setReady] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const prepare = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');

        if (code) {
          const { error: exchangeError } =
            await supabase.auth.exchangeCodeForSession(code);
          if (!exchangeError) {
            setReady(true);
            return;
          }
        }

        const { data } = await supabase.auth.getSession();
        if (data.session) setReady(true);
      } catch (err) {
        console.error(err);
      }
    };

    prepare();
  }, [supabase]);

  const sendResetCode = async () => {
    setError('');
    setMessage('');

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setError('Enter your email address.');
      return;
    }

    setSaving(true);
    try {
      const { error: sendError } = await supabase.auth.resetPasswordForEmail(
        normalizedEmail,
        { redirectTo: `${window.location.origin}/reset-password` }
      );

      if (sendError) throw sendError;

      setCodeSent(true);
      setMessage('Reset code sent. Check your email, then enter the code below.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send reset code.');
    } finally {
      setSaving(false);
    }
  };

  const verifyResetCode = async () => {
    setError('');
    setMessage('');

    if (!email.trim()) {
      setError('Enter the email address that received the reset code.');
      return;
    }

    if (!/^\d{6,10}$/.test(otp.trim())) {
      setError('Enter the verification code from your email.');
      return;
    }

    setSaving(true);
    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: otp.trim(),
        type: 'recovery',
      });

      if (verifyError) throw verifyError;

      setReady(true);
      setMessage('Code verified. Create your new password below.');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'The verification code could not be verified.'
      );
    } finally {
      setSaving(false);
    }
  };

  const updatePassword = async () => {
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

    setSaving(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;

      await supabase.rpc('activate_my_invited_memberships');

      setMessage('Password updated successfully. Opening your dashboard…');
      window.setTimeout(() => router.push('/dashboard'), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="shell">
      <section className="card">
        <div className="eyebrow">Living Teacher Planner</div>
        <h1>Reset Password</h1>

        {!ready ? (
          <>
            <p>
              Enter your email address. We will send a verification code so you
              can safely create a new password.
            </p>

            {error && <div className="error">{error}</div>}
            {message && <div className="success">{message}</div>}

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

              <button disabled={saving} onClick={sendResetCode}>
                {saving && !codeSent ? 'Sending…' : codeSent ? 'Resend Reset Code' : 'Send Reset Code'}
              </button>

              {codeSent && (
                <>
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

                  <button disabled={saving} onClick={verifyResetCode}>
                    {saving ? 'Verifying…' : 'Verify Code'}
                  </button>
                </>
              )}

              <button className="secondary" onClick={() => router.push('/login')}>
                Back to Sign In
              </button>
            </div>
          </>
        ) : (
          <>
            <p>Create a new password for your Living Teacher Planner account.</p>

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

              <button disabled={saving} onClick={updatePassword}>
                {saving ? 'Updating…' : 'Update Password'}
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
            radial-gradient(circle at 20% 0%, rgba(0,255,136,.08), transparent 28rem),
            #090909;
          color: #e0e0e0;
        }
        .card {
          width: min(470px, 100%);
          padding: 30px;
          border: 1px solid #292929;
          border-radius: 10px;
          background: #151515;
        }
        .eyebrow {
          color: #00ff88;
          text-transform: uppercase;
          letter-spacing: .12em;
          font-size: 11px;
          font-weight: 800;
        }
        h1 { margin: 5px 0 7px; color: #fff; font-size: 28px; }
        p { margin: 0 0 22px; color: #888; line-height: 1.5; }
        .form { display: grid; gap: 16px; }
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
          border-radius: 7px;
          background: #0e0e0e;
          color: #eee;
          font: inherit;
        }
        input:focus { outline: none; border-color: #00ff88; }
        button {
          padding: 12px 15px;
          border: 1px solid rgba(0,255,136,.5);
          border-radius: 7px;
          background: rgba(0,255,136,.08);
          color: #00ff88;
          font-weight: 800;
          cursor: pointer;
        }
        button:disabled { opacity: .5; cursor: not-allowed; }
        .secondary {
          border-color: #333;
          background: #101010;
          color: #aaa;
        }
        .error, .success {
          margin-bottom: 16px;
          padding: 11px 13px;
          border-radius: 7px;
          font-size: 12px;
          line-height: 1.4;
        }
        .error {
          border: 1px solid rgba(255,90,90,.35);
          background: rgba(255,90,90,.08);
          color: #ff8b8b;
        }
        .success {
          border: 1px solid rgba(0,255,136,.3);
          background: rgba(0,255,136,.07);
          color: #80ffbb;
        }
      `}</style>
    </main>
  );
}
