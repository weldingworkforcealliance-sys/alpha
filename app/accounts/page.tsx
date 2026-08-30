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
  id: string;
  school_id: string;
  user_id: string;
  role: string;
  status: string;
}

interface Profile {
  id: string;
  display_name: string | null;
  email: string | null;
}

function titleCase(value: string | null | undefined) {
  if (!value) return '—';
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function makeTemporaryPassword() {
  const chars =
    'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*';
  const bytes = new Uint32Array(32);
  crypto.getRandomValues(bytes);

  let result = 'Aa1!';
  for (let i = 0; i < 28; i += 1) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

export default function AccountManagementPage() {
  const router = useRouter();

  const [supabase] = useState(() =>
    createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
    )
  );

  /*
    This second client is intentionally isolated from the administrator's
    existing browser session. It is used only to create the new Auth account
    through Supabase's normal public signup flow.

    It does not store the new user's session in the administrator's browser.
  */
  const [signupClient] = useState(() =>
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
  const [isOwner, setIsOwner] = useState(false);
  const [currentUserId, setCurrentUserId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [schools, setSchools] = useState<School[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);

  const [schoolId, setSchoolId] = useState('');
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState('instructor');
  const [newReason, setNewReason] = useState('New school user invitation');

  const [existingEmail, setExistingEmail] = useState('');
  const [existingRole, setExistingRole] = useState('instructor');
  const [existingReason, setExistingReason] = useState(
    'Existing user added to school'
  );
  const [lookupResult, setLookupResult] = useState<Record<string, unknown> | null>(
    null
  );

  const [resendEmail, setResendEmail] = useState('');

  const schoolMap = useMemo(
    () => new Map(schools.map((school) => [school.id, school])),
    [schools]
  );

  const profileMap = useMemo(
    () => new Map(profiles.map((profile) => [profile.id, profile])),
    [profiles]
  );

  const selectedSchoolMemberships = useMemo(
    () =>
      memberships.filter(
        (membership) =>
          !schoolId || membership.school_id === schoolId
      ),
    [memberships, schoolId]
  );

  const roleOptions = useMemo(() => {
    if (isOwner) {
      return [
        'school_admin',
        'program_lead',
        'lead_instructor',
        'instructor',
        'viewer',
      ];
    }

    const currentUserMembership = memberships.find(
      (membership) =>
        membership.school_id === schoolId &&
        membership.status === 'active' &&
        membership.user_id === currentUserId
    );

    if (currentUserMembership?.role === 'school_admin') {
      return ['lead_instructor', 'instructor', 'viewer'];
    }

    if (currentUserMembership?.role === 'program_lead') {
      return ['instructor', 'viewer'];
    }

    return [];
  }, [isOwner, memberships, schoolId, currentUserId]);

  const load = async () => {
    setError('');

    const { data: authData } = await supabase.auth.getSession();

    if (!authData.session) {
      router.replace('/login');
      return;
    }

    const userId = authData.session.user.id;

    setCurrentUserId(userId);

    const [ownerResult, schoolResult, membershipResult, profileResult] =
      await Promise.all([
        supabase.rpc('is_platform_owner'),
        supabase.from('schools').select('id, name').order('name'),
        supabase
          .from('school_memberships')
          .select('id, school_id, user_id, role, status'),
        supabase
          .from('profiles')
          .select('id, display_name, email')
          .order('display_name'),
      ]);

    const firstError = [
      ownerResult.error,
      schoolResult.error,
      membershipResult.error,
      profileResult.error,
    ].find(Boolean);

    if (firstError) {
      throw new Error(firstError?.message ?? 'Account management failed to load.');
    }

    const owner = Boolean(ownerResult.data);
    const loadedMemberships = (membershipResult.data ?? []) as Membership[];

    const managementMemberships = loadedMemberships.filter(
      (membership) =>
        membership.user_id === userId &&
        membership.status === 'active' &&
        ['school_admin', 'program_lead'].includes(membership.role)
    );

    if (!owner && managementMemberships.length === 0) {
      setAuthorized(false);
      return;
    }

    const allowedSchoolIds = new Set(
      owner
        ? ((schoolResult.data ?? []) as School[]).map((school) => school.id)
        : managementMemberships.map((membership) => membership.school_id)
    );

    const allowedSchools = ((schoolResult.data ?? []) as School[]).filter(
      (school) => allowedSchoolIds.has(school.id)
    );

    setAuthorized(true);
    setIsOwner(owner);
    setSchools(allowedSchools);
    setMemberships(loadedMemberships);
    setProfiles((profileResult.data ?? []) as Profile[]);

    if (!schoolId && allowedSchools[0]) {
      setSchoolId(allowedSchools[0].id);
    }
  };

  useEffect(() => {
    load()
      .catch((err) =>
        setError(err instanceof Error ? err.message : String(err))
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (roleOptions.length > 0 && !roleOptions.includes(newRole)) {
      setNewRole(roleOptions[0]);
    }
    if (roleOptions.length > 0 && !roleOptions.includes(existingRole)) {
      setExistingRole(roleOptions[0]);
    }
  }, [roleOptions]);

  const inviteNewUser = async () => {
    setError('');
    setNotice('');

    if (!schoolId || !newName.trim() || !newEmail.trim() || !newReason.trim()) {
      setError('School, name, email, role, and reason are required.');
      return;
    }

    if (!roleOptions.includes(newRole)) {
      setError('You do not have permission to assign that role.');
      return;
    }

    setBusy(true);

    try {
      const email = newEmail.trim().toLowerCase();

      /*
        First ensure we are not accidentally creating a duplicate account.
      */
      const { data: lookupData, error: lookupError } = await supabase.rpc(
        'admin_lookup_user_by_email',
        {
          p_school_id: schoolId,
          p_email: email,
        }
      );

      if (lookupError) throw lookupError;

      const lookup = (lookupData ?? {}) as Record<string, unknown>;

      if (lookup.exists) {
        setLookupResult(lookup);
        throw new Error(
          'An account already exists for this email. Use Add Existing User instead.'
        );
      }

      const temporaryPassword = makeTemporaryPassword();

      const { data: signupData, error: signupError } =
        await signupClient.auth.signUp({
          email,
          password: temporaryPassword,
          options: {
            emailRedirectTo: `${window.location.origin}/account-setup`,
            data: {
              display_name: newName.trim(),
            },
          },
        });

      if (signupError) throw signupError;

      if (!signupData.user?.id) {
        throw new Error('Supabase did not return the new user account ID.');
      }

      /*
        The admin session now associates the newly created Auth account
        with the school as INVITED.
      */
      const { error: prepareError } = await supabase.rpc(
        'admin_prepare_invited_user',
        {
          p_school_id: schoolId,
          p_user_id: signupData.user.id,
          p_email: email,
          p_display_name: newName.trim(),
          p_role: newRole,
          p_reason: newReason.trim(),
        }
      );

      if (prepareError) throw prepareError;

      setNotice(
        `Invitation created for ${email}. The account remains INVITED until the user completes account setup.`
      );

      setNewName('');
      setNewEmail('');
      setLookupResult(null);

      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const lookupExisting = async () => {
    setError('');
    setNotice('');
    setLookupResult(null);

    if (!schoolId || !existingEmail.trim()) {
      setError('Choose a school and enter the existing user email.');
      return;
    }

    setBusy(true);

    try {
      const { data, error: lookupError } = await supabase.rpc(
        'admin_lookup_user_by_email',
        {
          p_school_id: schoolId,
          p_email: existingEmail.trim().toLowerCase(),
        }
      );

      if (lookupError) throw lookupError;

      setLookupResult((data ?? {}) as Record<string, unknown>);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const addExisting = async () => {
    setError('');
    setNotice('');

    if (
      !schoolId ||
      !existingEmail.trim() ||
      !existingReason.trim() ||
      !roleOptions.includes(existingRole)
    ) {
      setError('Email, role, and reason are required.');
      return;
    }

    setBusy(true);

    try {
      const { error: addError } = await supabase.rpc(
        'admin_add_existing_user_to_school',
        {
          p_school_id: schoolId,
          p_email: existingEmail.trim().toLowerCase(),
          p_role: existingRole,
          p_reason: existingReason.trim(),
        }
      );

      if (addError) throw addError;

      setNotice(
        `${existingEmail.trim().toLowerCase()} now has active access to ${
          schoolMap.get(schoolId)?.name ?? 'the selected school'
        }.`
      );

      setExistingEmail('');
      setLookupResult(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const resendSetupEmail = async () => {
    setError('');
    setNotice('');

    if (!resendEmail.trim()) {
      setError('Enter the invited user email.');
      return;
    }

    setBusy(true);

    try {
      const email = resendEmail.trim().toLowerCase();

      const { data: lookupData, error: lookupError } = await supabase.rpc(
        'admin_lookup_user_by_email',
        {
          p_school_id: schoolId,
          p_email: email,
        }
      );

      if (lookupError) throw lookupError;

      const lookup = (lookupData ?? {}) as Record<string, unknown>;

      if (!lookup.exists) {
        throw new Error('No Living Teacher Planner account exists for this email.');
      }

      if (lookup.membership_status !== 'invited') {
        throw new Error(
          'This school membership is not currently in INVITED status.'
        );
      }

      const { error: resendError } = await signupClient.auth.resend({
        type: 'signup',
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/account-setup`,
        },
      });

      if (resendError) throw resendError;

      setNotice(`Setup email resent to ${email}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <main className="loading">Loading account management…</main>;
  }

  if (!authorized) {
    return (
      <main className="loading">
        <div>
          <h1>Access denied</h1>
          <p>Account management requires Platform Owner, School Admin, or Program Lead access.</p>
          <button onClick={() => router.push('/dashboard')}>Return to Dashboard</button>
        </div>
      </main>
    );
  }

  return (
    <div className="shell">
      <header>
        <div>
          <div className="eyebrow">Living Teacher Planner</div>
          <h1>Account Management</h1>
        </div>

        <div className="actions">
          {isOwner && <button onClick={() => router.push('/owner')}>Owner Dashboard</button>}
          <button onClick={() => router.push('/school')}>School Dashboard</button>
          <button onClick={() => router.push('/dashboard')}>Teacher Dashboard</button>
        </div>
      </header>

      <main>
        {error && <div className="error">{error}</div>}
        {notice && <div className="notice">{notice}</div>}

        <section className="school-bar">
          <label>
            School
            <select value={schoolId} onChange={(e) => setSchoolId(e.target.value)}>
              {schools.map((school) => (
                <option key={school.id} value={school.id}>
                  {school.name}
                </option>
              ))}
            </select>
          </label>
          <span>
            Managing accounts for <strong>{schoolMap.get(schoolId)?.name ?? 'school'}</strong>
          </span>
        </section>

        <div className="grid">
          <section className="panel">
            <div className="eyebrow">New Account</div>
            <h2>Invite New User</h2>
            <p>
              Creates a new Supabase login account and an INVITED school membership.
              The user completes setup from the email link and chooses their own password.
            </p>

            <label>
              Full Name
              <input value={newName} onChange={(e) => setNewName(e.target.value)} />
            </label>

            <label>
              Email
              <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
            </label>

            <label>
              School Role
              <select value={newRole} onChange={(e) => setNewRole(e.target.value)}>
                {roleOptions.map((role) => (
                  <option key={role} value={role}>
                    {titleCase(role)}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Audit Reason
              <textarea value={newReason} onChange={(e) => setNewReason(e.target.value)} />
            </label>

            <button className="primary full" disabled={busy || roleOptions.length === 0} onClick={inviteNewUser}>
              Send New User Invitation
            </button>
          </section>

          <section className="panel">
            <div className="eyebrow">Existing Login</div>
            <h2>Add Existing User</h2>
            <p>
              Use this when the person already has a Living Teacher Planner account.
              One login can belong to multiple schools.
            </p>

            <label>
              Existing Account Email
              <input
                type="email"
                value={existingEmail}
                onChange={(e) => setExistingEmail(e.target.value)}
              />
            </label>

            <button disabled={busy} onClick={lookupExisting}>
              Check Account
            </button>

            {lookupResult && (
              <div className="lookup">
                <strong>
                  {lookupResult.exists ? 'Account found' : 'No account found'}
                </strong>

                {Boolean(lookupResult.exists) && (
                  <>
                    <span>
                      {String(
                        lookupResult.display_name ??
                          lookupResult.email ??
                          'Existing user'
                      )}
                    </span>
                    <span>
                      School membership:{' '}
                      {lookupResult.membership_exists
                        ? `${titleCase(String(lookupResult.membership_role ?? ''))} · ${titleCase(
                            String(lookupResult.membership_status ?? '')
                          )}`
                        : 'None'}
                    </span>
                  </>
                )}
              </div>
            )}

            <label>
              School Role
              <select
                value={existingRole}
                onChange={(e) => setExistingRole(e.target.value)}
              >
                {roleOptions.map((role) => (
                  <option key={role} value={role}>
                    {titleCase(role)}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Audit Reason
              <textarea
                value={existingReason}
                onChange={(e) => setExistingReason(e.target.value)}
              />
            </label>

            <button
              className="primary full"
              disabled={
                busy ||
                !lookupResult ||
                !Boolean(lookupResult.exists) ||
                roleOptions.length === 0
              }
              onClick={addExisting}
            >
              Add / Reactivate Existing User
            </button>
          </section>
        </div>

        <section className="panel">
          <div className="eyebrow">Invitation Help</div>
          <h2>Resend Account Setup Email</h2>
          <p>
            Resends the Supabase signup confirmation/setup email for a user whose
            school membership is still INVITED.
          </p>

          <div className="inline">
            <input
              type="email"
              value={resendEmail}
              onChange={(e) => setResendEmail(e.target.value)}
              placeholder="instructor@school.edu"
            />
            <button disabled={busy} onClick={resendSetupEmail}>
              Resend Setup Email
            </button>
          </div>
        </section>

        <section className="panel">
          <div className="eyebrow">Current School Access</div>
          <h2>Members</h2>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {selectedSchoolMemberships.map((membership) => {
                  const profile = profileMap.get(membership.user_id);
                  return (
                    <tr key={membership.id}>
                      <td>{profile?.display_name ?? 'Unnamed User'}</td>
                      <td>{profile?.email ?? '—'}</td>
                      <td>{titleCase(membership.role)}</td>
                      <td>
                        <span className={`status ${membership.status}`}>
                          {titleCase(membership.status)}
                        </span>
                      </td>
                    </tr>
                  );
                })}

                {selectedSchoolMemberships.length === 0 && (
                  <tr>
                    <td colSpan={4} className="empty">
                      No members found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      <style jsx>{`
        .shell {
          min-height: 100vh;
          background: #080808;
          color: #ddd;
        }

        .loading {
          min-height: 100vh;
          display: grid;
          place-items: center;
          padding: 24px;
          text-align: center;
          background: #080808;
          color: #aaa;
        }

        header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 20px;
          padding: 19px 27px;
          border-bottom: 1px solid #272727;
          background: #111;
        }

        .eyebrow {
          color: #00ff88;
          text-transform: uppercase;
          letter-spacing: .12em;
          font-size: 10px;
          font-weight: 900;
        }

        h1, h2, p {
          margin: 0;
        }

        h1 {
          margin-top: 4px;
          color: white;
          font-size: 24px;
        }

        h2 {
          margin: 4px 0 6px;
          color: white;
          font-size: 20px;
        }

        p {
          color: #818181;
          line-height: 1.5;
          font-size: 12px;
        }

        .actions,
        .inline {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        button {
          padding: 10px 13px;
          border-radius: 7px;
          border: 1px solid #303030;
          background: #151515;
          color: #ddd;
          font-weight: 750;
          cursor: pointer;
        }

        button:hover:not(:disabled) {
          border-color: #00ff88;
          color: #00ff88;
        }

        button:disabled {
          opacity: .45;
          cursor: not-allowed;
        }

        .primary {
          color: #00ff88;
          border-color: rgba(0,255,136,.45);
          background: rgba(0,255,136,.06);
        }

        .full {
          width: 100%;
          margin-top: 12px;
        }

        main {
          width: min(1200px, calc(100% - 28px));
          margin: auto;
          padding: 23px 0 50px;
        }

        .school-bar,
        .panel {
          padding: 19px;
          border: 1px solid #292929;
          border-radius: 10px;
          background: #141414;
        }

        .school-bar {
          display: flex;
          justify-content: space-between;
          gap: 20px;
          align-items: end;
          margin-bottom: 16px;
        }

        .school-bar label {
          min-width: 300px;
          margin: 0;
        }

        .school-bar > span {
          color: #777;
          font-size: 12px;
        }

        .school-bar strong {
          color: #ddd;
        }

        .grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          margin-bottom: 16px;
        }

        .panel {
          margin-bottom: 16px;
        }

        label {
          display: grid;
          gap: 6px;
          margin-top: 13px;
          color: #888;
          font-size: 10px;
          text-transform: uppercase;
          font-weight: 850;
        }

        input, select, textarea {
          width: 100%;
          padding: 11px 12px;
          border: 1px solid #303030;
          border-radius: 7px;
          background: #0d0d0d;
          color: #eee;
          font: inherit;
        }

        textarea {
          min-height: 70px;
          resize: vertical;
        }

        .lookup {
          display: grid;
          gap: 4px;
          margin-top: 10px;
          padding: 11px;
          border: 1px solid #2b2b2b;
          border-radius: 7px;
          background: #101010;
          color: #888;
          font-size: 11px;
        }

        .lookup strong {
          color: #ddd;
        }

        .inline {
          margin-top: 14px;
        }

        .inline input {
          flex: 1;
          min-width: 260px;
        }

        .table-wrap {
          overflow-x: auto;
          margin-top: 15px;
        }

        table {
          width: 100%;
          min-width: 720px;
          border-collapse: collapse;
        }

        th, td {
          padding: 11px 12px;
          text-align: left;
          border-bottom: 1px solid #282828;
        }

        th {
          color: #666;
          font-size: 9px;
          text-transform: uppercase;
          letter-spacing: .06em;
        }

        td {
          color: #cfcfcf;
          font-size: 12px;
        }

        .status {
          display: inline-block;
          padding: 4px 7px;
          border-radius: 999px;
          background: #222;
        }

        .status.active {
          color: #00ff88;
          background: rgba(0,255,136,.07);
        }

        .status.invited {
          color: #55cfff;
          background: rgba(0,180,255,.08);
        }

        .status.suspended,
        .status.revoked {
          color: #ff9090;
          background: rgba(255,80,80,.08);
        }

        .error, .notice {
          margin-bottom: 14px;
          padding: 11px 13px;
          border-radius: 7px;
          font-size: 12px;
        }

        .error {
          color: #ff9090;
          border: 1px solid rgba(255,80,80,.3);
          background: rgba(255,80,80,.07);
        }

        .notice {
          color: #80ffbb;
          border: 1px solid rgba(0,255,136,.3);
          background: rgba(0,255,136,.06);
        }

        .empty {
          text-align: center;
          color: #666;
          padding: 22px;
        }

        @media(max-width:800px) {
          header, .school-bar {
            align-items: flex-start;
            flex-direction: column;
          }

          .school-bar label {
            width: 100%;
            min-width: 0;
          }

          .grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
