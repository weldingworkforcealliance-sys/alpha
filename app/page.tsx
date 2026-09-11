import Link from 'next/link';
import './marketing.css';

const features = [
  { code: '01', title: 'Living Teacher Guide', body: 'Approved curriculum becomes a usable day-by-day instructor workflow without changing protected course outcomes.' },
  { code: '02', title: 'Live Classroom', body: 'Launch instructor-guided activities, assessments, job cards, and student participation from the lesson being taught.' },
  { code: '03', title: 'Attendance', body: 'Record daily attendance, completion status, instructor notes, corrections, history, and school reporting in the same workflow.' },
  { code: '04', title: 'Progress & Grades', body: 'Bring assessment and activity results back to the instructor so student progress remains visible after class.' },
  { code: '05', title: 'Workforce Time Clock', body: 'Connect instructor time records to school-level review and payroll-ready weekly reporting.' },
  { code: '06', title: 'School & Owner Reporting', body: 'Give schools operational visibility while preserving a separate platform-owner view across participating programs.' },
];

const operatingPoints = [
  ['Live beta', 'Operating in active technical education'],
  ['Connected workflow', 'Instruction, attendance, progress, timekeeping, and reporting'],
  ['Protected by design', 'Role-based access and curriculum safeguards'],
  ['Web based', 'Built for school computers and phones without local software installs'],
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
          <a href="#why">Why LTG</a>
          <a href="#platform">Features</a>
          <a href="#programs">Programs</a>
          <a href="#results">Results</a>
          <a href="#beta">Beta Partners</a>
        </nav>
        <div className="ltg-marketing-nav-actions">
          <Link href="/login" className="ltg-marketing-login">Open LTG</Link>
          <a href="#beta" className="ltg-marketing-demo">Request a Demo</a>
        </div>
      </header>

      <section className="ltg-marketing-hero" id="why">
        <div className="ltg-marketing-hero-copy">
          <div className="ltg-marketing-kicker">LTG · Education Operating System</div>
          <h1>The operating system for the work between curriculum and the classroom.</h1>
          <p>
            LTG connects curriculum delivery, instructor planning, live classroom activities,
            attendance, student progress, workforce timekeeping, and school reporting in one
            platform built for real technical education.
          </p>
          <div className="ltg-marketing-actions">
            <a href="#showcase" className="ltg-marketing-primary">See LTG in Action</a>
            <a href="#beta" className="ltg-marketing-secondary">Founding School Beta</a>
          </div>
          <div className="ltg-marketing-hero-proof" aria-label="LTG product principles">
            <span>Live.</span><span>Connected.</span><span>Protected.</span>
          </div>
        </div>

        <div className="ltg-marketing-hero-visual" aria-label="Technical education illustration">
          <div className="ltg-marketing-sparks" aria-hidden="true">
            <i /><i /><i /><i /><i /><i /><i /><i />
          </div>
          <div className="ltg-marketing-helmet" aria-hidden="true">
            <span className="ltg-marketing-helmet-shell" />
            <span className="ltg-marketing-helmet-window">LTG</span>
          </div>
          <div className="ltg-marketing-weld-line" aria-hidden="true" />
          <div className="ltg-marketing-hero-statement">
            <strong>REAL SKILLS.</strong>
            <strong>REAL INSTRUCTION.</strong>
            <strong>BETTER VISIBILITY.</strong>
          </div>
        </div>
      </section>

      <section className="ltg-marketing-feature-strip" id="platform" aria-label="LTG platform features">
        {features.map((feature) => (
          <article key={feature.title}>
            <span className="ltg-marketing-feature-icon">{feature.code}</span>
            <h2>{feature.title}</h2>
            <p>{feature.body}</p>
          </article>
        ))}
      </section>

      <section className="ltg-marketing-showcase" id="showcase">
        <div className="ltg-marketing-product-window" aria-label="Illustration based on the live LTG instructor workspace">
          <aside>
            <div className="ltg-marketing-product-brand"><span>LTG</span><small>Instructor Workspace</small></div>
            <nav aria-label="Product preview navigation">
              <b>Planner</b>
              <span>Agenda Workspace</span>
              <span>Content &amp; Resources</span>
              <span>Live Classroom</span>
              <span>Student Attendance</span>
              <span>Review Queue</span>
              <span>Employee Time Clock</span>
              <span>Weekly Time Reports</span>
            </nav>
          </aside>
          <div className="ltg-marketing-product-main">
            <header>
              <div><small>CURRENT TEACHING SECTION</small><h3>WLD 205 · Instructor Planner</h3></div>
              <span className="ltg-marketing-status">LIVE BETA</span>
            </header>
            <div className="ltg-marketing-product-grid">
              <section className="ltg-marketing-product-today">
                <small>TODAY&apos;S INSTRUCTION</small>
                <h4>Day 5 · Weld Symbols + Joint Information</h4>
                <div className="ltg-marketing-lesson-line"><span>Opening / review</span><b>Ready</b></div>
                <div className="ltg-marketing-lesson-line"><span>Instructor guidance</span><b>Protected</b></div>
                <div className="ltg-marketing-lesson-line"><span>Live class activity</span><b>Connected</b></div>
                <div className="ltg-marketing-lesson-line"><span>Evidence / notes</span><b>Saved</b></div>
              </section>
              <section className="ltg-marketing-product-live">
                <small>LIVE CLASSROOM</small>
                <strong>Connected Classroom Testing</strong>
                <p>Launch activities from the lesson, review submissions, and return evidence to the instructor.</p>
                <span className="ltg-marketing-live-pill">● LIVE WORKFLOW</span>
              </section>
              <section className="ltg-marketing-product-card">
                <small>ATTENDANCE</small>
                <strong>Daily record</strong>
                <p>Final status, instructor notes, history, and corrections stay attached to the class record.</p>
              </section>
              <section className="ltg-marketing-product-card">
                <small>WORKFORCE OPERATIONS</small>
                <strong>Time clock + weekly report</strong>
                <p>Instructor punches and school payroll review live inside the same operating environment.</p>
              </section>
            </div>
          </div>
        </div>

        <div className="ltg-marketing-showcase-copy" id="guide">
          <span>THE CORE INSTRUCTION ENGINE</span>
          <h2>The Living Teacher Guide turns approved curriculum into a live daily workflow.</h2>
          <p>
            LTG gives instructors a focused workspace for pacing, demonstrations, resources,
            activities, attendance, evidence, notes, and class progress. The goal is not another
            place to store curriculum. It is a better way to use it while teaching.
          </p>
          <ul>
            <li>Plan and deliver daily instruction</li>
            <li>Launch connected classroom activities</li>
            <li>Track attendance, skills, and progress</li>
            <li>Protect approved curriculum and outcomes</li>
            <li>Connect classroom work to school operations</li>
          </ul>
          <div className="ltg-marketing-protected-card">
            <small>PROTECTED BY DESIGN</small>
            <strong>Curriculum stays curriculum.</strong>
            <p>Implementation can improve without silently rewriting approved course outcomes.</p>
          </div>
        </div>
      </section>

      <section className="ltg-marketing-programs" id="programs">
        <div className="ltg-marketing-centered-heading">
          <span>PROGRAMS THAT PROVE THE MODEL</span>
          <h2>Built for technical education. Designed to scale.</h2>
          <p>Welding is the first proof, not the boundary.</p>
        </div>
        <div className="ltg-marketing-program-grid">
          <article className="ltg-marketing-program-welding">
            <div className="ltg-marketing-program-art" aria-hidden="true"><span>WLD</span></div>
            <div><h3>Welding</h3><p>Live implementation and current proof case for the LTG operating model.</p><small>LIVE PROOF CASE</small></div>
          </article>
          <article className="ltg-marketing-program-radiography">
            <div className="ltg-marketing-program-art" aria-hidden="true"><span>XR</span></div>
            <div><h3>Radiography</h3><p>Next demonstration program for clinical competencies, imaging workflows, safety, assessments, attendance, and instructor review.</p><small>NEXT DEMONSTRATION</small></div>
          </article>
          <article className="ltg-marketing-program-beyond">
            <div className="ltg-marketing-program-art" aria-hidden="true"><span>+</span></div>
            <div><h3>Beyond one department</h3><p>The same operating model can be configured around each program&apos;s approved curriculum, workflows, and outcomes.</p><small>PROGRAM NEUTRAL</small></div>
          </article>
        </div>
      </section>

      <section className="ltg-marketing-results" id="results">
        <div className="ltg-marketing-results-copy">
          <span>OPERATING LIVE IN TECHNICAL EDUCATION</span>
          <h2>Real workflows. Real instructors. Real classroom use.</h2>
          <p>
            LTG is being shaped in live use rather than designed in isolation. Public claims here are
            deliberately limited to what the platform can substantiate today.
          </p>
        </div>
        <div className="ltg-marketing-operating-grid">
          {operatingPoints.map(([title, body]) => (
            <div key={title}><strong>{title}</strong><span>{body}</span></div>
          ))}
        </div>
      </section>

      <section className="ltg-marketing-security">
        <div className="ltg-marketing-centered-heading">
          <span>BUILT FOR SCHOOL OPERATIONS</span>
          <h2>Each role sees the information it is responsible for.</h2>
        </div>
        <div className="ltg-marketing-role-grid">
          <div><span>01</span><strong>Instructor</strong><p>Classes, daily instruction, student progress, attendance, and personal time records.</p></div>
          <div><span>02</span><strong>School Administration</strong><p>Programs, rosters, staff access, attendance history, payroll reporting, and school analytics.</p></div>
          <div><span>03</span><strong>Platform Owner</strong><p>Cross-school operations, configuration, release management, support, and platform analytics.</p></div>
        </div>
        <p className="ltg-marketing-security-note">
          School-to-school access isolation is release-tested before additional institutions are added.
          Production access remains controlled while LTG expands beyond its first implementation.
        </p>
      </section>

      <section className="ltg-marketing-beta" id="beta">
        <div className="ltg-marketing-beta-copy">
          <span>FOUNDING SCHOOL BETA</span>
          <h2>Help shape the future of technical education delivery.</h2>
          <p>
            LTG is preparing for a small group of partner programs. Initial partners receive guided
            setup, program configuration, staff onboarding, support, and a defined feedback process.
          </p>
          <div className="ltg-marketing-actions">
            <a href="#beta-process" className="ltg-marketing-primary">Request a Program Review</a>
            <Link href="/login" className="ltg-marketing-secondary">Open LTG</Link>
          </div>
        </div>
        <div className="ltg-marketing-beta-side" id="beta-process">
          <div className="ltg-marketing-beta-roles">
            <div><strong>For School Administrators</strong><span>Program setup, reporting, access, and operational visibility.</span></div>
            <div><strong>For Instructors</strong><span>Daily delivery, activities, attendance, progress, and resources.</span></div>
            <div><strong>For Program Leadership</strong><span>Protected curriculum, implementation feedback, and cross-program insight.</span></div>
          </div>
          <div className="ltg-marketing-beta-steps">
            <span>01 · Program review</span>
            <span>02 · LTG configuration</span>
            <span>03 · Staff onboarding</span>
            <span>04 · Controlled launch</span>
            <span>05 · Usage &amp; outcome review</span>
          </div>
        </div>
      </section>

      <footer className="ltg-marketing-footer">
        <div className="ltg-marketing-footer-brand"><strong>LTG</strong><span>Living Teacher Guide · Education Operating System</span></div>
        <div className="ltg-marketing-footer-links"><a href="#platform">Features</a><a href="#programs">Programs</a><a href="#beta">Beta Partners</a><Link href="/login">Platform Login</Link></div>
      </footer>
    </main>
  );
}
