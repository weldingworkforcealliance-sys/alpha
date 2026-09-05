import { getSupabase } from './supabase-browser';

const OPEN_PUNCH_WARNING =
  'YOU ARE CURRENTLY CLOCKED IN.\n\nSigning out of LTG will NOT clock you out. Your time will continue until you use Clock Out.\n\nPress OK to SIGN OUT ANYWAY.\nPress Cancel to RETURN TO THE TIME CLOCK.';

const UNVERIFIED_WARNING =
  'LTG could not verify your current time-clock status.\n\nSigning out of LTG does NOT clock you out.\n\nPress OK to SIGN OUT ANYWAY.\nPress Cancel to RETURN TO THE TIME CLOCK and verify your status.';

async function confirmClockAwareSignOut(userId: string) {
  const supabase = getSupabase();

  try {
    const { data: employee, error: employeeError } = await supabase
      .from('timeclock_employees')
      .select('id')
      .eq('profile_id', userId)
      .eq('active', true)
      .eq('clocking_enabled', true)
      .maybeSingle();

    if (employeeError) {
      return window.confirm(UNVERIFIED_WARNING);
    }

    if (!employee?.id) return true;

    const { data: openEntry, error: entryError } = await supabase
      .from('timeclock_entries')
      .select('id')
      .eq('employee_id', employee.id)
      .is('clock_out_at', null)
      .limit(1)
      .maybeSingle();

    if (entryError) {
      return window.confirm(UNVERIFIED_WARNING);
    }

    return openEntry ? window.confirm(OPEN_PUNCH_WARNING) : true;
  } catch {
    return window.confirm(UNVERIFIED_WARNING);
  }
}

export async function guardedSignOut(redirectTo = '/login') {
  if (typeof window === 'undefined') return false;

  const supabase = getSupabase();
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

  if (sessionError) {
    const proceed = window.confirm(UNVERIFIED_WARNING);
    if (!proceed) {
      window.location.assign('/time-clock');
      return false;
    }
  }

  const session = sessionData.session;
  if (session) {
    const proceed = await confirmClockAwareSignOut(session.user.id);
    if (!proceed) {
      window.location.assign('/time-clock');
      return false;
    }
  }

  const { error: signOutError } = await supabase.auth.signOut();
  if (signOutError) {
    window.alert('LTG could not sign you out. Please try again.');
    return false;
  }

  window.location.assign(redirectTo);
  return true;
}
