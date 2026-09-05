'use client';

import { useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabase-browser';

const LOGOUT_LABELS = new Set(['log out', 'logout', 'sign out']);

export default function ClockAwareLogoutGuard() {
  const [supabase] = useState(getSupabase);

  useEffect(() => {
    const handleLogoutClick = async (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;

      const control = target.closest('button, a');
      if (!control) return;

      const label = (control.textContent ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
      if (!LOGOUT_LABELS.has(label)) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const session = sessionData.session;

        if (!session) {
          window.location.assign('/login');
          return;
        }

        let clockStatusVerified = true;
        let hasOpenPunch = false;

        const { data: employee, error: employeeError } = await supabase
          .from('timeclock_employees')
          .select('id')
          .eq('profile_id', session.user.id)
          .eq('active', true)
          .eq('clocking_enabled', true)
          .maybeSingle();

        if (employeeError) {
          clockStatusVerified = false;
        } else if (employee?.id) {
          const { data: openEntry, error: entryError } = await supabase
            .from('timeclock_entries')
            .select('id')
            .eq('employee_id', employee.id)
            .is('clock_out_at', null)
            .limit(1)
            .maybeSingle();

          if (entryError) clockStatusVerified = false;
          else hasOpenPunch = Boolean(openEntry);
        }

        if (hasOpenPunch) {
          const signOutAnyway = window.confirm(
            'YOU ARE CURRENTLY CLOCKED IN.\n\nSigning out of LTG will NOT clock you out. Your time will continue until you use Clock Out.\n\nPress OK to SIGN OUT ANYWAY.\nPress Cancel to RETURN TO THE TIME CLOCK.'
          );

          if (!signOutAnyway) {
            window.location.assign('/time-clock');
            return;
          }
        } else if (!clockStatusVerified) {
          const signOutAnyway = window.confirm(
            'LTG could not verify your current time-clock status.\n\nSigning out of LTG does NOT clock you out.\n\nPress OK to SIGN OUT ANYWAY.\nPress Cancel to RETURN TO THE TIME CLOCK and verify your status.'
          );

          if (!signOutAnyway) {
            window.location.assign('/time-clock');
            return;
          }
        }

        await supabase.auth.signOut();
        window.location.assign('/login');
      } catch {
        const signOutAnyway = window.confirm(
          'LTG could not verify your current time-clock status.\n\nSigning out of LTG does NOT clock you out.\n\nPress OK to SIGN OUT ANYWAY.\nPress Cancel to RETURN TO THE TIME CLOCK and verify your status.'
        );

        if (!signOutAnyway) {
          window.location.assign('/time-clock');
          return;
        }

        await supabase.auth.signOut();
        window.location.assign('/login');
      }
    };

    document.addEventListener('click', handleLogoutClick, true);
    return () => document.removeEventListener('click', handleLogoutClick, true);
  }, [supabase]);

  return null;
}
