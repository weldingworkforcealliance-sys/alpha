# TwinLane Adaptive Link v1

Adaptive Link is a required TwinLane engine add-on for any game where live motion crosses from one physical device to another.

## Physical reference

The v1 contract is anchored to the physically approved Bocce build:

- Commit: `234b9eb3ef1a893b359fb3bb7d3c6bdb0fb420b7`
- Locked branch: `locked/adaptive-link-v1-physical-approved`
- Direct transport: WebRTC DataChannels
- Signaling/fallback: Supabase Realtime
- Durable recovery: Supabase state snapshots

## Required behavior

Adaptive Link must:

- prefer a direct WebRTC path for live motion
- use a reliable control channel and low-latency motion channel
- automatically fall back to Supabase Realtime
- measure RTT, jitter, clock offset and refresh behavior
- select a session profile from measured link conditions
- change adaptive settings only between moving shots
- keep game-specific physics authoritative on the game simulation device

## Protected boundary

Adaptive Link may change transport and presentation timing only.

It must not change:

- launch mechanics
- game physics
- scoring
- collision or target geometry
- game rules
- object hitboxes

## Integration rule

All future TwinLane games with cross-device moving objects must integrate this add-on or a later explicitly approved version.

The game provides game events and receives calibrated transport parameters. The add-on does not own game logic.
