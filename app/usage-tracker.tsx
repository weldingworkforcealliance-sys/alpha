'use client';

import { useEffect, useRef, useState } from 'react';
import { getSupabase } from '@/lib/supabase-browser';

const EXCLUDED_PREFIXES = ['/login', '/join/', '/student-display/', '/reset-password', '/forgot-password', '/training/login'];

export default function UsageTracker({ pathname }: { pathname: string }) {
  const [supabase] = useState(getSupabase);
  const lastPath = useRef('');

  useEffect(() => {
    if (!pathname || lastPath.current === pathname) return;
    if (EXCLUDED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix))) return;

    lastPath.current = pathname;

    void supabase.rpc('track_ltg_page_view', { p_path: pathname });
  }, [pathname, supabase]);

  return null;
}
