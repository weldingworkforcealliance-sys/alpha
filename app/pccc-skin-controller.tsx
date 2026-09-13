'use client';

import { useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabase-browser';

type Membership = { school_id: string; role: string | null; status: string | null };
type School = { id: string; name: string | null };
type SkinMode = 'school' | 'instructor' | 'demo' | null;

const SCHOOL_CONTEXT_PREFIXES = [
  '/school', '/accounts', '/reports', '/owner/school', '/time-clock/payroll',
  '/attendance/history', '/attendance/corrections',
];
const SCHOOL_ACCESS_ROLES = new Set(['school_admin', 'program_lead', 'viewer']);
const PCCC_SKIN_CLASSES = ['pccc-welding-skin', 'pccc-school-skin', 'pccc-instructor-skin', 'pccc-demo-skin'];

function isPcccName(name: string | null | undefined) {
  const normalized = (name ?? '').trim().toLowerCase();
  return (
    normalized === 'pccc' ||
    normalized.includes('passaic county community college') ||
    normalized.includes('pccc welding') ||
    (normalized.includes('passaic') && normalized.includes('community college'))
  );
}

function isSchoolContext(pathname: string) {
  return SCHOOL_CONTEXT_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function skinClassForMode(mode: SkinMode) {
  if (mode === 'school') return 'pccc-school-skin';
  if (mode === 'instructor') return 'pccc-instructor-skin';
  if (mode === 'demo') return 'pccc-demo-skin';
  return null;
}

function applyPcccClasses(mode: SkinMode) {
  if (typeof document === 'undefined') return;
  const targets = [document.documentElement, document.body];
  const modeClass = skinClassForMode(mode);

  targets.forEach((target) => {
    PCCC_SKIN_CLASSES.forEach((className) => target.classList.remove(className));
    if (mode && modeClass) {
      target.classList.add('pccc-welding-skin', modeClass);
      target.dataset.pcccAccess = mode;
    } else {
      delete target.dataset.pcccAccess;
    }
  });
}

export default function PcccSkinController({ pathname }: { pathname: string }) {
  const [supabase] = useState(getSupabase);

  useEffect(() => {
    let cancelled = false;
    let activeMode: SkinMode = null;

    const setMode = (mode: SkinMode) => {
      if (cancelled) return;
      activeMode = mode;
      applyPcccClasses(mode);
    };

    // RootLayout owns body.className and can rewrite it during client renders.
    // Keep the tenant skin attached after those renders instead of allowing a partial skin flash/dropout.
    const observer = new MutationObserver(() => {
      if (!activeMode) return;
      const requiredClass = skinClassForMode(activeMode);
      if (
        !document.body.classList.contains('pccc-welding-skin') ||
        (requiredClass && !document.body.classList.contains(requiredClass))
      ) {
        applyPcccClasses(activeMode);
      }
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });

    const apply = async () => {
      setMode(null);

      if (pathname.startsWith('/demo/welding') || pathname.startsWith('/demo/time-clock')) {
        setMode('demo');
        return;
      }
      if (pathname.startsWith('/demo') || pathname === '/' || pathname.startsWith('/login')) return;

      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData.session?.user.id;
        if (!userId || cancelled) return;

        const [ownerResult, membershipResult] = await Promise.all([
          supabase.rpc('is_platform_owner'),
          supabase
            .from('school_memberships')
            .select('school_id,role,status')
            .eq('user_id', userId)
            .eq('status', 'active'),
        ]);

        const isOwner = Boolean(ownerResult.data);
        if (membershipResult.error && !isOwner) return;

        const rows = ((membershipResult.data ?? []) as Membership[]).filter((row) => row.school_id);
        const schoolIds = Array.from(new Set(rows.map((row) => row.school_id)));

        let schools: School[] = [];
        if (isOwner) {
          const schoolResult = await supabase
            .from('schools')
            .select('id,name')
            .eq('status', 'active');
          if (schoolResult.error || cancelled) return;
          schools = (schoolResult.data ?? []) as School[];
        } else {
          if (!schoolIds.length) return;
          const schoolResult = await supabase
            .from('schools')
            .select('id,name')
            .in('id', schoolIds);
          if (schoolResult.error || cancelled) return;
          schools = (schoolResult.data ?? []) as School[];
        }

        const pcccSchoolIds = new Set(schools.filter((school) => isPcccName(school.name)).map((school) => school.id));
        if (!pcccSchoolIds.size) return;

        const pcccMembership = rows.find((row) => pcccSchoolIds.has(row.school_id)) ?? null;
        if (!pcccMembership && !isOwner) return;

        const roleUsesSchoolPortal = Boolean(
          pcccMembership?.role && SCHOOL_ACCESS_ROLES.has(pcccMembership.role)
        );
        const schoolAccess = isSchoolContext(pathname) || roleUsesSchoolPortal;
        setMode(schoolAccess ? 'school' : 'instructor');
      } catch (error) {
        console.error('Unable to apply PCCC Welding skin:', error);
      }
    };

    void apply();
    const { data: authListener } = supabase.auth.onAuthStateChange(() => { void apply(); });

    return () => {
      cancelled = true;
      observer.disconnect();
      authListener.subscription.unsubscribe();
      applyPcccClasses(null);
    };
  }, [pathname, supabase]);

  return null;
}
