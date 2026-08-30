'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

export default function TrainingLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [supabase] = useState(() =>
    createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
    )
  );

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace('/training');
    });
  }, [router, supabase]);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (authError) throw authError;
      router.push('/training');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="shell">
      <section className="card">
        <div className="training-banner">TRAINING MODE · NOT PRODUCTION</div>
        <div className="body">
          <div className="eyebrow">Living Teacher Planner</div>
          <h1>Training Sign In</h1>
          <p>
            Use your normal school account. Training activity is isolated from live class records and production reporting.
          </p>

          <form onSubmit={signIn}>
            <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
            <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
            {error && <div className="error">{error}</div>}
            <button type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Enter Training Center'}</button>
          </form>

          <div className="links">
            <button onClick={() => router.push('/demo')}>Try Public Demo</button>
            <button onClick={() => router.push('/login')}>Back to Live Login</button>
          </div>
        </div>
      </section>

      <style jsx>{`
        .shell { min-height:100vh; display:grid; place-items:center; padding:24px; background:#080808; color:#ddd; }
        .card { width:min(500px,100%); border:1px solid #2b2b2b; border-radius:11px; overflow:hidden; background:#141414; }
        .training-banner { padding:10px; text-align:center; background:#9a4d13; color:white; font-size:11px; font-weight:900; letter-spacing:.08em; }
        .body { padding:30px; }
        .eyebrow { color:#ffad70; font-size:10px; text-transform:uppercase; letter-spacing:.12em; font-weight:900; }
        h1 { margin:5px 0 7px; color:white; font-size:29px; }
        p { color:#888; line-height:1.5; margin:0 0 22px; }
        form { display:grid; gap:14px; }
        label { display:grid; gap:7px; color:#aaa; font-size:12px; font-weight:700; }
        input { padding:12px; border-radius:7px; border:1px solid #303030; background:#0d0d0d; color:#eee; font:inherit; }
        form button { padding:12px; border-radius:7px; border:1px solid rgba(255,154,82,.5); background:rgba(255,154,82,.08); color:#ffad70; font-weight:850; cursor:pointer; }
        button:disabled { opacity:.5; cursor:not-allowed; }
        .error { padding:10px; border-radius:7px; border:1px solid rgba(255,80,80,.35); color:#ff9090; background:rgba(255,80,80,.07); font-size:12px; }
        .links { display:flex; gap:8px; margin-top:18px; }
        .links button { flex:1; padding:10px; border-radius:7px; border:1px solid #303030; background:#101010; color:#aaa; cursor:pointer; }
      `}</style>
    </main>
  );
}
