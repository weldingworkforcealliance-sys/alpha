'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getSupabase } from '@/lib/supabase-browser';
import { eligibleCompletedHours, isActiveOpenPunch, isUnresolvedOpenPunch } from '@/lib/timeclock-safety';
import { notifyTimeclockChanged, subscribeTimeclockChanges } from '@/lib/timeclock-events';

type Employee = {
  id: string;
  school_id: string;
  display_name: string;
  clocking_enabled: boolean;
};

type TimeEntry = {
  id: string;
  clock_in_at: string;
  clock_out_at: string | null;
};

function localDayBounds() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

function hoursToday(entries: TimeEntry[], now: number) {
  const { start, end } = localDayBounds();
  return entries.reduce((sum, entry) => {
    if (entry.clock_out_at === null ? !isActiveOpenPunch(entry, now) : eligibleCompletedHours(entry) === 0) return sum;
    const inMs = Math.max(new Date(entry.clock_in_at).getTime(), start.getTime());
    const outMs = Math.min(
      entry.clock_out_at ? new Date(entry.clock_out_at).getTime() : now,
      end.getTime()
    );
    return sum + Math.max(0, outMs - inMs) / 3_600_000;
  }, 0);
}

function formatDuration(hours: number) {
  const totalMinutes = Math.round(hours * 60);
  const wholeHours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${wholeHours}h ${String(minutes).padStart(2, '0')}m`;
}

function formatClockTime(value: string) {
  return new Date(value).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function DashboardPunchClock({ pathname }: { pathname: string }) {
  const [supabase] = useState(getSupabase);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [openEntry, setOpenEntry] = useState<TimeEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());
  const loadVersion = useRef(0);

  const supported = !['/', '/login', '/account-setup', '/reset-password'].includes(pathname) && !pathname.startsWith('/demo');

  const load = useCallback(async () => {
    if (!supported) return;
    const version = ++loadVersion.current;
    setLoading(true);
    setError('');

    try {
      const { data: auth } = await supabase.auth.getSession();
      if (version !== loadVersion.current) return;
      const userId = auth.session?.user.id;
      if (!userId) {
        setEmployee(null);
        setEntries([]);
        setOpenEntry(null);
        return;
      }

      const { data: employeeData, error: employeeError } = await supabase
        .from('timeclock_employees')
        .select('id,school_id,display_name,clocking_enabled')
        .eq('profile_id', userId)
        .eq('active', true)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (version !== loadVersion.current) return;
      if (employeeError) throw employeeError;
      const nextEmployee = (employeeData ?? null) as Employee | null;
      setEmployee(nextEmployee);

      if (!nextEmployee) {
        setEntries([]);
        setOpenEntry(null);
        return;
      }

      const { start } = localDayBounds();
      const [todayResult, openResult] = await Promise.all([
        supabase
          .from('timeclock_entries')
          .select('id,clock_in_at,clock_out_at')
          .eq('employee_id', nextEmployee.id)
          .gte('clock_in_at', start.toISOString())
          .order('clock_in_at', { ascending: false }),
        supabase
          .from('timeclock_entries')
          .select('id,clock_in_at,clock_out_at')
          .eq('employee_id', nextEmployee.id)
          .is('clock_out_at', null)
          .order('clock_in_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (version !== loadVersion.current) return;
      if (todayResult.error) throw todayResult.error;
      if (openResult.error) throw openResult.error;

      const todayEntries = (todayResult.data ?? []) as TimeEntry[];
      const currentOpen = (openResult.data ?? null) as TimeEntry | null;
      const combined = new Map(todayEntries.map((entry) => [entry.id, entry]));
      if (currentOpen) combined.set(currentOpen.id, currentOpen);

      setEntries(Array.from(combined.values()));
      setOpenEntry(currentOpen);
      setNow(Date.now());
    } catch (err) {
      if (version !== loadVersion.current) return;
      setError(err instanceof Error ? err.message : 'Unable to load punch clock');
    } finally {
      if (version === loadVersion.current) setLoading(false);
    }
  }, [supported, supabase]);

  useEffect(() => {
    if (!supported) return;
    void load();
    const unsubscribe = subscribeTimeclockChanges('sidebar', () => { void load(); });
    return () => {
      unsubscribe();
      loadVersion.current += 1;
    };
  }, [load, supported, pathname]);

  useEffect(() => {
    if (!supported) return;
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, [supported]);

  const todayHours = useMemo(() => hoursToday(entries, now), [entries, now]);
  const activeOpen = Boolean(openEntry && isActiveOpenPunch(openEntry, now));
  const unresolvedOpen = Boolean(openEntry && isUnresolvedOpenPunch(openEntry, now));

  const handlePunch = async () => {
    // A stale session must be corrected by a manager, never clocked out now.
    if (!employee || busy || loading || error || !employee.clocking_enabled || unresolvedOpen) return;
    setBusy(true);
    setError('');
    try {
      const { error: rpcError } = await supabase.rpc(
        activeOpen ? 'timeclock_clock_out' : 'timeclock_clock_in',
        {
          p_employee_id: employee.id,
          p_pin: null,
        }
      );
      if (rpcError) throw rpcError;
      notifyTimeclockChanged('sidebar');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Clock action failed');
    } finally {
      setBusy(false);
    }
  };

  if (!supported) return null;

  const todayLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  return (
    <section className="ltg-punch-row" aria-label="Punch clock summary">
      <div className="ltg-punch-card">
        <div className="ltg-punch-card-heading">
          <div>
            <span className="ltg-punch-icon" aria-hidden="true">◷</span>
            <div>
              <h2>Punch Clock</h2>
              <p>{employee?.display_name ?? 'Track your work hours'}</p>
            </div>
          </div>
          <a href={employee
            ? `/time-clock?school=${encodeURIComponent(employee.school_id)}${unresolvedOpen && openEntry ? `&review=${encodeURIComponent(openEntry.id)}` : ''}`
            : '/time-clock'}>
            {unresolvedOpen ? 'Review Previous Punch →' : 'View Time Clock →'}
          </a>
        </div>

        {loading ? (
          <div className="ltg-punch-loading">Loading clock status…</div>
        ) : !employee ? (
          <div className="ltg-punch-action-row">
            <div className="ltg-punch-status neutral">
              <strong>Time clock not assigned</strong>
              <span>Open Employee Time Clock for available options.</span>
            </div>
            <Link className="ltg-punch-primary" href="/time-clock">Open Time Clock</Link>
          </div>
        ) : (
          <div className="ltg-punch-action-row">
            <div className={`ltg-punch-status ${activeOpen ? 'in' : unresolvedOpen ? 'neutral' : 'out'}`}>
              <span className="ltg-punch-dot" aria-hidden="true" />
              <strong>{unresolvedOpen ? 'Previous Punch Needs Review' : activeOpen ? 'Clocked In' : 'Clocked Out'}</strong>
              <span>
                {unresolvedOpen && openEntry
                  ? `Previous punch from ${new Date(openEntry.clock_in_at).toLocaleString('en-US')} must be corrected by a manager.`
                  : activeOpen && openEntry
                    ? `Since ${formatClockTime(openEntry.clock_in_at)}`
                    : 'You are not currently on the clock.'}
              </span>
            </div>
            <button
              type="button"
              className="ltg-punch-primary"
              onClick={handlePunch}
              disabled={busy || Boolean(error) || !employee.clocking_enabled || unresolvedOpen}
            >
              {busy ? 'Working…' : unresolvedOpen ? 'Review Required' : activeOpen ? 'Clock Out' : 'Clock In'}
            </button>
          </div>
        )}
        {error && <div className="ltg-punch-error">{error}</div>}
      </div>

      <div className="ltg-today-card">
        <div className="ltg-today-heading">
          <span aria-hidden="true">▣</span>
          <strong>Today</strong>
          <span>{todayLabel}</span>
        </div>
        <div className="ltg-today-session">
          <span aria-hidden="true">◷</span>
          {unresolvedOpen ? 'Previous punch requires review' : activeOpen && openEntry ? `Active since ${formatClockTime(openEntry.clock_in_at)}` : 'No active clock session'}
        </div>
        <div className="ltg-today-total">
          <span>Recorded Hours Today (reviewed + current)</span>
          <strong>{formatDuration(todayHours)}</strong>
        </div>
      </div>
    </section>
  );
}
