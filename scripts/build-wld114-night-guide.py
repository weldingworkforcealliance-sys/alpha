"""Build the staged WLD 114 guide payload from its reviewed Markdown draft.

This only writes a local JSON file. It never connects to Supabase or Netlify.
"""

import json
import re
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "docs/WLD114_NIGHT_LEVEL1_22_DAY_DRAFT.md"
OUTPUT = ROOT / "docs/WLD114_NIGHT_LEVEL1_22_DAY_PAYLOAD.json"
source = SOURCE.read_text(encoding="utf-8")

calendar = []
day = date(2026, 11, 9)
while day <= date(2026, 12, 19):
    if day.weekday() < 4 and not date(2026, 11, 25) <= day <= date(2026, 11, 29):
        calendar.append(day.isoformat())
    day += timedelta(days=1)
assert len(calendar) == 22 and calendar[-1] == "2026-12-17"

project_windows = {
    "nameplate": (5, 7),
    "welcome_sign": (7, 9),
    "capstone": (9, 15),
}
project_due_days = {"nameplate": 7, "welcome_sign": 9, "capstone": 15}

outcomes = {
    "CLO 1": "Safely operate Torchmate 4X00 CNC plasma equipment following Torchmate Academy standards.",
    "CLO 2": "Configure FlexCut 80 consumables and settings for various materials and thicknesses.",
    "CLO 3": "Use VMD SP2 to perform startup, shutdown, alignment, AVHC adjustments, nesting, and first-cut procedures.",
    "CLO 4": "Create and modify CAD files using Torchmate CAD including shapes, paths, offsets, nesting, and GM-file output.",
    "CLO 5": "Diagnose and correct cut-quality issues such as bevel, dross, kerf variation, and torch misfires.",
    "CLO 6": "Perform daily, monthly, and as-needed maintenance procedures based on Torchmate Academy modules.",
    "CLO 7": "Produce a CNC-cut project demonstrating dimensional accuracy and proper toolpath preparation.",
}
day_outcomes = [
    [1], [1, 3], [4], [1, 2, 3], [4, 7], [2, 5, 7], [4, 7], [4, 7],
    [4, 7], [3, 4], [4, 7], [3, 5], [3, 6, 7], [5, 7], [4, 7],
    [2, 5], [3], [4, 7], [5, 6], [3, 4], [1, 2, 3], [1, 4, 7],
]
assert len(day_outcomes) == 22

days = []
for line in source.splitlines():
    match = re.match(r"^\| (\d+) · (\w+ \d+) \| (.+) \| (.+) \|$", line)
    if not match:
        continue
    number = int(match[1])
    if not 1 <= number <= 22:
        continue
    focus, evidence = match[3], match[4]
    active_projects = [
        name for name, (start, end) in project_windows.items() if start <= number <= end
    ]
    days.append({
        "planner_day_number": number,
        "scheduled_date": calendar[number - 1],
        "title": f"Torchmate Academy — {re.sub(r'<[^>]+>', '', focus).replace('**', '').split(';')[0]}"[:180],
        "objective": focus,
        "safety_focus": "Use the installed Torchmate 4800/FlexCut 80 procedures. Instructor approves every live cut and stops unsafe work.",
        "instructor_prep": "Sign in to Torchmate Academy; queue the named videos, ready the CAD station, and review approved machine settings and the supervised cut queue.",
        "opening_review": "Recall the prior video, current project status, and one safety or quality check.",
        "demonstration": "Play and pause the instructor-only Academy videos for whole-class follow-along; no separate lecture block.",
        "guided_practice": focus,
        "independent_practice": "Follow the Academy procedure in CAD or at the machine under instructor direction. CNC cuts may rotate during WLD 115 with direct supervision.",
        "assessment": evidence,
        "instructor_checks": evidence,
        "evidence_check_for_understanding": evidence,
        "teaching_tips": "Record class video playback separately from each student's participation and project evidence. Academy login belongs to the instructor only.",
        "materials_equipment": "Instructor Academy access; display/audio; Torchmate 4800; FlexCut 80; installed CAD/VMD; approved PPE, stock, cut chart and consumables.",
        "outcome_codes": [f"CLO {n}" for n in day_outcomes[number - 1]],
        "academy_access": "instructor_only_whole_class_playback",
        "academy_learning_plan_url": "https://lincolnelectric.docebosaas.com/learn/learning-plans/87/torchmate-4000-learning-plan",
        "resource_url": "/resources/wld114/torchmate-operator-hub.html",
        "active_projects": active_projects,
        "project_due": [name for name, due in project_due_days.items() if due == number],
        "segments": [{
            "sequence_number": 1,
            "segment_type": "guided_practice",
            "segment_title": "Instructor-played Academy videos and follow-along",
            "start_minute": 0,
            "end_minute": 60,
            "planned_minutes": 60,
            "instructor_actions": f"Play/pause the relevant Academy videos and coach the class: {focus}",
            "student_actions": f"Watch together, follow the steps, and retain individual evidence: {evidence}",
        }],
    })

assert [item["planner_day_number"] for item in days] == list(range(1, 23))
assert [item["scheduled_date"] for item in days] == calendar
assert all(sum(s["planned_minutes"] for s in item["segments"]) == 60 for item in days)
assert {name: [d["planner_day_number"] for d in days if name in d["active_projects"]]
        for name, (start, end) in project_windows.items()} == {
            name: list(range(start, end + 1)) for name, (start, end) in project_windows.items()
        }

payload = {
    "status": "staged_draft_not_deployed",
    "course_code": "WLD 114",
    "guide_name": "WLD 114 Night Level 1 22-Day Instructor Guide",
    "planned_instructional_days": 22,
    "window": {"start_date": "2026-11-09", "end_date": "2026-12-19", "recess": ["2026-11-25", "2026-11-29"]},
    "section_time": {"start": "17:00", "end": "18:00", "minutes": 60},
    "paired_course": {"course_code": "WLD 115", "start": "18:00", "end": "21:45", "attendance_primary": False},
    "academy_delivery": {"access": "instructor_only", "mode": "whole_class_video_follow_along", "courses": 7, "lessons": 69, "target_completion_day": 15},
    "project_windows": {name: {"start_day": start, "end_day": end} for name, (start, end) in project_windows.items()},
    "protected_outcomes_from_supplied_syllabus": outcomes,
    "grade_weights_from_supplied_syllabus": {
        "safety_machine_operation_assessments": 20,
        "torchmate_academy_quizzes": 25,
        "torchmate_cad_project_series": 25,
        "machine_operation_practical_exam": 15,
        "final_cnc_cut_capstone_project": 15,
    },
    "days": days,
}
OUTPUT.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
print(f"Staged {len(days)} days, {len(days)} segments, {len(days) * 60} minutes in {OUTPUT}")
