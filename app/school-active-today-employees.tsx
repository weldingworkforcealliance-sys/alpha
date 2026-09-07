'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { getSupabase } from '@/lib/supabase-browser';

type Employee = {
  id: string;
  school_id: string;
  display_name: string;
  active: boolean;
  clocking_enabled: boolean;
};

type Entry = {
  id: string;
  school_id: string;
  employee_id: string;
  clock_in_at: string;
  clock_out_at: string | null;
};

type School = {
  id: string;
  name: string;
};

type EmployeeRow = {
  employee: Employee;
  schoolName: string;
  entries: Entry[];
  openEntry: Entry | null;
  lastEntry: Entry;
};

function dayBounds() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

function formatClock(timestamp: string | null) {
  if (!timestamp) return '—';
  return new Date(timestamp).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatElapsed(ms: number) {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (!hours) return `${minutes}m`;
  return `${hours}h ${String(minutes).padStart(2, '0')}m`;
}

function workedTodayMs(entries: Entry[], nowMs: number) {
  const { start, end } = dayBounds();
  const dayStart = start.getTime();
  const dayEnd = end.getTime();

  return entries.reduce((sum, entry) => {
    const rawStart = new Date(entry.clock_in_at).getTime();
    const rawEnd = entry.clock_out_at
      ? new Date(entry.clock_out_at).getTime()
      : nowMs;
    const clippedStart = Math.max(rawStart, dayStart);
    const clippedEnd = Math.min(rawEnd, dayEnd, nowMs);
    return clippedEnd > clippedStart ? sum + (clippedEnd - clippedStart) : sum;
  }, 0);
}

export default function SchoolActiveTodayEmployees({ pathname }: { pathname: string }) {
  const [supabase] = useState(getSupabase);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [nowMs, setNowMs] = useState(Date.now());

  const load = useCallback(async () => {
    if (pathname !== '/school') return;
    setLoading(true);
    setError('');

    try {
      const { data: auth } = await supabase.auth.getSession();
      if (!auth.session) return;

      const employeeResult = await supabase
        .from('timeclock_employees')
        .select('id,school_id,display_name,active,clocking_enabled')
        .eq('active', true)
        .order('display_name');

      if (employeeResult.error) throw employeeResult.error;
      const loadedEmployees = (employeeResult.data ?? []) as Employee[];
      setEmployees(loadedEmployees);

      if (!loadedEmployees.length) {
        setEntries([]);
        setSchools([]);
        return;
      }

      const employeeIds = loadedEmployees.map((employee) => employee.id);
      const schoolIds = Array.from(new Set(loadedEmployees.map((employee) => employee.school_id)));
      const { start, end } = dayBounds();

      const [todayResult, openResult, schoolResult] = await Promise.all([
        supabase
          .from('timeclock_entries')
          .select('id,school_id,employee_id,clock_in_at,clock_out_at')
          .in('employee_id', employeeIds)
          .gte('clock_in_at', start.toISOString())
          .lt('clock_in_at', end.toISOString())
          .order('clock_in_at', { ascending: false }),
        supabase
          .from('timeclock_entries')
          .select('id,school_id,employee_id,clock_in_at,clock_out_at')
          .in('employee_id', employeeIds)
          .is('clock_out_at', null)
          .order('clock_in_at', { ascending: false }),
        supabase
          .from('schools')
          .select('id,name')
          .in('id', schoolIds)
          .order('name'),
      ]);

      const firstError = todayResult.error || openResult.error || schoolResult.error;
      if (firstError) throw firstError;

      const merged = new Map<string, Entry>();
      [...((todayResult.data ?? []) as Entry[]), ...((openResult.data ?? []) as Entry[])].forEach(
        (entry) => merged.set(entry.id, entry)
      );

      setEntries(Array.from(merged.values()));
      setSchools((schoolResult.data ?? []) as School[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [pathname, supabase]);

  useEffect(() => {
    if (pathname !== '/school') return;
    void load();
    const refresh = window.setInterval(() => void load(), 30000);
    return () => window.clearInterval(refresh);
  }, [load, pathname]);

  useEffect(() => {
    if (pathname !== '/school') return;
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [pathname]);

  const schoolMap = useMemo(
    () => new Map(schools.map((school) => [school.id, school.name])),
    [schools]
  );

  const rows = useMemo<EmployeeRow[]>(() => {
    const byEmployee = new Map<string, Entry[]>();
    entries.forEach((entry) => {
      const current = byEmployee.get(entry.employee_id) ?? [];
      current.push(entry);
      byEmployee.set(entry.employee_id, current);
    });

    return employees
      .map((employee) => {
        const employeeEntries = (byEmployee.get(employee.id) ?? []).sort(
          (a, b) => new Date(b.clock_in_at).getTime() - new Date(a.clock_in_at).getTime()
        );
        if (!employeeEntries.length) return null;
        const openEntry = employeeEntries.find((entry) => !entry.clock_out_at) ?? null;
        return {
          employee,
          schoolName: schoolMap.get(employee.school_id) ?? 'School',
          entries: employeeEntries,
          openEntry,
          lastEntry: employeeEntries[0],
        };
      })
      .filter((row): row is EmployeeRow => Boolean(row))
      .sort((a, b) => {
        if (Boolean(a.openEntry) !== Boolean(b.openEntry)) return a.openEntry ? -1 : 1;
        return (
          new Date(b.lastEntry.clock_in_at).getTime() -
          new Date(a.lastEntry.clock_in_at).getTime()
        );
      });
  }, [employees, entries, schoolMap]);

  if (pathname !== '/school') return null;

  const clockedInCount = rows.filter((row) => Boolean(row.openEntry)).length;
  const showSchoolName = new Set(rows.map((row) => row.employee.school_id)).size > 1;

  return (
    <section className="ltg-school-live-punch-panel" aria-label="Active today employees">
      <div className="ltg-school-live-punch-header">
        <div>
          <span className="ltg-school-live-punch-eyebrow">Live Time Clock</span>
          <h2>Active Today Employees</h2>
          <p>View-only live punch status. Corrections and payroll controls remain in Employee Time Clock.</p>
        </div>
        <div className="ltg-school-live-punch-count">
          <strong>{clockedInCount}</strong>
          <span>Clocked In</span>
        </div>
      </div>

      {loading && rows.length === 0 ? (
        <div className="ltg-school-live-punch-empty">Loading today&apos;s punch activity…</div>
      ) : error ? (
        <div className="ltg-school-live-punch-error">Unable to load live punch status: {error}</div>
      ) : rows.length === 0 ? (
        <div className="ltg-school-live-punch-empty">No employee punches recorded today.</div>
      ) : (
        <div className="ltg-school-live-punch-list">
          {rows.map((row) => {
            const active = Boolean(row.openEntry);
            const last = row.openEntry ?? row.lastEntry;
            return (
              <article className="ltg-school-live-punch-row" key={row.employee.id}>
                <div className="ltg-school-live-punch-person">
                  <span
                    className={`ltg-school-live-punch-dot ${active ? 'active' : 'complete'}`}
                    aria-hidden="true"
                  />
                  <div>
                    <strong>{row.employee.display_name}</strong>
                    {showSchoolName && <small>{row.schoolName}</small>}
                  </div>
                </div>

                <div className="ltg-school-live-punch-times">
                  <span>
                    <small>Clock In</small>
                    <strong>{formatClock(last.clock_in_at)}</strong>
                  </span>
                  <span>
                    <small>{active ? 'Current Time' : 'Clock Out'}</small>
                    <strong>
                      {active
                        ? formatElapsed(workedTodayMs(row.entries, nowMs))
                        : formatClock(last.clock_out_at)}
                    </strong>
                  </span>
                  {!active && (
                    <span>
                      <small>Today</small>
                      <strong>{formatElapsed(workedTodayMs(row.entries, nowMs))}</strong>
                    </span>
                  )}
                </div>

                <span className={`ltg-school-live-punch-status ${active ? 'active' : 'complete'}`}>
                  {active ? 'CLOCKED IN' : 'CLOCKED OUT'}
                </span>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
