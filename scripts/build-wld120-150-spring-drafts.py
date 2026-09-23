"""Create provisional, local WLD 120/150 daily guides. No service connections."""

import json
from datetime import date, datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"

dates = []
cursor = date(2027, 2, 8)
while cursor <= date(2027, 3, 18):
    if cursor.weekday() < 4:
        dates.append(cursor.isoformat())
    cursor += timedelta(days=1)
assert len(dates) == 24

# Each tuple: objective, application, assessment evidence, protected CLO numbers.
capstone = [
    ("Introduce the multi-component capstone and allocate individual components", "Inspect the project brief and assign one traceable part or subassembly per student; identify the final assembly interface.", "Approved project brief and component assignment log", [1, 7]),
    ("Interpret the assembly drawing and identify critical dimensions", "Mark part IDs, mating surfaces, weld symbols, and dimensions on instructor-provided drawings.", "Annotated drawing with instructor corrections", [1, 2]),
    ("Create a cut list and fabrication sequence", "Calculate material quantities, identify cut order and hold points, and check stock against the drawing.", "Cut list and workflow plan", [1, 2]),
    ("Set tolerances and obtain material-release approval", "Agree on datum points, measurement methods, and assembly fit limits before cutting.", "Signed blueprint, cut-list, and tolerance approval", [1, 2, 5]),
    ("Prepare material and verify CNC plasma files", "Inspect stock; confirm units, scale, geometry, and file naming with the instructor before CAM work.", "Material log and approved file check", [2, 3]),
    ("Nest components and verify toolpaths", "Compare nest to material, kerf allowance, lead-ins, cut order, and hold-down plan; run a supervised simulation.", "Nesting/toolpath checklist and saved revision", [3, 5]),
    ("Cut first components under supervision", "Run approved CNC or manual cutting, label each part, and retain the first-piece sample.", "First-piece dimensional inspection", [3, 5]),
    ("Complete first cutting QC and correction", "Measure all assigned parts; document rework, recut, or approval before fit-up.", "Cut-part inspection record and disposition", [3, 5, 6]),
    ("Lay out components for fit-up", "Verify datums and mating dimensions; fixture the first joint without forcing misfit parts.", "Fit-up checklist and measured gap", [4, 5]),
    ("Tack assigned components and check alignment", "Tack in a distortion-aware sequence; remeasure before releasing the fixture.", "Tack and alignment sign-off", [4, 5, 6]),
    ("Start production welds and retain traceability", "Weld assigned parts with the approved process/WPS and record part ID, welder, and setting reference.", "Labeled component and process record", [4, 6]),
    ("Perform peer visual QC on early welds", "Inspect preparation, fit-up, profile, and visible discontinuities; log findings for instructor disposition.", "Peer QC sheet and instructor disposition", [4, 6]),
    ("Continue weld-out while controlling sequence", "Alternate sides or use approved fixtures as appropriate; check dimensions at planned pauses.", "Interpass measurement and weld log", [4, 5]),
    ("Correct distortion and document rework", "Measure displacement against agreed tolerances; request approval before heat correction or recut.", "Distortion record and corrective-action approval", [5, 6]),
    ("Build first subassembly", "Join approved components in sequence and check mating interfaces after each step.", "Subassembly fit-up and QC record", [4, 5, 6]),
    ("Complete subassembly QC gate", "Inspect welds and dimensions; tag accepted pieces and isolate pieces requiring correction.", "Signed subassembly inspection record", [5, 6]),
    ("Test-fit the full assembly", "Dry-fit components; measure cumulative stack-up and identify interface corrections.", "Test-fit measurements and punch list", [5, 7]),
    ("Correct out-of-tolerance components", "Rework only instructor-approved items, then reinspect and update revision notes.", "Before/after measurements and disposition", [5, 6]),
    ("Review sample weld and final assembly readiness", "Inspect representative welds and confirm all components meet fit and quality requirements.", "Assembly-release checklist", [4, 6, 7]),
    ("Complete final test-fit and assembly plan", "Assign team roles, lifting/fixturing sequence, and final weld/check locations.", "Signed assembly plan and role roster", [1, 7]),
    ("Execute final assembly", "Assemble approved components using safe handling, fixtures, and documented sequence.", "Assembly progress photos and dimensional checks", [4, 5, 7]),
    ("Perform final inspection and close punch list", "Measure critical dimensions, inspect accessible welds, and record remaining corrections.", "Final QC report and closed punch list", [5, 6]),
    ("Assemble the documentation and presentation packet", "Collect drawings, file revisions, cut list, inspection records, process logs, and individual contributions.", "Complete draft documentation packet", [1, 6, 7]),
    ("Present the finished capstone and document individual work", "Deliver team presentation, demonstrate assembly fit, and submit the final individual evidence packet.", "Final project rubric, packet, and presentation record", [6, 7]),
]

advanced = [
    ("Refresh safety and assess starting skill", "Inspect stations and run a supervised baseline coupon in the candidate primary process.", "Safety checklist and labeled baseline coupon", [1]),
    ("Select primary specialization and performance targets", "Choose SMAW, GMAW, FCAW, or GTAW with instructor approval; identify positions and approved procedure.", "Signed track plan and starting parameter log", [1, 6]),
    ("Prepare groove joint and fit-up variables", "Practice bevel, land, root gap, alignment, and tacking on training plates.", "Joint-preparation checklist", [2, 4]),
    ("Run primary-track warm-up and first quality review", "Practice the selected process; identify one repeatable correction using the process rubric.", "Labeled coupon and instructor coaching note", [1, 6]),
    ("Build repeatable root-pass technique", "Prepare and weld groove coupons in the primary track under the approved WPS.", "Root-pass visual check and parameters", [1, 2, 4]),
    ("Control fill-pass sequence and interpass cleaning", "Run multi-pass plates; inspect access, fusion, cleaning, and heat management between passes.", "Multi-pass log and instructor check", [1, 2, 4]),
    ("Progress to the next approved position", "Repeat groove preparation and welding in the next position permitted by readiness and equipment.", "Position rubric and labeled plate", [1, 2]),
    ("Diagnose discontinuities and correct technique", "Compare inspected coupons with selected acceptance criteria; change one variable and retry.", "Defect and corrective-action record", [1, 2, 6]),
    ("Refine primary-track groove quality", "Repeat the weakest assessed position and preserve the best plate for comparison.", "Before/after plates and parameter log", [1, 2]),
    ("Practice consistent joint prep across plates", "Reproduce bevel, land, root gap, and alignment without instructor adjustment.", "Fit-up checklist and measurement evidence", [2, 4]),
    ("Complete a coached groove test rehearsal", "Perform a timed plate to the approved procedure; identify remaining quality gaps.", "Rehearsal rubric and correction plan", [1, 2]),
    ("Approve bend-test plate preparation", "Prepare the test plate and verify identification, fit-up, procedure, and inspection gate.", "Instructor-approved test plate record", [2, 4]),
    ("Weld bend-test plate", "Complete supervised test weld and retain full traceability of parameters and passes.", "Labeled plate, WPS record, and visual check", [1, 2]),
    ("Prepare destructive-test specimens", "Follow local cutting and specimen-preparation procedure; confirm identification and dimensions.", "Specimen preparation and chain-of-custody record", [2, 3]),
    ("Run destructive bends with instructor control", "Observe or perform authorized bending; record result against the selected test criteria.", "Bend-test results and defect notes", [3]),
    ("Interpret bends and make a correction plan", "Identify failure location and likely causes; plan a targeted retest or improvement sequence.", "Result interpretation and corrective-action log", [3, 6]),
    ("Introduce pipe joint prep and 1G setup", "Inspect pipe material, prepare bevel/root gap, align and tack under supervision.", "Pipe 1G fit-up and safety checklist", [4, 5]),
    ("Practice 1G root quality", "Develop controlled root passes with the selected primary process and approved pipe procedure.", "Labeled 1G coupon and root inspection", [1, 5]),
    ("Complete 1G fill and cap", "Manage pass sequence, cleaning, and profile; record process settings.", "Completed 1G coupon and parameter record", [1, 5, 6]),
    ("Progress toward 2G pipe fundamentals", "Set up a 2G joint and practice root control only after 1G safety/fit-up sign-off.", "2G setup and practice record", [4, 5]),
    ("Weld assigned capstone component", "Use the approved primary process on an instructor-released WLD 120 component or practice equivalent.", "Traceable component weld and quality record", [1, 6]),
    ("Refine capstone weld and portfolio evidence", "Correct documented weld issues and select coupons, photos, and parameter records.", "Accepted component and portfolio checklist", [1, 6]),
    ("Complete final skills check and portfolio", "Demonstrate primary-track quality and submit bend/pipe/capstone evidence with reflection.", "Final skills rubric and verified portfolio", [1, 3, 5, 6]),
    ("Close project work and review individual growth", "Finish any approved rework, verify shutdown and tool accountability, and review next qualification steps.", "Final portfolio and individual assessment record", [1, 6]),
]

assert len(capstone) == len(advanced) == len(dates) == 24

protected_outcomes = {
    "WLD 120": [
        "Plan a complete fabrication workflow from blueprint to final assembly.",
        "Interpret technical drawings and produce accurate cut lists.",
        "Prepare CNC plasma files, nesting, and toolpath verification.",
        "Fabricate assigned components using appropriate welding processes.",
        "Apply tolerances, measurement strategies, and distortion control.",
        "Perform QC inspections and document fabrication processes.",
        "Participate in team assembly and deliver a professional final presentation.",
    ],
    "WLD 150": [
        "Demonstrate advanced proficiency in a selected welding process across multiple positions.",
        "Prepare certification-level groove test plates in the primary track.",
        "Complete destructive bend testing and interpret results.",
        "Execute accurate joint preparation and fit-up for multi-pass weldments.",
        "Apply pipe welding fundamentals safely and consistently.",
        "Compile a weld portfolio documenting progress and final performance in the primary track.",
    ],
}

# Instructor references only. The source files remain outside the public site.
inspection_refs = ["01-welding-inspection.pdf", "02-visual-inspection.pdf",
                   "05-visual-inspection.pptx", "06-ch-11-discontinuties.pptx"]


def references_for_day(code, number):
    names = []
    if number == 1:
        names.append("03-occupational-orientation.pdf")
    if code == "WLD 120" and number in (8, 12, 16, 19, 22):
        names.extend(inspection_refs)
    if code == "WLD 150" and number in (8, 11, 12, 13, 15, 16, 23):
        names.extend(inspection_refs)
    return [{"source_filename": name, "access": "instructor_only",
             "ltg_url": None} for name in names]


def build(code, title, items, weights):
    is_capstone = code == "WLD 120"
    section_time = ({"start": "17:00", "end": "18:00", "minutes": 60} if is_capstone
                    else {"start": "18:00", "end": "21:45", "minutes": 225})
    segment_plan = ([
        ("demonstration", "Review, safety gate, and demonstration", 0, 15),
        ("guided_practice", "Supervised project work", 15, 45),
        ("other", "Evidence, handoff, and safe closeout", 45, 60),
    ] if is_capstone else [
        ("demonstration", "Toolbox talk and demonstration", 0, 25),
        ("guided_practice", "Guided setup and first attempt", 25, 60),
        ("independent_practice", "Welding practice, coaching, and assessment", 60, 200),
        ("other", "Evidence and safe closeout", 200, 225),
    ])
    days = []
    for index, (objective, application, evidence, clos) in enumerate(items):
        number = index + 1
        safety = ("PPE, ventilation, fire watch/hot-metal control, machine condition, and instructor release before operation. "
                  "Stop work on unsafe setup or an unapproved procedure.")
        day = {
            "planner_day_number": number,
            "candidate_date": dates[index],
            "scheduled_date": dates[index],
            "date_status": "provisional_2027_spring_6a_projection",
            "title": objective,
            "objective": objective,
            "outcome_codes": [f"CLO {n}" for n in clos],
            "instructor_prep": "Prepare the approved project drawings, WPS/test criteria, equipment, material, and individual evidence records.",
            "safety_focus": safety,
            "opening_review": "Review the prior checkpoint and today's release criteria.",
            "demonstration": f"Demonstrate the method and quality check for: {objective.lower()}.",
            "guided_practice": application,
            "independent_practice": application,
            "assessment": evidence,
            "instructor_checks": evidence,
            "evidence_check_for_understanding": evidence,
            "teaching_tips": "Coach one measurable correction at a time; retain labeled work and revision history.",
            "materials_equipment": "Approved PPE, project/track drawings, WPS, station equipment, measuring tools, and labeled work records.",
            "closeout": "Record evidence and open corrections; de-energize equipment, secure gas, control hot material, and clean the station.",
            "instructor_only_resource_references": references_for_day(code, number),
            "segments": [{
                "sequence_number": seq,
                "segment_type": kind,
                "segment_title": label,
                "start_minute": start,
                "end_minute": end,
                "planned_minutes": end - start,
                "instructor_actions": (
                    f"Review safety and demonstrate: {objective}" if kind == "demonstration" else
                    f"Supervise and coach: {application}" if kind == "guided_practice" else
                    f"Coach, inspect, and assess: {application}" if kind == "independent_practice" else
                    f"Record evidence: {evidence}. Complete safe shutdown and handoff."
                ),
                "student_actions": (
                    "Identify hazards, review the prior checkpoint, and observe the demonstration." if kind == "demonstration" else
                    application if kind in ("guided_practice", "independent_practice") else
                    f"Submit {evidence.lower()}; log corrections and leave the station safe."
                ),
            } for seq, (kind, label, start, end) in enumerate(segment_plan, 1)],
        }
        days.append(day)
    payload = {
        "status": "staged_provisional_dated_draft_not_deployed",
        "course_code": code,
        "guide_name": f"{code} Spring 6A 24-Day Instructor Guide Draft",
        "planned_instructional_days": 24,
        "calendar_basis": "PCCC Spring 2026 6A pattern shifted to Monday February 8 2027; 2027 dates unconfirmed",
        "calendar_status": "provisional_awaiting_pccc_2027_confirmation",
        "section_time": section_time,
        "paired_course": ({"course_code": "WLD 150", "start": "18:00", "end": "21:45",
                           "attendance_primary": False} if is_capstone else
                          {"course_code": "WLD 120", "start": "17:00", "end": "18:00",
                           "attendance_primary": True}),
        "attendance_primary": is_capstone,
        "grade_weights_from_supplied_syllabus": weights,
        "protected_outcomes_from_supplied_syllabus": {
            f"CLO {number}": wording
            for number, wording in enumerate(protected_outcomes[code], 1)
        },
        "days": days,
    }
    stem = code.replace(" ", "") + "_SPRING6A_24_DAY"
    (DOCS / f"{stem}_PAYLOAD.json").write_text(json.dumps(payload, indent=2) + "\n")
    lines = [f"# {code} — Spring 6A provisional 24-day instructor guide", "",
             "**Status:** Guide loaded into LTG as a draft. February 8–March 18, 2027 dates are provisional; no live section or attendance records until curriculum approval and section release.", "",
             f"**Role:** {title}. Paired daily with {payload['paired_course']['course_code']}.", "",
             f"**Class time:** {'5:00–6:00 PM (60 minutes)' if is_capstone else '6:00–9:45 PM (225 minutes)'}. "
             f"{'WLD 120 is the attendance-primary course for the pair.' if is_capstone else 'Attendance follows the WLD 120 primary record.'}", "",
             "## Daily teaching flow", "",
             "Start with the safety gate and prior-day review. Demonstrate the day's method, supervise first attempts, "
             "release students for independent work only after setup approval, assess the listed evidence, then document "
             "corrections and close the shop. WLD 120 hands off approved parts and open issues to WLD 150 at 6:00 PM.", "",
             "| Segment | Minutes | Clock time |", "| --- | ---: | --- |"]
    for kind, label, start, end in segment_plan:
        base = datetime.strptime(section_time['start'], '%H:%M')
        clock = lambda minute: (base + timedelta(minutes=minute)).strftime('%-I:%M %p')
        lines.append(f"| {label} | {end-start} | {clock(start)}–{clock(end)} |")
    lines.append("")
    for day in days:
        lines += [f"## Day {day['planner_day_number']} — {day['candidate_date']} (candidate)", "",
                  f"**Objective:** {day['objective']}", "",
                  f"**Protected outcomes:** {', '.join(day['outcome_codes'])}", "",
                  f"**Safety and instructor preparation:** {day['safety_focus']} {day['instructor_prep']}", "",
                  f"**Opening and demonstration:** {day['opening_review']} {day['demonstration']}", "",
                  f"**Guided and independent work:** {day['guided_practice']}", "",
                  f"**Assessment/evidence:** {day['assessment']}", "",
                  f"**Instructor sources:** {', '.join(r['source_filename'] for r in day['instructor_only_resource_references']) or 'Approved drawings, WPS, and equipment manuals.'}", "",
                  f"**Closeout:** {day['closeout']}", ""]
    (DOCS / f"{stem}_DRAFT.md").write_text("\n".join(lines).rstrip() + "\n")
    return stem


for result in (
    build("WLD 120", "Capstone planning, fabrication, inspection, and presentation", capstone,
          {"blueprint_and_cut_list": 20, "cutting_and_tolerance": 20, "welding_fitup_distortion": 30,
           "team_assembly_communication": 10, "final_packet_presentation": 20}),
    build("WLD 150", "Advanced process specialization and weld performance", advanced,
          {"primary_track_performance": 50, "bend_test_plate_and_results": 25,
           "advanced_fabrication_capstone": 15, "professionalism_safety_attendance": 10}),
):
    print(result)
