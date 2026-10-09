'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { getSupabase } from '@/lib/supabase-browser';
import { SCHOOL_DASHBOARD_ROLES } from '@/lib/access-roles';

export default function PlannerUtilityNavLinks() {
  const pathname = usePathname();
  const [supabase] = useState(getSupabase);
  const [canOpenSchool, setCanOpenSchool] = useState(false);
  const [canOpenOwner, setCanOpenOwner] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const { data: auth } = await supabase.auth.getSession();
      const userId = auth.session?.user.id;
      if (!userId || cancelled) return;

      const [ownerResult, membershipResult] = await Promise.all([
        supabase.rpc('is_platform_owner'),
        supabase
          .from('school_memberships')
          .select('role,status')
          .eq('user_id', userId)
          .eq('status', 'active'),
      ]);

      if (cancelled) return;
      const owner = Boolean(ownerResult.data);
      const school = (membershipResult.data ?? []).some(
        (row: { role: string | null }) =>
          Boolean(row.role && SCHOOL_DASHBOARD_ROLES.has(row.role))
      );
      setCanOpenOwner(owner);
      setCanOpenSchool(owner || school);
    })();

    return () => {
      cancelled = true;
    };
  }, [supabase]);

  return (
    <>
      <Link
        href="/training"
        className={`ltg-nav-link ${pathname.startsWith('/training') ? 'active' : ''}`}
      >
        Training Mode
      </Link>
      {canOpenSchool && (
        <Link
          href="/school"
          className={`ltg-nav-link ${pathname.startsWith('/school') ? 'active' : ''}`}
        >
          School Dashboard
        </Link>
      )}
      {canOpenOwner && (
        <Link
          href="/owner"
          className={`ltg-nav-link ${pathname.startsWith('/owner') ? 'active' : ''}`}
        >
          Owner Dashboard
        </Link>
      )}
    </>
  );
}
