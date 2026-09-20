# WLD 110 — Instructor Shop Planner Template

Approved reference: WLD 110 Day 1, September 20, 2026.
Purpose: make every shop day easy for the instructor to scan, teach and check.

## At a glance

Use one card per scheduled activity. Show the time range and duration prominently, followed by a short activity title. Keep each card focused on what to do, what to watch for and what students must demonstrate.

| Cue | Appearance | Content |
| --- | --- | --- |
| Time | Large, bold | Calculated range and duration |
| Activity | Large, bold | Specific skill or project step |
| SAFETY / SAFE CLOSEOUT | Red | Essential hazard, control or stop condition |
| DEMONSTRATE / DEMO + PRACTICE / APPLY | Blue | Short action steps |
| CHECK / STUDENT PRACTICE | Green | Observable evidence or supervised practice |
| HOMEWORK | Amber | Only work actually assigned |

Use written labels along with color. Activity titles are about 20 px, body text 16 px and cue labels 12 px. Maintain readable contrast and spacing on desktop and phone. Keep background curriculum and coaching available in expandable sections.

## Copy-ready activity

```text
SHORT ACTIVITY TITLE

🟥 SAFETY — [Essential hazard/control, if needed in this block.]

🟦 DEMO + PRACTICE
• [First concrete teaching or practice step.]
• [Next step, only if needed.]

🟩 CHECK — [What the instructor observes, verifies or records.]
```

For an application block, use APPLY. For closeout, use SAFE CLOSEOUT. Use only the cues the activity needs. Use plain text, short bullets and occasional **bold** emphasis. Do not paste HTML.

## Writing rules

- Start with an action: inspect, show, fit, practice, compare, verify or record.
- Aim for 1–3 teaching bullets and one concise check. Add detail when safety or sequence requires it.
- Keep required precautions, authorization steps and shutdown instructions.
- Remove repeated explanations and generic coaching from the main teaching cards.
- Name the actual electrode, position, skill and project step from the approved day.
- Use the active WLD 105 print, cut list, dimensions, project status and quality decisions for fabrication work.
- Use the active rubric and gradebook. Do not invent tolerances, parameters, grade weights or completion criteria.
- Treat the day plan as a teaching benchmark. Individual skill advancement follows the existing shop competency rules.

## Timing rules

Retain each day's own time allocations unless the instructor requests a change. Recalculate later ranges cumulatively from minute 0 whenever a duration changes. Verify no gaps or overlaps and a total of 190 minutes.

| Reference schedule | Minutes |
| --- | --- |
| Approved Day 1 | 25 + 50 + 85 + 30 = 190 |
| Current Days 2–22 | 25 + 5 + 130 + 30 = 190 |
| Current Day 23 | 25 + 5 + 45 written exam + 85 performance + 30 = 190 |

The 50-minute block belongs to Day 1; it is not a default duration for other lessons.

## Daily use

1. Open the day and confirm the active skill, project status and paired WLD 105 work.
2. Adjust the specific steps to the instructor's direction and actual student progress.
3. Preserve approved outcomes, safety requirements and grading rules.
4. Read only the activity cards to check that the next action is obvious.
5. Recheck the timeline, save, reload and verify the day.

## Approved Day 1 reference

### 0–25 min · 25 min

SHOP ORIENTATION & EMERGENCY ROUTINES

🟥 SAFETY — Raised fist + call out = STOP. Everyone reports hazards; resume only after instructor clearance. Never criticize a legitimate safety stop.

🟦 TOUR + SHOW
• Locate exits, alarms, extinguishers, eyewash, first aid, spare glasses and hearing protection. AED: near guard booth.
• Rally point: corner by the church. Stop work safely → follow instructor to an appropriate exit → rally → stay for headcount. Emergency-only doors stay closed except for emergencies or authorized direction.
• Stage and identify: helmet, leather jacket, glasses, hearing protection, SMAW gloves, pliers, chipping hammer, brush, grinder and wire wheel.

🟩 CHECK — Students identify the rally point and demonstrate the stop signal.

### 25–75 min · 50 min

HELMET, GRINDER & E6010 ARC STARTS

🟦 DEMO + PRACTICE
• Helmet: fit headgear; check operation, shade/sensitivity and lowering motion. Keep safety glasses on.
• Grinder: inspect tool/accessories; fit guard; show approved wheel/disc changes, controls, two-hand grip, body position and spark direction. Use eye, face and hearing protection.
• Students: install/remove a wire wheel; label assigned tools and PPE.
• E6010: show holder/work connection, body/hand position and safe holder placement. Demonstrate strike, sticking, long arc and steady arc length. Focus on arc control.

🟥 SAFETY — Unplug grinders for setup, accessory changes and adjustments. Instructor checks every setup before powered use.

🟩 CHECK — Students demonstrate helmet lowering and an unplugged wheel change; explain arc-length control.

HOMEWORK — Take helmet home. Pen and paper only: welding stance → hold pen like holder → lower helmet → strike motion → trace the arc path. No live welding.

### 75–160 min · 85 min

OXY-FUEL CUTTING (OFC) — DEMO + PRACTICE

🟥 SAFETY — Shade 5 OFC eye protection, gloves and protective clothing. Clear combustibles; control sparks, slag and hot metal.

🟦 DEMONSTRATE
• Stage cylinders, regulators, hoses, torch, striker and accessories.
• Inspect equipment; connect regulators/hoses; check valves/flashback protection; fit torch/tip; leak-test.
• Use approved striker; adjust cutting flame; show torch position, cutting-oxygen lever and a basic cut.
• Show torch shutdown, cylinder closure, pressure relief, backing out regulator adjusting screws, disconnection and storage.

🟩 STUDENT PRACTICE — Repeat the demonstrated setup, cut and shutdown under instructor supervision. Prioritize safe sequence and control over speed.

SEQUENCE — Inspect → Assemble → Leak-test → Light → Adjust → Cut → Shut down → Relieve pressure → Disassemble.

### 160–190 min · 30 min

LAYOUT, CLEANUP & CLOSEOUT

🟦 APPLY — Prepare coupons/joints, complete a short layout drill and stage materials using the paired WLD-105 print and dimensions.

🟥 SAFE CLOSEOUT — Reserve the final portion for equipment shutdown, hot-metal control, cleanup, tool count and storage.

🟩 CHECK — Confirm stations are safe, tools are accounted for and logs are complete. Review the helmet pen-and-paper homework.

## LTG implementation reference

The existing shared renderer applies this format in the dashboard and agenda workspace:
- `lib/planner-activity.ts`: recognizes titles and cue labels.
- `app/planner-activity.tsx`: renders readable, safe text.
- `app/planner-readability.css`: shared typography, colors and responsive cards.

Store each activity's formatted text in its existing instructor-actions field. Keep curriculum references intact and correct stale project labels against the active guide before saving.
