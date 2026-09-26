'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase-browser';
import { isPublicRoute, safePostLoginRoute } from '@/lib/auth-routes';

const REQUIRE_MFA = process.env.NEXT_PUBLIC_REQUIRE_MFA === 'true';

export default function MfaGate({ pathname }: { pathname: string }) {
  const router = useRouter();
  const [supabase] = useState(getSupabase);

  useEffect(() => {
    if (pathname === '/mfa' || isPublicRoute(pathname)) return;

    const check = async () => {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session) return;

      const { data: aal, error: aalError } =
        await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aalError) return;

      const needsChallenge =
        aal.currentLevel !== 'aal2' &&
        (aal.nextLevel === 'aal2' || REQUIRE_MFA);

      if (!needsChallenge) return;

      const requested =
        typeof window === 'undefined'
          ? pathname
          : `${pathname}${window.location.search}`;

      const next = encodeURIComponent(safePostLoginRoute(requested));
      router.replace(`/mfa?next=${next}`);
    };

    void check();
  }, [pathname, router, supabase]);

  return null;
}
