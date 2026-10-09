// Parse Supabase recovery callbacks without logging or persisting raw tokens.
// GoTrue may redirect with implicit-flow hash tokens, a PKCE code, or a
// token_hash, depending on the email template and auth client.
export type RecoveryRedirect =
  | { kind: 'implicit'; accessToken: string; refreshToken: string }
  | { kind: 'pkce'; code: string }
  | { kind: 'token_hash'; tokenHash: string }
  | { kind: 'error'; message: string }
  | { kind: 'none' };

export function parseRecoveryRedirect(search: string, hash: string): RecoveryRedirect {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const fragment = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
  const errorDescription =
    fragment.get('error_description') || params.get('error_description');
  if (errorDescription) return { kind: 'error', message: errorDescription };
  if (fragment.has('error') || params.has('error')) {
    return {
      kind: 'error',
      message: 'This recovery link is invalid or expired. Request another email.',
    };
  }

  const type = fragment.get('type') || params.get('type');
  if (type && type !== 'recovery') {
    return {
      kind: 'error',
      message: 'This is not a password-recovery link. Open the recovery email instead.',
    };
  }

  const accessToken = fragment.get('access_token');
  const refreshToken = fragment.get('refresh_token');
  if (accessToken || refreshToken) {
    if (!accessToken || !refreshToken) {
      return {
        kind: 'error',
        message: 'Incomplete recovery link. Request a new password reset email.',
      };
    }
    return { kind: 'implicit', accessToken, refreshToken };
  }

  const tokenHash = params.get('token_hash');
  if (tokenHash) return { kind: 'token_hash', tokenHash };
  const code = params.get('code');
  if (code) return { kind: 'pkce', code };
  return { kind: 'none' };
}
