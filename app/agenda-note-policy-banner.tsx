'use client';

export default function AgendaNotePolicyBanner({ pathname }: { pathname: string }) {
  if (pathname !== '/agenda') return null;

  return (
    <div
      style={{
        padding: '9px 16px',
        borderBottom: '1px solid #242424',
        background: '#111',
        color: '#9a9a9a',
        fontSize: '12px',
        lineHeight: 1.45,
      }}
    >
      <strong style={{ color: '#d8d8d8' }}>Instructor notes:</strong>{' '}
      notes are observations and suggestions only. They do not change the agenda until a school administrator approves an implementation change.
    </div>
  );
}
