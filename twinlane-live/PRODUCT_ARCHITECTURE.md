# Corvu Mor TwinLane — Product Architecture v1

## Approved gameplay baseline

- Contract: `bocce-v1-physical-approved`
- Locked branch: `locked/bocce-v1-physical-approved`
- Living Kingdoms is the default/original included skin.
- Diagnostics are opt-in only with `?monitor=1`.

## Skin contract

A skin may change presentation only.

Allowed:
- court and scenic artwork
- rail/end-board materials
- HUD framing
- typography
- ball surface appearance
- decorative particles that do not obstruct play
- non-gameplay labels and ornamental presentation

Protected:
- normalized world coordinates
- screen/lane positions
- playfield dimensions and boundaries
- ball and pallino collision geometry
- launch curves
- physics solver, friction and restitution
- turn order and scoring
- realtime playback/synchronization
- gameplay hitboxes
- competitive visibility/readability

A skin that needs a protected-system change is not a skin. It is a game/engine revision and requires separate testing.

## Runtime registry

The runtime uses a skin registry with:
- stable skin ID
- display name
- edition
- included/paid entitlement metadata
- price slot
- status
- gameplay contract
- competitive-readability approval

Current registered skin:
- `living_kingdoms`
- Living Kingdoms
- Original
- Included / free
- Approved for `bocce-v1-physical-approved`

## Next product layer

The next layer should add a registry-driven Court Library / Skin Store without changing the gameplay contract. Purchases or unlocks should alter entitlement state only; gameplay must continue to load through the same approved TwinLane Bocce contract.
