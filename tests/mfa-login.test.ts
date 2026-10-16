import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { finishPasswordSignIn } from '@/lib/mfa-login';
import { NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase-proxy';
const mock = vi.hoisted(() => ({ auth: { getClaims: vi.fn(), getUser: vi.fn(), mfa: { getAuthenticatorAssuranceLevel: vi.fn() } }, rpc: vi.fn() }));
vi.mock('@supabase/ssr', () => ({ createServerClient: () => mock }));
beforeEach(() => {
  vi.resetAllMocks();
  mock.auth.getClaims.mockResolvedValue({ data: { claims: { sub: 'synthetic', aal: 'aal1' } }, error: null });
  mock.auth.mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({ data: { currentLevel: 'aal1', nextLevel: 'aal2' }, error: null });
  mock.auth.getUser.mockResolvedValue({ data: { user: { id: 'synthetic', factors: [{status:'verified'}] } }, error: null });
  mock.rpc.mockResolvedValue({ error: null });
});
const client = mock as unknown as SupabaseClient;
describe('MFA login boundary', () => {
  it('does not activate memberships before the enrolled authenticator is verified', async () => {
    expect(await finishPasswordSignIn(client, '/school?tab=grades')).toBe('/mfa?next=%2Fschool%3Ftab%3Dgrades');
    expect(mock.rpc).not.toHaveBeenCalled();
  });
  it.each(['aal1', 'aal2'])('allows a fully satisfied %s account', async level => {
    mock.auth.mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({ data: { currentLevel: level, nextLevel: level }, error: null });
    expect(await finishPasswordSignIn(client, '/school')).toBe('/school');
    expect(mock.rpc).toHaveBeenCalledWith('activate_my_invited_memberships');
  });
  it('fails closed on an assurance lookup error', async () => {
    mock.auth.mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({ data: null, error: new Error('offline') });
    await expect(finishPasswordSignIn(client, '/school')).rejects.toThrow('Could not check');
    expect(mock.rpc).not.toHaveBeenCalled();
  });
  it('rejects external and looping return paths', async () => {
    expect(await finishPasswordSignIn(client, '//example.com')).toBe('/mfa?next=%2Fdashboard');
    expect(await finishPasswordSignIn(client, '/mfa?next=/school')).toBe('/mfa?next=%2Fdashboard');
  });
  it.each(['/dashboard', '/school?tab=attendance', '/training', '/tower-ui/index.html'])('blocks direct AAL1 access to %s for enrolled accounts', async path => {
    const response = await updateSession(new NextRequest(`https://staging.example${path}`));
    const destination = new URL(response.headers.get('location')!);
    expect(destination.pathname).toBe('/mfa');
    expect(destination.searchParams.get('next')).toBe(path);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });
  it.each(['/mfa', '/reset-password', '/demo/welding/session/', '/join/ABC123', '/job/ABC123'])('preserves public recovery/student/demo entry %s', async path => {
    const response = await updateSession(new NextRequest(`https://staging.example${path}`));
    expect(response.headers.get('location')).toBeNull();
    expect(mock.auth.mfa.getAuthenticatorAssuranceLevel).not.toHaveBeenCalled();
  });
  it('allows AAL2 protected requests', async () => {
    mock.auth.getClaims.mockResolvedValue({ data: { claims: { sub: 'synthetic', aal: 'aal2' } }, error: null });
    mock.auth.mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({ data: { currentLevel: 'aal2', nextLevel: 'aal2' }, error: null });
    expect((await updateSession(new NextRequest('https://staging.example/school'))).headers.get('location')).toBeNull();
  });
  it('fails closed on server assurance errors', async () => {
    mock.auth.getUser.mockResolvedValue({ data: { user: null }, error: new Error('offline') });
    mock.auth.mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({ data: null, error: new Error('offline') });
    expect((await updateSession(new NextRequest('https://staging.example/school'))).headers.get('location')).toContain('/mfa?');
  });
});

it('does not trust cookie-backed factor lists to bypass server verification', async () => {
  mock.auth.mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({data:{currentLevel:'aal1',nextLevel:'aal1'},error:null});
  expect((await updateSession(new NextRequest('https://staging.example/school'))).headers.get('location')).toContain('/mfa?');
  expect(mock.auth.getUser).toHaveBeenCalled();
});
it('preserves access for accounts without an enrolled factor', async () => {
  mock.auth.getUser.mockResolvedValue({data:{user:{id:'synthetic',factors:[]}},error:null});
  expect((await updateSession(new NextRequest('https://staging.example/school'))).headers.get('location')).toBeNull();
});
