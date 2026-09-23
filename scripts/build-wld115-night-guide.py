"""Build the staged WLD 115 guide payload from its reviewed Markdown draft.

This only writes a local JSON file. It never connects to Supabase or Netlify.
"""

import json
import re
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "docs/WLD115_NIGHT_LEVEL1_22_DAY_DRAFT.md"
OUTPUT = ROOT / "docs/WLD115_NIGHT_LEVEL1_22_DAY_PAYLOAD.json"
text = SOURCE.read_text(encoding="utf-8")

outcomes = {
    int(number): wording.strip()
    for number, wording in re.findall(r"^\d+\. CLO (\d+): (.+)$", text, re.M)
}
assert sorted(outcomes) == list(range(1, 7)), "All six protected outcomes are required"

calendar = []
day = date(2026, 11, 9)
while day <= date(2026, 12, 19):
    if day.weekday() < 4 and not date(2026, 11, 25) <= day <= date(2026, 11, 29):
        calendar.append(day.isoformat())
    day += timedelta(days=1)
assert len(calendar) == 22 and calendar[-1] == "2026-12-17"

segments = [
    ("demonstration", "Toolbox talk and demonstration", 0, 25),
    ("guided_practice", "Guided setup and practice", 25, 60),
    ("independent_practice", "Practice, coaching, and assessment", 60, 200),
    ("other", "Evidence and safe closeout", 200, 225),
]

days = []
for line in text.splitlines():
    match = re.match(r"^\| (\d+) \| (.+) \| (.+) \| (.+) \| (.+) \|$", line)
    if not match:
        continue
    number = int(match[1])
    if not 1 <= number <= 22:
        continue
    objective, application, evidence, alignment = match.groups()[1:]
    process = "GTAW" if number <= 8 else "GMAW" if number <= 16 else "FCAW"
    codes, slide_range = alignment.split("; ", 1)
    outcome_numbers = [int(code) for code in re.findall(r"\d+", codes)]
    if codes.strip() == "1–6":
        outcome_numbers = list(range(1, 7))
    assert outcome_numbers and set(outcome_numbers) <= outcomes.keys()
    assert slide_range.startswith(process + " ")
    day_segments = []
    for index, (kind, title, start, end) in enumerate(segments, 1):
        action = [objective, f"Demonstrate, then coach: {application}", application,
                  f"Check and record: {evidence} Shut down and account for equipment."][index - 1]
        day_segments.append({
            "sequence_number": index,
            "segment_type": kind,
            "segment_title": title,
            "start_minute": start,
            "end_minute": end,
            "planned_minutes": end - start,
            "instructor_actions": action,
            "student_actions": ["Identify the hazard and observe the process demonstration.",
                                "Complete supervised setup and first attempt.",
                                "Practice, adjust one variable, and retain labeled work.",
                                "Log evidence, shut down safely, and clean the station."][index - 1],
        })
    days.append({
        "planner_day_number": number,
        "scheduled_date": calendar[number - 1],
        "title": f"{process} — {objective.split(';')[0].rstrip('.')}"[:180],
        "objective": objective,
        "safety_focus": "Check PPE, ventilation, cylinder and electrical setup; stop unsafe work and obtain instructor clearance.",
        "instructor_prep": "Confirm the approved WPS, equipment, consumables, coupons, and supervised practice stations.",
        "opening_review": "Review the prior day's settings, quality evidence, and one corrective action.",
        "demonstration": objective,
        "guided_practice": application,
        "independent_practice": application,
        "assessment": evidence,
        "instructor_checks": evidence,
        "evidence_check_for_understanding": evidence,
        "teaching_tips": "Coach one observable correction at a time; log settings and label coupons.",
        "materials_equipment": "Approved WPS, PPE, process-specific power source and torch/gun, consumables, gas where applicable, and practice coupons.",
        "outcome_codes": [f"CLO {code}" for code in outcome_numbers],
        "instructor_only_slide_crosswalk": slide_range,
        "segments": day_segments,
    })

assert [item["planner_day_number"] for item in days] == list(range(1, 23))
assert [item["scheduled_date"] for item in days] == calendar
assert all(sum(segment["planned_minutes"] for segment in item["segments"]) == 225 for item in days)
assert [sum(item["title"].startswith(p) for item in days) for p in ("GTAW", "GMAW", "FCAW")] == [8, 8, 6]

payload = {
    "status": "staged_draft_not_deployed",
    "course_code": "WLD 115",
    "guide_name": "WLD 115 Night Level 1 22-Day Instructor Guide",
    "planned_instructional_days": 22,
    "window": {"start_date": "2026-11-09", "end_date": "2026-12-19", "recess": ["2026-11-25", "2026-11-29"]},
    "section_time": {"start": "18:00", "end": "21:45", "minutes": 225},
    "paired_course": {"course_code": "WLD 114", "start": "17:00", "end": "18:00", "attendance_primary": True},
    "grade_weights_from_supplied_syllabus": {"GTAW": 35, "GMAW": 35, "FCAW": 20, "attendance_and_shop_conduct": 10},
    "protected_outcomes_from_supplied_syllabus": {f"CLO {key}": value for key, value in outcomes.items()},
    "days": days,
}
OUTPUT.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
print(f"Staged {len(days)} days, {len(days) * 4} segments, {len(days) * 225} minutes in {OUTPUT}")
