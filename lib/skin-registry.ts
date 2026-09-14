export type LtgAccessMode = 'school' | 'instructor' | 'owner' | 'student' | 'demo';

export type LtgSkinDefinition = {
  key: string;
  className: string;
  stylesheetHrefs?: string[];
  legacyBaseClasses?: string[];
  legacyAccessClasses?: Partial<Record<LtgAccessMode, string[]>>;
};

export const DEFAULT_LTG_SKIN_KEY = 'ltg-default';

const SKIN_REGISTRY: Record<string, LtgSkinDefinition> = {
  'ltg-default': {
    key: 'ltg-default',
    className: 'ltg-skin-default',
  },
  'pccc-welding': {
    key: 'pccc-welding',
    className: 'ltg-skin-pccc-welding',
    stylesheetHrefs: [
      '/pccc-portal-shell.css?v=20260913-2',
      '/pccc-light-mode.css?v=20260913-1',
    ],
    legacyBaseClasses: ['pccc-welding-skin'],
    legacyAccessClasses: {
      school: ['pccc-school-skin'],
      owner: ['pccc-school-skin'],
      instructor: ['pccc-instructor-skin'],
      demo: ['pccc-demo-skin'],
    },
  },
  'clinical-learning': {
    key: 'clinical-learning',
    className: 'ltg-skin-clinical-learning',
    stylesheetHrefs: ['/skins/clinical-learning.css?v=20260914-1'],
  },
};

export function getLtgSkinDefinition(value: string | null | undefined) {
  const key = (value ?? '').trim().toLowerCase();
  return SKIN_REGISTRY[key] ?? SKIN_REGISTRY[DEFAULT_LTG_SKIN_KEY];
}

export function getDemoSkinKey(pathname: string) {
  if (pathname.startsWith('/demo/welding') || pathname.startsWith('/demo/time-clock')) {
    return 'pccc-welding';
  }
  if (pathname.startsWith('/demo/nursing')) return 'clinical-learning';
  return DEFAULT_LTG_SKIN_KEY;
}

export function allSkinDomClasses() {
  const classes = new Set<string>();
  Object.values(SKIN_REGISTRY).forEach((skin) => {
    classes.add(skin.className);
    skin.legacyBaseClasses?.forEach((name) => classes.add(name));
    Object.values(skin.legacyAccessClasses ?? {}).forEach((names) =>
      names?.forEach((name) => classes.add(name))
    );
  });
  return Array.from(classes);
}

export function registeredSkinKeys() {
  return Object.keys(SKIN_REGISTRY);
}
