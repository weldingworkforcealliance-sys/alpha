import Link from 'next/link';
import './marketing.css';

const features = [
  {
    title: 'Living Teacher Guide',
    body: 'Turns approved curriculum into a usable day-by-day instructor workflow while protecting approved course outcomes.',
  },
  {
    title: 'Live Classroom',
    body: 'Launches instructor-guided activities, assessments, job cards, and student participation from the lesson being taught.',
  },
  {
    title: 'Attendance',
    body: 'Records daily attendance, completion status, instructor notes, history, corrections, and school reporting in one operating workflow.',
  },
  {
    title: 'Progress & Grades',
    body: 'Returns assessment and activity results to instructors so student progress can be reviewed instead of disappearing after class.',
  },
  {
    title: 'Workforce Time Clock',
    body: 'Gives instructors and school administrators a connected time-clock record with payroll-ready reporting.',
  },
  {
    title: 'School & Owner Reporting',
    body: 'Provides school-level operational visibility while preserving a separate platform-owner view across participating programs.',
  },
];

export default function Home() {
  return (
    <main className="ltg-marketing">
      <header className="ltg-marketing-nav">
        <Link href="/" className="ltg-marketing-brand" aria-label="LTG home">
          <span className="ltg-marketing-mark">LTG</span>
          <span>
            Education Operating System
            <small>Powered by the Living Teacher Guide</small>
          </span>
        </Link>
        <nav aria-label="Public site navigation">
          <a href="#platform">Platform</a>
          <a href="#guide">Living Teacher Guide</a>
          <a href="#programs">Programs</a>
          <a href="#beta">Beta Partners</a>
          <Link href="/login" className="ltg-marketing-login">
            LTG Login
          </Link>
        </nav>
      </header>

      <section className="ltg-marketing-hero">
        <div className="ltg-marketing-kicker">LTG · Education Operating System</div>
        <h1>The operating system for the work between curriculum and the classroom.</h1>
        <p>
          LTG connects curriculum delivery, instructor planning, live classroom activities,
          attendance, student progress, workforce timekeeping, and school reporting without
          replacing the approved curriculum that makes each program its own.
        </p>
        <div className="ltg-marketing-actions">
          <a href="#beta" className="ltg-marketing-primary">Founding School Beta</a>
          <Link href="/login" className="ltg-marketing-secondary">Open LTG</Link>
        </div>
        <div className="ltg-marketing-proof-grid" aria-label="Current product proof points">
          <div><strong>Live</strong><span>Operating in an active technical education program</span></div>
          <div><strong>Connected</strong><span>Instruction, classroom, attendance, reporting, and workforce operations</span></div>
          <div><strong>Protected</strong><span>Role-based school access and curriculum safeguards</span></div>
        </div>
      </section>

      <section className="ltg-marketing-section" id="platform">
        <div className="ltg-marketing-section-heading">
          <span>THE PLATFORM</span>
          <h2>One operating layer for daily education delivery.</h2>
          <p>
            Schools already have systems for storing information. LTG is built for using that
            information while instruction is actually happening. It connects the daily work of
            instructors, students, administrators, and program leadership in one operational flow.
          </p>
        </div>
        <div className="ltg-marketing-feature-grid">
          {features.map((feature) => (
            <article key={feature.title}>
              <h3>{feature.title}</h3>
              <p>{feature.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="ltg-marketing-program-band" id="guide">
        <div>
          <span>THE CORE INSTRUCTION ENGINE</span>
          <h2>The Living Teacher Guide turns approved curriculum into a live daily workflow.</h2>
          <p>
            At the center of LTG is the Living Teacher Guide. It gives instructors a day-by-day
            teaching workspace for pacing, demonstrations, resources, notes, activities, and class
            progress while protecting approved curriculum and course outcomes from unauthorized
            changes.
          </p>
        </div>
        <div className="ltg-marketing-program-card">
          <span>PROTECTED BY DESIGN</span>
          <h3>Curriculum stays curriculum.</h3>
          <p>
            Instructors and administrators can improve implementation without silently rewriting
            approved course outcomes. Core curriculum changes remain a formal review decision.
          </p>
        </div>
      </section>

      <section className="ltg-marketing-section" id="programs">
        <div className="ltg-marketing-section-heading">
          <span>PROGRAM NEUTRAL</span>
          <h2>Welding is the first proof, not the boundary.</h2>
          <p>
            LTG was built against the demands of a real welding program: multiple courses,
            instructor assignments, practical activities, attendance, assessments, student records,
            and daily delivery. That working implementation is the proof case for a platform designed
            to support other career, technical, and professional programs.
          </p>
        </div>
        <div className="ltg-marketing-feature-grid">
          <article>
            <h3>Welding</h3>
            <p>Live implementation and current proof case for the LTG operating model.</p>
          </article>
          <article>
            <h3>Radiography</h3>
            <p>Next demonstration program for clinical competencies, imaging workflows, safety, assessments, attendance, and instructor review.</p>
          </article>
          <article>
            <h3>Beyond one department</h3>
            <p>The same operating model can be configured around each program's approved curriculum, workflows, and outcomes.</p>
          </article>
        </div>
      </section>

      <section className="ltg-marketing-section ltg-marketing-security">
        <div className="ltg-marketing-section-heading">
          <span>BUILT FOR SCHOOL OPERATIONS</span>
          <h2>Each role sees the information it is responsible for.</h2>
        </div>
        <div className="ltg-marketing-role-grid">
          <div><strong>Instructor</strong><p>Classes, daily instruction, student progress, attendance, and personal time records.</p></div>
          <div><strong>School Administration</strong><p>Programs, rosters, staff access, historical attendance, payroll reporting, and school analytics.</p></div>
          <div><strong>Platform Owner</strong><p>Cross-school operations, configuration, release management, support, and platform analytics.</p></div>
        </div>
        <p className="ltg-marketing-security-note">
          School-to-school access isolation is release-tested before additional institutions are added.
          Production access remains controlled while LTG expands beyond its first implementation.
        </p>
      </section>

      <section className="ltg-marketing-beta" id="beta">
        <div>
          <span>FOUNDING SCHOOL BETA</span>
          <h2>LTG is preparing for a small group of partner programs.</h2>
          <p>
            Initial partners receive guided setup, program configuration, administrator and instructor
            onboarding, support, and a defined feedback process. Access remains controlled while the
            multi-school release is expanded deliberately.
          </p>
        </div>
        <div className="ltg-marketing-beta-steps">
          <span>01 · Program review</span>
          <span>02 · LTG configuration</span>
          <span>03 · Staff onboarding</span>
          <span>04 · Controlled launch</span>
          <span>05 · Usage &amp; outcome review</span>
        </div>
      </section>

      <footer className="ltg-marketing-footer">
        <div>
          <strong>LTG</strong>
          <span>Education Operating System · Living Teacher Guide core</span>
        </div>
        <Link href="/login">Platform Login</Link>
      </footer>
    </main>
  );
}
