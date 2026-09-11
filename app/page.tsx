import Link from 'next/link';
import './marketing.css';

const features = [
  {
    title: 'Living Daily Planner',
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
            Living Teacher Guide
            <small>Education Operating System</small>
          </span>
        </Link>
        <nav aria-label="Public site navigation">
          <a href="#platform">Platform</a>
          <a href="#programs">Programs</a>
          <a href="#beta">Beta Partners</a>
          <Link href="/login" className="ltg-marketing-login">
            LTG Login
          </Link>
        </nav>
      </header>

      <section className="ltg-marketing-hero">
        <div className="ltg-marketing-kicker">Built in a real classroom. Designed to scale beyond one program.</div>
        <h1>One operating system for the work that happens between curriculum and the classroom.</h1>
        <p>
          LTG connects instructor planning, live classroom activities, attendance, student progress,
          workforce timekeeping, and school reporting without replacing the approved curriculum that
          makes each program its own.
        </p>
        <div className="ltg-marketing-actions">
          <a href="#beta" className="ltg-marketing-primary">Founding School Beta</a>
          <Link href="/login" className="ltg-marketing-secondary">Open LTG</Link>
        </div>
        <div className="ltg-marketing-proof-grid" aria-label="Current product proof points">
          <div><strong>Live</strong><span>Operating in an active welding program</span></div>
          <div><strong>Connected</strong><span>Planner, classroom, attendance, reporting, and time clock</span></div>
          <div><strong>Protected</strong><span>Role-based school access and curriculum safeguards</span></div>
        </div>
      </section>

      <section className="ltg-marketing-section" id="platform">
        <div className="ltg-marketing-section-heading">
          <span>THE PLATFORM</span>
          <h2>LTG is not another folder full of lesson plans.</h2>
          <p>
            It is the operating layer instructors and administrators use every day. The point is not
            to collect more information. Schools already have enough places to put information. The
            point is to make the information usable while class is actually happening.
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

      <section className="ltg-marketing-program-band" id="programs">
        <div>
          <span>PROVEN IMPLEMENTATION</span>
          <h2>Welding is the first proof, not the boundary.</h2>
          <p>
            LTG was built against the demands of an active technical program: multiple courses,
            instructor assignments, practical activities, attendance, assessments, student records,
            and daily delivery. That working implementation becomes the proof case for the platform.
          </p>
        </div>
        <div className="ltg-marketing-program-card">
          <span>NEXT DEMONSTRATION PROGRAM</span>
          <h3>Nursing</h3>
          <p>
            A program-neutral Nursing demonstration will show the same LTG engine supporting skills
            checklists, safety instruction, classroom activities, assessments, attendance, and
            instructor review without relying on welding-specific workflows.
          </p>
        </div>
      </section>

      <section className="ltg-marketing-section ltg-marketing-security">
        <div className="ltg-marketing-section-heading">
          <span>BUILT FOR SCHOOL OPERATIONS</span>
          <h2>Role-based access keeps each user focused on the information they are responsible for.</h2>
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
          <span>Living Teacher Guide · Education Operating System</span>
        </div>
        <Link href="/login">Platform Login</Link>
      </footer>
    </main>
  );
}
