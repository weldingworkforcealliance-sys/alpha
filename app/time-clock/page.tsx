'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import styles from './time-clock.module.css';

type Employee = {
  id: string;
  school_id: string;
  profile_id: string | null;
  display_name: string;
  employee_code: string | null;
  active: boolean;
  clocking_enabled: boolean;
  pin_configured: boolean;
};

type TimeEntry = {
  id: string;
  school_id: string;
  employee_id: string;
  clock_in_at: string;
  clock_out_at: string | null;
  clock_in_method: string;
  clock_out_method: string | null;
  notes: string | null;
};

type Membership = {
  school_id: string;
  role: string;
  status: string;
};

type School = {
  id: string;
  name: string;
};

type ProfileOption = {
  id: string;
  display_name: string | null;
  email: string | null;
};

const MANAGER_ROLES = new Set(['school_admin', 'program_lead', 'lead_instructor']);
const REPORT_ROLES = new Set(['school_admin', 'program_lead', 'lead_instructor', 'viewer']);

function dateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function startOfCurrentWeek() {
  const date = new Date();
  const day = date.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + offset);
  date.setHours(0, 0, 0, 0);
  return dateInputValue(date);
}

function formatTime(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function hoursBetween(start: string, end: string | null, now = Date.now()) {
  const startMs = new Date(start).getTime();
  const endMs = end ? new Date(end).getTime() : now;
  return Math.max(0, (endMs - startMs) / 3_600_000);
}

function elapsedLabel(start: string, now: number) {
  const minutes = Math.max(0, Math.floor((now - new Date(start).getTime()) / 60_000));
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${String(hours).padStart(2, '0')}h ${String(remainder).padStart(2, '0')}m`;
}

function toLocalDateTimeInput(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function localInputToIso(value: string) {
  return value ? new Date(value).toISOString() : null;
}

export default function TimeClockPage() {
  const router = useRouter();
  const [supabase] = useState(() =>
    createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
    )
  );

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [schoolId, setSchoolId] = useState('');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [profileOptions, setProfileOptions] = useState<ProfileOption[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [pin, setPin] = useState('');
  const [pinEmployeeId, setPinEmployeeId] = useState('');
  const [newPin, setNewPin] = useState('');
  const [selfPin, setSelfPin] = useState('');
  const [rangeStart, setRangeStart] = useState(startOfCurrentWeek);
  const [rangeEnd, setRangeEnd] = useState(() => dateInputValue(new Date()));
  const [now, setNow] = useState(() => Date.now());

  const [newEmployeeName, setNewEmployeeName] = useState('');
  const [newEmployeeCode, setNewEmployeeCode] = useState('');
  const [newEmployeeProfileId, setNewEmployeeProfileId] = useState('');

  const [adjustingEntryId, setAdjustingEntryId] = useState('');
  const [adjustIn, setAdjustIn] = useState('');
  const [adjustOut, setAdjustOut] = useState('');
  const [adjustReason, setAdjustReason] = useState('');

  const currentMembership = useMemo(
    () => memberships.find((membership) => membership.school_id === schoolId) ?? null,
    [memberships, schoolId]
  );

  const isManager = Boolean(
    isOwner || (currentMembership && MANAGER_ROLES.has(currentMembership.role))
  );

  const canReport = Boolean(
    isOwner || (currentMembership && REPORT_ROLES.has(currentMembership.role))
  );

  const employeeById = useMemo(() => {
    const map = new Map<string, Employee>();
    employees.forEach((employee) => map.set(employee.id, employee));
    return map;
  }, [employees]);

  const openByEmployee = useMemo(() => {
    const map = new Map<string, TimeEntry>();
    entries.forEach((entry) => {
      if (!entry.clock_out_at) map.set(entry.employee_id, entry);
    });
    return map;
  }, [entries]);

  const myEmployee = useMemo(
    () => employees.find((employee) => employee.profile_id === userId) ?? null,
    [employees, userId]
  );

  const selectedEmployee = useMemo(
    () => employeeById.get(selectedEmployeeId) ?? null,
    [employeeById, selectedEmployeeId]
  );

  const filteredEntries = useMemo(() => {
    return [...entries]
      .filter((entry) => {
        const day = dateInputValue(new Date(entry.clock_in_at));
        return day >= rangeStart && day <= rangeEnd;
      })
      .sort((a, b) => b.clock_in_at.localeCompare(a.clock_in_at));
  }, [entries, rangeStart, rangeEnd]);

  const totalHours = useMemo(
    () => filteredEntries.reduce((sum, entry) => sum + hoursBetween(entry.clock_in_at, entry.clock_out_at, now), 0),
    [filteredEntries, now]
  );

  const currentSchool = schools.find((school) => school.id === schoolId) ?? null;

  const loadSchoolData = useCallback(async () => {
    if (!schoolId) return;
    setRefreshing(true);
    setError('');

    try {
      const startIso = new Date(`${rangeStart}T00:00:00`).toISOString();
      const endIso = new Date(`${rangeEnd}T23:59:59.999`).toISOString();

      const [employeeResult, rangeEntryResult, openEntryResult] = await Promise.all([
        supabase
          .from('timeclock_employees')
          .select('id,school_id,profile_id,display_name,employee_code,active,clocking_enabled,pin_configured')
          .eq('school_id', schoolId)
          .eq('active', true)
          .order('display_name'),
        supabase
          .from('timeclock_entries')
          .select('id,school_id,employee_id,clock_in_at,clock_out_at,clock_in_method,clock_out_method,notes')
          .eq('school_id', schoolId)
          .gte('clock_in_at', startIso)
          .lte('clock_in_at', endIso)
          .order('clock_in_at', { ascending: false }),
        supabase
          .from('timeclock_entries')
          .select('id,school_id,employee_id,clock_in_at,clock_out_at,clock_in_method,clock_out_method,notes')
          .eq('school_id', schoolId)
          .is('clock_out_at', null),
      ]);

      const loadError = employeeResult.error || rangeEntryResult.error || openEntryResult.error;
      if (loadError) throw loadError;

      const loadedEmployees = (employeeResult.data ?? []) as Employee[];
      const combinedEntries = new Map<string, TimeEntry>();
      [...((rangeEntryResult.data ?? []) as TimeEntry[]), ...((openEntryResult.data ?? []) as TimeEntry[])].forEach(
        (entry) => combinedEntries.set(entry.id, entry)
      );

      setEmployees(loadedEmployees);
      setEntries(Array.from(combinedEntries.values()));

      setSelectedEmployeeId((current) => {
        if (current && loadedEmployees.some((employee) => employee.id === current)) return current;
        return loadedEmployees[0]?.id ?? '';
      });

      setPinEmployeeId((current) => {
        if (current && loadedEmployees.some((employee) => employee.id === current)) return current;
        return loadedEmployees[0]?.id ?? '';
      });

      if (isManager) {
        const memberResult = await supabase
          .from('school_memberships')
          .select('user_id')
          .eq('school_id', schoolId)
          .eq('status', 'active');

        if (!memberResult.error) {
          const ids = (memberResult.data ?? []).map((row: { user_id: string }) => row.user_id);
          if (ids.length > 0) {
            const profileResult = await supabase
              .from('profiles')
              .select('id,display_name,email')
              .in('id', ids)
              .order('display_name');
            if (!profileResult.error) setProfileOptions((profileResult.data ?? []) as ProfileOption[]);
          } else {
            setProfileOptions([]);
          }
        }
      } else {
        setProfileOptions([]);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to load time clock data';
      setError(message);
    } finally {
      setRefreshing(false);
    }
  }, [schoolId, rangeStart, rangeEnd, supabase, isManager]);

  useEffect(() => {
    const initialize = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const session = sessionData.session;
        if (!session) {
          router.push('/login');
          return;
        }

        setUserId(session.user.id);

        const [ownerResult, membershipResult] = await Promise.all([
          supabase.rpc('is_platform_owner'),
          supabase
            .from('school_memberships')
            .select('school_id,role,status')
            .eq('user_id', session.user.id)
            .eq('status', 'active'),
        ]);

        const owner = Boolean(ownerResult.data);
        const activeMemberships = (membershipResult.data ?? []) as Membership[];
        setIsOwner(owner);
        setMemberships(activeMemberships);

        let schoolResult;
        if (owner) {
          schoolResult = await supabase.from('schools').select('id,name').eq('status', 'active').order('name');
        } else {
          const ids = activeMemberships.map((membership) => membership.school_id);
          schoolResult = ids.length
            ? await supabase.from('schools').select('id,name').in('id', ids).order('name')
            : { data: [], error: null };
        }

        if (schoolResult.error) throw schoolResult.error;
        const loadedSchools = (schoolResult.data ?? []) as School[];
        setSchools(loadedSchools);
        setSchoolId(loadedSchools[0]?.id ?? '');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to open the time clock';
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    initialize();
  }, [router, supabase]);

  useEffect(() => {
    loadSchoolData();
  }, [loadSchoolData]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const handlePunch = async (employee: Employee) => {
    const openEntry = openByEmployee.get(employee.id);
    const selfPunch = employee.profile_id === userId;
    const enteredPin = selfPunch ? null : pin.trim();

    if (!selfPunch && !isManager) {
      setError('You may only clock yourself in or out.');
      return;
    }

    if (!selfPunch && !/^\d{4,8}$/.test(enteredPin ?? '')) {
      setError('Enter the employee PIN before using kiosk clocking.');
      return;
    }

    setActionLoading(true);
    setError('');
    setNotice('');
    try {
      const functionName = openEntry ? 'timeclock_clock_out' : 'timeclock_clock_in';
      const { error: rpcError } = await supabase.rpc(functionName, {
        p_employee_id: employee.id,
        p_pin: enteredPin,
      });
      if (rpcError) throw rpcError;

      setNotice(`${employee.display_name} ${openEntry ? 'clocked out' : 'clocked in'} successfully.`);
      setPin('');
      await loadSchoolData();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Clock action failed';
      setError(message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSetPin = async (employeeId: string, value: string, clear: () => void) => {
    if (!/^\d{4,8}$/.test(value)) {
      setError('PIN must contain 4 to 8 digits.');
      return;
    }

    setActionLoading(true);
    setError('');
    setNotice('');
    try {
      const { error: rpcError } = await supabase.rpc('timeclock_set_pin', {
        p_employee_id: employeeId,
        p_pin: value,
      });
      if (rpcError) throw rpcError;
      const employee = employeeById.get(employeeId);
      setNotice(`${employee?.display_name ?? 'Employee'} PIN updated.`);
      clear();
      await loadSchoolData();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to update PIN';
      setError(message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateEmployee = async () => {
    if (!isManager || !schoolId) return;
    const linked = profileOptions.find((profile) => profile.id === newEmployeeProfileId) ?? null;
    const name = newEmployeeName.trim() || linked?.display_name?.trim() || '';
    if (!name) {
      setError('Enter an employee name or select an LTG account.');
      return;
    }

    setActionLoading(true);
    setError('');
    setNotice('');
    try {
      const { error: rpcError } = await supabase.rpc('timeclock_create_employee', {
        p_school_id: schoolId,
        p_display_name: name,
        p_profile_id: newEmployeeProfileId || null,
        p_employee_code: newEmployeeCode.trim() || null,
      });
      if (rpcError) throw rpcError;
      setNotice(`${name} added to the time clock.`);
      setNewEmployeeName('');
      setNewEmployeeCode('');
      setNewEmployeeProfileId('');
      await loadSchoolData();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to add employee';
      setError(message);
    } finally {
      setActionLoading(false);
    }
  };

  const beginAdjustment = (entry: TimeEntry) => {
    setAdjustingEntryId(entry.id);
    setAdjustIn(toLocalDateTimeInput(entry.clock_in_at));
    setAdjustOut(toLocalDateTimeInput(entry.clock_out_at));
    setAdjustReason('');
    setError('');
  };

  const saveAdjustment = async () => {
    if (!adjustingEntryId || !adjustIn || adjustReason.trim().length < 3) {
      setError('A corrected clock-in time and a reason of at least 3 characters are required.');
      return;
    }

    setActionLoading(true);
    setError('');
    setNotice('');
    try {
      const { error: rpcError } = await supabase.rpc('timeclock_adjust_entry', {
        p_entry_id: adjustingEntryId,
        p_new_clock_in_at: localInputToIso(adjustIn),
        p_new_clock_out_at: localInputToIso(adjustOut),
        p_reason: adjustReason.trim(),
      });
      if (rpcError) throw rpcError;
      setNotice('Time entry corrected and audit history recorded.');
      setAdjustingEntryId('');
      setAdjustIn('');
      setAdjustOut('');
      setAdjustReason('');
      await loadSchoolData();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to adjust time entry';
      setError(message);
    } finally {
      setActionLoading(false);
    }
  };

  const exportCsv = () => {
    const header = ['Employee', 'Date', 'Clock In', 'Clock Out', 'Hours', 'Status', 'Method In', 'Method Out'];
    const rows = filteredEntries.map((entry) => {
      const employee = employeeById.get(entry.employee_id);
      return [
        employee?.display_name ?? 'Unknown employee',
        formatDate(entry.clock_in_at),
        formatTime(entry.clock_in_at),
        formatTime(entry.clock_out_at),
        hoursBetween(entry.clock_in_at, entry.clock_out_at, now).toFixed(4),
        entry.clock_out_at ? 'Complete' : 'Clocked In',
        entry.clock_in_method,
        entry.clock_out_method ?? '',
      ];
    });

    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ltg-time-clock-${rangeStart}-to-${rangeEnd}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return <main className={styles.loading}>Opening LTG Time Clock…</main>;
  }

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div>
          <div className={styles.eyebrow}>Living Teacher Guide</div>
          <h1>Employee Time Clock</h1>
          <p>Server-timestamped attendance with school-level reporting and correction history.</p>
        </div>
        <div className={styles.headerActions}>
          <button onClick={() => router.push('/dashboard')}>Back to Planner</button>
          {canReport && <button onClick={() => router.push('/school')}>School Dashboard</button>}
        </div>
      </header>

      <main className={styles.main}>
        {schools.length > 1 && (
          <section className={styles.schoolBar}>
            <label>
              School
              <select value={schoolId} onChange={(event) => setSchoolId(event.target.value)}>
                {schools.map((school) => (
                  <option key={school.id} value={school.id}>{school.name}</option>
                ))}
              </select>
            </label>
          </section>
        )}

        {error && <div className={styles.error}>{error}</div>}
        {notice && <div className={styles.notice}>{notice}</div>}

        <section className={styles.summaryGrid}>
          <div className={styles.summaryCard}>
            <span>School</span>
            <strong>{currentSchool?.name ?? 'No school selected'}</strong>
          </div>
          <div className={styles.summaryCard}>
            <span>Clocked In Now</span>
            <strong>{openByEmployee.size}</strong>
          </div>
          <div className={styles.summaryCard}>
            <span>Hours in Report</span>
            <strong>{totalHours.toFixed(2)}</strong>
          </div>
        </section>

        <div className={styles.twoColumn}>
          <section className={styles.panel}>
            <div className={styles.panelHeading}>
              <div>
                <span className={styles.kicker}>MY TIME</span>
                <h2>My Time Clock</h2>
              </div>
            </div>

            {myEmployee ? (
              <>
                <div className={styles.employeeHero}>
                  <div>
                    <strong>{myEmployee.display_name}</strong>
                    <span>{myEmployee.employee_code || 'LTG employee'}</span>
                  </div>
                  <div className={openByEmployee.has(myEmployee.id) ? styles.statusIn : styles.statusOut}>
                    {openByEmployee.has(myEmployee.id) ? 'CLOCKED IN' : 'CLOCKED OUT'}
                  </div>
                </div>

                {openByEmployee.get(myEmployee.id) && (
                  <div className={styles.elapsed}>
                    Clocked in at {formatTime(openByEmployee.get(myEmployee.id)!.clock_in_at)} ·{' '}
                    {elapsedLabel(openByEmployee.get(myEmployee.id)!.clock_in_at, now)}
                  </div>
                )}

                <button
                  className={openByEmployee.has(myEmployee.id) ? styles.clockOutButton : styles.clockInButton}
                  disabled={actionLoading || !myEmployee.clocking_enabled}
                  onClick={() => handlePunch(myEmployee)}
                >
                  {openByEmployee.has(myEmployee.id) ? 'CLOCK OUT' : 'CLOCK IN'}
                </button>

                <div className={styles.pinRow}>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={8}
                    placeholder={myEmployee.pin_configured ? 'Reset kiosk PIN' : 'Set kiosk PIN'}
                    value={selfPin}
                    onChange={(event) => setSelfPin(event.target.value.replace(/\D/g, ''))}
                  />
                  <button
                    disabled={actionLoading || !selfPin}
                    onClick={() => handleSetPin(myEmployee.id, selfPin, () => setSelfPin(''))}
                  >
                    {myEmployee.pin_configured ? 'Reset PIN' : 'Set PIN'}
                  </button>
                </div>
              </>
            ) : (
              <div className={styles.empty}>Your LTG account is not linked to a time-clock employee record.</div>
            )}
          </section>

          {isManager && (
            <section className={styles.panel}>
              <div className={styles.panelHeading}>
                <div>
                  <span className={styles.kicker}>SHARED KIOSK</span>
                  <h2>Employee Clock</h2>
                </div>
                <span className={styles.managerBadge}>Manager Mode</span>
              </div>

              <label className={styles.field}>
                Employee
                <select value={selectedEmployeeId} onChange={(event) => { setSelectedEmployeeId(event.target.value); setPin(''); }}>
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>{employee.display_name}</option>
                  ))}
                </select>
              </label>

              {selectedEmployee && (
                <>
                  <div className={styles.kioskStatus}>
                    <div>
                      <strong>{selectedEmployee.display_name}</strong>
                      <span>
                        {selectedEmployee.pin_configured ? 'PIN ready' : 'PIN not configured'}
                        {selectedEmployee.profile_id ? ' · LTG linked' : ' · Kiosk only'}
                      </span>
                    </div>
                    <div className={openByEmployee.has(selectedEmployee.id) ? styles.statusIn : styles.statusOut}>
                      {openByEmployee.has(selectedEmployee.id) ? 'IN' : 'OUT'}
                    </div>
                  </div>

                  {selectedEmployee.profile_id !== userId && (
                    <label className={styles.field}>
                      Employee PIN
                      <input
                        type="password"
                        inputMode="numeric"
                        maxLength={8}
                        placeholder="4–8 digits"
                        value={pin}
                        onChange={(event) => setPin(event.target.value.replace(/\D/g, ''))}
                      />
                    </label>
                  )}

                  <button
                    className={openByEmployee.has(selectedEmployee.id) ? styles.clockOutButton : styles.clockInButton}
                    disabled={actionLoading || !selectedEmployee.clocking_enabled}
                    onClick={() => handlePunch(selectedEmployee)}
                  >
                    {openByEmployee.has(selectedEmployee.id) ? 'CLOCK OUT' : 'CLOCK IN'}
                  </button>
                </>
              )}
            </section>
          )}
        </div>

        {isManager && (
          <section className={styles.panel}>
            <div className={styles.panelHeading}>
              <div>
                <span className={styles.kicker}>ADMINISTRATION</span>
                <h2>Employee Setup</h2>
              </div>
            </div>

            <div className={styles.adminGrid}>
              <div>
                <h3>Add Employee</h3>
                <div className={styles.formGrid}>
                  <label className={styles.field}>
                    Link LTG account (optional)
                    <select value={newEmployeeProfileId} onChange={(event) => setNewEmployeeProfileId(event.target.value)}>
                      <option value="">Kiosk-only employee</option>
                      {profileOptions
                        .filter((profile) => !employees.some((employee) => employee.profile_id === profile.id))
                        .map((profile) => (
                          <option key={profile.id} value={profile.id}>
                            {profile.display_name || profile.email || profile.id}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label className={styles.field}>
                    Display name
                    <input value={newEmployeeName} onChange={(event) => setNewEmployeeName(event.target.value)} placeholder="Employee name" />
                  </label>
                  <label className={styles.field}>
                    Employee code
                    <input value={newEmployeeCode} onChange={(event) => setNewEmployeeCode(event.target.value)} placeholder="Optional" />
                  </label>
                </div>
                <button disabled={actionLoading} onClick={handleCreateEmployee}>Add Employee</button>
              </div>

              <div>
                <h3>Set / Reset Kiosk PIN</h3>
                <div className={styles.formGrid}>
                  <label className={styles.field}>
                    Employee
                    <select value={pinEmployeeId} onChange={(event) => setPinEmployeeId(event.target.value)}>
                      {employees.map((employee) => (
                        <option key={employee.id} value={employee.id}>
                          {employee.display_name}{employee.pin_configured ? ' · PIN set' : ' · needs PIN'}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className={styles.field}>
                    New PIN
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={8}
                      value={newPin}
                      onChange={(event) => setNewPin(event.target.value.replace(/\D/g, ''))}
                      placeholder="4–8 digits"
                    />
                  </label>
                </div>
                <button
                  disabled={actionLoading || !pinEmployeeId || !newPin}
                  onClick={() => handleSetPin(pinEmployeeId, newPin, () => setNewPin(''))}
                >
                  Save PIN
                </button>
              </div>
            </div>
          </section>
        )}

        <section className={styles.panel}>
          <div className={styles.panelHeading}>
            <div>
              <span className={styles.kicker}>{canReport ? 'REPORTING' : 'MY HISTORY'}</span>
              <h2>{canReport ? 'Attendance Report' : 'My Attendance'}</h2>
            </div>
            <div className={styles.reportActions}>
              {canReport && <button onClick={exportCsv} disabled={filteredEntries.length === 0}>Export CSV</button>}
              <button onClick={loadSchoolData} disabled={refreshing}>{refreshing ? 'Refreshing…' : 'Refresh'}</button>
            </div>
          </div>

          <div className={styles.rangeBar}>
            <label className={styles.field}>
              From
              <input type="date" value={rangeStart} onChange={(event) => setRangeStart(event.target.value)} />
            </label>
            <label className={styles.field}>
              Through
              <input type="date" value={rangeEnd} onChange={(event) => setRangeEnd(event.target.value)} />
            </label>
            <div className={styles.rangeTotal}>
              <span>Total hours</span>
              <strong>{totalHours.toFixed(2)}</strong>
            </div>
          </div>

          {adjustingEntryId && isManager && (
            <div className={styles.adjustBox}>
              <h3>Correct Time Entry</h3>
              <p>Every correction is retained in the adjustment history with the manager and reason.</p>
              <div className={styles.formGrid}>
                <label className={styles.field}>
                  Clock in
                  <input type="datetime-local" value={adjustIn} onChange={(event) => setAdjustIn(event.target.value)} />
                </label>
                <label className={styles.field}>
                  Clock out
                  <input type="datetime-local" value={adjustOut} onChange={(event) => setAdjustOut(event.target.value)} />
                </label>
                <label className={styles.fieldWide}>
                  Reason
                  <input value={adjustReason} onChange={(event) => setAdjustReason(event.target.value)} placeholder="Required correction reason" />
                </label>
              </div>
              <div className={styles.inlineActions}>
                <button onClick={saveAdjustment} disabled={actionLoading}>Save Correction</button>
                <button className={styles.secondaryButton} onClick={() => setAdjustingEntryId('')}>Cancel</button>
              </div>
            </div>
          )}

          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  {canReport && <th>Employee</th>}
                  <th>Date</th>
                  <th>Clock In</th>
                  <th>Clock Out</th>
                  <th>Hours</th>
                  <th>Status</th>
                  {isManager && <th>Correction</th>}
                </tr>
              </thead>
              <tbody>
                {filteredEntries.map((entry) => {
                  const employee = employeeById.get(entry.employee_id);
                  return (
                    <tr key={entry.id}>
                      {canReport && <td><strong>{employee?.display_name ?? 'Unknown employee'}</strong></td>}
                      <td>{formatDate(entry.clock_in_at)}</td>
                      <td>{formatTime(entry.clock_in_at)}</td>
                      <td>{formatTime(entry.clock_out_at)}</td>
                      <td>{hoursBetween(entry.clock_in_at, entry.clock_out_at, now).toFixed(2)}</td>
                      <td>
                        <span className={entry.clock_out_at ? styles.completePill : styles.openPill}>
                          {entry.clock_out_at ? 'Complete' : 'Clocked In'}
                        </span>
                      </td>
                      {isManager && (
                        <td>
                          <button className={styles.tableButton} onClick={() => beginAdjustment(entry)}>Adjust</button>
                        </td>
                      )}
                    </tr>
                  );
                })}
                {filteredEntries.length === 0 && (
                  <tr>
                    <td colSpan={isManager ? (canReport ? 7 : 6) : (canReport ? 6 : 5)} className={styles.emptyCell}>
                      No time entries in this date range.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
