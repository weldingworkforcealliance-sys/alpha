'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getSupabase } from '@/lib/supabase-browser';

type Employee = {
  id: string;
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

  const supported = pathname === '/dashboard';

  const load = useCallback(async () => {
    if (!supported) return;
    setError('');

    try {
      const { data: auth } = await supabase.auth.getSession();
      const userId = auth.session?.user.id;
      if (!userId) {
        setEmployee(null);
        setEntries([]);
        setOpenEntry(null);
        return;
      }

      const { data: employeeData, error: employeeError } = await supabase
        .from('timeclock_employees')
        .select('id,display_name,clocking_enabled')
        .eq('profile_id', userId)
        .eq('active', true)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

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

      if (todayResult.error) throw todayResult.error;
      if (openResult.error) throw openResult.error;

      const todayEntries = (todayResult.data ?? []) as TimeEntry[];
      const currentOpen = (openResult.data ?? null) as TimeEntry | null;
      const combined = new Map(todayEntries.map((entry) => [entry.id, entry]));
      if (currentOpen) combined.set(currentOpen.id, currentOpen);

      setEntries(Array.from(combined.values()));
      setOpenEntry(currentOpen);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load punch clock');
    } finally {
      setLoading(false);
    }
  }, [supported, supabase]);

  useEffect(() => {
    if (!supported) return;
    void load();
  }, [load, supported]);

  useEffect(() => {
    if (!supported) return;
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, [supported]);

  const todayHours = useMemo(() => hoursToday(entries, now), [entries, now]);

  const handlePunch = async () => {
    if (!employee || busy || !employee.clocking_enabled) return;
    setBusy(true);
    setError('');
    try {
      const { error: rpcError } = await supabase.rpc(
        openEntry ? 'timeclock_clock_out' : 'timeclock_clock_in',
        {
          p_employee_id: employee.id,
          p_pin: null,
        }
      );
      if (rpcError) throw rpcError;
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
              <p>Track your work hours</p>
            </div>
          </div>
          <Link href="/time-clock">View Time Clock →</Link>
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
            <div className={`ltg-punch-status ${openEntry ? 'in' : 'out'}`}>
              <span className="ltg-punch-dot" aria-hidden="true" />
              <strong>{openEntry ? 'Clocked In' : 'Clocked Out'}</strong>
              <span>
                {openEntry
                  ? `Since ${formatClockTime(openEntry.clock_in_at)}`
                  : 'You are not currently on the clock.'}
              </span>
            </div>
            <button
              type="button"
              className="ltg-punch-primary"
              onClick={handlePunch}
              disabled={busy || !employee.clocking_enabled}
            >
              {busy ? 'Working…' : openEntry ? 'Clock Out' : 'Clock In'}
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
          {openEntry ? `Active since ${formatClockTime(openEntry.clock_in_at)}` : 'No active clock session'}
        </div>
        <div className="ltg-today-total">
          <span>Total Hours Today</span>
          <strong>{formatDuration(todayHours)}</strong>
        </div>
      </div>
    </section>
  );
}
