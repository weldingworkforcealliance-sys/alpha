'use client';

import { useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabase-browser';

type Membership = {
  school_id: string;
  role: string | null;
  status: string | null;
};

type School = {
  id: string;
  name: string | null;
};

const SCHOOL_CONTEXT_PREFIXES = [
  '/school',
  '/accounts',
  '/reports',
  '/owner/school',
  '/time-clock/payroll',
  '/attendance/history',
  '/attendance/corrections',
];

const SCHOOL_ACCESS_ROLES = new Set(['school_admin', 'program_lead', 'viewer']);

function isPcccName(name: string | null | undefined) {
  const normalized = (name ?? '').trim().toLowerCase();
  return (
    normalized === 'pccc' ||
    normalized.includes('passaic county community college') ||
    normalized.includes('pccc welding')
  );
}

function isSchoolContext(pathname: string) {
  return SCHOOL_CONTEXT_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

function clearPcccClasses() {
  if (typeof document === 'undefined') return;
  document.body.classList.remove(
    'pccc-welding-skin',
    'pccc-school-skin',
    'pccc-instructor-skin',
    'pccc-demo-skin'
  );
  delete document.body.dataset.pcccAccess;
}

export default function PcccSkinController({ pathname }: { pathname: string }) {
  const [supabase] = useState(getSupabase);

  useEffect(() => {
    let cancelled = false;

    const apply = async () => {
      clearPcccClasses();

      if (pathname.startsWith('/demo/welding') || pathname.startsWith('/demo/time-clock')) {
        document.body.classList.add('pccc-welding-skin', 'pccc-demo-skin');
        document.body.dataset.pcccAccess = 'demo';
        return;
      }

      if (pathname.startsWith('/demo') || pathname === '/' || pathname.startsWith('/login')) {
        return;
      }

      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData.session?.user.id;
        if (!userId || cancelled) return;

        const { data: memberships, error: membershipError } = await supabase
          .from('school_memberships')
          .select('school_id,role,status')
          .eq('user_id', userId)
          .eq('status', 'active');

        if (membershipError || cancelled) return;

        const rows = (memberships ?? []) as Membership[];
        const schoolIds = Array.from(new Set(rows.map((row) => row.school_id).filter(Boolean)));
        if (!schoolIds.length) return;

        const { data: schools, error: schoolError } = await supabase
          .from('schools')
          .select('id,name')
          .in('id', schoolIds);

        if (schoolError || cancelled) return;

        const pcccSchoolIds = new Set(
          ((schools ?? []) as School[])
            .filter((school) => isPcccName(school.name))
            .map((school) => school.id)
        );

        const pcccMembership = rows.find((row) => pcccSchoolIds.has(row.school_id));
        if (!pcccMembership || cancelled) return;

        const roleUsesSchoolPortal = Boolean(
          pcccMembership.role && SCHOOL_ACCESS_ROLES.has(pcccMembership.role)
        );
        const schoolAccess = roleUsesSchoolPortal || isSchoolContext(pathname);

        document.body.classList.add(
          'pccc-welding-skin',
          schoolAccess ? 'pccc-school-skin' : 'pccc-instructor-skin'
        );
        document.body.dataset.pcccAccess = schoolAccess ? 'school' : 'instructor';
      } catch (error) {
        console.error('Unable to apply PCCC Welding skin:', error);
      }
    };

    void apply();

    const { data: authListener } = supabase.auth.onAuthStateChange(() => {
      void apply();
    });

    return () => {
      cancelled = true;
      authListener.subscription.unsubscribe();
      clearPcccClasses();
    };
  }, [pathname, supabase]);

  return null;
}
