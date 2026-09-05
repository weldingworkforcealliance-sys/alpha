'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase-browser';

interface School { id: string; name: string; status: string | null; }
interface Section { id: string; school_id: string; section_name: string | null; section_code: string | null; planned_instructional_days: number | null; }
interface SectionProgress { section_id: string; school_id: string; current_planner_day_number: number | null; manual_hold: boolean; hold_reason: string | null; completed_at: string | null; }
interface Membership { id: string; school_id: string; user_id: string; role: string; status: string; }
interface Profile { id: string; display_name: string | null; email: string | null; }
interface SectionInstructor { id: string; school_id: string; section_id: string; instructor_id: string; instructor_role: string | null; active: boolean; }
interface Delivery { id: string; school_id: string; section_id: string; delivery_status: string; started_at: string | null; }
interface AuditEvent { id: string; school_id: string | null; user_id: string | null; action: string; entity_type: string; entity_id: string | null; details: Record<string, unknown> | null; created_at: string; }

function titleCase(value: string | null | undefined) {
  if (!value) return '—';
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDateTime(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export default function OwnerAdminPage() {
  const router = useRouter();
  const [supabase] = useState(getSupabase);

  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [schoolFilter, setSchoolFilter] = useState('all');

  const [schools, setSchools] = useState<School[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [progress, setProgress] = useState<SectionProgress[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [assignments, setAssignments] = useState<SectionInstructor[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [audit, setAudit] = useState<AuditEvent[]>([]);

  const [classSectionId, setClassSectionId] = useState('');
  const [targetDay, setTargetDay] = useState('1');
  const [classReason, setClassReason] = useState('');

  const [assignSectionId, setAssignSectionId] = useState('');
  const [assignUserId, setAssignUserId] = useState('');
  const [assignRole, setAssignRole] = useState('instructor');
  const [assignReason, setAssignReason] = useState('');

  const [membershipId, setMembershipId] = useState('');
  const [membershipRole, setMembershipRole] = useState('instructor');
  const [membershipStatus, setMembershipStatus] = useState('active');
  const [membershipReason, setMembershipReason] = useState('');

  const [profileUserId, setProfileUserId] = useState('');
  const [profileName, setProfileName] = useState('');
  const [profileReason, setProfileReason] = useState('');
  const [passwordUserId, setPasswordUserId] = useState('');
  const [passwordReason, setPasswordReason] = useState('');

  const loadData = async () => {
    const [schoolsR, sectionsR, progressR, membershipsR, profilesR, assignmentsR, deliveriesR, auditR] = await Promise.all([
      supabase.from('schools').select('id, name, status').order('name'),
      supabase.from('sections').select('id, school_id, section_name, section_code, planned_instructional_days').order('section_name'),
      supabase.from('section_progress').select('section_id, school_id, current_planner_day_number, manual_hold, hold_reason, completed_at'),
      supabase.from('school_memberships').select('id, school_id, user_id, role, status'),
      supabase.from('profiles').select('id, display_name, email').order('display_name'),
      supabase.from('section_instructors').select('id, school_id, section_id, instructor_id, instructor_role, active'),
      supabase.from('planner_day_delivery').select('id, school_id, section_id, delivery_status, started_at'),
      supabase.from('audit_log').select('id, school_id, user_id, action, entity_type, entity_id, details, created_at').order('created_at', { ascending: false }).limit(500),
    ]);

    const firstError = [schoolsR.error, sectionsR.error, progressR.error, membershipsR.error, profilesR.error, assignmentsR.error, deliveriesR.error, auditR.error].find(Boolean);
    if (firstError) throw new Error(firstError?.message ?? 'Admin data query failed.');

    setSchools((schoolsR.data ?? []) as School[]);
    setSections((sectionsR.data ?? []) as Section[]);
    setProgress((progressR.data ?? []) as SectionProgress[]);
    setMemberships((membershipsR.data ?? []) as Membership[]);
    setProfiles((profilesR.data ?? []) as Profile[]);
    setAssignments((assignmentsR.data ?? []) as SectionInstructor[]);
    setDeliveries((deliveriesR.data ?? []) as Delivery[]);
    setAudit((auditR.data ?? []) as AuditEvent[]);
  };

  useEffect(() => {
    const init = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData.session) { router.push('/login'); return; }
        const { data: owner, error: ownerError } = await supabase.rpc('is_platform_owner');
        if (ownerError) throw ownerError;
        if (!owner) { setAuthorized(false); return; }
        setAuthorized(true);
        await loadData();
      } catch (err) {
        setError(messageOf(err));
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [router, supabase]);

  const schoolMap = useMemo(() => new Map(schools.map((s) => [s.id, s])), [schools]);
  const profileMap = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles]);
  const progressMap = useMemo(() => new Map(progress.map((p) => [p.section_id, p])), [progress]);

  const scopedSections = useMemo(() => schoolFilter === 'all' ? sections : sections.filter((s) => s.school_id === schoolFilter), [sections, schoolFilter]);
  const scopedMemberships = useMemo(() => schoolFilter === 'all' ? memberships : memberships.filter((m) => m.school_id === schoolFilter), [memberships, schoolFilter]);
  const scopedAudit = useMemo(() => schoolFilter === 'all' ? audit : audit.filter((a) => a.school_id === schoolFilter), [audit, schoolFilter]);

  const selectedClass = scopedSections.find((s) => s.id === classSectionId) ?? scopedSections[0] ?? null;
  const selectedClassProgress = selectedClass ? progressMap.get(selectedClass.id) ?? null : null;
  const currentDay = selectedClassProgress?.current_planner_day_number ?? 1;
  const maxDay = selectedClass?.planned_instructional_days ?? 1;
  const activeTimer = selectedClass ? deliveries.find((d) => d.section_id === selectedClass.id && d.delivery_status === 'in_progress') ?? null : null;

  const selectedAssignSection = scopedSections.find((s) => s.id === assignSectionId) ?? scopedSections[0] ?? null;
  const assignCandidates = useMemo(() => {
    if (!selectedAssignSection) return [];
    const ids = new Set(memberships.filter((m) => m.school_id === selectedAssignSection.school_id && m.status === 'active').map((m) => m.user_id));
    return profiles.filter((p) => ids.has(p.id));
  }, [selectedAssignSection, memberships, profiles]);
  const activeSectionAssignments = selectedAssignSection ? assignments.filter((a) => a.section_id === selectedAssignSection.id && a.active) : [];

  const selectedMembership = memberships.find((m) => m.id === membershipId) ?? scopedMemberships[0] ?? null;
  const selectedProfile = profileMap.get(profileUserId) ?? profiles[0] ?? null;

  useEffect(() => {
    if (scopedSections[0] && !scopedSections.some((s) => s.id === classSectionId)) setClassSectionId(scopedSections[0].id);
    if (scopedSections[0] && !scopedSections.some((s) => s.id === assignSectionId)) setAssignSectionId(scopedSections[0].id);
    if (scopedMemberships[0] && !scopedMemberships.some((m) => m.id === membershipId)) setMembershipId(scopedMemberships[0].id);
  }, [scopedSections, scopedMemberships, classSectionId, assignSectionId, membershipId]);

  useEffect(() => { setTargetDay(String(currentDay)); }, [selectedClass?.id, currentDay]);
  useEffect(() => {
    if (selectedMembership) { setMembershipRole(selectedMembership.role); setMembershipStatus(selectedMembership.status); }
  }, [selectedMembership?.id]);
  useEffect(() => {
    if (!profileUserId && profiles[0]) setProfileUserId(profiles[0].id);
    if (!passwordUserId && profiles[0]) setPasswordUserId(profiles[0].id);
  }, [profiles, profileUserId, passwordUserId]);
  useEffect(() => { if (selectedProfile) setProfileName(selectedProfile.display_name ?? ''); }, [selectedProfile?.id]);

  const runAction = async (fn: () => PromiseLike<{ error: { message: string } | null }>, success: string) => {
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await fn();
      if (result.error) throw new Error(result.error.message);
      setNotice(success);
      await loadData();
    } catch (err) { setError(messageOf(err)); }
    finally { setBusy(false); }
  };

  const applyDayOverride = async () => {
    if (!selectedClass) return;
    const target = Number(targetDay);
    if (!Number.isInteger(target) || target < 1 || target > maxDay) { setError(`Target day must be between 1 and ${maxDay}.`); return; }
    if (!classReason.trim()) { setError('A reason is required.'); return; }
    if (target === currentDay) { setError('Target day is already current.'); return; }
    const rewinding = target < currentDay;
    const ok = window.confirm(rewinding ? `Reset ${selectedClass.section_name ?? 'section'} from Day ${currentDay} to Day ${target}? Delivery records from Day ${target} onward will be archived first.` : `Move ${selectedClass.section_name ?? 'section'} forward from Day ${currentDay} to Day ${target}?`);
    if (!ok) return;
    await runAction(() => supabase.rpc(rewinding ? 'owner_reset_section_to_day' : 'owner_move_section_to_day', { p_section_id: selectedClass.id, p_target_day: target, p_reason: classReason.trim() }), rewinding ? `Section reset to Day ${target}.` : `Section moved to Day ${target}.`);
    setClassReason('');
  };

  const toggleHold = async () => {
    if (!selectedClass || !selectedClassProgress) return;
    if (!classReason.trim()) { setError('A reason is required.'); return; }
    const next = !selectedClassProgress.manual_hold;
    await runAction(() => supabase.rpc('owner_set_section_hold', { p_section_id: selectedClass.id, p_hold: next, p_reason: classReason.trim() }), next ? 'Section placed on hold.' : 'Section hold released.');
    setClassReason('');
  };

  const clearStart = async () => {
    if (!selectedClass || !activeTimer) return;
    if (!classReason.trim()) { setError('A reason is required.'); return; }
    if (!window.confirm('Clear this active class start? The timer row will be archived first.')) return;
    await runAction(() => supabase.rpc('owner_clear_active_section_start', { p_section_id: selectedClass.id, p_reason: classReason.trim() }), 'Accidental start cleared and archived.');
    setClassReason('');
  };

  const assignInstructor = async () => {
    if (!selectedAssignSection || !assignUserId) { setError('Choose a section and instructor.'); return; }
    if (!assignReason.trim()) { setError('A reason is required.'); return; }
    await runAction(() => supabase.rpc('owner_assign_instructor_to_section', { p_section_id: selectedAssignSection.id, p_instructor_id: assignUserId, p_instructor_role: assignRole, p_reason: assignReason.trim() }), 'Instructor assignment saved.');
    setAssignReason('');
  };

  const removeInstructor = async (userId: string) => {
    if (!selectedAssignSection) return;
    if (!assignReason.trim()) { setError('Enter a reason before removing an instructor.'); return; }
    const p = profileMap.get(userId);
    if (!window.confirm(`Remove ${p?.display_name ?? p?.email ?? 'this instructor'} from this section? Historical records remain.`)) return;
    await runAction(() => supabase.rpc('owner_remove_instructor_from_section', { p_section_id: selectedAssignSection.id, p_instructor_id: userId, p_reason: assignReason.trim() }), 'Instructor removed from active assignment.');
    setAssignReason('');
  };

  const updateMembership = async () => {
    if (!selectedMembership) return;
    if (!membershipReason.trim()) { setError('A reason is required.'); return; }
    if (['suspended', 'revoked'].includes(membershipStatus) && !window.confirm(`Set this membership to ${membershipStatus.toUpperCase()}? Active section assignments at this school will be disabled.`)) return;
    await runAction(() => supabase.rpc('owner_update_school_membership', { p_membership_id: selectedMembership.id, p_role: membershipRole, p_status: membershipStatus, p_reason: membershipReason.trim() }), 'School membership updated.');
    setMembershipReason('');
  };

  const updateName = async () => {
    if (!selectedProfile) return;
    if (!profileName.trim() || !profileReason.trim()) { setError('Display name and reason are required.'); return; }
    await runAction(() => supabase.rpc('owner_update_profile_display_name', { p_user_id: selectedProfile.id, p_display_name: profileName.trim(), p_reason: profileReason.trim() }), 'Display name updated.');
    setProfileReason('');
  };

  const sendReset = async () => {
    const p = profileMap.get(passwordUserId);
    if (!p?.email) { setError('Selected user has no profile email.'); return; }
    if (!passwordReason.trim()) { setError('A reason is required to send a password reset email.'); return; }
    setBusy(true); setError(''); setNotice('');
    try {
      const { error: e } = await supabase.auth.resetPasswordForEmail(p.email, { redirectTo: `${window.location.origin}/reset-password` });
      if (e) throw e;
      const { error: auditError } = await supabase.rpc('write_audit_event', {
        check_school_id: null,
        p_action: 'owner_send_password_reset',
        p_entity_type: 'profile',
        p_entity_id: p.id,
        p_details: { email: p.email, reason: passwordReason.trim() },
      });
      if (auditError) throw auditError;
      setNotice(`Password reset email sent to ${p.email}.`);
      setPasswordReason('');
    } catch (err) { setError(messageOf(err)); }
    finally { setBusy(false); }
  };

  if (loading) return <main className="shell centered"><div className="spinner"/><p>Verifying Platform Owner access…</p><style jsx>{styles}</style></main>;
  if (!authorized) return <main className="shell centered"><section className="card"><div className="eyebrow">Private Platform Area</div><h1>Access denied</h1><p>This area is restricted to the Platform Owner.</p><button onClick={() => router.push('/dashboard')}>Return to Dashboard</button></section><style jsx>{styles}</style></main>;

  return <div className="shell">
    <header className="topbar">
      <div><div className="eyebrow">Living Teacher Planner</div><h1>God-Level Administration</h1></div>
      <div className="nav"><button onClick={() => router.push('/owner')}>Owner Dashboard</button><button onClick={() => router.push('/school')}>School Dashboard</button><button onClick={() => router.push('/dashboard')}>Teacher Dashboard</button></div>
    </header>

    <main className="page">
      <section className="heading"><div><div className="eyebrow">Platform Owner Only</div><h2>Admin Control Center</h2><p>Live operational controls with required reasons, confirmations, and audit logging.</p></div>
        <label>Scope<select value={schoolFilter} onChange={(e) => setSchoolFilter(e.target.value)}><option value="all">All Schools</option>{schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      </section>

      {error && <div className="error">{error}</div>}
      {notice && <div className="notice">{notice}</div>}

      <div className="warning"><strong>High-impact area</strong><span>Curriculum and approved course outcomes are not editable here. These controls affect operations, access, assignments, and class progress only.</span></div>

      <div className="grid">
        <section className="panel">
          <div className="eyebrow">Class Control</div><h3>Reset / Move / Hold</h3>
          <label>Section<select value={selectedClass?.id ?? ''} onChange={(e) => setClassSectionId(e.target.value)}>{scopedSections.map((s) => <option key={s.id} value={s.id}>{schoolMap.get(s.school_id)?.name ?? 'School'} · {s.section_name ?? s.section_code ?? 'Section'}</option>)}</select></label>
          {selectedClass && <div className="summary"><span>Current Day<strong>{currentDay} / {maxDay}</strong></span><span>Hold<strong>{selectedClassProgress?.manual_hold ? 'YES' : 'No'}</strong></span><span>Active Timer<strong>{activeTimer ? 'YES' : 'No'}</strong></span></div>}
          <label>Target Planner Day<input type="number" min={1} max={maxDay} value={targetDay} onChange={(e) => setTargetDay(e.target.value)}/></label>
          <label>Required Reason<textarea value={classReason} onChange={(e) => setClassReason(e.target.value)} placeholder="Why is this override necessary?"/></label>
          <div className="actions"><button className="primary" disabled={busy || !selectedClass} onClick={applyDayOverride}>Apply Day Override</button><button disabled={busy || !selectedClassProgress} onClick={toggleHold}>{selectedClassProgress?.manual_hold ? 'Release Hold' : 'Place On Hold'}</button><button className="danger" disabled={busy || !activeTimer} onClick={clearStart}>Clear Accidental Start</button></div>
        </section>

        <section className="panel">
          <div className="eyebrow">Instructor Control</div><h3>Assign / Remove</h3>
          <label>Section<select value={selectedAssignSection?.id ?? ''} onChange={(e) => { setAssignSectionId(e.target.value); setAssignUserId(''); }}>{scopedSections.map((s) => <option key={s.id} value={s.id}>{schoolMap.get(s.school_id)?.name ?? 'School'} · {s.section_name ?? s.section_code ?? 'Section'}</option>)}</select></label>
          <label>Instructor / School Member<select value={assignUserId} onChange={(e) => setAssignUserId(e.target.value)}><option value="">Select person</option>{assignCandidates.map((p) => <option key={p.id} value={p.id}>{p.display_name ?? p.email ?? p.id}</option>)}</select></label>
          <label>Section Role<select value={assignRole} onChange={(e) => setAssignRole(e.target.value)}><option value="lead_instructor">Lead Instructor</option><option value="instructor">Instructor</option><option value="assistant">Assistant</option></select></label>
          <label>Required Reason<textarea value={assignReason} onChange={(e) => setAssignReason(e.target.value)} placeholder="Reason for assignment change"/></label>
          <button className="primary full" disabled={busy || !assignUserId} onClick={assignInstructor}>Assign / Update Instructor</button>
          <div className="list"><strong>Current Active Assignments</strong>{activeSectionAssignments.length === 0 && <span>No active instructors assigned.</span>}{activeSectionAssignments.map((a) => { const p = profileMap.get(a.instructor_id); return <div className="row" key={a.id}><div><strong>{p?.display_name ?? p?.email ?? a.instructor_id}</strong><span>{titleCase(a.instructor_role)}</span></div><button className="danger" disabled={busy} onClick={() => removeInstructor(a.instructor_id)}>Remove</button></div>; })}</div>
        </section>

        <section className="panel">
          <div className="eyebrow">User Control</div><h3>Role / School Access</h3>
          <label>School Membership<select value={selectedMembership?.id ?? ''} onChange={(e) => setMembershipId(e.target.value)}>{scopedMemberships.map((m) => { const p = profileMap.get(m.user_id); return <option key={m.id} value={m.id}>{schoolMap.get(m.school_id)?.name ?? 'School'} · {p?.display_name ?? p?.email ?? m.user_id}</option>; })}</select></label>
          <label>School Role<select value={membershipRole} onChange={(e) => setMembershipRole(e.target.value)}><option value="school_admin">School Admin</option><option value="program_lead">Program Lead</option><option value="lead_instructor">Lead Instructor</option><option value="instructor">Instructor</option><option value="viewer">Viewer</option></select></label>
          <label>Membership Status<select value={membershipStatus} onChange={(e) => setMembershipStatus(e.target.value)}><option value="invited">Invited</option><option value="active">Active</option><option value="suspended">Suspended</option><option value="revoked">Revoked</option></select></label>
          <label>Required Reason<textarea value={membershipReason} onChange={(e) => setMembershipReason(e.target.value)} placeholder="Reason for role/status change"/></label>
          <button className="primary full" disabled={busy || !selectedMembership} onClick={updateMembership}>Update School Access</button>
        </section>

        <section className="panel">
          <div className="eyebrow">Account Profile</div><h3>Name / Password Help</h3>
          <label>User<select value={selectedProfile?.id ?? ''} onChange={(e) => setProfileUserId(e.target.value)}>{profiles.map((p) => <option key={p.id} value={p.id}>{p.display_name ?? p.email ?? p.id}</option>)}</select></label>
          <label>Display Name<input value={profileName} onChange={(e) => setProfileName(e.target.value)}/></label>
          <label>Required Reason<textarea value={profileReason} onChange={(e) => setProfileReason(e.target.value)} placeholder="Reason for profile name change"/></label>
          <button className="primary full" disabled={busy || !selectedProfile} onClick={updateName}>Update Display Name</button>
          <div className="divider"/>
          <label>Password Reset User<select value={passwordUserId} onChange={(e) => setPasswordUserId(e.target.value)}>{profiles.map((p) => <option key={p.id} value={p.id}>{p.display_name ?? 'User'} · {p.email ?? 'No email'}</option>)}</select></label>
          <label>Required Reason<textarea value={passwordReason} onChange={(e) => setPasswordReason(e.target.value)} placeholder="Reason for sending password reset"/></label>
          <button className="full" disabled={busy || !profileMap.get(passwordUserId)?.email} onClick={sendReset}>Send Password Reset Email</button>
          <div className="locked"><strong>Login Email Change</strong><span>Intentionally not exposed in browser code. Updating another user&apos;s Supabase Auth login email requires privileged Auth administration.</span></div>
        </section>
      </div>

      <section className="panel audit">
        <div className="panelHead"><div><div className="eyebrow">Accountability</div><h3>Audit Log</h3></div><span>Latest {scopedAudit.length} events</span></div>
        <div className="tableWrap"><table><thead><tr><th>When</th><th>School</th><th>User</th><th>Action</th><th>Entity</th><th>Details</th></tr></thead><tbody>{scopedAudit.slice(0,250).map((a) => <tr key={a.id}><td>{formatDateTime(a.created_at)}</td><td>{a.school_id ? schoolMap.get(a.school_id)?.name ?? 'Unknown school' : 'Platform'}</td><td>{a.user_id ? profileMap.get(a.user_id)?.display_name ?? profileMap.get(a.user_id)?.email ?? a.user_id : 'System'}</td><td><strong>{titleCase(a.action)}</strong></td><td>{titleCase(a.entity_type)}{a.entity_id && <small>{a.entity_id}</small>}</td><td><code>{JSON.stringify(a.details ?? {})}</code></td></tr>)}</tbody></table></div>
      </section>
    </main>
    <style jsx>{styles}</style>
  </div>;
}

const styles = `
  :global(body){background:#080808}.shell{min-height:100vh;background:radial-gradient(circle at 12% 0%,rgba(0,255,136,.08),transparent 28rem),#080808;color:#e0e0e0}.centered{display:grid;place-items:center;align-content:center;gap:16px;padding:24px}.topbar{min-height:84px;padding:18px 28px;border-bottom:1px solid #252525;background:#101010;display:flex;justify-content:space-between;align-items:center;gap:20px}.nav{display:flex;gap:9px;flex-wrap:wrap}.nav button,.actions button,.panel>button,.row button,.card button{padding:10px 14px;border:1px solid #303030;border-radius:7px;background:#171717;color:#e8e8e8;font-weight:700;cursor:pointer}.nav button:hover,.actions button:hover:not(:disabled),.panel>button:hover:not(:disabled){border-color:#00ff88;color:#00ff88}button:disabled{opacity:.5;cursor:not-allowed}.page{width:min(1500px,calc(100% - 36px));margin:0 auto;padding:30px 0 60px}.heading{display:flex;justify-content:space-between;align-items:end;gap:20px;margin-bottom:18px}.heading p{color:#888;margin-top:6px}.heading>label{min-width:270px}.eyebrow{color:#00ff88;text-transform:uppercase;letter-spacing:.12em;font-size:11px;font-weight:800}h1,h2,h3,p{margin:0}h1{color:#fff;font-size:25px}h2{color:#fff;font-size:36px}h3{color:#fff;font-size:21px;margin:4px 0 12px}.warning,.error,.notice{padding:13px 15px;border-radius:8px;margin-bottom:16px}.warning{display:grid;gap:3px;border:1px solid rgba(255,154,82,.4);background:rgba(255,154,82,.07);color:#a98b76}.warning strong{color:#ffb277}.error{border:1px solid rgba(255,90,90,.35);background:rgba(255,90,90,.08);color:#ff8b8b}.notice{border:1px solid rgba(0,255,136,.3);background:rgba(0,255,136,.07);color:#80ffbb}.grid{display:grid;grid-template-columns:repeat(2,minmax(320px,1fr));gap:18px}.panel{border:1px solid #292929;border-radius:10px;background:#151515;padding:22px;display:grid;align-content:start;gap:13px}.panel label,.heading label{display:grid;gap:7px;color:#888;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.06em}.panel select,.panel input,.panel textarea,.heading select{width:100%;padding:11px 13px;border-radius:7px;border:1px solid #303030;background:#101010;color:#eee;font:inherit}.panel textarea{min-height:76px;resize:vertical}.summary{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.summary span{padding:10px;background:#101010;border-radius:7px;color:#777;font-size:11px}.summary strong{display:block;color:#eee;font-size:17px;margin-top:2px}.actions{display:flex;gap:8px;flex-wrap:wrap}.primary{border-color:rgba(0,255,136,.5)!important;color:#00ff88!important;background:rgba(0,255,136,.06)!important}.danger{border-color:rgba(255,100,100,.35)!important;color:#ff8888!important}.full{width:100%}.list{display:grid;gap:8px;margin-top:6px;padding-top:13px;border-top:1px solid #2a2a2a}.list>strong,.list>span{font-size:12px;color:#888}.row{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px;background:#101010;border-radius:7px}.row>div{display:grid;gap:2px}.row strong{font-size:12px;color:#e3e3e3}.row span{font-size:10px;color:#777}.divider{height:1px;background:#2b2b2b;margin:3px 0}.locked{display:grid;gap:4px;padding:12px;border:1px solid #2b2b2b;border-radius:7px;background:#101010}.locked strong{font-size:12px;color:#aaa}.locked span{font-size:11px;color:#747474;line-height:1.5}.audit{margin-top:18px}.panelHead{display:flex;justify-content:space-between;align-items:start;gap:15px}.panelHead>span{font-size:12px;color:#777}.tableWrap{overflow-x:auto}table{width:100%;border-collapse:collapse;min-width:900px}th{padding:10px 11px;text-align:left;color:#666;text-transform:uppercase;letter-spacing:.05em;font-size:10px;border-bottom:1px solid #2b2b2b}td{padding:12px 11px;border-bottom:1px solid #242424;color:#ccc;font-size:12px;vertical-align:top}td small{display:block;color:#666;margin-top:3px}code{display:block;max-width:460px;white-space:pre-wrap;word-break:break-word;color:#929292;font-size:10px}.spinner{width:42px;height:42px;border:3px solid #2b2b2b;border-top-color:#00ff88;border-radius:50%;animation:spin .8s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}.card{width:min(520px,100%);padding:28px;border:1px solid #292929;border-radius:10px;background:#151515}.card h1{margin:5px 0 10px}.card p{color:#999;margin-bottom:18px}@media(max-width:850px){.grid{grid-template-columns:1fr}}@media(max-width:760px){.topbar,.heading{flex-direction:column;align-items:flex-start}.nav{width:100%}.nav button{flex:1}.page{width:min(100% - 24px,1500px)}.heading>label{min-width:0;width:100%}}@media(max-width:480px){.summary{grid-template-columns:1fr}.panel{padding:16px}}
`;
