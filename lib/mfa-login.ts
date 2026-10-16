import type { SupabaseClient } from '@supabase/supabase-js';
import { safePostLoginRoute } from './auth-routes';

export async function finishPasswordSignIn(supabase: SupabaseClient, requested: string | null) {
  const target = safePostLoginRoute(requested);
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error || !data?.currentLevel) throw new Error('Could not check account verification. Please try signing in again.');
  if (data.nextLevel === 'aal2' && data.currentLevel !== 'aal2') {
    return `/mfa?next=${encodeURIComponent(target)}`;
  }
  const { error: membershipError } = await supabase.rpc('activate_my_invited_memberships');
  if (membershipError) throw new Error('Could not activate your school access. Please try again.');
  return target;
}
