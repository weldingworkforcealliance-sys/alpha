'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { getSupabase } from '@/lib/supabase-browser';
import { PAYROLL_ROLES } from '@/lib/access-roles';

export default function PayrollNavLink() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [supabase] = useState(getSupabase);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      if (!session) return;

      const [ownerResult, membershipResult] = await Promise.all([
        supabase.rpc('is_platform_owner'),
        supabase
          .from('school_memberships')
          .select('role,status')
          .eq('user_id', session.user.id)
          .eq('status', 'active'),
      ]);

      const allowed =
        Boolean(ownerResult.data) ||
        (membershipResult.data ?? []).some((row: { role: string; status: string }) =>
          PAYROLL_ROLES.has(row.role)
        );

      if (active) setVisible(allowed);
    };

    load();
    return () => {
      active = false;
    };
  }, [supabase]);

  if (!visible) return null;

  return (
    <Link
      href="/time-clock/payroll"
      className={`ltg-nav-link ${pathname.startsWith('/time-clock/payroll') ? 'active' : ''}`}
    >
      Weekly Time Reports
    </Link>
  );
}
