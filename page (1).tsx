'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [supabase] = useState(() => createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!));
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const prepare = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');
        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
        }
        const { data } = await supabase.auth.getSession();
        if (!data.session) { setError('This password-reset link is invalid or has expired. Request a new reset email.'); return; }
        setReady(true);
      } catch (err) { setError(err instanceof Error ? err.message : String(err)); }
    };
    prepare();
  }, [supabase]);

  const updatePassword = async () => {
    setError(''); setMessage('');
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }
    setSaving(true);
    try {
      const { error: e } = await supabase.auth.updateUser({ password });
      if (e) throw e;
      setMessage('Password updated successfully. Redirecting…');
      setTimeout(() => router.push('/dashboard'), 1200);
    } catch (err) { setError(err instanceof Error ? err.message : String(err)); }
    finally { setSaving(false); }
  };

  return <main className="shell"><section className="card"><div className="eyebrow">Living Teacher Planner</div><h1>Set New Password</h1><p>Choose a new password for your account.</p>{error && <div className="error">{error}</div>}{message && <div className="success">{message}</div>}{ready && <div className="form"><label>New Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password"/></label><label>Confirm Password<input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password"/></label><button disabled={saving} onClick={updatePassword}>{saving ? 'Updating…' : 'Update Password'}</button></div>}{!ready && !error && <div className="loading">Preparing secure reset…</div>}</section><style jsx>{`.shell{min-height:100vh;display:grid;place-items:center;padding:24px;background:radial-gradient(circle at 20% 0%,rgba(0,255,136,.08),transparent 28rem),#090909;color:#e0e0e0}.card{width:min(460px,100%);padding:30px;border:1px solid #292929;border-radius:10px;background:#151515}.eyebrow{color:#00ff88;text-transform:uppercase;letter-spacing:.12em;font-size:11px;font-weight:800}h1{margin:5px 0 7px;color:#fff;font-size:28px}p{margin:0 0 22px;color:#888}.form{display:grid;gap:16px}label{display:grid;gap:7px;color:#aaa;font-size:12px;font-weight:700}input{width:100%;padding:12px 13px;border:1px solid #303030;border-radius:7px;background:#0e0e0e;color:#eee;font:inherit}input:focus{outline:none;border-color:#00ff88}button{padding:12px 15px;border:1px solid rgba(0,255,136,.5);border-radius:7px;background:rgba(0,255,136,.08);color:#00ff88;font-weight:800;cursor:pointer}button:disabled{opacity:.5;cursor:not-allowed}.error,.success,.loading{margin-bottom:16px;padding:11px 13px;border-radius:7px;font-size:12px}.error{border:1px solid rgba(255,90,90,.35);background:rgba(255,90,90,.08);color:#ff8b8b}.success{border:1px solid rgba(0,255,136,.3);background:rgba(0,255,136,.07);color:#80ffbb}.loading{color:#888;background:#101010}`}</style></main>;
}
