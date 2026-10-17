// Deleted rows cannot safely be delivered through Postgres Changes RLS.
// Re-read authorized state periodically and on return to the training window.
export function startTrainingRefresh(load: () => Promise<void>, onError: (error: unknown) => void) {
  let stopped = false;
  let running = false;
  const refresh = async () => {
    if (stopped || running) return;
    running = true;
    try { await load(); }
    catch (error) { if (!stopped) onError(error); }
    finally { running = false; }
  };
  const onFocus = () => { void refresh(); };
  const timer = window.setInterval(onFocus, 30000);
  window.addEventListener('focus', onFocus);
  return {
    refresh,
    stop: () => {
      stopped = true;
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    },
  };
}
