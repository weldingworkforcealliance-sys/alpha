'use client';

import { usePathname } from 'next/navigation';
import styles from './attendance-nav.module.css';

const ITEMS = [
  { href: '/attendance', label: 'Take Attendance' },
  { href: '/attendance/history', label: 'Attendance History' },
];

export default function AttendanceNav() {
  const pathname = usePathname();

  return (
    <nav className={styles.nav} aria-label="Attendance navigation">
      <div className={styles.inner}>
        <span className={styles.label}>Attendance</span>
        <div className={styles.links}>
          {ITEMS.map((item) => {
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
