// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); localStorage.clear(); vi.resetModules(); });
it('sends public RPCs without consuming staff storage, cookies, or a recovery fragment', async () => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL','https://test.supabase.co');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY','public-test-key');
  const staff = JSON.stringify({access_token:'staff-aal1-token',refresh_token:'staff-refresh',expires_at:9999999999});
  localStorage.setItem('sb-test-auth-token',staff);
  document.cookie = 'sb-test-auth-token='+encodeURIComponent(staff);
  window.history.replaceState(null,'','/shop/student#access_token=recovery-token&type=recovery');
  const requests: RequestInit[] = [];
  vi.stubGlobal('fetch',vi.fn(async (_url:unknown,init:RequestInit) => {
    requests.push(init);
    return new Response(JSON.stringify({ok:true}),{headers:{'Content-Type':'application/json'}});
  }));
  const {getPublicSupabase} = await import('../lib/supabase-public');
  const client = getPublicSupabase();
  expect(getPublicSupabase()).toBe(client);
  await client.rpc('get_classroom_assessment',{p_join_code:'TESTCODE'});
  await client.rpc('read_lab_student',{p_token:'personal-student-token'});
  expect(requests).toHaveLength(2);
  for (const request of requests) {
    const headers = new Headers(request.headers);
    expect(headers.get('Authorization')).toBe('Bearer public-test-key');
    expect(headers.get('apikey')).toBe('public-test-key');
  }
  expect(localStorage.getItem('sb-test-auth-token')).toBe(staff);
  expect(window.location.hash).toContain('recovery-token');
});
