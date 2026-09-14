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
  readSelectedSectionId,
  subscribeSelectedSection,
} from '@/lib/section-selection';
import {
  allSkinDomClasses,
  DEFAULT_LTG_SKIN_KEY,
  getDemoSkinKey,
  getLtgSkinDefinition,
  type LtgAccessMode,
} from '@/lib/skin-registry';

type Membership = {
  school_id: string;
  role: string | null;
  status: string | null;
};

type BrandingProfile = {
  id?: string;
  school_id: string;
  program_id: string | null;
  skin_key: string | null;
  display_name: string | null;
  short_name: string | null;
  logo_url: string | null;
  program_logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  accent_color: string | null;
  header_text: string | null;
  footer_text: string | null;
  skin_config?: Record<string, unknown> | null;
  active?: boolean | null;
};

type TenantSkinState = {
  skinKey: string;
  accessMode: LtgAccessMode;
  schoolId: string | null;
  programId: string | null;
  branding: BrandingProfile | null;
  ready: boolean;
};

type TenantSkinContextValue = TenantSkinState;

const TenantSkinContext = createContext<TenantSkinContextValue | null>(null);

const SCHOOL_CONTEXT_PREFIXES = [
  '/school',
  '/accounts',
  '/reports',
  '/owner/school',
  '/time-clock/payroll',
  '/attendance/history',
  '/attendance/corrections',
];
const SCHOOL_ACCESS_ROLES = new Set(['school_admin', 'program_lead', 'viewer']);
const SKIN_LINK_ATTR = 'data-ltg-skin-stylesheet';
const ALL_SKIN_CLASSES = allSkinDomClasses();

function isSchoolContext(pathname: string) {
  return SCHOOL_CONTEXT_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

function accessModeForPath(
  pathname: string,
  membership: Membership | null,
  isOwner: boolean
): LtgAccessMode {
  if (pathname.startsWith('/demo')) return 'demo';
  if (pathname.startsWith('/join/') || pathname.startsWith('/student-display/')) {
    return 'student';
  }
  if (isOwner && pathname.startsWith('/owner')) return 'owner';
  if (
    isSchoolContext(pathname) ||
    Boolean(membership?.role && SCHOOL_ACCESS_ROLES.has(membership.role))
  ) {
    return 'school';
  }
  return 'instructor';
}

function validBrandColor(value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  return /^#[0-9a-fA-F]{6}$/.test(trimmed) || /^#[0-9a-fA-F]{3}$/.test(trimmed)
    ? trimmed
    : null;
}

function linkIdForHref(href: string) {
  let hash = 0;
  for (let i = 0; i < href.length; i += 1) {
    hash = (hash * 31 + href.charCodeAt(i)) >>> 0;
  }
  return `ltg-skin-${hash.toString(16)}`;
}

function syncSkinStylesheets(hrefs: string[]) {
  if (typeof document === 'undefined') return;
  const wanted = new Set(hrefs.map(linkIdForHref));
  document
    .querySelectorAll<HTMLLinkElement>(`link[${SKIN_LINK_ATTR}='true']`)
    .forEach((link) => {
      if (!wanted.has(link.id)) link.remove();
    });

  hrefs.forEach((href) => {
    const id = linkIdForHref(href);
    const current = document.getElementById(id) as HTMLLinkElement | null;
    if (current) {
      if (!current.href.endsWith(href)) current.href = href;
      return;
    }
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = href;
    link.setAttribute(SKIN_LINK_ATTR, 'true');
    document.head.appendChild(link);
  });
}

function clearBrandVariables(target: HTMLElement) {
  [
    '--ltg-brand-primary',
    '--ltg-brand-secondary',
    '--ltg-brand-accent',
  ].forEach((name) => target.style.removeProperty(name));
}

function applySkinToDom(state: TenantSkinState) {
  if (typeof document === 'undefined') return;
  const skin = getLtgSkinDefinition(state.skinKey);
  const targets = [document.documentElement, document.body];

  syncSkinStylesheets(skin.stylesheetHrefs ?? []);

  targets.forEach((target) => {
    ALL_SKIN_CLASSES.forEach((className) => target.classList.remove(className));
    target.classList.add('ltg-tenant-skin', skin.className);
    skin.legacyBaseClasses?.forEach((className) => target.classList.add(className));
    skin.legacyAccessClasses?.[state.accessMode]?.forEach((className) =>
      target.classList.add(className)
    );

    target.dataset.ltgSkin = skin.key;
    target.dataset.ltgAccess = state.accessMode;
    if (state.schoolId) target.dataset.ltgSchool = state.schoolId;
    else delete target.dataset.ltgSchool;
    if (state.programId) target.dataset.ltgProgram = state.programId;
    else delete target.dataset.ltgProgram;

    clearBrandVariables(target);
    const primary = validBrandColor(state.branding?.primary_color);
    const secondary = validBrandColor(state.branding?.secondary_color);
    const accent = validBrandColor(state.branding?.accent_color);
    if (primary) target.style.setProperty('--ltg-brand-primary', primary);
    if (secondary) target.style.setProperty('--ltg-brand-secondary', secondary);
    if (accent) target.style.setProperty('--ltg-brand-accent', accent);
  });
}

function clearSkinFromDom() {
  if (typeof document === 'undefined') return;
  syncSkinStylesheets([]);
  [document.documentElement, document.body].forEach((target) => {
    ALL_SKIN_CLASSES.forEach((className) => target.classList.remove(className));
    target.classList.remove('ltg-tenant-skin');
    delete target.dataset.ltgSkin;
    delete target.dataset.ltgAccess;
    delete target.dataset.ltgSchool;
    delete target.dataset.ltgProgram;
    clearBrandVariables(target);
  });
}

function fallbackBrandingRow(row: Record<string, unknown>, schoolId: string): BrandingProfile {
  return {
    school_id: schoolId,
    program_id: null,
    skin_key: DEFAULT_LTG_SKIN_KEY,
    display_name: (row.display_name as string | null) ?? null,
    short_name: (row.short_name as string | null) ?? null,
    logo_url: (row.logo_url as string | null) ?? null,
    program_logo_url: (row.program_logo_url as string | null) ?? null,
    primary_color: (row.primary_color as string | null) ?? null,
    secondary_color: (row.secondary_color as string | null) ?? null,
    accent_color: (row.accent_color as string | null) ?? null,
    header_text: (row.header_text as string | null) ?? null,
    footer_text: (row.footer_text as string | null) ?? null,
    active: true,
  };
}

export default function TenantSkinProvider({
  pathname,
  children,
}: {
  pathname: string;
  children: ReactNode;
}) {
  const [supabase] = useState(getSupabase);
  const [state, setState] = useState<TenantSkinState>({
    skinKey: DEFAULT_LTG_SKIN_KEY,
    accessMode: pathname.startsWith('/demo') ? 'demo' : 'instructor',
    schoolId: null,
    programId: null,
    branding: null,
    ready: false,
  });

  useEffect(() => {
    let cancelled = false;
    let requestNumber = 0;

    const resolveSkin = async (selectedSectionId = readSelectedSectionId()) => {
      const request = ++requestNumber;
      const commit = (next: TenantSkinState) => {
        if (!cancelled && request === requestNumber) setState(next);
      };

      if (pathname.startsWith('/demo')) {
        commit({
          skinKey: getDemoSkinKey(pathname),
          accessMode: 'demo',
          schoolId: null,
          programId: null,
          branding: null,
          ready: true,
        });
        return;
      }

      if (
        pathname === '/' ||
        pathname === '/login' ||
        pathname === '/account-setup' ||
        pathname === '/forgot-password' ||
        pathname === '/reset-password'
      ) {
        commit({
          skinKey: DEFAULT_LTG_SKIN_KEY,
          accessMode: 'instructor',
          schoolId: null,
          programId: null,
          branding: null,
          ready: true,
        });
        return;
      }

      const { data: auth } = await supabase.auth.getSession();
      const userId = auth.session?.user.id;
      if (!userId) {
        commit({
          skinKey: DEFAULT_LTG_SKIN_KEY,
          accessMode: pathname.startsWith('/join/') ? 'student' : 'instructor',
          schoolId: null,
          programId: null,
          branding: null,
          ready: true,
        });
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
      const memberships = (membershipResult.data ?? []) as Membership[];

      let schoolId: string | null = null;
      let programId: string | null = null;

      if (selectedSectionId) {
        const { data: section } = await supabase
          .from('sections')
          .select('school_id,course_id')
          .eq('id', selectedSectionId)
          .maybeSingle();
        if (section?.school_id) {
          const permitted =
            isOwner || memberships.some((row) => row.school_id === section.school_id);
          if (permitted) {
            schoolId = section.school_id as string;
            if (section.course_id) {
              const { data: course } = await supabase
                .from('courses')
                .select('program_id')
                .eq('id', section.course_id)
                .maybeSingle();
              programId = (course?.program_id as string | null | undefined) ?? null;
            }
          }
        }
      }

      if (!schoolId && memberships.length === 1) schoolId = memberships[0].school_id;
      if (!schoolId && memberships.length > 1) schoolId = memberships[0].school_id;

      const activeMembership =
        memberships.find((row) => row.school_id === schoolId) ?? memberships[0] ?? null;
      const accessMode = accessModeForPath(pathname, activeMembership, isOwner);

      if (!schoolId) {
        commit({
          skinKey: DEFAULT_LTG_SKIN_KEY,
          accessMode,
          schoolId: null,
          programId: null,
          branding: null,
          ready: true,
        });
        return;
      }

      let branding: BrandingProfile | null = null;
      const profileResult = await supabase
        .from('branding_profiles')
        .select(
          'id,school_id,program_id,skin_key,display_name,short_name,logo_url,program_logo_url,primary_color,secondary_color,accent_color,header_text,footer_text,skin_config,active'
        )
        .eq('school_id', schoolId)
        .eq('active', true);

      if (!profileResult.error) {
        const profiles = (profileResult.data ?? []) as BrandingProfile[];
        branding =
          (programId ? profiles.find((row) => row.program_id === programId) : null) ??
          profiles.find((row) => row.program_id === null) ??
          null;
      } else {
        // Compatibility path while production is still on the legacy schema.
        const legacyResult = await supabase
          .from('school_branding')
          .select(
            'display_name,short_name,logo_url,program_logo_url,primary_color,secondary_color,accent_color,header_text,footer_text'
          )
          .eq('school_id', schoolId)
          .maybeSingle();
        if (legacyResult.data) {
          branding = fallbackBrandingRow(
            legacyResult.data as Record<string, unknown>,
            schoolId
          );
        }
      }

      commit({
        skinKey: branding?.skin_key || DEFAULT_LTG_SKIN_KEY,
        accessMode,
        schoolId,
        programId,
        branding,
        ready: true,
      });
    };

    void resolveSkin();
    const unsubscribeSection = subscribeSelectedSection((sectionId) => {
      void resolveSkin(sectionId);
    });
    const { data: authListener } = supabase.auth.onAuthStateChange(() => {
      void resolveSkin();
    });

    return () => {
      cancelled = true;
      unsubscribeSection();
      authListener.subscription.unsubscribe();
    };
  }, [pathname, supabase]);

  useEffect(() => {
    applySkinToDom(state);

    const observer = new MutationObserver(() => {
      const skin = getLtgSkinDefinition(state.skinKey);
      if (
        !document.body.classList.contains('ltg-tenant-skin') ||
        !document.body.classList.contains(skin.className) ||
        document.body.dataset.ltgAccess !== state.accessMode
      ) {
        applySkinToDom(state);
      }
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  }, [state]);

  useEffect(() => () => clearSkinFromDom(), []);

  const value = useMemo(() => state, [state]);

  return <TenantSkinContext.Provider value={value}>{children}</TenantSkinContext.Provider>;
}

export function useTenantSkin() {
  const context = useContext(TenantSkinContext);
  if (!context) throw new Error('useTenantSkin must be used inside TenantSkinProvider');
  return context;
}
