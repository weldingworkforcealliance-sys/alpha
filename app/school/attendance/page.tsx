'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase-browser';
import { AttendanceGroup, parseRosterPaste } from '@/lib/attendance';
import styles from './school-attendance.module.css';

type School = { id: string; name: string };
type Membership = { school_id: string; role: string; status: string };
type Course = { id: string; course_code: string | null; course_name: string | null };
type Section = {
  id: string;
  course_id: string;
  section_name: string | null;
  section_code: string | null;
  status: string | null;
};
type EmailSettings = {
  school_id: string;
  recipient_email: string | null;
  cc_emails: string[];
  enabled: boolean;
  recipient_confirmed_at: string | null;
};
type AttendanceSessionRow = {
  id: string;
  attendance_group_id: string;
  attendance_date: string;
  status: string;
  finalized_at: string | null;
  report_due_at: string | null;
  report_sent_at: string | null;
  revision: number;
};
type Delivery = {
  id: string;
  attendance_session_id: string;
  delivery_kind: string;
  recipient_email: string;
  status: string;
  due_at: string;
  sent_at: string | null;
  attempt_count: number;
  last_error: string | null;
};
type ImportResult = {
  new_students: number;
  existing_students: number;
  enrolled: number;
  errors: Array<{ row: number; message: string }>;
};

function titleCase(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function SchoolAttendanceAdminPage() {
  const router = useRouter();
  const [supabase] = useState(getSupabase);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [schools, setSchools] = useState<School[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [isOwner, setIsOwner] = useState(false);
  const [schoolId, setSchoolId] = useState('');
  const [courses, setCourses] = useState<Course[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [groups, setGroups] = useState<AttendanceGroup[]>([]);
  const [sessions, setSessions] = useState<AttendanceSessionRow[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [settings, setSettings] = useState<EmailSettings | null>(null);

  const [groupName, setGroupName] = useState('');
  const [groupCode, setGroupCode] = useState('');
  const [groupMode, setGroupMode] = useState<'standard' | 'pvhs_daily_email'>('standard');
  const [selectedSectionIds, setSelectedSectionIds] = useState<string[]>([]);
  const [confirmationSectionId, setConfirmationSectionId] = useState('');
  const [rosterGroupId, setRosterGroupId] = useState('');
  const [rosterPaste, setRosterPaste] = useState('');

  const [recipientEmail, setRecipientEmail] = useState('');
  const [ccEmails, setCcEmails] = useState('');
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [confirmRecipient, setConfirmRecipient] = useState(false);

  const courseById = useMemo(() => new Map(courses.map((course) => [course.id, course])), [courses]);
  const groupById = useMemo(() => new Map(groups.map((group) => [group.id, group])), [groups]);
  const parsedRoster = useMemo(() => parseRosterPaste(rosterPaste), [rosterPaste]);

  const canAdministerSelectedSchool = Boolean(
    isOwner || memberships.some((membership) => membership.school_id === schoolId && membership.role === 'school_admin')
  );

  const loadSchool = useCallback(async () => {
    if (!schoolId) return;
    setBusy(true);
    setError('');
    try {
      const [courseResult, sectionResult, groupResult, settingsResult, sessionResult, deliveryResult] =
        await Promise.all([
          supabase.from('courses').select('id,course_code,course_name').eq('school_id', schoolId).order('course_code'),
          supabase
            .from('sections')
            .select('id,course_id,section_name,section_code,status')
            .eq('school_id', schoolId)
            .order('section_name'),
          supabase.rpc('list_attendance_groups'),
          supabase
            .from('attendance_email_settings')
            .select('school_id,recipient_email,cc_emails,enabled,recipient_confirmed_at')
            .eq('school_id', schoolId)
            .maybeSingle(),
          supabase
            .from('attendance_sessions')
            .select('id,attendance_group_id,attendance_date,status,finalized_at,report_due_at,report_sent_at,revision')
            .eq('school_id', schoolId)
            .order('attendance_date', { ascending: false })
            .limit(40),
          supabase
            .from('attendance_report_deliveries')
            .select('id,attendance_session_id,delivery_kind,recipient_email,status,due_at,sent_at,attempt_count,last_error')
            .eq('school_id', schoolId)
            .order('created_at', { ascending: false })
            .limit(40),
        ]);

      const firstError =
        courseResult.error ||
        sectionResult.error ||
        groupResult.error ||
        settingsResult.error ||
        sessionResult.error ||
        deliveryResult.error;
      if (firstError) throw firstError;

      setCourses((courseResult.data ?? []) as Course[]);
      setSections((sectionResult.data ?? []) as Section[]);
      const schoolGroups = ((groupResult.data ?? []) as AttendanceGroup[]).filter(
        (group) => group.school_id === schoolId
      );
      setGroups(schoolGroups);
      setRosterGroupId((current) =>
        current && schoolGroups.some((group) => group.id === current) ? current : schoolGroups[0]?.id ?? ''
      );
      setSessions((sessionResult.data ?? []) as AttendanceSessionRow[]);
      setDeliveries((deliveryResult.data ?? []) as Delivery[]);
      const loadedSettings = (settingsResult.data ?? null) as EmailSettings | null;
      setSettings(loadedSettings);
      setRecipientEmail(loadedSettings?.recipient_email ?? '');
      setCcEmails((loadedSettings?.cc_emails ?? []).join(', '));
      setEmailEnabled(loadedSettings?.enabled ?? true);
      setConfirmRecipient(Boolean(loadedSettings?.recipient_confirmed_at));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'School attendance settings could not be loaded.');
    } finally {
      setBusy(false);
    }
  }, [schoolId, supabase]);

  useEffect(() => {
    const initialize = async () => {
      try {
        const { data: authData } = await supabase.auth.getSession();
        const userId = authData.session?.user.id;
        if (!userId) {
          router.replace('/login');
          return;
        }
        const [ownerResult, membershipResult, schoolResult] = await Promise.all([
          supabase.rpc('is_platform_owner'),
          supabase
            .from('school_memberships')
            .select('school_id,role,status')
            .eq('user_id', userId)
            .eq('status', 'active'),
          supabase.from('schools').select('id,name').order('name'),
        ]);
        if (membershipResult.error || schoolResult.error) throw membershipResult.error || schoolResult.error;
        const owner = Boolean(ownerResult.data);
        const loadedMemberships = (membershipResult.data ?? []) as Membership[];
        const adminSchoolIds = new Set(
          loadedMemberships
            .filter((membership) => membership.role === 'school_admin')
            .map((membership) => membership.school_id)
        );
        const allowedSchools = owner
          ? ((schoolResult.data ?? []) as School[])
          : ((schoolResult.data ?? []) as School[]).filter((school) => adminSchoolIds.has(school.id));
        setIsOwner(owner);
        setMemberships(loadedMemberships);
        setSchools(allowedSchools);
        setSchoolId(allowedSchools[0]?.id ?? '');
        if (!allowedSchools.length) setError('School administrator access is required for rosters and email settings.');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Attendance administration could not be opened.');
      } finally {
        setLoading(false);
      }
    };
    initialize();
  }, [router, supabase]);

  useEffect(() => {
    if (schoolId && canAdministerSelectedSchool) void loadSchool();
  }, [schoolId, canAdministerSelectedSchool, loadSchool]);

  const toggleSection = (sectionId: string) => {
    setSelectedSectionIds((current) => {
      if (current.includes(sectionId)) {
        if (confirmationSectionId === sectionId) setConfirmationSectionId('');
        return current.filter((value) => value !== sectionId);
      }
      return [...current, sectionId];
    });
  };

  const createGroup = async () => {
    if (!groupName.trim() || selectedSectionIds.length < 2 || !confirmationSectionId) {
      setError('Enter a group name, select at least two classes, and choose the final class that triggers attendance.');
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const { error: createError } = await supabase.rpc('create_attendance_group', {
        p_school_id: schoolId,
        p_name: groupName,
        p_code: groupCode,
        p_attendance_mode: groupMode,
        p_section_ids: selectedSectionIds,
        p_confirmation_section_ids: [confirmationSectionId],
      });
      if (createError) throw createError;
      setGroupName('');
      setGroupCode('');
      setSelectedSectionIds([]);
      setConfirmationSectionId('');
      setNotice('Class pair created. Students added to it will be enrolled in every selected class.');
      await loadSchool();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The class pair could not be created.');
    } finally {
      setBusy(false);
    }
  };

  const importRoster = async () => {
    if (!rosterGroupId || !parsedRoster.rows.length || parsedRoster.errors.length) {
      setError('Correct the roster preview errors before importing.');
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const { data, error: importError } = await supabase.rpc('bulk_import_attendance_roster', {
        p_attendance_group_id: rosterGroupId,
        p_students: parsedRoster.rows,
      });
      if (importError) throw importError;
      const result = data as ImportResult;
      if (result.errors?.length) {
        setError(
          `Imported ${result.enrolled}. ${result.errors.length} row(s) need attention: ${result.errors
            .slice(0, 3)
            .map((item) => `row ${item.row}: ${item.message}`)
            .join('; ')}`
        );
      } else {
        setNotice(
          `${result.enrolled} students enrolled: ${result.new_students} new and ${result.existing_students} already on file.`
        );
        setRosterPaste('');
      }
      await loadSchool();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The roster could not be imported.');
    } finally {
      setBusy(false);
    }
  };

  const saveEmailSettings = async () => {
    if (emailEnabled && !confirmRecipient) {
      setError('Confirm that the PVHS report address is correct before enabling daily email.');
      return;
    }
    const cc = ccEmails
      .split(/[;,]/)
      .map((value) => value.trim())
      .filter(Boolean);
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const { error: saveError } = await supabase.rpc('configure_attendance_email', {
        p_school_id: schoolId,
        p_recipient_email: recipientEmail,
        p_cc_emails: cc,
        p_enabled: emailEnabled,
        p_confirm_recipient: confirmRecipient,
      });
      if (saveError) throw saveError;
      setNotice('PVHS attendance email settings saved.');
      await loadSchool();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Email settings could not be saved.');
    } finally {
      setBusy(false);
    }
  };

  const reopen = async (session: AttendanceSessionRow) => {
    const reason = window.prompt('Enter the reason for reopening this attendance record:');
    if (!reason) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const { error: reopenError } = await supabase.rpc('reopen_attendance_session', {
        p_attendance_session_id: session.id,
        p_reason: reason,
      });
      if (reopenError) throw reopenError;
      setNotice('Attendance reopened. The correction and reason are recorded in the audit history.');
      await loadSchool();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Attendance could not be reopened.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <main className={styles.loading}>Opening Attendance Administration…</main>;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <div className={styles.eyebrow}>School Administration</div>
          <h1>Student Rosters &amp; Attendance Settings</h1>
          <p>Create linked class pairs, import students once, and control PVHS reporting.</p>
        </div>
        <div className={styles.headerActions}>
          <button onClick={() => router.push('/attendance')}>Take Attendance</button>
          <button onClick={() => router.push('/school')}>School Dashboard</button>
        </div>
      </header>

      {schools.length > 1 && (
        <label className={styles.schoolSelect}>
          <span>School</span>
          <select value={schoolId} onChange={(event) => setSchoolId(event.target.value)}>
            {schools.map((school) => (
              <option key={school.id} value={school.id}>{school.name}</option>
            ))}
          </select>
        </label>
      )}

      {error && <div className={styles.error}>{error}</div>}
      {notice && <div className={styles.notice}>{notice}</div>}

      {canAdministerSelectedSchool && (
        <div className={styles.grid}>
          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <div className={styles.eyebrow}>Step 1</div>
                <h2>Create a Class Pair</h2>
              </div>
              <span>{groups.length} configured</span>
            </div>
            <div className={styles.formGrid}>
              <label>
                <span>Pair / Cohort Name</span>
                <input value={groupName} onChange={(event) => setGroupName(event.target.value)} placeholder="PVHS B — Level I" />
              </label>
              <label>
                <span>Short Code</span>
                <input value={groupCode} onChange={(event) => setGroupCode(event.target.value)} placeholder="PVHS-B-L1" />
              </label>
              <label className={styles.fullWidth}>
                <span>Attendance Type</span>
                <select value={groupMode} onChange={(event) => setGroupMode(event.target.value as typeof groupMode)}>
                  <option value="standard">Standard College Attendance</option>
                  <option value="pvhs_daily_email">PVHS Attendance — Daily Email Required</option>
                </select>
              </label>
            </div>
            <fieldset className={styles.sections}>
              <legend>Linked class sections — select two or more</legend>
              {sections.map((section) => {
                const course = courseById.get(section.course_id);
                return (
                  <label key={section.id}>
                    <input
                      type="checkbox"
                      checked={selectedSectionIds.includes(section.id)}
                      onChange={() => toggleSection(section.id)}
                    />
                    <span>
                      <strong>{course?.course_code ?? course?.course_name ?? 'Course'}</strong>
                      {section.section_name ?? section.section_code ?? 'Section'}
                    </span>
                  </label>
                );
              })}
            </fieldset>
            {selectedSectionIds.length > 0 && (
              <fieldset className={styles.sections}>
                <legend>End-of-pair attendance prompt</legend>
                <p className={styles.help}>Choose the final class of the paired day—normally WLD 110 or WLD 210.</p>
                {sections
                  .filter((section) => selectedSectionIds.includes(section.id))
                  .map((section) => {
                    const course = courseById.get(section.course_id);
                    return (
                      <label key={section.id}>
                        <input
                          type="radio"
                          name="attendance-confirmation-section"
                          checked={confirmationSectionId === section.id}
                          onChange={() => setConfirmationSectionId(section.id)}
                        />
                        <span>
                          <strong>{course?.course_code ?? course?.course_name ?? 'Course'}</strong>
                          Completing this class opens attendance confirmation
                        </span>
                      </label>
                    );
                  })}
              </fieldset>
            )}
            <button className={styles.primary} disabled={busy} onClick={createGroup}>Create Class Pair</button>
            <div className={styles.groupList}>
              {groups.map((group) => (
                <article key={group.id}>
                  <div><strong>{group.name}</strong><small>{group.code || 'No short code'}</small></div>
                  <span>{group.course_labels.join(' / ')}</span>
                  <em>
                    {group.roster_count} students · {group.attendance_mode === 'pvhs_daily_email' ? 'PVHS email' : 'standard'}
                    <small>Prompt after {group.confirmation_course_labels?.join(' / ') || 'not set'}</small>
                  </em>
                </article>
              ))}
            </div>
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <div className={styles.eyebrow}>Step 2</div>
                <h2>Paste Student Roster</h2>
              </div>
              <span>{parsedRoster.rows.length} ready</span>
            </div>
            <label>
              <span>Class Pair</span>
              <select value={rosterGroupId} onChange={(event) => setRosterGroupId(event.target.value)}>
                {groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
              </select>
            </label>
            <label>
              <span>Paste Names or Spreadsheet Rows</span>
              <textarea
                value={rosterPaste}
                onChange={(event) => setRosterPaste(event.target.value)}
                placeholder={'Smith, Jordan\nTaylor Morgan\n10032\tRivera\tAlex\talex@example.edu'}
                rows={10}
              />
            </label>
            <p className={styles.help}>
              One student per line: “Last, First” or “First Last.” From a spreadsheet use columns: Student ID, Last Name, First Name, Email.
            </p>
            {parsedRoster.errors.length > 0 && (
              <div className={styles.parseErrors}>
                {parsedRoster.errors.slice(0, 6).map((item) => (
                  <div key={`${item.line}-${item.message}`}>Line {item.line}: {item.message}</div>
                ))}
              </div>
            )}
            {parsedRoster.rows.length > 0 && (
              <div className={styles.preview}>
                <strong>Preview</strong>
                {parsedRoster.rows.slice(0, 5).map((row) => (
                  <span key={`${row.source_line}-${row.last_name}`}>{row.last_name}, {row.first_name}{row.external_student_id ? ` · ${row.external_student_id}` : ''}</span>
                ))}
                {parsedRoster.rows.length > 5 && <small>+ {parsedRoster.rows.length - 5} more</small>}
              </div>
            )}
            <button
              className={styles.primary}
              disabled={busy || !rosterGroupId || !parsedRoster.rows.length || Boolean(parsedRoster.errors.length)}
              onClick={importRoster}
            >
              Import &amp; Enroll in All Linked Classes
            </button>
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <div className={styles.eyebrow}>PVHS Reporting</div>
                <h2>Daily Email Settings</h2>
              </div>
              <span className={settings?.enabled && settings?.recipient_confirmed_at ? styles.ready : styles.needsSetup}>
                {settings?.enabled && settings?.recipient_confirmed_at ? 'Ready' : 'Needs Setup'}
              </span>
            </div>
            <label>
              <span>PVHS Report Email</span>
              <input type="email" value={recipientEmail} onChange={(event) => { setRecipientEmail(event.target.value); setConfirmRecipient(false); }} placeholder="attendance@pvhs.example.edu" />
            </label>
            <label>
              <span>Optional CC Emails</span>
              <input value={ccEmails} onChange={(event) => setCcEmails(event.target.value)} placeholder="Separate addresses with commas" />
            </label>
            <label className={styles.checkboxLine}>
              <input type="checkbox" checked={emailEnabled} onChange={(event) => setEmailEnabled(event.target.checked)} />
              <span>Automatically email each finalized PVHS report after 30 minutes</span>
            </label>
            <label className={styles.confirmLine}>
              <input type="checkbox" checked={confirmRecipient} onChange={(event) => setConfirmRecipient(event.target.checked)} />
              <span>I confirmed this is the correct authorized PVHS attendance address.</span>
            </label>
            <button className={styles.primary} disabled={busy || !recipientEmail} onClick={saveEmailSettings}>Save Email Settings</button>
            <p className={styles.help}>Changing the primary address requires confirmation again. Every delivery and failure is logged.</p>
          </section>

          <section className={`${styles.panel} ${styles.fullPanel}`}>
            <div className={styles.panelHeader}>
              <div>
                <div className={styles.eyebrow}>Audit &amp; Delivery</div>
                <h2>Recent Attendance Reports</h2>
              </div>
              <button disabled={busy} onClick={loadSchool}>Refresh</button>
            </div>
            <div className={styles.tableWrap}>
              <table>
                <thead><tr><th>Date</th><th>Class Pair</th><th>Attendance</th><th>Email</th><th>Recipient</th><th>Correction</th></tr></thead>
                <tbody>
                  {sessions.map((session) => {
                    const delivery = deliveries.find((item) => item.attendance_session_id === session.id);
                    const group = groupById.get(session.attendance_group_id);
                    return (
                      <tr key={session.id}>
                        <td>{new Date(`${session.attendance_date}T12:00:00`).toLocaleDateString()}</td>
                        <td><strong>{group?.name ?? 'Class Pair'}</strong><small>{group?.course_labels.join(' / ')}</small></td>
                        <td>{titleCase(session.status)} · revision {session.revision}</td>
                        <td>
                          {delivery ? (
                            <><strong className={styles[`delivery_${delivery.status}`]}>{titleCase(delivery.status)}</strong><small>{delivery.sent_at ? new Date(delivery.sent_at).toLocaleString() : `Due ${new Date(delivery.due_at).toLocaleString()}`}</small>{delivery.last_error && <small>{delivery.last_error}</small>}</>
                          ) : group?.attendance_mode === 'pvhs_daily_email' ? 'Not queued' : 'Not required'}
                        </td>
                        <td>{delivery?.recipient_email ?? '—'}</td>
                        <td><button disabled={busy || session.status !== 'finalized'} onClick={() => reopen(session)}>Reopen</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!sessions.length && <div className={styles.empty}>No attendance sessions have been created.</div>}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
