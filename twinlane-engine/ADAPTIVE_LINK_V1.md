# TwinLane Adaptive Link v1

## Status

**Required engine add-on** for Corvu Mor games where a moving object crosses device boundaries.

Physically approved reference:

- Game: Bocce
- Branch: `locked/adaptive-link-v1-physical-approved`
- Commit: `234b9eb3ef1a893b359fb3bb7d3c6bdb0fb420b7`
- Physical approval: September 24, 2026

## Responsibilities

Adaptive Link handles transport and presentation timing. It does **not** own game physics, scoring, hitboxes, launch curves, or rules.

It provides:

- WebRTC direct device-to-device control channel
- WebRTC low-latency unordered motion channel
- Supabase Realtime signaling and automatic fallback
- RTT, jitter, packet-loss and clock-offset calibration
- sender/receiver refresh-rate measurement
- adaptive playback delay
- adaptive prediction window
- adaptive motion-send interval
- connection health checks and between-shot recalibration

## Required rule

Any Corvu Mor game with visible continuous motion crossing from one device to another must use this add-on or a later compatible version.

Do not replace it with game-specific fixed buffer constants unless the engine version itself is formally superseded.

## Multi-screen topology

The add-on is transport-agnostic and can be instantiated per downstream peer. For a three-segment Skee-Ball table, the approved visual model remains:

- Launch/control: world Y 0–34
- Middle lane: world Y 34–66
- Ramp/scoring: world Y 66–100

Each live cross-device motion link should use its own calibrated Adaptive Link instance once that peer is registered in the session layer.

## Fallback

If WebRTC cannot establish or remains unhealthy, the game continues over Supabase Realtime using the approved cloud profile rather than blocking play.
