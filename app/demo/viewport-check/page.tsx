import { notFound } from 'next/navigation';

// Same-origin frames exercise actual responsive CSS without changing device
// settings. This diagnostic page is unavailable in production builds.
export default function ViewportCheck() {
  if (process.env.NEXT_PUBLIC_DEPLOYMENT_ENV !== 'staging') notFound();
  return (
    <main style={{ padding: 16 }}>
      <h1>Staging phone-width checks</h1>
      <p>Responsive layout checks only. These frames do not emulate a physical phone or its keyboard.</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24 }}>
        {[
          ['Login · 320px', '/login', 320],
          ['Welding demo · 390px', '/demo/welding', 390],
          ['Student code · 390px', '/demo/welding/join', 390],
        ].map(([title, src, width]) => (
          <section key={src}>
            <h2>{title}</h2>
            <iframe title={String(title)} src={String(src)} width={Number(width)} height={844}
              style={{ border: '2px solid #64748b', maxWidth: '100%' }} />
          </section>
        ))}
      </div>
    </main>
  );
}
