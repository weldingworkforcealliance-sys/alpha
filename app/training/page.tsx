'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase-browser';

interface School { id:string; name:string; }
interface Membership { id:string; school_id:string; user_id:string; role:string; status:string; }
interface SessionRow { id:string; school_id:string; created_by:string; session_name:string; status:string; started_at:string; expires_at:string; last_activity_at:string; }
interface ReportRow { report_id:string; school_id:string; session_name:string; created_at:string; expires_at:string; }

function fmt(value:string) {
  return new Date(value).toLocaleString('en-US', { month:'short', day:'numeric', hour:'numeric', minute:'2-digit' });
}

export default function TrainingHubPage() {
  const router = useRouter();
  const [supabase] = useState(getSupabase);

  const [loading,setLoading] = useState(true);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const [notice,setNotice] = useState('');
  const [owner,setOwner] = useState(false);
  const [schools,setSchools] = useState<School[]>([]);
  const [memberships,setMemberships] = useState<Membership[]>([]);
  const [sessions,setSessions] = useState<SessionRow[]>([]);
  const [reports,setReports] = useState<ReportRow[]>([]);
  const [schoolId,setSchoolId] = useState('');
  const [sessionName,setSessionName] = useState('Instructor Training Session');

  const schoolMap = useMemo(() => new Map(schools.map(s => [s.id,s])), [schools]);

  const load = async () => {
    setError('');
    const { data: auth } = await supabase.auth.getSession();
    if (!auth.session) {
      router.replace('/training/login');
      return;
    }
    const uid = auth.session.user.id;

    const [ownerResult, membershipResult, schoolResult, sessionResult, reportResult] = await Promise.all([
      supabase.rpc('is_platform_owner'),
      supabase.from('school_memberships').select('id,school_id,user_id,role,status').eq('user_id', uid).eq('status','active'),
      supabase.from('schools').select('id,name').order('name'),
      supabase.from('training_sessions').select('id,school_id,created_by,session_name,status,started_at,expires_at,last_activity_at').eq('status','active').gt('expires_at', new Date().toISOString()).order('started_at',{ascending:false}),
      supabase.rpc('get_pending_training_reports'),
    ]);

    const first = [ownerResult.error,membershipResult.error,schoolResult.error,sessionResult.error,reportResult.error].find(Boolean);
    if (first) throw new Error(first?.message ?? 'Training Center failed to load.');

    setOwner(Boolean(ownerResult.data));
    setMemberships((membershipResult.data ?? []) as Membership[]);
    setSchools((schoolResult.data ?? []) as School[]);
    setSessions((sessionResult.data ?? []) as SessionRow[]);
    setReports((reportResult.data ?? []) as ReportRow[]);

    const allowedIds = new Set(((membershipResult.data ?? []) as Membership[]).map(m => m.school_id));
    const firstSchool = (schoolResult.data ?? []).find((s:any) => ownerResult.data || allowedIds.has(s.id));
    if (!schoolId && firstSchool) setSchoolId(firstSchool.id);
  };

  useEffect(() => {
    load().catch(err => setError(err instanceof Error ? err.message : String(err))).finally(() => setLoading(false));
  }, []);

  const manageableSchoolIds = useMemo(() => {
    const ids = new Set<string>();
    memberships.forEach(m => {
      if (['school_admin','program_lead'].includes(m.role)) ids.add(m.school_id);
    });
    if (owner) schools.forEach(s => ids.add(s.id));
    return ids;
  }, [memberships,owner,schools]);

  const visibleSchools = schools.filter(s => owner || memberships.some(m => m.school_id === s.id));
  const canCreate = schoolId && manageableSchoolIds.has(schoolId);

  const createSession = async () => {
    if (!schoolId || !sessionName.trim()) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const { data, error: rpcError } = await supabase.rpc('create_training_session', {
        p_school_id: schoolId,
        p_session_name: sessionName.trim(),
      });
      if (rpcError) throw rpcError;
      router.push(`/training/session/${data}/teacher`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally { setBusy(false); }
  };

  const joinSession = async (id:string) => {
    setBusy(true); setError(''); setNotice('');
    try {
      const { error: rpcError } = await supabase.rpc('join_training_session', { p_training_session_id:id });
      if (rpcError) throw rpcError;
      router.push(`/training/session/${id}/teacher`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally { setBusy(false); }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    router.push('/training/login');
  };

  if (loading) return <main className="loading">Loading Training Center…</main>;

  return (
    <div className="shell">
      <div className="banner">TRAINING MODE · TEMPORARY SANDBOX · NOT PRODUCTION REPORTING</div>

      <header>
        <div><div className="eyebrow">Living Teacher Planner</div><h1>Training Center</h1></div>
        <div className="actions">
          <button onClick={() => router.push('/dashboard')}>Live Platform</button>
          <button onClick={() => router.push('/demo')}>Try Demo</button>
          <button onClick={signOut}>Log Out</button>
        </div>
      </header>

      <main>
        {error && <div className="error">{error}</div>}
        {notice && <div className="notice">{notice}</div>}

        <div className="grid">
          <section className="panel">
            <div className="eyebrow">Start Training</div>
            <h2>Create School Training Session</h2>
            <p>School Admins and Program Leads can open a shared training room. Instructors from the same school join separately with their own accounts.</p>

            <label>
              School
              <select value={schoolId} onChange={e => setSchoolId(e.target.value)}>
                {visibleSchools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>

            <label>
              Session Name
              <input value={sessionName} onChange={e => setSessionName(e.target.value)} />
            </label>

            <button className="primary full" disabled={busy || !canCreate} onClick={createSession}>
              {canCreate ? 'Create Training Session' : 'School Admin / Program Lead Required'}
            </button>
          </section>

          <section className="panel">
            <div className="eyebrow">Join Together</div>
            <h2>Active Training Sessions</h2>

            <div className="session-list">
              {sessions.filter(s => owner || memberships.some(m => m.school_id === s.school_id)).map(s => (
                <div className="session" key={s.id}>
                  <div>
                    <strong>{s.session_name}</strong>
                    <span>{schoolMap.get(s.school_id)?.name ?? 'School'}</span>
                    <small>Started {fmt(s.started_at)} · expires {fmt(s.expires_at)}</small>
                  </div>
                  <button disabled={busy} onClick={() => joinSession(s.id)}>Join Session</button>
                </div>
              ))}
              {sessions.length === 0 && <div className="empty">No active training sessions.</div>}
            </div>
          </section>
        </div>

        <section className="panel reports">
          <div className="eyebrow">School Admin</div>
          <h2>Training Reports Inbox</h2>
          <p>Final training reports are temporary. Open/download them, then acknowledge receipt to delete the remaining report envelope.</p>

          <div className="session-list">
            {reports.map(r => (
              <div className="session" key={r.report_id}>
                <div>
                  <strong>{r.session_name}</strong>
                  <span>{schoolMap.get(r.school_id)?.name ?? 'School'}</span>
                  <small>Created {fmt(r.created_at)} · expires {fmt(r.expires_at)}</small>
                </div>
                <button onClick={() => router.push(`/training/report/${r.report_id}`)}>Open Report</button>
              </div>
            ))}
            {reports.length === 0 && <div className="empty">No pending training reports for your account.</div>}
          </div>
        </section>
      </main>

      <style jsx>{`
        .shell{min-height:100vh;background:#080808;color:#ddd}.loading{min-height:100vh;display:grid;place-items:center;background:#080808;color:#aaa}
        .banner{position:sticky;top:0;z-index:20;padding:9px;text-align:center;background:#9a4d13;color:#fff;font-size:11px;font-weight:900;letter-spacing:.08em}
        header{display:flex;justify-content:space-between;gap:20px;align-items:center;padding:20px 28px;border-bottom:1px solid #262626;background:#111}
        .eyebrow{color:#ffad70;text-transform:uppercase;letter-spacing:.12em;font-size:10px;font-weight:900}h1,h2{margin:4px 0;color:#fff}h1{font-size:24px}h2{font-size:20px}
        .actions{display:flex;gap:8px;flex-wrap:wrap}button{padding:10px 13px;border:1px solid #303030;border-radius:7px;background:#151515;color:#ddd;font-weight:750;cursor:pointer}button:hover:not(:disabled){border-color:#ffad70;color:#ffad70}button:disabled{opacity:.45;cursor:not-allowed}
        main{width:min(1200px,calc(100% - 28px));margin:auto;padding:24px 0 50px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.panel{padding:20px;border:1px solid #292929;border-radius:10px;background:#141414}.panel p{color:#808080;line-height:1.5}
        label{display:grid;gap:7px;margin-top:14px;color:#888;font-size:11px;font-weight:800;text-transform:uppercase}select,input{padding:11px 12px;border:1px solid #303030;border-radius:7px;background:#0d0d0d;color:#eee;font:inherit}.full{width:100%;margin-top:14px}.primary{border-color:rgba(255,154,82,.5);color:#ffad70;background:rgba(255,154,82,.07)}
        .session-list{display:grid;gap:9px;margin-top:15px}.session{display:flex;justify-content:space-between;gap:12px;align-items:center;padding:12px;border:1px solid #282828;border-radius:8px;background:#101010}.session>div{display:grid;gap:3px}.session strong{color:#eee}.session span{color:#aaa;font-size:12px}.session small{color:#666;font-size:10px}.reports{margin-top:16px}.empty{padding:20px;text-align:center;color:#666}
        .error,.notice{margin-bottom:14px;padding:11px 13px;border-radius:7px;font-size:12px}.error{border:1px solid rgba(255,80,80,.35);color:#ff9090;background:rgba(255,80,80,.07)}.notice{border:1px solid rgba(0,255,136,.3);color:#80ffbb;background:rgba(0,255,136,.06)}
        @media(max-width:800px){header{align-items:flex-start;flex-direction:column}.grid{grid-template-columns:1fr}.session{align-items:flex-start;flex-direction:column}.session button{width:100%}}
      `}</style>
    </div>
  );
}
