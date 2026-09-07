export function formatError(error: unknown, fallback = 'Something went wrong.') {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (typeof error === 'string' && error.trim()) return error;
  if (error && typeof error === 'object') {
    const candidate = error as Record<string, unknown>;
    for (const key of ['message', 'details', 'hint', 'error_description']) {
      const value = candidate[key];
      if (typeof value === 'string' && value.trim()) return value;
    }
    try {
      const serialized = JSON.stringify(error);
      if (serialized && serialized !== '{}') return serialized;
    } catch {
      // Ignore serialization failures and use the fallback.
    }
  }
  return fallback;
}
