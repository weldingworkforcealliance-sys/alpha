'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

const PAYROLL_ROLES = new Set(['school_admin', 'program_lead', 'lead_instructor']);

export default function PayrollNavLink() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [supabase] = useState(() =>
    createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
    )
  );

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
