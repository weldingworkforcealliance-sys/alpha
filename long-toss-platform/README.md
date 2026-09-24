# Long Toss Platform

Long Toss Platform is the reusable two-device game engine extracted from the physically approved Corvu Mor Bocce build.

## Platform identity

- Name: **Long Toss Platform**
- Version: **v1**
- Origin baseline: `locked/bocce-v1-physical-approved`
- Reference implementation: Corvu Mor Bocce
- First derivative game: Skee Ball

## What the platform owns

The platform owns systems that should behave the same across every long-lane game:

- device/session pairing and QR join flow
- near-screen / far-screen role coordination
- normalized two-screen world coordinates
- realtime projectile streaming
- monotonic remote playback clock
- recovery polling when realtime stalls
- immutable projectile identity while a shot is active
- shared audio/visual event timeline
- shot-start / motion / completion event ordering
- diagnostics and telemetry hooks
- skin/theme registry plumbing
- presentation shell and device setup flow

## What the platform does NOT own

Each game adapter owns:

- projectile physics
- scoring rules
- target geometry
- turn structure
- number of projectiles
- win conditions
- game-specific collision rules
- game-specific art and audio
- game-specific HUD content

Bocce code is therefore a reference adapter, not the definition of the platform.

## Branch policy

- `platform/long-toss-v1` is the reusable engine baseline.
- `feature/bocce-*` continues Bocce development independently.
- `feature/skee-ball-v1` develops Skee Ball from Long Toss Platform.
- Game-specific changes must not be back-ported into the platform unless they are genuinely reusable across games.
