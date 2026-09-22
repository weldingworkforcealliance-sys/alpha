(() => {
  'use strict';

  const DEFAULT_SKIN_ID = 'living-kingdoms';

  const SKINS = {
    'living-kingdoms': {
      id: 'living-kingdoms',
      name: 'Living Kingdoms',
      edition: 'Original',
      included: true,
      purchasable: false,
      unlocked: true,
      description: 'The free default Corvu Mor battlefield: carved stone, warm timber, brass, banners, crystals, and a living frontier.',
      palette: {
        '--skin-page-bg': '#0b0f13',
        '--skin-panel-bg': '#121820',
        '--skin-panel-border': '#394654',
        '--skin-text': '#f3f5f7',
        '--skin-muted': '#9aa8b8',
        '--skin-accent': '#d7b56d',
        '--skin-lane-a': '#263127',
        '--skin-lane-b': '#2f3b30',
        '--skin-lane-line': '#6f7b63',
        '--skin-ball': '#f0e5c8',
        '--skin-ball-border': '#b99858',
        '--skin-blue': '#2f77d8',
        '--skin-red': '#be3d42'
      },
      assets: {
        terrain: null,
        laneGround: null,
        frontier: null,
        bridge: null,
        castleBlue: null,
        castleRed: null,
        resourceWood: null,
        resourceStone: null,
        resourceIron: null,
        unitBlue: null,
        unitRed: null,
        cardFrameBlue: null,
        cardFrameRed: null,
        uiTrimBlue: null,
        uiTrimRed: null,
        bannerBlue: null,
        bannerRed: null,
        projectile: null,
        particles: null,
        victoryEffect: null,
        music: null,
        sfxPack: null
      }
    },

    'ironhold-preview': {
      id: 'ironhold-preview',
      name: 'Ironhold',
      edition: 'Paid skin placeholder',
      included: false,
      purchasable: true,
      unlocked: false,
      previewOnly: true,
      description: 'Reserved proof-of-architecture slot for a future industrial medieval cosmetic skin. No gameplay changes.',
      palette: {
        '--skin-page-bg': '#0d0f10',
        '--skin-panel-bg': '#17191b',
        '--skin-panel-border': '#474b4f',
        '--skin-text': '#f0f1f2',
        '--skin-muted': '#a0a4a8',
        '--skin-accent': '#c08d52',
        '--skin-lane-a': '#2c2d2d',
        '--skin-lane-b': '#353636',
        '--skin-lane-line': '#736a5f',
        '--skin-ball': '#d8d1c2',
        '--skin-ball-border': '#8c6a45',
        '--skin-blue': '#466f8e',
        '--skin-red': '#91463e'
      },
      assets: {}
    }
  };

  function getSkin(id) {
    return SKINS[id] || SKINS[DEFAULT_SKIN_ID];
  }

  function resolveAsset(skinId, key) {
    const requested = getSkin(skinId);
    const fallback = SKINS[DEFAULT_SKIN_ID];
    return requested.assets?.[key] || fallback.assets?.[key] || null;
  }

  function applySkin(id, root = document.documentElement) {
    const requested = getSkin(id);
    const skin = requested.unlocked || requested.included ? requested : SKINS[DEFAULT_SKIN_ID];

    Object.entries(skin.palette || {}).forEach(([name, value]) => {
      root.style.setProperty(name, value);
    });

    root.dataset.skin = skin.id;
    return skin;
  }

  function canSelect(id) {
    const skin = SKINS[id];
    return Boolean(skin && (skin.unlocked || skin.included));
  }

  window.TwinLaneSkins = Object.freeze({
    DEFAULT_SKIN_ID,
    SKINS,
    getSkin,
    resolveAsset,
    applySkin,
    canSelect
  });
})();