'use client';

import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { getSupabase } from '@/lib/supabase-browser';
import {
  isPcccSchoolId,
  skinForSchool,
  type LtgAccessMode,
  type LtgSkinId,
} from '@/lib/skin-registry';

type Membership = { school_id: string; role: string | null; status: string | null };
type School = { id: string; name: string | null };

type SkinContextValue = {
  skinId: LtgSkinId;
  accessMode: LtgAccessMode;
  ready: boolean;
};

const SkinContext = createContext<SkinContextValue>({
  skinId: 'default',
  accessMode: null,
  ready: false,
});

const CACHE_KEY = 'ltg_skin_context_v1';
const SCHOOL_ACCESS_ROLES = new Set(['school_admin', 'program_lead', 'viewer']);
const SCHOOL_CONTEXT_PREFIXES = [
  '/school',
  '/accounts',
  '/reports',
  '/owner/school',
  '/time-clock/payroll',
  '/attendance/history',
  '/attendance/corrections',
];
const LEGACY_PCCC_CLASSES = [
  'pccc-welding-skin',
  'pccc-school-skin',
  'pccc-instructor-skin',
  'pccc-demo-skin',
];

const PCCC_STYLESHEETS = [
  ['ltg-skin-pccc-portal', '/pccc-portal-shell.css?v=20260913-2'],
  ['ltg-skin-pccc-light', '/pccc-light-mode.css?v=20260913-1'],
] as const;

function isSchoolContext(pathname: string) {
  return SCHOOL_CONTEXT_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

function accessModeFor(
  pathname: string,
  role: string | null | undefined,
  platformOwner = false
): LtgAccessMode {
  if (
    platformOwner ||
    isSchoolContext(pathname) ||
    (role && SCHOOL_ACCESS_ROLES.has(role))
  ) {
    return 'school';
  }
  return 'instructor';
}

function ensureStylesheet(id: string, href: string) {
  if (typeof document === 'undefined') return;
  let link = document.getElementById(id) as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    document.head.appendChild(link);
  }
  if (!link.href.endsWith(href)) link.href = href;
}

function ensureSkinAssets(skinId: LtgSkinId) {
  if (skinId !== 'pccc-welding') return;
  PCCC_STYLESHEETS.forEach(([id, href]) => ensureStylesheet(id, href));
}

function legacyClassFor(accessMode: LtgAccessMode) {
  if (accessMode === 'school') return 'pccc-school-skin';
  if (accessMode === 'instructor') return 'pccc-instructor-skin';
  if (accessMode === 'demo') return 'pccc-demo-skin';
  return null;
}

function applySkinToDocument(skinId: LtgSkinId, accessMode: LtgAccessMode) {
  if (typeof document === 'undefined') return;
  const targets = [document.documentElement, document.body];
  const legacyAccessClass = legacyClassFor(accessMode);

  ensureSkinAssets(skinId);

  targets.forEach((target) => {
    LEGACY_PCCC_CLASSES.forEach((className) => target.classList.remove(className));

    if (skinId === 'default') {
      delete target.dataset.ltgSkin;
      delete target.dataset.ltgAccess;
      delete target.dataset.pcccAccess;
      return;
    }

    target.dataset.ltgSkin = skinId;
    if (accessMode) target.dataset.ltgAccess = accessMode;
    else delete target.dataset.ltgAccess;

    if (skinId === 'pccc-welding') {
      target.classList.add('pccc-welding-skin');
      if (legacyAccessClass) target.classList.add(legacyAccessClass);
      if (accessMode) target.dataset.pcccAccess = accessMode;
    }
  });
}

function writeCachedSkin(skinId: LtgSkinId, accessMode: LtgAccessMode) {
  if (typeof window === 'undefined') return;
  if (skinId === 'default') {
    window.localStorage.removeItem(CACHE_KEY);
    return;
  }
  window.localStorage.setItem(CACHE_KEY, JSON.stringify({ skinId, accessMode }));
}

export default function SkinProvider({
  pathname,
  children,
}: {
  pathname: string;
  children: ReactNode;
}) {
  const [supabase] = useState(getSupabase);
  const [skinId, setSkinId] = useState<LtgSkinId>('default');
  const [accessMode, setAccessMode] = useState<LtgAccessMode>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let activeSkin: LtgSkinId = 'default';
    let activeAccess: LtgAccessMode = null;

    const commitSkin = (nextSkin: LtgSkinId, nextAccess: LtgAccessMode) => {
      if (cancelled) return;
      activeSkin = nextSkin;
      activeAccess = nextAccess;
      setSkinId(nextSkin);
      setAccessMode(nextAccess);
      applySkinToDocument(nextSkin, nextAccess);
      writeCachedSkin(nextSkin, nextAccess);
    };

    // React owns the route classes on <body>. Tenant identity is separate state, so if a
    // route render replaces body classes, reassert the skin without touching light/dark.
    const observer = new MutationObserver(() => {
      if (cancelled || activeSkin === 'default') return;
      const expectedLegacy = legacyClassFor(activeAccess);
      const htmlWrong =
        document.documentElement.dataset.ltgSkin !== activeSkin ||
        document.documentElement.dataset.ltgAccess !== (activeAccess ?? undefined);
      const bodyWrong =
        document.body.dataset.ltgSkin !== activeSkin ||
        document.body.dataset.ltgAccess !== (activeAccess ?? undefined) ||
        !document.body.classList.contains('pccc-welding-skin') ||
        Boolean(expectedLegacy && !document.body.classList.contains(expectedLegacy));
      if (htmlWrong || bodyWrong) applySkinToDocument(activeSkin, activeAccess);
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ['class', 'data-ltg-skin', 'data-ltg-access'] });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-ltg-skin', 'data-ltg-access'] });

    const resolve = async () => {
      setReady(false);

      if (pathname.startsWith('/demo/welding') || pathname.startsWith('/demo/time-clock')) {
        commitSkin('pccc-welding', 'demo');
        setReady(true);
        return;
      }

      if (
        pathname.startsWith('/demo') ||
        pathname === '/' ||
        pathname.startsWith('/login') ||
        pathname.startsWith('/forgot-password') ||
        pathname.startsWith('/reset-password')
      ) {
        commitSkin('default', null);
        setReady(true);
        return;
      }

      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData.session?.user.id;
        if (!userId || cancelled) {
          commitSkin('default', null);
          return;
        }

        const [ownerResult, membershipResult] = await Promise.all([
          supabase.rpc('is_platform_owner'),
          supabase
            .from('school_memberships')
            .select('school_id,role,status')
            .eq('user_id', userId)
            .eq('status', 'active'),
        ]);

        const isOwner = Boolean(ownerResult.data);
        if (membershipResult.error && !isOwner) {
          commitSkin('default', null);
          return;
        }

        const memberships = ((membershipResult.data ?? []) as Membership[]).filter(
          (row) => row.school_id
        );

        const directPccc = memberships.find((row) => isPcccSchoolId(row.school_id));
        if (directPccc) {
          commitSkin(
            'pccc-welding',
            accessModeFor(pathname, directPccc.role, isOwner)
          );
          return;
        }

        const schoolIds = Array.from(new Set(memberships.map((row) => row.school_id)));
        if (!schoolIds.length && !isOwner) {
          commitSkin('default', null);
          return;
        }

        let schools: School[] = [];
        if (isOwner) {
          const result = await supabase.from('schools').select('id,name').eq('status', 'active');
          if (result.error || cancelled) return;
          schools = (result.data ?? []) as School[];
        } else {
          const result = await supabase.from('schools').select('id,name').in('id', schoolIds);
          if (result.error || cancelled) return;
          schools = (result.data ?? []) as School[];
        }

        const skinnedSchool = schools.find(
          (school) => skinForSchool(school.id, school.name) !== 'default'
        );
        if (!skinnedSchool) {
          commitSkin('default', null);
          return;
        }

        const resolvedSkin = skinForSchool(skinnedSchool.id, skinnedSchool.name);
        const membership = memberships.find((row) => row.school_id === skinnedSchool.id) ?? null;
        if (!membership && !isOwner) {
          commitSkin('default', null);
          return;
        }

        commitSkin(
          resolvedSkin,
          accessModeFor(pathname, membership?.role, isOwner && !membership)
        );
      } catch (error) {
        console.error('Unable to resolve LTG tenant skin:', error);
        commitSkin('default', null);
      } finally {
        if (!cancelled) setReady(true);
      }
    };

    void resolve();
    const { data: listener } = supabase.auth.onAuthStateChange(() => void resolve());

    return () => {
      cancelled = true;
      observer.disconnect();
      listener.subscription.unsubscribe();
    };
  }, [pathname, supabase]);

  const value = useMemo(
    () => ({ skinId, accessMode, ready }),
    [skinId, accessMode, ready]
  );

  return <SkinContext.Provider value={value}>{children}</SkinContext.Provider>;
}

export function useLtgSkin() {
  return useContext(SkinContext);
}
