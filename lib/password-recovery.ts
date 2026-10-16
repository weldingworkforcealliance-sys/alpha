export const RECOVERY_REQUEST_KEY = 'ltg_password_recovery_requested_at';

// This marker selects a screen only. Supabase still verifies every credential.
export function recoveryCallbackPath(search: string, hash: string, requestedAt: string | null, now = Date.now()) {
  const query = new URLSearchParams(search);
  const fragment = new URLSearchParams(hash.replace(/^#/, ''));
  const requested = Number(requestedAt);
  const pending = requested > 0 && now >= requested && now - requested < 60 * 60 * 1000;
  const recovery = fragment.get('type') === 'recovery' || query.get('type') === 'recovery';
  const callback = query.has('code') || query.has('token_hash') || fragment.has('access_token') || fragment.has('error_description') || query.has('error_description');
  if (!recovery && !(pending && callback)) return null;
  // Never follow a destination supplied by a callback query.
  return `/reset-password${search}${hash}`;
}
