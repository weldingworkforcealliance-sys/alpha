# Corvu Mor Bocce — Living Kingdoms Visual Stage

## Locked gameplay baseline

Approved gameplay/audio commit:

`c6acb057f355b7182e84e82adc6b13620bd480c9`

Locked branch:

`locked/bocce-gameplay-audio-v1`

Visual-development branch:

`feature/bocce-living-kingdoms-v1`

## Absolute rule

The Living Kingdoms stage may change presentation only.

Do not change:

- 144 Hz physics solver
- launch curve
- rolling resistance / friction
- collision radii or visible contact geometry
- restitution or damping
- start-zone coordinates
- lane/world coordinates
- wall boundaries
- pallino legal zone
- scoring or turn logic
- realtime interpolation / buffering
- API behavior
- sound-event timing or routing
- gameplay hitboxes

## Living Kingdoms goals

1. Replace prototype-looking court presentation with finished Living Kingdoms art.
2. Preserve immediate competitive readability.
3. Give Screen 1 and Screen 2 the illusion of one continuous court.
4. Use wood, stone, moss, carved heraldic details, subtle foliage, and restrained magical accents.
5. Keep balls, pallino, rail edges, scoring, and legal play area visually obvious.
6. Create a polished title/setup/pairing experience without hiding essential instructions.
7. Keep the original Living Kingdoms skin free and structure visuals so future paid skins can reuse identical gameplay geometry.

## Skin architecture

Future skins may replace:

- court surface textures
- rail materials
- border ornament
- ambient background
- ball cosmetic materials
- UI frame treatments
- particles / non-gameplay animation
- sound cosmetic set only after separate approval

Future skins may not alter gameplay layout, lane positions, collisions, hitboxes, or competitive visibility.
