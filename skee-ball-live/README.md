# Corvu Mor Skee Ball — v1 Prototype

This game is the first new game built from **Long Toss Platform** after Bocce.

## First playable rules

- 2 players
- 9 balls per player
- players alternate throws
- target values: 10, 20, 30, 40, 50 and 100
- highest score after both players throw 9 balls wins
- swipe direction controls lateral aim
- swipe strength controls distance up the scoring ramp

## Platform systems reused

- Screen 1 / Screen 2 pairing
- QR join flow
- normalized 0–100 long field
- realtime projectile broadcast
- monotonic 60 ms remote playback
- durable physics snapshots for recovery
- shot sequence ordering

## Prototype limitation

For this first Skee Ball branch, score/match state is broadcast live from the launch device rather than persisted through Bocce-specific completion actions. This deliberately avoids modifying the Bocce backend. A generic Long Toss state endpoint is a later platform task.
