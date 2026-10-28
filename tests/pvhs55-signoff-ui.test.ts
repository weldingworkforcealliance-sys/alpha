import { describe, expect, it, vi } from 'vitest';
import { pageHandler } from './helpers/page-handler';
const path = 'app/signoffs/page.tsx';
function harness(overrides: Record<string, unknown> = {}) {
  const target = { section: 'section-B', student: 'learner-B', scope: 'Machine A' };
  const rpc = vi.fn().mockResolvedValue({ data: { history: [] }, error: null });
  const context = {
    target, loadedTarget: target, review: { history: [{ gate: 'cnc', id: 'prior-review' }] }, busy: false,
    targetKey: (t: typeof target) => JSON.stringify([t.section, t.student, t.scope.trim()]),
    gate: 'cnc', decision: 'release', evidence: ' evidence-1 ', criteria: ' manual-R1 ', observation: ' observed ',
    rows: [{ criterion: 'setup', required: 'manual requirement', observed: 'measured', met: 'yes' }],
    bend: '', expiry: '', supabase: { rpc }, clearForm: vi.fn(), setBusy: vi.fn(), setError: vi.fn(),
    setMessage: vi.fn(), setReview: vi.fn(), setLoadedTarget: vi.fn(), ...overrides,
  };
  return { context, rpc, save: pageHandler<() => Promise<void>>(path, 'saveSignoff', context) };
}
describe('PVHS instructor signoff handler', () => {
  it('records the reviewed target and expected prior version without supplying an actor or date', async () => {
    const h = harness(); await h.save();
    expect(h.rpc.mock.calls[0][0]).toBe('pvhs55_signoff_record');
    const payload = h.rpc.mock.calls[0][1];
    expect(payload).toMatchObject({ p_section: 'section-B', p_student: 'learner-B', p_scope: 'Machine A', p_expected_previous: 'prior-review', p_evidence: 'evidence-1' });
    expect(payload).not.toHaveProperty('recorded_by'); expect(payload).not.toHaveProperty('scheduled_date');
    expect(h.rpc.mock.calls[1][0]).toBe('pvhs55_signoff_read');
    expect(h.context.clearForm).toHaveBeenCalledOnce();
  });
  it('refuses to submit after the selected student changes', async () => {
    const h = harness({ target: { section: 'section-B', student: 'different', scope: 'Machine A' } });
    await h.save(); expect(h.rpc).not.toHaveBeenCalled();
  });
  it('never treats an undecided criterion as passed', async () => {
    const h = harness({ rows: [{ criterion: 'setup', required: 'limit', observed: 'measured', met: '' }] });
    await h.save(); expect(h.rpc).not.toHaveBeenCalled(); expect(h.context.setError).toHaveBeenCalled();
  });
  it('prevents release when a criterion is not met', async () => {
    const h = harness({ rows: [{ criterion: 'setup', required: 'limit', observed: 'outside limit', met: 'no' }] });
    await h.save(); expect(h.rpc).not.toHaveBeenCalled();
  });
  it('prevents a failed bend result from being released', async () => {
    const h = harness({ gate: 'bend31', bend: 'failed' }); await h.save(); expect(h.rpc).not.toHaveBeenCalled();
  });
  it('permits an explicit hold with an unmet observation', async () => {
    const h = harness({ decision: 'hold', rows: [{ criterion: 'setup', required: 'limit', observed: 'outside limit', met: 'no' }] });
    await h.save(); expect(h.rpc.mock.calls[0][1].p_results[0].met).toBe(false);
  });
  it('requires reloading on a stale review and never automatically retries', async () => {
    const h = harness(); h.rpc.mockResolvedValueOnce({ error: { code: '40001' }, data: null });
    await h.save(); expect(h.rpc).toHaveBeenCalledOnce(); expect(h.context.setLoadedTarget).toHaveBeenCalledWith(null);
    expect(h.context.setError).toHaveBeenLastCalledWith(expect.stringContaining('Another instructor'));
  });
  it('distinguishes a saved review from a history-refresh failure', async () => {
    const h = harness(); h.rpc.mockResolvedValueOnce({ data: 'new-review', error: null }).mockResolvedValueOnce({ data: null, error: { code: 'NETWORK' } });
    await h.save(); expect(h.context.setError).toHaveBeenLastCalledWith(expect.stringContaining('Signoff saved, but'));
    expect(h.context.setLoadedTarget).toHaveBeenCalledWith(null);
  });
  it('does not submit while another request is busy', async () => {
    const h = harness({ busy: true }); await h.save(); expect(h.rpc).not.toHaveBeenCalled();
  });
});
