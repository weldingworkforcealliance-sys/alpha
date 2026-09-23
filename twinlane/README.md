# TwinLane v2 core trial

Dedicated branch: `feature/twinlane-v2-core`. This is an additive, isolated prototype. `twinlane-live/` and all LTG code remain unchanged. Do not replace the live prototype until the physical acceptance checklist passes.

## Run

Requires Node 22 or newer. No installation or third-party dependencies.

```sh
cd twinlane
node server.js
```

Open http://localhost:8787/ on this computer. For phones, open `http://<computer-LAN-IP>:8787/` on the same Wi-Fi, with the server reachable through the computer firewall. Create the session from that LAN URL so the invitation also uses the LAN address. Keep the computer running. No public deployment was made. A static host alone cannot run this version; it needs the separate long-running Node server with streaming responses enabled.

Phone A is always left; Phone B is always right. Both are portrait with long sides touching. Align the top edges and scroll both pages to the top. Use matching screen dimensions for the first test. Header/status heights are identical; invitation and controls are below the battlefield. Different physical display sizes still require a future calibration UI.

1. Start on Phone A, copy its invitation to Phone B, and tap Join on Phone B.
2. On Phone A choose Launch shared ball, then scroll both screens to the top. The ball automatically travels and bounces across the seam.
3. Select Three lanes on Phone A. Deploy one scout from each phone in the desired lane. Resume if paused. Scouts stop at the opposite castle; combat is intentionally absent.
4. Open `?dev=1` to enable the local cosmetic preview. Switch skins while the world runs. This never grants an entitlement.
5. Expand Session diagnostics for device, viewport, session ID, selected skin, world X/Y, local X/Y, tick, snapshot age and render delay. Offscreen local coordinates are expected.

## Architecture

- `src/game/`: data-only rules, state and fixed-step engine. No visuals or networking imports. Unit data includes type, owner, health, damage, speed, lane, position, target and attack cooldown. Resource balances and castles exist as state foundations; no harvesting or combat yet.
- `server.js`: authoritative in-memory sessions, authenticated device commands and state streams. 60 Hz simulation, 20 Hz complete snapshots. Both devices are viewers; neither phone runs gameplay simulation. The independent backend avoids modifying the existing Bocce API/schema or deployment.
- `src/multiplayer/`: session lifecycle, snapshot buffering and device viewports. Commands use HTTP; snapshots use server-sent events. Native reconnect recovers the current complete state, without replaying independent movement. Same-tab reload restores credentials from sessionStorage.
- `src/rendering/`: canvas drawing only; receives state, device and resolved skin. Both viewports clip one world. There is no movement handoff event at the seam.
- `src/skins/`: centralized manifests and category-level fallback. Procedural color/material tokens are the initial assets, with no external artwork dependencies.
- `src/commerce/`: cosmetic catalog and entitlement interface only. No checkout, payment, premium currency, account or store integration.
- `src/app.js`: thin browser composition and controls. Extract dedicated card/lobby UI modules when their behavior grows; empty combat/effects modules were not added.

## Shared world and synchronization

World X is 0–1000 and Y is 0–800. Phone A views X 0–500; Phone B views 500–1000. Both use the same Y range. Lanes are at Y 180, 400 and 620; castles are at X 35 and 965. The frontier is X 500. Objects are clipped by canvas boundaries, including partial circles straddling the seam.

Rendering interpolates snapshots with a 120 ms receive-time buffer, rejects old ticks, and freezes at the last available snapshot during a disconnect. This reduces ordinary jitter but does not guarantee frame-exact cross-device synchronization under asymmetric network delay. Clock-offset estimation and a common presentation timestamp are the next networking improvement if physical tests show visible seam lag. All simulation and command validation remains on the server.

## Skins

Living Kingdoms is free, permanent, always unlocked, and the fallback for unknown or locked skin IDs. It provides every category: terrain, lane ground, frontier, bridge, both castles, three resources, both units/card frames/UI trims/banners, projectiles, particles, victory, optional music/SFX. The current renderer draws simple stone, timber, brass and banner forms with muted terrain and stronger blue/red contrast. Final diorama artwork is not included.

Ironhold is locked and marked as a future cosmetic. `?dev=1` previews its alternate terrain/material palette; missing assets fall back to Living Kingdoms. Skin selection is local and never enters commands or game state. Card frames, particles, victory effects and audio have registry hooks but no finished systems yet.

## Verification

```sh
node --test --test-isolation=none tests/*.test.js
```

Five tests pass: shared boundary projection, owner/lane validation and both scouts crossing; skin defaults/locks/fallback and state invariance; jitter/stale snapshots/disconnection freeze; and real HTTP session creation, invalid invitations, second-device joining, full-slot rejection, unauthorized commands, identical stream snapshots, moving ball crossing and reconnect recovery. The no-isolation flag avoids child-process restrictions in the Codex Windows sandbox.

Browser smoke check: create session, reload recovery, launch ball, Ironhold selection while motion continues, diagnostics and basic rendering passed. A second browser tab could not attach in the tool, so browser-to-browser joining is covered by the real two-client transport test, not claimed as a browser UI pass.

### Physical acceptance still required

- Two actual portrait phones, touching long sides, correct left/right viewports.
- Ball passes both directions across the seam without visible jump under real Wi-Fi conditions.
- One scout per phone traverses all three lanes.
- Wi-Fi disconnect/reconnect and background/foreground behavior on each mobile OS.
- Switch skins during motion and verify unchanged positions, health and match state.
- Matched-screen alignment; document behavior on mismatched screens before adding calibration.

## Known limits / next milestone

This is a local trusted-play trial. Sessions are in memory and expire after one hour without clients; server restart loses sessions. Guest joining is one-use; reconnect in the original tab, or start a new session if that tab's storage is lost. The server simulates while disconnected. There is no host migration, durable persistence, final matchmaking, production service hardening or mobile screen-size calibration. Public hosting should add HTTPS, admission controls and deployment-specific protections before broader access.

Next milestone: pass the physical two-phone acceptance checklist, then add common-timestamp presentation/calibration as needed, and only then implement authoritative targeting and basic lane combat with tests. Preserve the original prototype until those checks pass.

## Files

All created files are under `twinlane/`: `index.html`, `style.css`, `package.json`, `server.js`, this README, `src/app.js`, `src/game/{rules,state,engine}.js`, `src/multiplayer/{device-layout,session,sync}.js`, `src/rendering/renderer.js`, `src/skins/registry.js`, `src/skins/{living-kingdoms,ironhold}/manifest.js`, `src/commerce/{catalog,entitlements}.js`, and `tests/{core,session}.test.js`.

Existing files modified: none.
