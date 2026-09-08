insert into public.assessment_modules(
  slug,title,description,category,estimated_minutes,sort_order,version,
  active,instructions,allow_team_members,
  reference_title,reference_image_url,reference_body,show_student_score
)
values(
  'wld205_pvhs_bridge_day5',
  'WLD 205 Day 5 — Weld Symbols + Joint Information',
  'PVHS prerequisite bridge: basic joint identification, authorized symbol-source navigation, BRACKET-B source roles, and symbol exit check.',
  'WLD 205 PVHS Bridge Live',
  60,
  205,
  12,
  true,
  'DAY 5 LIVE CLASS
0–8 min — Joint-type retrieval: butt, lap, tee, corner, edge.
8–20 min — Keep the AUTHORIZED PCCC/AWS symbol reference visible. Review reference line, arrow, tail, side/location, and basic fillet/groove information.
20–40 min — Work the six original Symbol-to-Joint Cards from the activity set. The live module auto-grades the source-backed concepts; the authorized reference remains controlling.
40–54 min — Bridge Print B (BRACKET-B): locate joint/location requirements and identify what must come from the approved WPS/SWPS.
54–60 min — Symbol Exit.
Never invent a missing weld size, procedure value, or symbol meaning.',
  false,
  'WLD 205 Day 5 — Live Whiteboard',
  '/live-activities/wld205-day5-symbols-board.svg',
  'Practice board only. Exact symbol conventions come from the authorized classroom source. BRACKET-B includes a T-joint at the vertical plate/base plate intersection and the note WELD PER APPROVED WPS/SWPS.',
  true
)
on conflict(slug) do update set
  title=excluded.title,
  description=excluded.description,
  category=excluded.category,
  estimated_minutes=excluded.estimated_minutes,
  sort_order=excluded.sort_order,
  version=excluded.version,
  active=true,
  instructions=excluded.instructions,
  allow_team_members=excluded.allow_team_members,
  reference_title=excluded.reference_title,
  reference_image_url=excluded.reference_image_url,
  reference_body=excluded.reference_body,
  show_student_score=excluded.show_student_score;

delete from public.assessment_questions where assessment_slug='wld205_pvhs_bridge_day5';

insert into public.assessment_questions(
  assessment_slug,question_key,question_number,question_type,question_text,
  domain,options,correct_answer,accepted_answers,explanation
)
values
('wld205_pvhs_bridge_day5','d5q1',1,'mc','Two members in the same plane meeting edge-to-edge form which joint?','Joint Types','{"A":"Butt joint","B":"Lap joint","C":"T-joint","D":"Edge joint"}'::jsonb,'A',null,'Joint Card 1 is a butt joint.'),
('wld205_pvhs_bridge_day5','d5q2',2,'mc','One member overlaps another. Which joint?','Joint Types','{"A":"Lap joint","B":"Butt joint","C":"Corner joint","D":"Edge joint"}'::jsonb,'A',null,'Joint Card 2 is a lap joint.'),
('wld205_pvhs_bridge_day5','d5q3',3,'mc','One member meets the face of another at about 90°. Which joint?','Joint Types','{"A":"T-joint","B":"Butt joint","C":"Lap joint","D":"Edge joint"}'::jsonb,'A',null,'Joint Card 3 is a T-joint.'),
('wld205_pvhs_bridge_day5','d5q4',4,'mc','Two members meet at their edges to form an L. Which joint?','Joint Types','{"A":"Corner joint","B":"Lap joint","C":"T-joint","D":"Butt joint"}'::jsonb,'A',null,'Joint Card 4 is a corner joint.'),
('wld205_pvhs_bridge_day5','d5q5',5,'mc','Parallel members joined at adjacent edges form which joint?','Joint Types','{"A":"Edge joint","B":"Lap joint","C":"Corner joint","D":"T-joint"}'::jsonb,'A',null,'Joint Card 5 is an edge joint.'),
('wld205_pvhs_bridge_day5','d5q6',6,'mc','On the authorized classroom example, a basic fillet symbol below the reference line specifies which side under the classroom convention?','Authorized Symbol Reference','{"A":"Arrow side","B":"Other side","C":"Both sides automatically","D":"No side"}'::jsonb,'A',null,'The source pack identifies the below-line example as arrow side; the authorized classroom reference controls.'),
('wld205_pvhs_bridge_day5','d5q7',7,'mc','On the authorized classroom example, a basic fillet symbol above the reference line specifies which side under the classroom convention?','Authorized Symbol Reference','{"A":"Other side","B":"Arrow side","C":"Both sides automatically","D":"No side"}'::jsonb,'A',null,'The source pack identifies the above-line example as other side; the authorized classroom reference controls.'),
('wld205_pvhs_bridge_day5','d5q8',8,'mc','A size shown to the left of a fillet symbol is what kind of information?','Authorized Symbol Reference','{"A":"Weld size information","B":"Material grade","C":"Actual amperage log","D":"Drawing scale"}'::jsonb,'A',null,'The source pack identifies it as weld size information; exact interpretation follows the authorized reference.'),
('wld205_pvhs_bridge_day5','d5q9',9,'mc','BRACKET-B includes a T-joint and the note WELD PER APPROVED WPS/SWPS. What does this demonstrate?','Bridge Print B','{"A":"The print gives joint/location information while procedure conditions come from the approved WPS/SWPS","B":"The print replaces the WPS/SWPS","C":"Students may invent missing procedure values","D":"The joint type determines all machine settings"}'::jsonb,'A',null,'The print and approved procedure have different source roles.'),
('wld205_pvhs_bridge_day5','d5q10',10,'mc','What are the three main places to look for a welding requirement in this bridge exercise?','Symbol Exit','{"A":"Print/symbol/notes; approved WPS/SWPS; governing/project instructions as applicable","B":"Memory; machine face; internet","C":"Only the print","D":"Only the WPS/SWPS"}'::jsonb,'A',null,'Those three source areas are listed in the source pack.'),
('wld205_pvhs_bridge_day5','d5q11',11,'mc','Can a student invent a missing weld size?','Symbol Exit','{"A":"No","B":"Yes, if the joint looks familiar","C":"Yes, for a fillet weld","D":"Only in WLD-210"}'::jsonb,'A',null,'Missing requirements must be resolved from the controlling source, not invented.'),
('wld205_pvhs_bridge_day5','d5q12',12,'mc','What is the safe response to an unclear symbol?','Symbol Exit','{"A":"Stop and check the authorized symbol/source with the instructor","B":"Tack first, then ask","C":"Use the most common symbol meaning","D":"Ignore it if the joint is obvious"}'::jsonb,'A',null,'The source pack requires stop/check when unclear.'),
('wld205_pvhs_bridge_day5','d5q13',13,'mc','A tail may reference what kind of information?','Symbol Exit','{"A":"Process/specification/other reference as defined by the authorized symbol standard","B":"Only material weight","C":"Only joint type","D":"Only drawing scale"}'::jsonb,'A',null,'The exact interpretation follows the authorized symbol standard.'),
('wld205_pvhs_bridge_day5','d5q14',14,'mc','Which course provides the physical welding application paired to this WLD-205 bridge?','Symbol Exit','{"A":"WLD-210","B":"WLD-205","C":"WLD-105","D":"WLD-114"}'::jsonb,'A',null,'WLD-210 provides the physical application.');
