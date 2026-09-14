'use client';

import { useEffect } from 'react';

const PCCC_SKIN_CLASSES = [
  'pccc-welding-skin',
  'pccc-school-skin',
  'pccc-instructor-skin',
  'pccc-demo-skin',
];

const PCCC_STYLESHEET_IDS = [
  'pccc-portal-shell-css',
  'pccc-light-mode-css',
  'pccc-automotive-final-css',
  'pccc-modern-shell-css',
];

function clearPcccSkin() {
  if (typeof document === 'undefined') return;

  PCCC_STYLESHEET_IDS.forEach((id) => document.getElementById(id)?.remove());

  [document.documentElement, document.body].forEach((target) => {
    PCCC_SKIN_CLASSES.forEach((className) => target.classList.remove(className));
    delete target.dataset.pcccAccess;
  });
}

export default function PcccSkinController({ pathname }: { pathname: string }) {
  useEffect(() => {
    clearPcccSkin();
  }, [pathname]);

  return null;
}
