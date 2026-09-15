import { describe, expect, it } from 'vitest';
import { formatError } from '../lib/format-error';

describe('formatError', () => {
  it('suppresses PKCE implementation guidance from invalid auth links', () => {
    const message = 'PKCE code verifier not found in storage. Use @supabase/ssr on the server and client.';
    for (const error of [message, { message }, new Error(message)]) {
      expect(formatError(error, 'Request a new invitation.')).toBe('Request a new invitation.');
    }
  });
  it('preserves intentional application messages', () => {
    expect(formatError({ message: 'This class code is invalid or has expired' })).toBe(
      'This class code is invalid or has expired'
    );
  });

  it('maps common database authorization and constraint codes to safe text', () => {
    expect(formatError({ code: '42501', message: 'technical auth detail' })).toBe(
      "You don't have permission to perform this action."
    );
    expect(formatError({ code: '23505', message: 'duplicate key technical detail' })).toBe(
      'That record already exists.'
    );
    expect(formatError({ code: '23503', message: 'foreign key technical detail' })).toBe(
      'This change conflicts with a related record.'
    );
  });

  it('does not expose PostgreSQL details or hints', () => {
    expect(
      formatError({
        details: 'Key (school_id)=(secret) already exists.',
        hint: 'Inspect internal_table_name.',
      })
    ).toBe('Something went wrong.');
  });

  it('suppresses technical schema and constraint messages', () => {
    expect(
      formatError({ message: 'duplicate key value violates unique constraint "profiles_pkey"' })
    ).toBe('Something went wrong.');
    expect(formatError(new Error('relation private.audit_log does not exist'))).toBe(
      'Something went wrong.'
    );
  });
});
