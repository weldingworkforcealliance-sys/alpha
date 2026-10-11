'use client';

import { useState } from 'react';
import PlannerTeachingConsole, {
  type PlannerDayOption,
  type PlannerLaunchResource,
  type PlannerPlanRow,
  type PlannerSupportItem,
} from '@/app/components/planner/PlannerTeachingConsole';
import {
  anthonyDaySupport,
  anthonyMathDisplayText,
} from '@/lib/wld205-anthony-view';
import styles from './review.module.css';

type PreviewKind = 'intake' | 'blueprint' | 'process' | 'math' | 'assessment' | 'metallurgy' | 'hold' | 'capstone' | 'reinforcement';
type PreviewTopic = { title: string; focus: string; kind: PreviewKind };

// PUBLIC, NON-SENSITIVE DEMONSTRATION DATA ONLY.
// These are representative topic outlines, not the PCCC teacher guide.
// Do not import authenticated sections, student records, real assessment
// questions or answer keys into this password-free presentation.
export const WLD205_REVIEW_TOPICS: readonly PreviewTopic[] = [
  { title: 'Level II orientation and math intake', focus: 'baseline measurement and safe setup', kind: 'intake' },
  { title: 'Common Level II start and math practice', focus: 'finding the source, calculating, checking and recording', kind: 'math' },
  { title: 'Blueprint I: lines, views and dimensions', focus: 'reading line types, views and tolerances from a sample print', kind: 'blueprint' },
  { title: 'Blueprint II: weld symbols and joint details', focus: 'matching sample weld symbols to joint requirements', kind: 'blueprint' },
  { title: 'Blueprint III: sections and assembly drawings', focus: 'sequencing work from a sample assembly print', kind: 'blueprint' },
  { title: 'WPS / SWPS and welding documentation', focus: 'locating governing procedure requirements and recording sources', kind: 'process' },
  { title: 'Trade math I: layout, perimeter and area', focus: 'estimating and verifying simple shapes and layouts', kind: 'math' },
  { title: 'Trade math II: triangles and angles', focus: 'calculating lengths and checking angular relationships', kind: 'math' },
  { title: 'Trade math III: circles and volume', focus: 'calculating diameter, circumference and volume', kind: 'math' },
  { title: 'Trade math IV: weights and repeat measurements', focus: 'material estimates and consistent measured precision', kind: 'math' },
  { title: 'Trade math V: U.S. customary and metric units', focus: 'consistent units and final-answer rounding', kind: 'math' },
  { title: 'Trade math readiness and assessment workflow', focus: 'readiness checks and secure assessment handling', kind: 'assessment' },
  { title: 'Metallurgy I: carbon steel and steel classes', focus: 'how steel composition relates to welding behavior', kind: 'metallurgy' },
  { title: 'Metallurgy II: microstructures and transformation', focus: 'ferrite, austenite and pearlite in practical terms', kind: 'metallurgy' },
  { title: 'Metallurgy III: cooling rate and heat-affected zone', focus: 'how cooling affects the HAZ and material properties', kind: 'metallurgy' },
  { title: 'Metallurgy IV: weldability and crack prevention', focus: 'identifying cracking risks and approved controls', kind: 'metallurgy' },
  { title: 'Metallurgy V: stainless steel families', focus: 'common stainless welding considerations', kind: 'metallurgy' },
  { title: 'Metallurgy VI: aluminum alloys and oxide', focus: 'aluminum weld preparation and property changes', kind: 'metallurgy' },
  { title: 'Metallurgy VII: distortion and residual stress', focus: 'predicting thermal movement and distortion', kind: 'metallurgy' },
  { title: 'Theory hold and paired shop application', focus: 'reinforcing prior material without introducing new theory', kind: 'hold' },
  { title: 'Metallurgy readiness and assessment workflow', focus: 'preparing for secure welding metallurgy assessment', kind: 'assessment' },
  { title: 'Blueprint and WPS integration', focus: 'connecting print requirements to governing procedure and records', kind: 'capstone' },
  { title: 'Integrated WLD 205 practice and evidence', focus: 'print to calculation to material choice to documented evidence', kind: 'capstone' },
  { title: 'Supplemental math and prior-learning reinforcement', focus: 'reviewing print dimensions and source verification', kind: 'reinforcement' },
  { title: 'Supplemental math and prior-learning reinforcement', focus: 'reviewing estimates and measured quantities', kind: 'reinforcement' },
  { title: 'Supplemental math and prior-learning reinforcement', focus: 'reviewing dimensions and units', kind: 'reinforcement' },
  { title: 'Supplemental math and prior-learning reinforcement', focus: 'revisiting weld-symbol comprehension', kind: 'reinforcement' },
  { title: 'Supplemental math and prior-learning reinforcement', focus: 'reviewing WPS and job-record discipline', kind: 'reinforcement' },
  { title: 'Supplemental math and prior-learning reinforcement', focus: 'coaching students through cumulative problems', kind: 'reinforcement' },
  { title: 'Supplemental math and prior-learning reinforcement', focus: 'consolidating prior learning and instructor feedback', kind: 'reinforcement' },
];

const DAY_OPTIONS: PlannerDayOption[] = WLD205_REVIEW_TOPICS.map((topic, index) => ({
  id: String(index + 1),
  dayNumber: index + 1,
  title: topic.title,
}));

const REVIEW_JUMPS = [
  { day: 1, label: 'Start' },
  { day: 3, label: 'Blueprints' },
  { day: 7, label: 'Trade Math' },
  { day: 13, label: 'Metallurgy' },
  { day: 22, label: 'Integration' },
  { day: 27, label: 'Later Days' },
  { day: 30, label: 'Last Day' },
];

function sampleRows(day: number, topic: PreviewTopic): PlannerPlanRow[] {
  const row = (id: string, time: string, instructor: string, students: string, kind: PlannerPlanRow['kind'] = 'core'): PlannerPlanRow => ({
    id: String(day) + '-' + id,
    time,
    instructor,
    students,
    kind,
  });

  if (topic.kind === 'assessment') {
    return [
      row('a', '0–10 min', 'Check readiness and approved assessment procedures.', 'Review the day's assessment directions.'),
      row('b', '10–15 min', 'Explain the secure testing process; do not display exam content.', 'Prepare for the authorized assessment.', 'assessment'),
      row('c', '15–55 min', 'Supervise the official assessment outside this sample environment.', 'Complete work using the school-approved assessment process.', 'assessment'),
      row('d', '55–60 min', 'Close the session and document completion in the actual system.', 'Submit materials as instructed.'),
    ];
  }

  if (topic.kind === 'hold') {
    return [
      row('a', '0–10 min', 'Review previously taught blueprint, WPS and math concepts.', 'Identify one skill needing additional practice.'),
      row('b', '10–40 min', 'Coach paired shop application without introducing new theory.', 'Practice using previously approved procedures.'),
      row('c', '40–55 min', 'Check interpretation and documentation against a sample.', 'Explain or correct the documented result.'),
      row('d', '55–60 min', 'Note the next instructional need.', 'Record an individual follow-up.'),
    ];
  }

  if (topic.kind === 'reinforcement') {
    return [
      row('a', '0–10 min', 'Identify one prior concept for targeted review.', 'Recall the governing requirement.'),
      row('b', '10–25 min', 'Demonstrate a short worked example of ' + topic.focus + '.', 'Compare steps against the example.'),
      row('c', '25–50 min', 'Support independent practice using approved materials.', 'Work a fresh practice problem and check units.', 'math'),
      row('d', '50–60 min', 'Review evidence and decide who needs additional coaching.', 'Explain the result and one area to improve.'),
    ];
  }

  return [
    row('a', '0–10 min', 'Introduce the objective and recall prior learning.', 'Identify the relevant source or procedure.'),
    row('b', '10–25 min', 'Demonstrate ' + topic.focus + ' using a prepared example.', 'Follow and question the demonstration.'),
    row('c', '25–45 min', 'Coach one guided or independent application.', 'Apply the steps to a practice example.', topic.kind === 'math' ? 'math' : 'core'),
    row('d', '45–55 min', 'Check the result against the source and quality criteria.', 'Verify accuracy and explain the reasoning.'),
    row('e', '55–60 min', 'Capture the learning point and set up the next class.', 'Identify one next step.'),
  ];
}

function sampleResources(day: number, topic: PreviewTopic): PlannerLaunchResource[] {
  if (topic.kind === 'assessment') {
    return [{ id: 'secure-' + day, title: 'School-approved assessment (not included)', type: 'secure_exam', required: true }];
  }
  const first: PlannerLaunchResource = {
    id: 'practice-' + day,
    title: 'Approved ' + (topic.kind === 'blueprint' ? 'print' : topic.kind === 'math' || topic.kind === 'reinforcement' ? 'math reference' : 'instructional reference') + ' · sample placeholder',
    type: topic.kind === 'blueprint' ? 'print' : topic.kind === 'math' ? 'book_reference' : 'resource',
    notes: 'No licensed files or instructor-only answers are distributed in this preview.',
  };
  return [first];
}

function sampleSupport(day: number, topic: PreviewTopic): PlannerSupportItem[] {
  const support: PlannerSupportItem[] = [
    { key: 'prep', label: 'Instructor Preparation', body: 'Prepare a school-approved example for ' + topic.focus + '. No real print or source material is bundled with this preview.' },
    { key: 'coaching', label: 'Coaching Notes', body: 'Ask students to state the governing requirement, their calculation or procedure choice, and how they checked it.' },
    { key: 'evidence', label: 'Evidence and Follow-Up', body: 'Example: a brief reasoning explanation or checked practice result. In the real LTG, evidence and grading remain protected.' },
  ];

  if (topic.kind === 'math' || topic.kind === 'reinforcement') {
    support.push({
      key: 'math',
      label: 'Optional Math Guidance',
      body: anthonyMathDisplayText('Keep guard digits until the requested final precision', day) || 'Check units and tolerance in the final answer.',
    });
  }

  if (topic.kind === 'assessment') {
    support.push({ key: 'security', label: 'Secure Assessment', body: 'Assessment questions, scoring keys and qualification decisions are excluded from this public layout preview.' });
  }

  for (const item of anthonyDaySupport(day)) {
    support.push({ key: 'specific-' + item.label, label: item.label, body: item.body });
  }

  return support;
}

export default function Wld205ReadOnlyReview() {
  const [day, setDay] = useState(1);
  const [compact, setCompact] = useState(true);
  const [notice, setNotice] = useState('');

  const topic = WLD205_REVIEW_TOPICS[day - 1];
  const rows = sampleRows(day, topic);
  const resources = sampleResources(day, topic);
  const supportItems = sampleSupport(day, topic);

  const changeDay = (next: number) => {
    if (!Number.isInteger(next) || next < 1 || next > WLD205_REVIEW_TOPICS.length) return;
    setDay(next);
    setNotice('');
  };

  return (
    <main className={styles.review}>
      <div className={styles.container}>
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>LTG · Instructor layout review · Staging only</p>
            <h1>WLD 205: Anthony's streamlined teaching view</h1>
            <p>Open any of the 30 example teaching days, compare the standard and streamlined layouts, and inspect the same teaching console used in LTG. No login or email setup required.</p>
          </div>
          <span className={styles.readOnlyTag}>Read-only · No sign-in</span>
        </header>

        <div className={styles.notice} role="note">
          <strong>Layout demonstration, not the live class.</strong> Day titles and activity outlines are representative, not a release of the approved PCCC instructor guide. Student records, attendance, gradebooks, answer keys, secured exams and saving are not available here. FABTECH is a separate demo.
        </div>

        <section className={styles.controls} aria-label="Review settings">
          <div>
            <span className={styles.controlLabel}>Compare the two instructor views</span>
            <div className={styles.views}>
              <button type="button" className={styles.view} aria-pressed={compact} onClick={() => setCompact(true)}>
                Anthony v1 · Streamlined
              </button>
              <button type="button" className={styles.view} aria-pressed={!compact} onClick={() => setCompact(false)}>
                Original · Standard
              </button>
            </div>
          </div>
          <div>
            <span className={styles.controlLabel}>Jump to a teaching block</span>
            <div className={styles.jumps}>
              {REVIEW_JUMPS.map((jump) => (
                <button key={jump.day} className={styles.jump} type="button"
                  aria-current={day === jump.day ? 'step' : undefined}
                  onClick={() => changeDay(jump.day)}>
                  {jump.label} · {jump.day}
                </button>
              ))}
            </div>
          </div>
        </section>

        <PlannerTeachingConsole
          courseLabel="WLD 205 · Level II"
          sectionLabel="Instructor review example"
          dayNumber={day}
          totalDays={WLD205_REVIEW_TOPICS.length}
          title={topic.title}
          objective={'Sample lesson: Students will practice ' + topic.focus + ' and explain how the result is checked.'}
          formatLabel="Illustrative 60-minute teaching flow · not an approved timetable"
          protectedOutcomes={[
            { id: 'sample-safety', code: 'CLO1', text: 'Sample safety outcome reference' },
            { id: 'sample-application', code: topic.kind === 'metallurgy' ? 'CLO5' : topic.kind === 'math' || topic.kind === 'reinforcement' ? 'CLO4' : 'CLO2', text: 'Illustrative mapping, not an approved edit' },
          ]}
          rows={rows}
          resources={resources}
          supportItems={supportItems}
          compactInstructorView={compact}
          dayOptions={DAY_OPTIONS}
          selectedGuideDayId={String(day)}
          isCurrentDay
          onPrevious={() => changeDay(day - 1)}
          onNext={() => changeDay(day + 1)}
          onSelectDay={changeDay}
          onLaunchResource={() => setNotice('Teaching materials are deliberately not linked in this read-only review. The real class keeps its authorized resources and secure assessments.')}
          studentDisplayUrl={null}
          footerPanel={
            <div className={styles.notice}>
              <strong>Preview only.</strong> The student-screen Preview button demonstrates presentation. It does not launch a live classroom, move class progress or record grades.
            </div>
          }
        />

        {notice && <div className={styles.status} role="status">{notice}</div>}

        <footer className={styles.bottom}>
          This isolated staging-only review does not connect to Supabase or expose the PCCC school records. For authenticated attendance, grading, lesson editing and saved instructor preferences, continue to use LTG's protected school workspace after the access issue is resolved.
        </footer>
      </div>
    </main>
  );
}
