'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase-browser';
import { SCHOOL_DASHBOARD_ROLES } from '@/lib/access-roles';
import { guardedSignOut } from '@/lib/guarded-signout';

export default function PlannerUtilityNavLinks() {
  const router = useRouter();
  const [supabase] = useState(getSupabase);
  const [canOpenSchool, setCanOpenSchool] = useState(false);
  const [canOpenOwner, setCanOpenOwner] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
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
        (row: { role: string | null }) => Boolean(row.role && SCHOOL_DASHBOARD_ROLES.has(row.role))
      );
      setCanOpenOwner(owner);
      setCanOpenSchool(owner || school);
    })();

    return () => {
      cancelled = true;
    };
  }, [supabase]);

  const signOut = async () => {
    await guardedSignOut();
    router.replace('/login');
  };

  return (
    <>
      <div className="ltg-nav-section-label">Teaching Tools</div>
      <Link href="/classroom" className="ltg-nav-link">
        Live Classroom
      </Link>
      <Link href="/training" className="ltg-nav-link">
        Training Mode
      </Link>
      {canOpenSchool && (
        <Link href="/school" className="ltg-nav-link">
          School Dashboard
        </Link>
      )}
      {canOpenOwner && (
        <Link href="/owner" className="ltg-nav-link">
          Owner Dashboard
        </Link>
      )}
      <button
        type="button"
        className="ltg-nav-link"
        onClick={signOut}
        style={{ width: '100%', textAlign: 'left', border: 0, cursor: 'pointer' }}
      >
        Sign Out
      </button>
    </>
  );
}
