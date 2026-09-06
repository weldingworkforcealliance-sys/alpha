'use client';

export default function AgendaNotePolicyBanner({ pathname }: { pathname: string }) {
  if (pathname !== '/agenda') return null;

  return (
    <div
      style={{
        padding: '9px 16px',
        borderBottom: '1px solid var(--ltg-border-soft)',
        background: 'var(--ltg-surface-2)',
        color: 'var(--ltg-muted)',
        fontSize: '12px',
        lineHeight: 1.45,
      }}
    >
      <strong style={{ color: 'var(--ltg-text)' }}>Instructor notes:</strong>{' '}
      notes are observations and suggestions only. They do not change the agenda until a school administrator approves an implementation change.
    </div>
  );
}
