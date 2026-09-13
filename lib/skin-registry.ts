export type LtgSkinId = 'default' | 'pccc-welding';
export type LtgAccessMode = 'school' | 'instructor' | 'demo' | null;

export type SkinDefinition = {
  id: LtgSkinId;
  schoolIds: ReadonlySet<string>;
  matchesSchoolName: (name: string | null | undefined) => boolean;
};

const PCCC_SCHOOL_IDS = new Set(['08ccb452-83ab-482f-bb28-5576e02741b2']);

function matchesPcccName(name: string | null | undefined) {
  const normalized = (name ?? '').trim().toLowerCase();
  return (
    normalized === 'pccc' ||
    normalized.includes('passaic county community college') ||
    normalized.includes('pccc welding') ||
    (normalized.includes('passaic') && normalized.includes('community college'))
  );
}

export const SKIN_REGISTRY: readonly SkinDefinition[] = [
  {
    id: 'pccc-welding',
    schoolIds: PCCC_SCHOOL_IDS,
    matchesSchoolName: matchesPcccName,
  },
];

export function skinForSchool(id: string | null | undefined, name?: string | null) {
  if (!id && !name) return 'default' as const;
  const found = SKIN_REGISTRY.find(
    (skin) => Boolean(id && skin.schoolIds.has(id)) || skin.matchesSchoolName(name)
  );
  return found?.id ?? ('default' as const);
}

export function isPcccSchoolId(id: string | null | undefined) {
  return Boolean(id && PCCC_SCHOOL_IDS.has(id));
}
