# Long Toss Platform Contract v1

## Stable coordinate model

Games use a normalized logical field. The current reference field is 0–100 on each axis and may span two physical displays.

The platform may map that field to different device dimensions, but a game adapter must never depend on literal CSS pixels for gameplay rules.

## Realtime contract

Every active shot has:

- a monotonically increasing shot sequence
- a stable projectile identity
- a shot-start event
- ordered motion frames
- optional physical-event timestamps
- a completion event

Remote presentation uses one monotonic playback clock. It may pause, slow, or catch up gently, but must never move backward.

## Recovery contract

Realtime is authoritative while healthy. Durable polling is recovery-only and must not overtake an active buffered shot.

## Audio contract

Physical sounds are scheduled against the same remote playback timeline as the projectile. Audio must not intentionally lead the visible physical event.

## Adapter contract

A game adapter supplies:

1. game metadata
2. initial state
3. projectile definition
4. launch interpretation
5. per-step simulation
6. target/collision resolution
7. scoring
8. shot-completion state transition
9. HUD projection
10. game-specific skin hooks

The platform supplies transport, synchronization, pairing, diagnostics, and rendering coordination.

## Protected platform behavior

Game adapters may not independently replace:

- session/token pairing
- shot sequence ordering
- monotonic remote playback
- recovery arbitration
- cross-device event timing
- monitor/telemetry transport

If a game requires a change to those systems, that is a platform revision.
