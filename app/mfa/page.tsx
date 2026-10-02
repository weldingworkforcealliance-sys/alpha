'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase-browser';
import { safePostLoginRoute } from '@/lib/auth-routes';
import { formatError } from '@/lib/format-error';

type Mode = 'loading' | 'challenge' | 'enroll' | 'ready';

const REQUIRE_MFA = process.env.NEXT_PUBLIC_REQUIRE_MFA === 'true';

function requestedNext() {
  if (typeof window === 'undefined') return '/dashboard';
  return safePostLoginRoute(new URLSearchParams(window.location.search).get('next'));
}

export default function MfaPage() {
  const router = useRouter();
  const [supabase] = useState(getSupabase);
  const [mode, setMode] = useState<Mode>('loading');
  const [factorId, setFactorId] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const finish = async () => {
    const { error: activationError } = await supabase.rpc('activate_my_invited_memberships');
    if (activationError) throw activationError;

    const next = requestedNext();
    router.replace(next);
    router.refresh();
  };

  useEffect(() => {
    const prepare = async () => {
      setError('');

      try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;

        if (!sessionData.session) {
          const next = encodeURIComponent(requestedNext());
          router.replace(`/login?next=${next}`);
          return;
        }

        const { data: aal, error: aalError } =
          await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (aalError) throw aalError;

        if (aal.currentLevel === 'aal2') {
          setMode('ready');
          await finish();
          return;
        }

        const factors = await supabase.auth.mfa.listFactors();
        if (factors.error) throw factors.error;

        const verifiedTotp = factors.data.totp.find(
          (factor: { id: string; status?: string }) => factor.status === 'verified'
        );

        if (verifiedTotp) {
          setFactorId(verifiedTotp.id);
          setMode('challenge');
          return;
        }

        const forceEnroll =
          REQUIRE_MFA ||
          (typeof window !== 'undefined' &&
            new URLSearchParams(window.location.search).get('enroll') === '1');

        if (!forceEnroll) {
          await finish();
          return;
        }

        const staleFactors = factors.data.totp.filter(
          (factor: { id: string; status?: string }) => factor.status !== 'verified'
        );
        for (const factor of staleFactors) {
          const cleanup = await supabase.auth.mfa.unenroll({ factorId: factor.id });
          if (cleanup.error) throw cleanup.error;
        }

        const enrollment = await supabase.auth.mfa.enroll({
          factorType: 'totp',
          friendlyName: 'LTG Authenticator',
        });
        if (enrollment.error) throw enrollment.error;

        setFactorId(enrollment.data.id);
        setQrCode(enrollment.data.totp.qr_code);
        setSecret(enrollment.data.totp.secret);
        setMode('enroll');
      } catch (err) {
        console.error(err);
        setError(formatError(err, 'Multi-factor authentication could not be prepared.'));
        setMode('ready');
      }
    };

    void prepare();
    // finish intentionally resolves the current invite only after AAL2 is reached.
  }, [router, supabase]);

  const verify = async () => {
    setError('');

    if (!/^\d{6,8}$/.test(code.trim())) {
      setError('Enter the code shown in your authenticator app.');
      return;
    }

    if (!factorId) {
      setError('No authenticator factor is available. Reload this page and try again.');
      return;
    }

    setBusy(true);

    try {
      const challenge = await supabase.auth.mfa.challenge({ factorId });
      if (challenge.error) throw challenge.error;

      const verification = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.data.id,
        code: code.trim(),
      });
      if (verification.error) throw verification.error;

      const { data: aal, error: aalError } =
        await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aalError) throw aalError;
      if (aal.currentLevel !== 'aal2') {
        throw new Error('The second authentication factor was not confirmed.');
      }

      await finish();
    } catch (err) {
      console.error(err);
      setError(formatError(err, 'The authenticator code could not be verified.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mfa-shell">
      <section className="mfa-card">
        <div className="eyebrow">LTG Account Security</div>
        <h1>Multi-Factor Authentication</h1>

        {mode === 'loading' && <p>Checking your account security…</p>}

        {mode === 'challenge' && (
          <>
            <p>
              Your account is protected with an authenticator app. Enter the current
              code to continue into LTG.
            </p>
            <div className="form">
              <label>
                Authenticator Code
                <input
                  value={code}
                  onChange={(event) =>
                    setCode(event.target.value.replace(/\D/g, '').slice(0, 8))
                  }
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  disabled={busy}
                  autoFocus
                />
              </label>
              {error && <div className="error">{error}</div>}
              <button type="button" onClick={verify} disabled={busy}>
                {busy ? 'Verifying…' : 'Verify and Continue'}
              </button>
            </div>
          </>
        )}

        {mode === 'enroll' && (
          <>
            <p>
              Scan this QR code with Microsoft Authenticator, Google Authenticator,
              1Password, or another TOTP-compatible authenticator. Then enter the
              generated code below.
            </p>

            {qrCode && (
              <div className="qr-wrap">
                <Image
                  src={qrCode}
                  alt="QR code for LTG multi-factor authentication"
                  width={220}
                  height={220}
                  unoptimized
                />
              </div>
            )}

            {secret && (
              <div className="secret">
                <span>Manual setup key</span>
                <code>{secret}</code>
              </div>
            )}

            <div className="form">
              <label>
                Authenticator Code
                <input
                  value={code}
                  onChange={(event) =>
                    setCode(event.target.value.replace(/\D/g, '').slice(0, 8))
                  }
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  disabled={busy}
                  autoFocus
                />
              </label>
              {error && <div className="error">{error}</div>}
              <button type="button" onClick={verify} disabled={busy}>
                {busy ? 'Enabling MFA…' : 'Enable MFA and Continue'}
              </button>
            </div>
          </>
        )}

        {mode === 'ready' && error && <div className="error">{error}</div>}
      </section>

      <style jsx>{`
        .mfa-shell {
          min-height: 100vh;
          display: grid;
          place-items: center;
          padding: 24px;
          background: #0a1115;
          color: #e8ecec;
        }

        .mfa-card {
          width: min(520px, 100%);
          padding: 30px;
          border: 1px solid #31444c;
          border-radius: 12px;
          background: #10191e;
          box-shadow: 0 28px 80px rgba(0, 0, 0, .4);
        }

        .eyebrow {
          color: #d8844d;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: .14em;
          text-transform: uppercase;
        }

        h1 {
          margin: 7px 0 10px;
          color: #f0ece5;
          font-size: 28px;
        }

        p {
          margin: 0 0 20px;
          color: #96a4a9;
          line-height: 1.6;
        }

        .qr-wrap {
          width: fit-content;
          margin: 0 auto 18px;
          padding: 10px;
          border-radius: 10px;
          background: white;
        }

        .secret {
          display: grid;
          gap: 6px;
          margin-bottom: 18px;
          padding: 12px;
          border: 1px solid #2c3f46;
          border-radius: 8px;
          background: #0b1317;
        }

        .secret span {
          color: #78898f;
          font-size: 10px;
          font-weight: 850;
          text-transform: uppercase;
          letter-spacing: .08em;
        }

        code {
          overflow-wrap: anywhere;
          color: #d7e4e6;
          font-size: 12px;
        }

        .form {
          display: grid;
          gap: 14px;
        }

        label {
          display: grid;
          gap: 7px;
          color: #aab5b9;
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: .04em;
        }

        input {
          min-height: 46px;
          padding: 12px 13px;
          border: 1px solid #31444c;
          border-radius: 8px;
          background: #0b1317;
          color: #ece8e2;
          font: inherit;
          letter-spacing: .16em;
        }

        button {
          min-height: 46px;
          border: 1px solid rgba(216, 132, 77, .65);
          border-radius: 8px;
          background: rgba(169, 106, 72, .15);
          color: #f0b88e;
          font-weight: 850;
          cursor: pointer;
        }

        button:disabled {
          opacity: .55;
          cursor: not-allowed;
        }

        .error {
          padding: 11px 12px;
          border: 1px solid rgba(195, 109, 90, .44);
          border-radius: 7px;
          background: rgba(195, 109, 90, .08);
          color: #eca08f;
          font-size: 12px;
          line-height: 1.45;
        }
      `}</style>
    </main>
  );
}
