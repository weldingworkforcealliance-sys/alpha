# PCCC Day Level II — 23-Day WLD 205 / WLD 210 Planner

Status: **reviewed curriculum build; deployment migration creates draft guides only**.

## Locked rules

- PCCC Day Level II meets Monday–Thursday for 23 instructional days beginning 09/22/2026.
- PVHS Level II continues beyond the Day Level II block to its full 55-day WLD 205/210 semester sequence.
- WLD 205 is the shared theory course. Beginning Day Level II Day 2 / PVHS Day 11, new WLD 205 theory is taught to both cohorts together at the same pace.
- PVHS-only Fridays do **not** introduce new WLD 205 theory. Friday is used for WLD 210 shop, application, reinforcement, remediation, inspection, evidence, or previously taught WLD 205 application.
- 10/27/2026 is a Day-Level-II-only WLD 205 theory hold because PVHS is not in attendance.
- Day Level II WLD 205 is 60 minutes per instructional day.
- Day Level II WLD 210 is an accelerated 300-minute shop block. Day 1 is intake/shop-readiness baseline; Days 2–23 provide the accelerated practical progression.
- Protected curriculum and approved course outcomes are not changed. The Day Level II build changes pacing, sequencing, practice density, and implementation only.
- Secure AWS/PCCC exam questions or answers are never stored in LTG. LTG records only permitted status/evidence.
- Live Job Card records instructional evidence only and does not itself create AWS qualification.

## WLD 205 calendar synchronization

| Day L2 | Date | PVHS alignment | WLD 205 |
|---:|---|---|---|
| 1 | 09/22 | PVHS Day 10 | Intake math diagnostic; no shared new theory |
| 2 | 09/23 | PVHS Day 11 | Common Level II Start + Math Day 1 |
| 3 | 09/24 | PVHS Day 12 | Blueprint I: lines, views, dimensions, notes |
| 4 | 09/28 | PVHS Day 14 | Blueprint II: welding symbols + joint details |
| 5 | 09/29 | PVHS Day 15 | Blueprint III: sections, assembly prints, fabrication sequence |
| 6 | 09/30 | PVHS Day 16 | WPS/SWPS + documentation discipline |
| 7 | 10/01 | PVHS Day 17 | Trade Math I: perimeter + area |
| 8 | 10/05 | PVHS Day 19 | Trade Math II: triangles + angles |
| 9 | 10/06 | PVHS Day 20 | Trade Math III: circles + volume |
| 10 | 10/07 | PVHS Day 21 | Trade Math IV: material weight + repeated measurements |
| 11 | 10/08 | PVHS Day 22 | Trade Math V: U.S./metric + mixed units |
| 12 | 10/13 | PVHS Day 24 | Readiness + secure Trade Math exam |
| 13 | 10/14 | PVHS Day 25 | Metallurgy I: carbon steel + steel classes |
| 14 | 10/15 | PVHS Day 26 | Metallurgy II: ferrite/austenite/pearlite |
| 15 | 10/19 | PVHS Day 28 | Metallurgy III: cooling rate, transformation, HAZ |
| 16 | 10/20 | PVHS Day 29 | Metallurgy IV: hardenability, weldability, cracking |
| 17 | 10/21 | PVHS Day 30 | Metallurgy V: stainless families |
| 18 | 10/22 | PVHS Day 31 | Metallurgy VI: aluminum + oxide/HAZ behavior |
| 19 | 10/26 | PVHS Day 33 | Metallurgy VII: residual stress + distortion |
| 20 | 10/27 | PVHS absent | Theory hold; application/shop support only |
| 21 | 10/28 | PVHS Day 34 | Metallurgy readiness + secure exam |
| 22 | 10/29 | PVHS Day 35 | Blueprint/WPS/governing-source integration |
| 23 | 11/02 | PVHS Day 37 | WLD 205 integrated capstone |

PVHS-only Friday holds during this overlap: **09/25, 10/02, 10/09, 10/16, 10/23, 10/30**. No new WLD 205 theory is introduced on those dates.

## Day Level II WLD 210 accelerated sequence

| Day | Shop focus |
|---:|---|
| 1 | Intake / shop-readiness baseline |
| 2 | Source-to-shop + OFC setup / square-edge cutting |
| 3 | OFC bevel cutting + workpiece preparation |
| 4 | PAC square / bevel / shape cutting |
| 5 | Thermal-cut quality, fit-up preparation + rework |
| 6 | Thermal-cut readiness + secure exam + remaining practical evidence |
| 7 | SMAW Level II reset: WPS, setup + multipass baseline |
| 8 | SMAW 3G joint prep, fit-up + root/first pass |
| 9 | SMAW 3G fill-pass control + repetition |
| 10 | SMAW 3G cap + visual inspection |
| 11 | SMAW 3G discontinuity correction + rework |
| 12 | SMAW 4G joint prep, fit-up + root/first pass |
| 13 | SMAW 4G fill-pass control + repetition |
| 14 | SMAW 4G cap + visual inspection |
| 15 | SMAW 4G discontinuity correction + rework |
| 16 | SMAW parameter control + repeatability |
| 17 | Fit-up, tack strategy + distortion control |
| 18 | SMAW plate readiness + secure exam + targeted remediation |
| 19 | SMAW 3G performance qualification attempt / program test |
| 20 | SMAW 4G performance qualification attempt / program test |
| 21 | Integrated capstone: cut -> fit -> weld -> inspect -> record |
| 22 | Targeted remediation / qualification-evidence recovery |
| 23 | Final practical closeout / remaining qualification evidence |

Normal WLD 210 day structure: 25-minute toolbox/demo, 120-minute guided shop cycle, 110-minute independent practice, 35-minute inspect/correct/evidence block, 10-minute cleanup/accountability.

## Deployment guardrail

Migration `20260914171000_day_level2_23_day_planners.sql` creates/updates the two guides as **draft**. It does not create Day Level II sections, assign instructors, generate live planner days, advance section progress, or alter the currently active PVHS section. Activation is a separate controlled step after instructor-view QA.
