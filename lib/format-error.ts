const USER_SAFE_DATABASE_ERRORS: Record<string, string> = {
  '23503': 'This change conflicts with a related record.',
  '23505': 'That record already exists.',
  '42501': "You don't have permission to perform this action.",
};

const TECHNICAL_MESSAGE_PATTERNS = [
  /duplicate key value violates unique constraint/i,
  /violates foreign key constraint/i,
  /violates row-level security policy/i,
  /relation .* does not exist/i,
  /column .* does not exist/i,
  /schema .* does not exist/i,
  /operator does not exist/i,
  /sqlstate/i,
  /pkce.*code verifier/i,
];

function safeMessage(value: unknown, fallback: string) {
  if (typeof value !== 'string') return null;
  const message = value.trim();
  if (!message) return null;
  if (TECHNICAL_MESSAGE_PATTERNS.some((pattern) => pattern.test(message))) return fallback;
  return message;
}

export function formatError(error: unknown, fallback = 'Something went wrong.') {
  if (error instanceof Error) {
    return safeMessage(error.message, fallback) ?? fallback;
  }

  if (typeof error === 'string') {
    return safeMessage(error, fallback) ?? fallback;
  }

  if (error && typeof error === 'object') {
    const candidate = error as Record<string, unknown>;
    const code = typeof candidate.code === 'string' ? candidate.code.trim() : '';
    if (code && USER_SAFE_DATABASE_ERRORS[code]) return USER_SAFE_DATABASE_ERRORS[code];

    // `details` and `hint` are deliberately not returned to the UI. Supabase/Postgres
    // often use those fields for schema names, constraint names, and query diagnostics.
    return (
      safeMessage(candidate.message, fallback) ??
      safeMessage(candidate.error_description, fallback) ??
      fallback
    );
  }

  return fallback;
}
