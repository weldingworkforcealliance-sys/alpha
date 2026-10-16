const FINALIZED_EVENT = 'ltg:attendance-finalized';
const STORAGE_KEY = 'ltg_attendance_finalized';

/** Invalidate attendance summaries; no student or session data is stored. */
export function notifyAttendanceFinalized() {
  window.dispatchEvent(new Event(FINALIZED_EVENT));
  try {
    window.localStorage.setItem(STORAGE_KEY, `${Date.now()}:${Math.random()}`);
  } catch {
    // Same-tab and focus refresh still work when storage is unavailable.
  }
}

export function subscribeAttendanceFinalized(refresh: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) refresh();
  };
  const onVisible = () => {
    if (document.visibilityState === 'visible') refresh();
  };
  window.addEventListener(FINALIZED_EVENT, refresh);
  window.addEventListener('storage', onStorage);
  window.addEventListener('focus', refresh);
  document.addEventListener('visibilitychange', onVisible);
  return () => {
    window.removeEventListener(FINALIZED_EVENT, refresh);
    window.removeEventListener('storage', onStorage);
    window.removeEventListener('focus', refresh);
    document.removeEventListener('visibilitychange', onVisible);
  };
}
