export function formatErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object') {
    const value = error as Record<string, unknown>;
    const candidates = [value.message, value.details, value.hint, value.code];
    const parts = Array.from(
      new Set(
        candidates
          .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
          .map((item) => item.trim())
      )
    );
    if (parts.length) return parts.join(' · ');
  }
  return 'Something went wrong. Please try again.';
}
