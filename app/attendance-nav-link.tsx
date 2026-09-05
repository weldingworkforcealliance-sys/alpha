'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { getSupabase } from '@/lib/supabase-browser';

export default function AttendanceNavLink() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [supabase] = useState(getSupabase);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data: authData } = await supabase.auth.getSession();
      if (!authData.session) return;
      const { data, error } = await supabase.rpc('list_attendance_groups');
      if (active) setVisible(!error && Array.isArray(data));
    };
    void load();
    return () => {
      active = false;
    };
  }, [supabase]);

  if (!visible) return null;
  return (
    <Link
      href="/attendance"
      className={`ltg-nav-link ${pathname.startsWith('/attendance') || pathname.startsWith('/school/attendance') ? 'active' : ''}`}
    >
      Student Attendance
    </Link>
  );
}
