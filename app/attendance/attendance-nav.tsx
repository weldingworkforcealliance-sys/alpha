'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { getSupabase } from '@/lib/supabase-browser';
import styles from './attendance-nav.module.css';

const BASE_ITEMS = [
  { href: '/attendance', label: 'Take Attendance' },
  { href: '/attendance/history', label: 'Attendance History' },
];

export default function AttendanceNav() {
  const pathname = usePathname();
  const [supabase] = useState(getSupabase);
  const [canCorrect, setCanCorrect] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data: owner } = await supabase.rpc('is_platform_owner');
        if (owner) {
          if (active) setCanCorrect(true);
          return;
        }

        const { data: auth } = await supabase.auth.getSession();
        const userId = auth.session?.user.id;
        if (!userId) return;

        const { count } = await supabase
          .from('school_memberships')
          .select('school_id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('status', 'active')
          .in('role', ['school_admin', 'program_lead']);

        if (active) setCanCorrect(Boolean(count));
      } catch {
        if (active) setCanCorrect(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [supabase]);

  const items = canCorrect
    ? [...BASE_ITEMS, { href: '/attendance/corrections', label: 'Correct Attendance' }]
    : BASE_ITEMS;

  return (
    <nav className={styles.nav} aria-label="Attendance navigation">
      <div className={styles.inner}>
        <span className={styles.label}>Attendance</span>
        <div className={styles.links}>
          {items.map((item) => {
            const active = item.href === '/attendance'
              ? pathname === item.href
              : pathname.startsWith(item.href);
            return (
              <a
                key={item.href}
                href={item.href}
                className={active ? styles.active : styles.link}
                aria-current={active ? 'page' : undefined}
              >
                {item.label}
              </a>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
