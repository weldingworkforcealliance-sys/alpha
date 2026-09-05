'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getSupabase } from '@/lib/supabase-browser';
import { REVIEW_QUEUE_ROLES } from '@/lib/access-roles';

export default function ReviewQueueLink() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [supabase] = useState(getSupabase);

  useEffect(() => {
    const loadAccess = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData.session?.user.id;
        if (!userId) {
          setVisible(false);
          return;
        }

        const [ownerResult, membershipResult] = await Promise.all([
          supabase.rpc('is_platform_owner'),
          supabase
            .from('school_memberships')
            .select('role,status')
            .eq('user_id', userId)
            .eq('status', 'active'),
        ]);

        if (ownerResult.error || membershipResult.error) {
          setVisible(false);
          return;
        }

        const canManageSchool = (membershipResult.data ?? []).some(
          (membership: { role: string | null }) =>
            Boolean(membership.role && REVIEW_QUEUE_ROLES.has(membership.role))
        );

        setVisible(Boolean(ownerResult.data) || canManageSchool);
      } catch {
        setVisible(false);
      }
    };

    loadAccess();
  }, [supabase]);

  if (!visible) return null;

  return (
    <Link
      href="/review-queue"
      style={{
        color: pathname === '/review-queue' ? '#00ff88' : '#c8c8c8',
        textDecoration: 'none',
        fontWeight: 800,
        fontSize: '13px',
      }}
    >
      Review Queue
    </Link>
  );
}
