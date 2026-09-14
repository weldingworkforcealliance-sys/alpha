'use client';

import { useEffect } from 'react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('LTG route error', {
      digest: error.digest ?? null,
      name: error.name,
      message: error.message,
    });
  }, [error]);

  return (
    <main
      role="alert"
      style={{
        maxWidth: 720,
        margin: '48px auto',
        padding: 24,
        border: '1px solid var(--ltg-border)',
        borderRadius: 12,
        background: 'var(--ltg-surface)',
        color: 'var(--ltg-text)',
      }}
    >
      <h1 style={{ marginTop: 0 }}>LTG could not load this screen</h1>
      <p style={{ color: 'var(--ltg-muted)', lineHeight: 1.5 }}>
        Your saved records were not changed. Retry the screen. If the problem continues,
        return to the dashboard and reopen the class or tool.
      </p>
      {error.digest && (
        <p style={{ color: 'var(--ltg-muted)', fontSize: 12 }}>
          Reference: {error.digest}
        </p>
      )}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button type="button" onClick={reset}>
          Retry
        </button>
        <a href="/dashboard">Return to dashboard</a>
      </div>
    </main>
  );
}
