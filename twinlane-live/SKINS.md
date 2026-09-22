# TwinLane Cosmetic Skin Contract

## Default
- `living-kingdoms` is the permanent free/default skin.
- It must always be available.
- If a selected skin or asset is missing, the renderer falls back to Living Kingdoms.

## What skins may change
A skin may replace:
- terrain / lane ground
- shared frontier treatment
- bridges
- blue and red castles
- wood, stone, and iron resource visuals
- blue and red unit art
- blue and red card frames
- blue and red UI trim
- banners
- projectiles
- particles
- victory effects
- optional music and SFX packs

## What skins may NOT change
Skins are cosmetic only. They must never alter:
- lane coordinates
- hitboxes
- unit collision size
- movement speed
- targeting
- damage
- health
- costs
- cooldowns
- timing
- match rules
- networking / synchronization
- spawn logic
- competitive visibility requirements

## Required asset keys
The skin manifest reserves these keys:

```
terrain
laneGround
frontier
bridge
castleBlue
castleRed
resourceWood
resourceStone
resourceIron
unitBlue
unitRed
cardFrameBlue
cardFrameRed
uiTrimBlue
uiTrimRed
bannerBlue
bannerRed
projectile
particles
victoryEffect
music
sfxPack
```

A skin may omit any key. Missing keys inherit from `living-kingdoms`.

## Commerce rule
Ownership/unlock state must be separate from gameplay logic. A locked paid skin can exist in the catalog, but the game renderer must refuse to activate it until entitlement is verified.

## Current proof slot
`ironhold-preview` exists only to prove that a future paid skin can be registered without altering game mechanics. It is locked and is not currently sold.
