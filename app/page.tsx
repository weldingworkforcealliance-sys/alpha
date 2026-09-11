import Link from 'next/link';
import './marketing.css';

const snapshotMetrics = [
  { label: 'Instruction Hours', value: '42.5', detail: '4 completed days', tone: 'blue' },
  { label: 'Schedule Completion', value: '100%', detail: '4 / 4 days due', tone: 'green' },
  { label: 'Active Students', value: '17', detail: '12 finalized attendance sessions', tone: 'blue' },
  { label: 'Attendance Rate', value: '92.5%', detail: '62 present records', tone: 'blue' },
  { label: 'Assessment Average', value: '70.9%', detail: '36 submissions', tone: 'gold' },
  { label: 'Employee Hours', value: '89.0', detail: '0 adjusted entries', tone: 'blue' },
];

const features = [
  ['Living Teacher Guide', 'Approved curriculum becomes a usable day-by-day instructor workflow without changing protected course outcomes.'],
  ['Live Classroom', 'Launch instructor-guided activities, assessments, job cards, and student participation from the lesson being taught.'],
  ['Attendance', 'Record daily attendance, completion status, instructor notes, corrections, history, and school reporting in the same workflow.'],
  ['Progress & Grades', 'Bring assessment and activity results back to the instructor so student progress remains visible after class.'],
  ['Workforce Time Clock', 'Connect instructor time records to school-level review and payroll-ready weekly reporting.'],
  ['School & Owner Reporting', 'Give schools operational visibility while preserving a separate platform-owner view across participating programs.'],
];

export default function Home() {
  return (
    <main className="ltg-marketing">
      <header className="ltg-marketing-nav">
        <Link href="/" className="ltg-marketing-brand" aria-label="LTG home">
          <span className="ltg-marketing-mark">LTG</span>
          <span className="ltg-marketing-brand-copy">
            <strong>Living Teacher Guide</strong>
            <small>Education Operating System</small>
          </span>
        </Link>
        <nav aria-label="Public site navigation">
          <a href="#reporting">Reporting</a>
          <a href="#platform">Platform</a>
          <a href="#programs">Programs</a>
          <a href="#beta">Beta Partners</a>
        </nav>
        <div className="ltg-marketing-nav-actions">
          <Link href="/login" className="ltg-marketing-login">Open LTG</Link>
          <Link href="/reports" className="ltg-marketing-demo">Open Reports</Link>
        </div>
      </header>

      <section className="ltg-admin-hero" id="reporting">
        <div className="ltg-admin-hero-copy">
          <span className="ltg-eyebrow">REPORTING &amp; ANALYTICS</span>
          <h1>See the health of your program in one place.</h1>
          <p>
            LTG gives school administrators a connected view of instruction, attendance,
            assessments, workforce activity, instructional improvement, and data quality so
            program decisions are based on what is actually happening.
          </p>
          <div className="ltg-marketing-actions">
            <Link href="/reports" className="ltg-marketing-primary">Open Live Reports</Link>
            <a href="#platform" className="ltg-marketing-secondary">Explore the Platform</a>
          </div>
        </div>
        <div className="ltg-snapshot-context">
          <span>VERIFIED CURRENT-SCHOOL SNAPSHOT</span>
          <strong>Current School Administrative Reporting</strong>
          <p>Calendar Q3 2026 to Date</p>
          <small>Jul 1, 2026 through Sep 11, 2026</small>
          <div className="ltg-context-rule" />
          <p className="ltg-context-note">Public preview uses aggregated school-level values only. Authorized users can open the full reporting workspace.</p>
        </div>
      </section>

      <section className="ltg-kpi-band" aria-label="Current school reporting snapshot">
        {snapshotMetrics.map((metric) => (
          <article key={metric.label} className={`ltg-kpi-card ltg-kpi-${metric.tone}`}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <small>{metric.detail}</small>
          </article>
        ))}
      </section>

      <section className="ltg-analytics-board" aria-label="Current school analytics details">
        <div className="ltg-ring-card">
          <header><strong>Attendance Rate</strong><span>Current period</span></header>
          <div className="ltg-ring ltg-ring-attendance"><div><strong>92.5%</strong><span>Attendance</span></div></div>
          <p>62 present records</p>
        </div>

        <div className="ltg-ring-card">
          <header><strong>Schedule Completion</strong><span>Instruction delivery</span></header>
          <div className="ltg-ring ltg-ring-completion"><div><strong>100%</strong><span>Completed</span></div></div>
          <p>4 of 4 scheduled instructional days due are complete.</p>
        </div>

        <div className="ltg-performance-card">
          <header><strong>Assessment Performance</strong><span>Student learning</span></header>
          <div className="ltg-performance-number"><strong>70.9%</strong><span>Average score</span></div>
          <div className="ltg-progress-track"><span /></div>
          <div className="ltg-performance-meta"><span>36 submissions</span><span>28 students assessed</span></div>
          <div className="ltg-live-use">
            <div><strong>22</strong><span>Live Classroom sessions</span></div>
            <div><strong>58</strong><span>Live Classroom usage events</span></div>
          </div>
        </div>

        <div className="ltg-improvement-card">
          <header><strong>Instructional Improvement &amp; Usage</strong><span>Current activity</span></header>
          <dl>
            <div><dt>Instructor notes captured</dt><dd>10</dd></div>
            <div><dt>Agenda / implementation reviews</dt><dd>8</dd></div>
            <div><dt>Approved changes</dt><dd>8</dd></div>
            <div><dt>Analytics events captured</dt><dd>268</dd></div>
            <div><dt>Live Classroom usage events</dt><dd>58</dd></div>
          </dl>
        </div>

        <div className="ltg-quality-card">
          <div className="ltg-quality-summary">
            <span>DATA QUALITY &amp; EXCEPTIONS</span>
            <strong>30</strong>
            <p>Items need review</p>
          </div>
          <dl>
            <div><dt>Unfinalized attendance sessions</dt><dd>0</dd></div>
            <div><dt>Assessment submissions not linked to LTG student</dt><dd>30</dd></div>
            <div><dt>Job Cards not linked to LTG student</dt><dd>0</dd></div>
            <div><dt>Open employee punches</dt><dd>0</dd></div>
            <div><dt>Archived delivery rows excluded from totals</dt><dd>106</dd></div>
          </dl>
        </div>

        <div className="ltg-school-card">
          <header>
            <div><span>CURRENT SCHOOL</span><strong>School Breakdown</strong></div>
            <Link href="/reports">Open full report →</Link>
          </header>
          <div className="ltg-school-table-wrap">
            <table>
              <thead>
                <tr><th>School</th><th>Students</th><th>Completed Days</th><th>Instruction Hrs</th><th>Attendance</th><th>Assessment Avg</th><th>Follow-ups</th></tr>
              </thead>
              <tbody>
                <tr><td>Passaic County Community College</td><td>17</td><td>4</td><td>42.5</td><td>92.5%</td><td>70.9%</td><td>0</td></tr>
              </tbody>
            </table>
          </div>
          <div className="ltg-school-foot">
            <span><strong>8</strong> sections in scope</span>
            <span><strong>0</strong> days due without completion</span>
            <span><strong>0</strong> open punches</span>
          </div>
        </div>
      </section>

      <section className="ltg-platform-section" id="platform">
        <div className="ltg-section-heading">
          <span>THE PLATFORM</span>
          <h2>Reporting is useful because the classroom work is connected.</h2>
          <p>
            LTG is not a reporting layer bolted onto disconnected systems. The same operating environment
            supports daily instruction, classroom activity, attendance, progress, time records, and administrative review.
          </p>
        </div>
        <div className="ltg-feature-grid">
          {features.map(([title, body], index) => (
            <article key={title}><span>{String(index + 1).padStart(2, '0')}</span><h3>{title}</h3><p>{body}</p></article>
          ))}
        </div>
      </section>

      <section className="ltg-core-band" id="guide">
        <div>
          <span>THE CORE INSTRUCTION ENGINE</span>
          <h2>The Living Teacher Guide turns approved curriculum into a live daily workflow.</h2>
          <p>
            Instructors work from a day-by-day teaching environment for pacing, demonstrations,
            resources, activities, evidence, attendance, and notes. Administrators see the operational
            picture created by that work instead of waiting for disconnected spreadsheets.
          </p>
        </div>
        <aside>
          <span>PROTECTED BY DESIGN</span>
          <strong>Curriculum stays curriculum.</strong>
          <p>Implementation can improve without silently rewriting approved course outcomes.</p>
        </aside>
      </section>

      <section className="ltg-programs" id="programs">
        <div className="ltg-centered-heading">
          <span>PROGRAMS THAT PROVE THE MODEL</span>
          <h2>Built for technical education. Designed to scale.</h2>
          <p>Welding is the first proof, not the boundary.</p>
        </div>
        <div className="ltg-program-grid">
          <article><div className="ltg-program-code">WLD</div><div><h3>Welding</h3><p>Live implementation and current proof case for the LTG operating model.</p><small>LIVE PROOF CASE</small></div></article>
          <article><div className="ltg-program-code">XR</div><div><h3>Radiography</h3><p>Next demonstration program for clinical competencies, imaging workflows, safety, assessments, attendance, and instructor review.</p><small>NEXT DEMONSTRATION</small></div></article>
          <article><div className="ltg-program-code">+</div><div><h3>Beyond one department</h3><p>The same operating model can be configured around each program&apos;s approved curriculum, workflows, and outcomes.</p><small>PROGRAM NEUTRAL</small></div></article>
        </div>
      </section>

      <section className="ltg-beta" id="beta">
        <div>
          <span>FOUNDING SCHOOL BETA</span>
          <h2>Use the system. Measure the system. Improve the system.</h2>
          <p>
            LTG is being shaped in live school use. Partner programs receive guided configuration,
            staff onboarding, reporting setup, support, and a defined feedback process.
          </p>
        </div>
        <div className="ltg-beta-actions">
          <Link href="/reports" className="ltg-marketing-primary">Open Live Reports</Link>
          <Link href="/login" className="ltg-marketing-secondary">Platform Login</Link>
        </div>
      </section>

      <footer className="ltg-marketing-footer">
        <div><strong>LTG</strong><span>Living Teacher Guide · Education Operating System</span></div>
        <div><a href="#reporting">Reporting</a><a href="#platform">Platform</a><a href="#programs">Programs</a><Link href="/login">Login</Link></div>
      </footer>
    </main>
  );
}
