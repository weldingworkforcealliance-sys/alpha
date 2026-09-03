'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

interface School {
  id: string;
  name: string;
}

interface Membership {
  school_id: string;
  user_id: string;
  role: string;
  status: string;
}

interface DiagnosticResult {
  exists?: boolean;
  email?: string | null;
  display_name?: string | null;
  membership_exists?: boolean;
  membership_role?: string | null;
  membership_status?: string | null;
  auth_created_at?: string | null;
  auth_invited_at?: string | null;
  confirmation_sent_at?: string | null;
  email_confirmed_at?: string | null;
  confirmed_at?: string | null;
  last_sign_in_at?: string | null;
  account_stage?: string | null;
}

function titleCase(value: string | null | undefined) {
  if (!value) return '—';
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatTimestamp(value: string | null | undefined) {
  if (!value) return 'Not yet';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export default function InvitationDiagnosticsPage() {
  const router = useRouter();

  const [supabase] = useState(() =>
    createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
    )
  );

  const [mailClient] = useState(() =>
    createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      }
    )
  );

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [schools, setSchools] = useState<School[]>([]);
  const [schoolId, setSchoolId] = useState('');
  const [email, setEmail] = useState('');
  const [diagnostic, setDiagnostic] = useState<DiagnosticResult | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const schoolMap = useMemo(
    () => new Map(schools.map((school) => [school.id, school])),
    [schools]
  );

  const isConfirmed = Boolean(
    diagnostic?.email_confirmed_at || diagnostic?.confirmed_at
  );

  const isActive = diagnostic?.membership_status === 'active';
  const isInvited = diagnostic?.membership_status === 'invited';

  useEffect(() => {
    const load = async () => {
      setError('');

      const { data: authData } = await supabase.auth.getSession();
      if (!authData.session) {
        router.replace('/login');
        return;
      }

      const userId = authData.session.user.id;
      const [ownerResult, schoolResult, membershipResult] = await Promise.all([
        supabase.rpc('is_platform_owner'),
        supabase.from('schools').select('id, name').order('name'),
        supabase
          .from('school_memberships')
          .select('school_id, user_id, role, status'),
      ]);

      const firstError = [
        ownerResult.error,
        schoolResult.error,
        membershipResult.error,
      ].find(Boolean);

      if (firstError) {
        throw new Error(firstError?.message ?? 'Diagnostics failed to load.');
      }

      const owner = Boolean(ownerResult.data);
      const memberships = (membershipResult.data ?? []) as Membership[];
      const managementMemberships = memberships.filter(
        (membership) =>
          membership.user_id === userId &&
          membership.status === 'active' &&
          ['school_admin', 'program_lead'].includes(membership.role)
      );

      if (!owner && managementMemberships.length === 0) {
        setAuthorized(false);
        return;
      }

      const allSchools = (schoolResult.data ?? []) as School[];
      const allowedIds = new Set(
        owner
          ? allSchools.map((school) => school.id)
          : managementMemberships.map((membership) => membership.school_id)
      );

      const allowedSchools = allSchools.filter((school) => allowedIds.has(school.id));
      setSchools(allowedSchools);
      setSchoolId((current) => current || allowedSchools[0]?.id || '');
      setAuthorized(true);
    };

    load()
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, [router, supabase]);

  const queryDiagnostic = async (targetEmail: string) => {
    const normalized = targetEmail.trim().toLowerCase();
    if (!schoolId || !normalized) {
      throw new Error('Choose a school and enter an email address.');
    }

    const { data, error: lookupError } = await supabase.rpc(
      'admin_lookup_user_by_email',
      {
        p_school_id: schoolId,
        p_email: normalized,
      }
    );

    if (lookupError) throw lookupError;

    const result = (data ?? {}) as DiagnosticResult;
    setDiagnostic(result);
    return result;
  };

  const checkStatus = async () => {
    setError('');
    setNotice('');
    setDiagnostic(null);
    setBusy(true);

    try {
      await queryDiagnostic(email);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const resendSetup = async () => {
    setError('');
    setNotice('');
    setBusy(true);

    try {
      const normalized = email.trim().toLowerCase();
      const current = await queryDiagnostic(normalized);

      if (!current.exists) {
        throw new Error('No Living Teacher Planner account exists for this email.');
      }

      if (current.membership_status !== 'invited') {
        throw new Error('This school membership is not currently INVITED.');
      }

      if (current.email_confirmed_at || current.confirmed_at) {
        throw new Error(
          'This email is already confirmed. Use Send Password Recovery instead.'
        );
      }

      const { error: resendError } = await mailClient.auth.resend({
        type: 'signup',
        email: normalized,
        options: {
          emailRedirectTo: `${window.location.origin}/account-setup`,
        },
      });

      if (resendError) throw resendError;

      setNotice(
        `Supabase accepted a new setup-email request for ${normalized}. Delivery beyond the mail provider still depends on the recipient's email system.`
      );
      await queryDiagnostic(normalized);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const sendRecovery = async () => {
    setError('');
    setNotice('');
    setBusy(true);

    try {
      const normalized = email.trim().toLowerCase();
      const current = await queryDiagnostic(normalized);

      if (!current.exists) {
        throw new Error('No Living Teacher Planner account exists for this email.');
      }

      if (!(current.email_confirmed_at || current.confirmed_at)) {
        throw new Error('The email is not confirmed yet. Resend Account Setup instead.');
      }

      if (current.membership_status !== 'invited') {
        throw new Error('Password recovery is only needed here for an invited account.');
      }

      const { error: recoveryError } = await mailClient.auth.resetPasswordForEmail(
        normalized,
        { redirectTo: `${window.location.origin}/reset-password` }
      );

      if (recoveryError) throw recoveryError;

      setNotice(
        `Password-recovery email requested for ${normalized}. The Reset Password page also accepts the recovery code from the email.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const copySafeSetupPage = async () => {
    setError('');
    setNotice('');

    try {
      const url = `${window.location.origin}/account-setup`;
      await navigator.clipboard.writeText(url);
      setNotice(
        'Account Setup page copied. If the school email scanner breaks the one-time link, send this plain LTG page separately and have the user enter the verification code from the email.'
      );
    } catch {
      setError('Could not copy the Account Setup page to the clipboard.');
    }
  };

  if (loading) {
    return <main className="loading">Loading invitation diagnostics…</main>;
  }

  if (!authorized) {
    return (
      <main className="loading">
        <div>
          <h1>Access denied</h1>
          <p>Invitation diagnostics require Platform Owner, School Admin, or Program Lead access.</p>
          <button onClick={() => router.push('/dashboard')}>Return to Dashboard</button>
        </div>
      </main>
    );
  }

  const guidance = (() => {
    if (!diagnostic) return '';
    if (!diagnostic.exists) {
      return 'No Auth account exists. Create the user from Account Management before troubleshooting email delivery.';
    }
    if (isActive) {
      return 'The account is active. No invitation recovery action is needed.';
    }
    if (isConfirmed && isInvited) {
      return 'The email is confirmed, but school access is still INVITED. The user likely stopped before creating a password. Send Password Recovery so they can finish setup and activate the membership.';
    }
    if (diagnostic.confirmation_sent_at && !isConfirmed) {
      return 'Supabase generated the setup email, but the email has not been confirmed. If the message is missing, check spam/quarantine or the school mail administrator. If the message arrived but the link fails, use the plain Account Setup page plus the verification code.';
    }
    return 'The Auth account exists, but no setup-email timestamp is recorded. Resend Account Setup.';
  })();

  return (
    <div className="shell">
      <header>
        <div>
          <div className="eyebrow">Living Teacher Planner</div>
          <h1>Invitation Diagnostics</h1>
        </div>
        <div className="actions">
          <button onClick={() => router.push('/accounts')}>Account Management</button>
          <button onClick={() => router.push('/dashboard')}>Teacher Dashboard</button>
        </div>
      </header>

      <main>
        {error && <div className="error">{error}</div>}
        {notice && <div className="notice">{notice}</div>}

        <section className="panel">
          <div className="eyebrow">Diagnostic Target</div>
          <h2>Check an invitation</h2>
          <p>
            This reads LTG membership state and Supabase Auth timestamps without exposing admin keys or confirmation tokens.
          </p>

          <div className="controls">
            <label>
              School
              <select
                value={schoolId}
                onChange={(event) => {
                  setSchoolId(event.target.value);
                  setDiagnostic(null);
                }}
              >
                {schools.map((school) => (
                  <option key={school.id} value={school.id}>
                    {school.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              User Email
              <input
                type="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setDiagnostic(null);
                }}
                placeholder="instructor@school.edu"
              />
            </label>
          </div>

          <div className="button-row">
            <button className="primary" disabled={busy} onClick={checkStatus}>
              {busy ? 'Checking…' : 'Check Invitation Status'}
            </button>
            <button disabled={busy} onClick={resendSetup}>Resend Account Setup</button>
            <button disabled={busy} onClick={sendRecovery}>Send Password Recovery</button>
            <button disabled={busy} onClick={copySafeSetupPage}>Copy Safe Setup Page</button>
          </div>
        </section>

        {diagnostic && (
          <section className="panel">
            <div className="eyebrow">Result</div>
            <h2>
              {diagnostic.exists
                ? diagnostic.display_name || diagnostic.email || 'Existing account'
                : 'Account not found'}
            </h2>

            <div className={`guidance ${isActive ? 'good' : ''}`}>{guidance}</div>

            <div className="stages">
              <div className="stage">
                <span>1</span>
                <strong>Auth Account Created</strong>
                <small>{diagnostic.exists ? formatTimestamp(diagnostic.auth_created_at) : 'No'}</small>
              </div>
              <div className="stage">
                <span>2</span>
                <strong>Setup Email Requested</strong>
                <small>{formatTimestamp(diagnostic.confirmation_sent_at)}</small>
              </div>
              <div className="stage">
                <span>3</span>
                <strong>Email Confirmed</strong>
                <small>{formatTimestamp(diagnostic.email_confirmed_at || diagnostic.confirmed_at)}</small>
              </div>
              <div className="stage">
                <span>4</span>
                <strong>First Login</strong>
                <small>{formatTimestamp(diagnostic.last_sign_in_at)}</small>
              </div>
              <div className="stage">
                <span>5</span>
                <strong>School Access</strong>
                <small>
                  {diagnostic.membership_exists
                    ? `${titleCase(diagnostic.membership_role)} · ${titleCase(diagnostic.membership_status)}`
                    : 'No school membership'}
                </small>
              </div>
            </div>

            <div className="summary-grid">
              <div>
                <span>School</span>
                <strong>{schoolMap.get(schoolId)?.name ?? '—'}</strong>
              </div>
              <div>
                <span>Account Stage</span>
                <strong>{titleCase(diagnostic.account_stage)}</strong>
              </div>
              <div>
                <span>Email</span>
                <strong>{diagnostic.email ?? email.trim().toLowerCase()}</strong>
              </div>
              <div>
                <span>Membership</span>
                <strong>{titleCase(diagnostic.membership_status)}</strong>
              </div>
            </div>
          </section>
        )}

        <section className="panel note-panel">
          <div className="eyebrow">Institutional Email</div>
          <h2>When the school mail system interferes</h2>
          <p>
            LTG can prove that Supabase generated the Auth email, but it cannot prove final inbox delivery after the mail provider accepts it. School Microsoft 365 or security gateways may quarantine the message or inspect a one-time link before the teacher clicks it. The plain Account Setup page plus the email verification code avoids the link-scanner problem without bypassing email verification.
          </p>
        </section>
      </main>

      <style jsx>{`
        .shell { min-height: 100vh; background: #080808; color: #ddd; }
        .loading {
          min-height: 100vh; display: grid; place-items: center; padding: 24px;
          text-align: center; background: #080808; color: #aaa;
        }
        header {
          display: flex; justify-content: space-between; align-items: center; gap: 18px;
          padding: 19px 27px; border-bottom: 1px solid #272727; background: #111;
        }
        .eyebrow {
          color: #00ff88; text-transform: uppercase; letter-spacing: .12em;
          font-size: 10px; font-weight: 900;
        }
        h1, h2, p { margin: 0; }
        h1 { margin-top: 4px; color: #fff; font-size: 24px; }
        h2 { margin: 4px 0 6px; color: #fff; font-size: 20px; }
        p { color: #818181; line-height: 1.55; font-size: 12px; }
        main { width: min(1120px, calc(100% - 28px)); margin: auto; padding: 23px 0 50px; }
        .panel {
          margin-bottom: 16px; padding: 19px; border: 1px solid #292929;
          border-radius: 10px; background: #141414;
        }
        .controls { display: grid; grid-template-columns: .8fr 1.2fr; gap: 12px; margin-top: 15px; }
        label {
          display: grid; gap: 6px; color: #888; font-size: 10px;
          text-transform: uppercase; font-weight: 850;
        }
        input, select {
          width: 100%; padding: 11px 12px; border: 1px solid #303030;
          border-radius: 7px; background: #0d0d0d; color: #eee; font: inherit;
        }
        .actions, .button-row { display: flex; gap: 8px; flex-wrap: wrap; }
        .button-row { margin-top: 14px; }
        button {
          padding: 10px 13px; border-radius: 7px; border: 1px solid #303030;
          background: #151515; color: #ddd; font-weight: 750; cursor: pointer;
        }
        button:hover:not(:disabled) { border-color: #00ff88; color: #00ff88; }
        button:disabled { opacity: .45; cursor: not-allowed; }
        .primary {
          color: #00ff88; border-color: rgba(0,255,136,.45);
          background: rgba(0,255,136,.06);
        }
        .error, .notice, .guidance {
          margin-bottom: 14px; padding: 11px 13px; border-radius: 7px;
          font-size: 12px; line-height: 1.45;
        }
        .error { color: #ff9090; border: 1px solid rgba(255,80,80,.3); background: rgba(255,80,80,.07); }
        .notice { color: #80ffbb; border: 1px solid rgba(0,255,136,.3); background: rgba(0,255,136,.06); }
        .guidance { margin-top: 14px; color: #8fdcff; border: 1px solid rgba(60,180,255,.28); background: rgba(60,180,255,.06); }
        .guidance.good { color: #80ffbb; border-color: rgba(0,255,136,.3); background: rgba(0,255,136,.06); }
        .stages { display: grid; grid-template-columns: repeat(5, 1fr); gap: 9px; margin-top: 14px; }
        .stage {
          min-height: 118px; padding: 12px; border: 1px solid #292929;
          border-radius: 8px; background: #101010; display: grid; align-content: start; gap: 7px;
        }
        .stage > span {
          width: 24px; height: 24px; display: grid; place-items: center;
          border-radius: 50%; background: rgba(0,255,136,.08); color: #00ff88;
          font-size: 11px; font-weight: 900;
        }
        .stage strong { color: #ddd; font-size: 11px; }
        .stage small { color: #727272; line-height: 1.35; }
        .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 9px; margin-top: 12px; }
        .summary-grid > div {
          padding: 11px; border: 1px solid #292929; border-radius: 7px; background: #101010;
          display: grid; gap: 4px;
        }
        .summary-grid span { color: #686868; font-size: 9px; text-transform: uppercase; }
        .summary-grid strong { color: #d8d8d8; font-size: 12px; overflow-wrap: anywhere; }
        .note-panel { border-color: rgba(60,180,255,.2); }
        @media(max-width:900px) {
          .stages { grid-template-columns: 1fr 1fr; }
          .summary-grid { grid-template-columns: 1fr 1fr; }
        }
        @media(max-width:650px) {
          header { align-items: flex-start; flex-direction: column; }
          .controls, .stages, .summary-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}
