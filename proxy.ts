import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase-proxy';

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // The public FABTECH demo is intentionally isolated from the authenticated
    // app-session middleware. Keep session refresh/auth checks on every
    // non-demo application route.
    '/((?!demo(?:/|$)|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
