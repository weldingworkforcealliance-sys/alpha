'use client';

import { useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabase-browser';

type Membership = { school_id: string; role: string | null; status: string | null };
type School = { id: string; name: string | null };
type SkinMode = 'school' | 'instructor' | 'demo' | null;

const SCHOOL_CONTEXT_PREFIXES = [
  '/school', '/accounts', '/reports', '/owner/school', '/time-clock/payroll',
  '/attendance/history', '/attendance/corrections',
];
const SCHOOL_ACCESS_ROLES = new Set(['school_admin', 'program_lead', 'viewer']);
const PCCC_SKIN_CLASSES = ['pccc-welding-skin', 'pccc-school-skin', 'pccc-instructor-skin', 'pccc-demo-skin'];

// Stable production tenant id for Passaic County Community College in the live LTG database.
// Keep the name fallback below so the skin still works if PCCC is ever migrated to a new school row.
const KNOWN_PCCC_SCHOOL_IDS = new Set(['08ccb452-83ab-482f-bb28-5576e02741b2']);
const PORTAL_SHELL_LINK_ID = 'pccc-portal-shell-css';
const PORTAL_SHELL_HREF = '/pccc-portal-shell.css?v=20260913-2';
const LIGHT_MODE_LINK_ID = 'pccc-light-mode-css';
const LIGHT_MODE_HREF = '/pccc-light-mode.css?v=20260913-1';

function isPcccName(name: string | null | undefined) {
  const normalized = (name ?? '').trim().toLowerCase();
  return (
    normalized === 'pccc' ||
    normalized.includes('passaic county community college') ||
    normalized.includes('pccc welding') ||
    (normalized.includes('passaic') && normalized.includes('community college'))
  );
}

function isKnownPcccSchoolId(id: string | null | undefined) {
  return Boolean(id && KNOWN_PCCC_SCHOOL_IDS.has(id));
}

function ensureStylesheet(id: string, href: string) {
  if (typeof document === 'undefined') return;
  const existing = document.getElementById(id) as HTMLLinkElement | null;
  if (existing) {
    if (!existing.href.endsWith(href)) existing.href = href;
    return;
  }

  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
}

function ensurePcccStyles() {
  ensureStylesheet(PORTAL_SHELL_LINK_ID, PORTAL_SHELL_HREF);
  // Loaded after the structural portal shell so light-mode tokens and surfaces can
  // override the dark painted-steel defaults without removing PCCC branding.
  ensureStylesheet(LIGHT_MODE_LINK_ID, LIGHT_MODE_HREF);
}

function isSchoolContext(pathname: string) {
  return SCHOOL_CONTEXT_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function skinClassForMode(mode: SkinMode) {
  if (mode === 'school') return 'pccc-school-skin';
  if (mode === 'instructor') return 'pccc-instructor-skin';
  if (mode === 'demo') return 'pccc-demo-skin';
  return null;
}

function restoreSavedTheme() {
  if (typeof window === 'undefined') return;
  const saved = window.localStorage.getItem('ltg_theme');
  const theme = saved === 'light' || saved === 'dark' ? saved : 'dark';
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

function applyPcccClasses(mode: SkinMode) {
  if (typeof document === 'undefined') return;
  const targets = [document.documentElement, document.body];
  const modeClass = skinClassForMode(mode);

  if (mode) ensurePcccStyles();

  targets.forEach((target) => {
    PCCC_SKIN_CLASSES.forEach((className) => target.classList.remove(className));
    if (mode && modeClass) {
      target.classList.add('pccc-welding-skin', modeClass);
      target.dataset.pcccAccess = mode;
    } else {
      delete target.dataset.pcccAccess;
    }
  });

  // PCCC branding follows the account's normal LTG theme preference. The tenant
  // skin must never overwrite the light/dark choice made by the user.
  restoreSavedTheme();
}

function modeForMembership(pathname: string, membership: Membership | null) {
  const roleUsesSchoolPortal = Boolean(
    membership?.role && SCHOOL_ACCESS_ROLES.has(membership.role)
  );
  return isSchoolContext(pathname) || roleUsesSchoolPortal ? 'school' : 'instructor';
}

export default function PcccSkinController({ pathname }: { pathname: string }) {
  const [supabase] = useState(getSupabase);

  useEffect(() => {
    let cancelled = false;
    let activeMode: SkinMode = null;

    ensurePcccStyles();

    const setMode = (mode: SkinMode) => {
      if (cancelled) return;
      activeMode = mode;
      applyPcccClasses(mode);
    };

    // RootLayout can rewrite document classes during client renders. Re-assert only
    // tenant identity; the ThemeProvider remains the sole owner of light/dark state.
    const observer = new MutationObserver(() => {
      if (!activeMode) return;
      const requiredClass = skinClassForMode(activeMode);
      const bodyMissing =
        !document.body.classList.contains('pccc-welding-skin') ||
        Boolean(requiredClass && !document.body.classList.contains(requiredClass));
      const htmlMissing =
        !document.documentElement.classList.contains('pccc-welding-skin') ||
        Boolean(requiredClass && !document.documentElement.classList.contains(requiredClass));
      if (bodyMissing || htmlMissing) applyPcccClasses(activeMode);
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    const apply = async () => {
      setMode(null);

      if (pathname.startsWith('/demo/welding') || pathname.startsWith('/demo/time-clock')) {
        setMode('demo');
        return;
      }
      if (pathname.startsWith('/demo') || pathname === '/' || pathname.startsWith('/login')) return;

      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData.session?.user.id;
        if (!userId || cancelled) return;

        const [ownerResult, membershipResult] = await Promise.all([
          supabase.rpc('is_platform_owner'),
          supabase
            .from('school_memberships')
            .select('school_id,role,status')
            .eq('user_id', userId)
            .eq('status', 'active'),
        ]);

        const isOwner = Boolean(ownerResult.data);
        if (membershipResult.error && !isOwner) return;

        const rows = ((membershipResult.data ?? []) as Membership[]).filter((row) => row.school_id);

        const directPcccMembership = rows.find((row) => isKnownPcccSchoolId(row.school_id)) ?? null;
        if (directPcccMembership) {
          setMode(modeForMembership(pathname, directPcccMembership));
          return;
        }

        const schoolIds = Array.from(new Set(rows.map((row) => row.school_id)));
        let schools: School[] = [];

        if (isOwner) {
          const schoolResult = await supabase
            .from('schools')
            .select('id,name')
            .eq('status', 'active');
          if (schoolResult.error || cancelled) return;
          schools = (schoolResult.data ?? []) as School[];
        } else {
          if (!schoolIds.length) return;
          const schoolResult = await supabase
            .from('schools')
            .select('id,name')
            .in('id', schoolIds);
          if (schoolResult.error || cancelled) return;
          schools = (schoolResult.data ?? []) as School[];
        }

        const pcccSchoolIds = new Set(
          schools
            .filter((school) => isKnownPcccSchoolId(school.id) || isPcccName(school.name))
            .map((school) => school.id)
        );
        if (!pcccSchoolIds.size) return;

        const pcccMembership = rows.find((row) => pcccSchoolIds.has(row.school_id)) ?? null;
        if (!pcccMembership && !isOwner) return;

        setMode(modeForMembership(pathname, pcccMembership));
      } catch (error) {
        console.error('Unable to apply PCCC Welding skin:', error);
      }
    };

    void apply();
    const { data: authListener } = supabase.auth.onAuthStateChange(() => { void apply(); });

    return () => {
      cancelled = true;
      observer.disconnect();
      authListener.subscription.unsubscribe();
      applyPcccClasses(null);
    };
  }, [pathname, supabase]);

  return null;
}
