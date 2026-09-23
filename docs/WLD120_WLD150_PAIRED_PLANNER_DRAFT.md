# WLD 120 + WLD 150 paired planner — curriculum draft

**Status:** the 24-day guides and committee-syllabus outcomes are loaded into LTG as drafts. The 2027 dates below remain a projection; college closures and the official meeting count are pending. Live sections and attendance records remain behind LTG's curriculum approval gate.

## Provisional Spring 2027 calendar

PCCC's published Spring 2026 6A term began **Monday, February 9, 2026** and listed **March 25, 2026** as its end. Its final-exam period was March 19–25, while spring break was also listed as March 23–27; those last dates overlap and must not be interpreted as confirmed teaching days. PCCC's Spring 2027 registration page currently leaves the Spring 6A start and end fields blank.

For planning, shift the Monday start by one calendar year to **Monday, February 8, 2027** and use six Monday–Thursday weeks through **Thursday, March 18, 2027**: 24 candidate class dates within a provisional February 8–March 20 term window. This matches the syllabus's six-week teaching outline. Do not import these dates as attendance or guide-day records until PCCC publishes the 2027 calendar and confirms breaks and section meeting times.

| Week | Candidate class dates (Mon–Thu) |
| --- | --- |
| 1 | Feb 8–11 |
| 2 | Feb 15–18 |
| 3 | Feb 22–25 |
| 4 | Mar 1–4 |
| 5 | Mar 8–11 |
| 6 | Mar 15–18 |

Source check: [PCCC 2025–26 academic calendar](https://www.course-catalog.com/pccc/C/2025-2026/content/academic-calendar-2025-2026/48); [PCCC Spring 2027 registration page](https://pccc.edu/registration/spring/).

## Paired course design

| Course | Syllabus role | Credit | Daily relationship |
| --- | --- | ---: | --- |
| WLD 120 | Level 1 Welding & Fabrication Capstone | 1 | 5:00–6:00 PM; project planning, CNC/manual cutting, fit-up, QC, documentation, assembly, presentation. Meets before WLD 150. |
| WLD 150 | Level 1 Advanced Processes | 4 | 6:00–9:45 PM; primary specialization in SMAW, GMAW, FCAW, or GTAW; groove plates, bend testing, pipe fundamentals, capstone component welding and portfolio. Follows WLD 120. |

Build two separate LTG sections and guides linked as one daily pair, using the established 105/110 and 114/115 section pattern. Preserve independent outcomes, grades, start/end records, attendance, and instructor evidence. Use WLD 120 as the attendance-primary course and carry its attendance into WLD 150, following the existing theory/lab pair pattern; verify the final section linkage before activation. Project theme, individual component assignments, WPS/test criteria, and available materials require instructor approval.

The two 24-day JSON drafts now use LTG's `outcome_codes`, `scheduled_date`, and timed `segments` field names. Each `scheduled_date` is the **provisional 2027 date** shown above, identified by `date_status` and `calendar_status`; verify the official calendar before import. WLD 120 has three segments totaling 60 minutes; WLD 150 has four segments totaling 225 minutes. Instructor source references are filenames only and are not public resource links. This keeps the draft aligned with the 105/110 guide field names without implying the pair is import-ready.

## Protected syllabus outcomes

**WLD 120:**

1. Plan a complete fabrication workflow from blueprint to final assembly.
2. Interpret technical drawings and produce accurate cut lists.
3. Prepare CNC plasma files, nesting, and toolpath verification.
4. Fabricate assigned components using appropriate welding processes.
5. Apply tolerances, measurement strategies, and distortion control.
6. Perform QC inspections and document fabrication processes.
7. Participate in team assembly and deliver a professional final presentation.

**WLD 150:**

1. Demonstrate advanced proficiency in a selected welding process across multiple positions.
2. Prepare certification-level groove test plates in the primary track.
3. Complete destructive bend testing and interpret results.
4. Execute accurate joint preparation and fit-up for multi-pass weldments.
5. Apply pipe welding fundamentals safely and consistently.
6. Compile a weld portfolio documenting progress and final performance in the primary track.

## Protected grading weights

| WLD 120 | Weight | WLD 150 | Weight |
| --- | ---: | --- | ---: |
| Blueprint packet and cut list accuracy | 20% | Primary track welding performance | 50% |
| CNC/manual cutting accuracy and tolerance compliance | 20% | Bend test plate and destructive test results | 25% |
| Welding quality, fit-up, and distortion control | 30% | Advanced fabrication capstone project | 15% |
| Team assembly participation and communication | 10% | Professionalism, safety compliance, and attendance | 10% |
| Final documentation packet and presentation | 20% | | |

WLD 120's syllabus target is that 75% of students earn at least 70% on the final project rubric. Do not treat the 75% cohort target as an individual passing threshold. WLD 150 is lab-based and specifies no required online AWS coursework.

## Six-week planning sequence

The syllabus gives week-level direction. Each row below maps the paired courses to one shared milestone; the daily guide pages expand these into objective, safety gate, instructor preparation, demonstration, guided work, independent work, assessment, evidence, teaching notes, and safe closeout within the confirmed nightly course times.

| Week | WLD 120 capstone work | WLD 150 advanced process work | Joint checkpoint |
| --- | --- | --- | --- |
| 1 | Assign project and individual components; interpret blueprints; develop workflow, cut lists, tolerances, and documentation packet. | Assess baseline skill, refresh safety, choose primary track, prepare joints, begin warm-up drills. | Instructor approves project, tolerances, process track, and material release. |
| 2 | Prepare material, verify CNC files/nests/toolpaths, cut parts, measure and record first QC. | Develop primary-track groove plate quality and positions; record parameters and corrections. | Cut-part dimensional and plate fit-up approval before welding. |
| 3 | Fit up and tack components; start welding; inspect peers' work. | Continue groove plate progression and multi-pass practice. | Peer QC and instructor sign-off on fit-up, weld quality, and documentation. |
| 4 | Weld out components, manage distortion, build subassemblies. | Complete bend test plates, destructive testing, and results review. | Record measured results and corrective action; route usable components to assembly. |
| 5 | Test-fit assembly, correct out-of-tolerance parts, complete sample weld checks. | Practice pipe fundamentals from 1G toward 2G with safe setup and root-quality checks. | Hold assembly until fit and weld acceptance are documented. |
| 6 | Final assembly, final QC packet, project presentation. | Complete advanced capstone component work and weld portfolio; optional aluminum only if equipment and time permit. | Deliver project, documentation, weld portfolio, and individual assessment records. |

## Uploaded teaching-material crosswalk

The uploaded resources support demonstrations and instructor preparation; they do not replace the syllabi, selected WPS, approved acceptance criteria, equipment manuals, or instructor supervision. Keep licensed source files instructor-only and link in LTG only after hosting/access rights are confirmed.

| Supplied file | Use in paired guide |
| --- | --- |
| `01-welding-inspection.pdf` | WLD 120 QC checkpoints and WLD 150 test interpretation. |
| `02-visual-inspection.pdf`; `05-visual-inspection.pptx` (33 slides) | Preweld, in-process, and final visual checks; measurement tools and written inspection evidence. |
| `03-occupational-orientation.pdf` | Week 1 shop conduct, safety, and professional practice refresh. |
| `04-cac-a.pdf` | Optional instructor demonstration of carbon arc gouging where equipment, ventilation, and local procedures permit. It is not a protected WLD 120/150 outcome. |
| `06-ch-11-discontinuties.pptx` (80 slides) | Identify discontinuities, distinguish findings from rejection using the applicable criteria, and document corrective action. |

## Source reconciliation before activation

- The WLD 150 syllabus title and outcomes define the course as advanced processes, but its description starts with “WLD-120 Advanced Processes” and its prerequisite line lists WLD 150 as its own co-requisite. Confirm corrected catalog text with the curriculum owner before copying either field into LTG.
- WLD 120's syllabus describes WLD 150 as a co-requisite/paired daily course, while its prerequisite wording varies between fields. Preserve the official registration rule rather than resolving this in a planner.
- The 6-week outline implies 24 meetings at four days per week, but the approved semester dates and closures may yield fewer. Reallocate milestones to the actual dates once supplied, as we did for the 22-day WLD 114/115 pair.
- Do not publish this pair until course sections, official dates, attendance linkage, protected grades/outcomes, and guide imports are checked in LTG.
