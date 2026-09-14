'use client';

import { createContext, type ReactNode, useContext, useEffect, useMemo } from 'react';
import { allSkinDomClasses, DEFAULT_LTG_SKIN_KEY, type LtgAccessMode } from '@/lib/skin-registry';

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
const ALL_SKIN_CLASSES = allSkinDomClasses();

const UNSKINNED_STATE: TenantSkinState = {
  skinKey: DEFAULT_LTG_SKIN_KEY,
  accessMode: 'instructor',
  schoolId: null,
  programId: null,
  branding: null,
  ready: true,
};

function clearSkinFromDom() {
  if (typeof document === 'undefined') return;

  document
    .querySelectorAll<HTMLLinkElement>("link[data-ltg-skin-stylesheet='true']")
    .forEach((link) => link.remove());

  [
    'pccc-portal-shell-css',
    'pccc-light-mode-css',
    'pccc-automotive-final-css',
    'pccc-modern-shell-css',
  ].forEach((id) => document.getElementById(id)?.remove());

  [document.documentElement, document.body].forEach((target) => {
    ALL_SKIN_CLASSES.forEach((className) => target.classList.remove(className));
    target.classList.remove('ltg-tenant-skin');

    delete target.dataset.ltgSkin;
    delete target.dataset.ltgAccess;
    delete target.dataset.ltgSchool;
    delete target.dataset.ltgProgram;
    delete target.dataset.pcccAccess;

    [
      '--ltg-brand-primary',
      '--ltg-brand-secondary',
      '--ltg-brand-accent',
    ].forEach((name) => target.style.removeProperty(name));
  });
}

export default function TenantSkinProvider({
  children,
}: {
  pathname: string;
  children: ReactNode;
}) {
  useEffect(() => {
    clearSkinFromDom();
  });

  const value = useMemo(() => UNSKINNED_STATE, []);
  return <TenantSkinContext.Provider value={value}>{children}</TenantSkinContext.Provider>;
}

export function useTenantSkin() {
  const context = useContext(TenantSkinContext);
  if (!context) throw new Error('useTenantSkin must be used inside TenantSkinProvider');
  return context;
}
