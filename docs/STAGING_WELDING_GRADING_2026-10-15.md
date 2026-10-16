# Staging welding grading repair

WLD 110 / WLD 210 grading had two separate access problems: the Gradebook discarded the selected section, and the isolated staging catalog had incomplete theory/lab mappings. Neither issue requires replacing the current welding modules or their rubrics.

The Gradebook now honors the explicit section link, or the saved planner selection when no section is supplied. An unavailable explicit section displays a message instead of choosing a different class. Sidebar Grading carries the selected section. The primary action is labeled **Shop grades & welding rubric**, followed by the lab course. It opens the existing WLD 110 ShopWorkspace or WLD 210 TowerWorkspace. Earlier WLD 110 assessments and qualifications remain under More. Pending rubric edits continue to block class/view changes.

## Staging data repair

Applied only to Supabase `ezlvivmeneefiiwqwgqd`, after a successful rollback dry run. The repair uses the existing foundation migration's Semester 1 catalog relationships (105/110 for L1, 205/210 for L2), with an allowlist of the six inspected staging levels. It restores four missing semesters and four missing catalog pairs, then assigns 24 previously unmapped, empty gradebooks to the matching school, program and cohort level. Existing non-null mappings are preserved. The script aborts if the catalog or expected count differs or if existing academic records would be remapped.

Verified after applying: all ten active WLD 110 gradebooks and all six active WLD 210 gradebooks resolve to the lab role. Fingerprints and counts of gradebook attempts, Tower records, WLD 110 attempts/progress and course finalizations are identical before and after repair. No scores, rubric definitions, attendance, account settings or production data were changed.

This was a staging-data repair, not an automatically applied migration. A production rollout must inspect its own catalog and retain existing academic-history guards; do not blindly replay the staging script.

## Checks

- 82 focused checks passed: WLD 110/210 section selection, original rubric routing, unavailable-class handling, catalog-gap explanation, pending-save protection, sidebar context, gradebooks, Shop UI and Tower runtime.
- TypeScript and targeted ESLint passed.
- Full CI and Netlify Deploy Preview must pass on the final commit before handoff.
- Authenticated browser acceptance remains with the instructor; automated UI checks use synthetic fixtures and do not record grades in real classes.

Production and the FABTECH QR branch are outside this change. PR #141 remains a draft pending final production approval.
