'use client';

import TenantSkinProvider from './tenant-skin-provider';

/**
 * Compatibility mount while production still imports the original controller name.
 * The implementation is now tenant/program generic; PCCC is only one registered skin.
 * Once the development branch is fully validated, RootLayout can be renamed cleanly.
 */
export default function PcccSkinController({ pathname }: { pathname: string }) {
  return <TenantSkinProvider pathname={pathname}>{null}</TenantSkinProvider>;
}
