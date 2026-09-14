'use client';

import { getLtgSkinDefinition } from '@/lib/skin-registry';
import { useTenantSkin } from './tenant-skin-provider';

export default function TenantBrandLockup() {
  const { skinKey, branding } = useTenantSkin();
  const skin = getLtgSkinDefinition(skinKey);
  const logoUrl = branding?.program_logo_url || branding?.logo_url || null;
  const brandMark = branding?.short_name?.trim() || skin.defaultBrandMark;
  const brandName = branding?.display_name?.trim() || skin.defaultBrandName;
  const brandSubline = branding?.header_text?.trim() || null;

  return (
    <div className="ltg-brand" data-ltg-brand-key={skin.key}>
      {logoUrl ? (
        <span
          className="ltg-brand-mark ltg-brand-mark-has-logo"
          aria-hidden="true"
          style={{ overflow: 'hidden' }}
        >
          <img
            className="ltg-brand-logo"
            src={logoUrl}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
          />
        </span>
      ) : (
        <span className="ltg-brand-mark" aria-hidden="true">
          {brandMark}
        </span>
      )}
      <span className="ltg-brand-copy" style={{ display: 'grid', gap: 2 }}>
        <span className="ltg-brand-name">{brandName}</span>
        {brandSubline && (
          <span className="ltg-brand-subline" style={{ fontSize: '0.72em', opacity: 0.72 }}>
            {brandSubline}
          </span>
        )}
      </span>
    </div>
  );
}
