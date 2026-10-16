const CHANGE_EVENT = 'ltg:timeclock-change';
const STORAGE_KEY = 'ltg_timeclock_change';
type Source = 'sidebar' | 'workspace';

/** Invalidate displayed clock data only; no time records are stored here. */
export function notifyTimeclockChanged(source: Source) {
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { source } }));
  try {
    window.localStorage.setItem(STORAGE_KEY, `${Date.now()}:${Math.random()}`);
  } catch {
    // Same-tab updates and focus refresh still work when storage is unavailable.
  }
}

export function subscribeTimeclockChanges(source: Source, refresh: () => void) {
  const onChange = (event: Event) => {
    if ((event as CustomEvent<{ source: Source }>).detail?.source !== source) refresh();
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) refresh();
  };
  const onVisible = () => {
    if (document.visibilityState === 'visible') refresh();
  };
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener('storage', onStorage);
  window.addEventListener('focus', refresh);
  document.addEventListener('visibilitychange', onVisible);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener('storage', onStorage);
    window.removeEventListener('focus', refresh);
    document.removeEventListener('visibilitychange', onVisible);
  };
}
