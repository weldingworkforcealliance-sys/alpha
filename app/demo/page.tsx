'use client';

import { useRouter } from 'next/navigation';

const CAPABILITIES = [
  ['Daily Instruction', 'Turn approved curriculum into a usable day-by-day teaching workflow.'],
  ['Live Classroom', 'Launch instructor-guided activities, assessments, job cards, and student participation.'],
  ['Attendance', 'Record daily attendance, completion status, notes, corrections, and history.'],
  ['Content & Resources', 'Keep procedures, references, activities, and teaching resources attached to the work.'],
  ['Workforce Time', 'Connect instructor time records to school review and payroll-ready reporting.'],
  ['Reporting & Analytics', 'Give school leaders a connected view of instruction, attendance, progress, and operations.'],
];

const WORKFLOW = [
  ['01', 'Choose a program', 'Open a demonstration built around a real instructional environment.'],
  ['02', 'Use the workflow', 'Move through the platform as an instructor or school user would.'],
  ['03', 'Leave no footprint', 'Temporary demo data is discarded after 30 minutes of inactivity.'],
];

export default function DemoLandingPage() {
  const router = useRouter();

  return (
    <main className="demo-page">
      <header className="topbar">
        <button className="brand" type="button" onClick={() => router.push('/')} aria-label="LTG home">
          <span className="mark">LTG</span>
          <span className="brand-copy">Education<br />Operating System</span>
        </button>
        <button className="login-link" type="button" onClick={() => router.push('/login')}>
          Live Platform Login
        </button>
      </header>

      <section className="hero-wrap">
        <div className="hero-copy">
          <div className="eyebrow">Interactive Public Demo</div>
          <h1>Experience LTG as an operating system, not a slideshow.</h1>
          <p className="lead">
            Explore how daily instruction, classroom activity, attendance, resources, workforce records,
            and school reporting connect inside one education operating environment.
          </p>

          <div className="actions">
            <button className="primary" type="button" onClick={() => router.push('/demo/programs')}>
              Enter Public Demo <span aria-hidden="true">→</span>
            </button>
            <button className="secondary" type="button" onClick={() => router.push('/')}>
              Back to LTG Overview
            </button>
          </div>

          <div className="trust-strip" aria-label="Public demo safeguards">
            <div><strong>Isolated</strong><span>Closed demo environment</span></div>
            <div><strong>Temporary</strong><span>Resets after 30 minutes of inactivity</span></div>
            <div><strong>Private</strong><span>No live school records</span></div>
            <div><strong>Disposable</strong><span>Demo changes are discarded</span></div>
          </div>
        </div>

        <aside className="workflow-card">
          <div className="panel-label">A connected school day</div>
          <h2>One workflow creates the operational picture.</h2>
          <div className="flow-list">
            <div><span>1</span><p><b>Open the class</b><small>Current section, day, schedule, and instructor context.</small></p></div>
            <div><span>2</span><p><b>Teach from the guide</b><small>Objectives, pacing, demonstrations, resources, and evidence.</small></p></div>
            <div><span>3</span><p><b>Run classroom activity</b><small>Live questions, assessments, tasks, and performance evidence.</small></p></div>
            <div><span>4</span><p><b>Record what happened</b><small>Attendance, notes, completion, follow-up, and time records.</small></p></div>
            <div><span>5</span><p><b>See the program</b><small>School reporting reflects the work performed in the classroom.</small></p></div>
          </div>
        </aside>
      </section>

      <section className="section capabilities-section">
        <div className="section-heading">
          <div className="eyebrow">What LTG connects</div>
          <h2>The platform is built around the work schools already have to do.</h2>
          <p>Instead of making instructors and administrators bounce between disconnected systems, LTG keeps the operating pieces attached to the same instructional workflow.</p>
        </div>

        <div className="capability-grid">
          {CAPABILITIES.map(([title, text]) => (
            <article key={title} className="capability-card">
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section how-section">
        <div className="how-heading">
          <div className="eyebrow">How the public demo works</div>
          <h2>Real interaction. No production footprint.</h2>
        </div>
        <div className="steps">
          {WORKFLOW.map(([number, title, text]) => (
            <article key={number} className="step">
              <span>{number}</span>
              <div><h3>{title}</h3><p>{text}</p></div>
            </article>
          ))}
        </div>
      </section>

      <section className="cta">
        <div>
          <div className="eyebrow">Ready to explore</div>
          <h2>Choose a program and enter the demo environment.</h2>
          <p>Welding demonstrates the original LTG implementation. Additional program demonstrations show how the same operating model adapts beyond one department.</p>
        </div>
        <button type="button" onClick={() => router.push('/demo/programs')}>Choose Program <span aria-hidden="true">→</span></button>
      </section>

      <footer>
        <span>LTG · Living Teacher Guide · Education Operating System</span>
        <span>Public demo activity is temporary and isolated from live school records.</span>
      </footer>

      <style jsx>{`
        :global(body.ltg-demo-route) { margin:0; background:#f3f6f7; color:#18303a; }
        :global(body.ltg-demo-route .app-container),
        :global(body.ltg-demo-route .ltg-public-content) { width:100%; max-width:none; margin:0; padding:0; display:block; }
        .demo-page { min-height:100vh; background:linear-gradient(180deg,#ffffff 0,#f6f9fa 54%,#edf3f5 100%); color:#20343d; }
        .topbar { height:78px; display:flex; align-items:center; justify-content:space-between; gap:24px; padding:0 max(24px,calc((100vw - 1220px)/2)); border-bottom:1px solid #dde6e9; background:rgba(255,255,255,.94); }
        .brand { display:flex; align-items:center; gap:12px; border:0; padding:0; background:transparent; cursor:pointer; text-align:left; }
        .mark { color:#f36a2f; font-size:25px; font-weight:950; letter-spacing:-.04em; }
        .brand-copy { color:#718087; font-size:11px; font-weight:850; line-height:1.05; text-transform:uppercase; letter-spacing:.04em; }
        .login-link { border:1px solid #cad7dc; border-radius:8px; background:#fff; color:#38515c; padding:10px 14px; font-weight:800; cursor:pointer; }
        .login-link:hover { border-color:#173a48; color:#173a48; }
        .hero-wrap { width:min(1220px,calc(100% - 40px)); margin:0 auto; padding:72px 0 54px; display:grid; grid-template-columns:minmax(0,1.12fr) minmax(360px,.88fr); gap:58px; align-items:center; }
        .eyebrow { color:#d85c28; font-size:11px; font-weight:950; letter-spacing:.14em; text-transform:uppercase; }
        h1,h2,h3,p { margin-top:0; }
        h1 { max-width:760px; margin:12px 0 20px; color:#102b35; font-size:clamp(42px,5.3vw,72px); line-height:.98; letter-spacing:-.045em; }
        .lead { max-width:730px; color:#62777f; font-size:18px; line-height:1.65; }
        .actions { display:flex; flex-wrap:wrap; gap:10px; margin:30px 0 28px; }
        .actions button,.cta button { border-radius:9px; padding:13px 17px; font-weight:900; cursor:pointer; }
        .primary,.cta button { border:1px solid #173a48; background:#173a48; color:#fff; box-shadow:0 10px 24px rgba(23,58,72,.16); }
        .primary:hover,.cta button:hover { background:#0e2b36; }
        .secondary { border:1px solid #cbd8dd; background:#fff; color:#425b65; }
        .trust-strip { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:1px; overflow:hidden; border:1px solid #dce6e9; border-radius:12px; background:#dce6e9; box-shadow:0 12px 35px rgba(25,53,64,.05); }
        .trust-strip div { min-height:82px; padding:16px; background:#fff; display:flex; flex-direction:column; justify-content:center; gap:4px; }
        .trust-strip strong { color:#17333e; font-size:13px; }
        .trust-strip span { color:#778a92; font-size:11px; line-height:1.35; }
        .workflow-card { border:1px solid #202c31; border-radius:18px; background:#11191d; color:#dbe5e8; padding:28px; box-shadow:0 28px 60px rgba(19,37,44,.19); }
        .panel-label { color:#62d5ff; font-size:10px; font-weight:900; letter-spacing:.13em; text-transform:uppercase; }
        .workflow-card h2 { margin:8px 0 22px; color:#fff; font-size:28px; line-height:1.15; letter-spacing:-.02em; }
        .flow-list { display:grid; gap:6px; }
        .flow-list>div { display:grid; grid-template-columns:34px 1fr; gap:12px; padding:13px 0; border-top:1px solid #283239; }
        .flow-list>div:first-child { border-top:0; }
        .flow-list>div>span { width:28px; height:28px; border-radius:50%; display:grid; place-items:center; background:#1b282f; border:1px solid #30424b; color:#62d5ff; font-size:11px; font-weight:900; }
        .flow-list p { margin:0; display:grid; gap:3px; }
        .flow-list b { color:#eef6f8; font-size:13px; }
        .flow-list small { color:#8fa1a8; font-size:11px; line-height:1.45; }
        .section { width:min(1220px,calc(100% - 40px)); margin:0 auto; padding:64px 0; }
        .capabilities-section { border-top:1px solid #e0e8eb; }
        .section-heading { max-width:780px; margin-bottom:28px; }
        .section-heading h2,.how-heading h2,.cta h2 { margin:7px 0 10px; color:#17333e; font-size:32px; line-height:1.14; letter-spacing:-.025em; }
        .section-heading p,.cta p { color:#71848c; line-height:1.62; }
        .capability-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:14px; }
        .capability-card { min-height:154px; padding:22px; border:1px solid #dbe5e8; border-radius:13px; background:rgba(255,255,255,.84); box-shadow:0 12px 30px rgba(32,59,69,.045); }
        .capability-card h3 { margin-bottom:8px; color:#1a3945; font-size:16px; }
        .capability-card p { margin:0; color:#71848c; font-size:12px; line-height:1.6; }
        .how-section { display:grid; grid-template-columns:.72fr 1.28fr; gap:44px; align-items:start; border-top:1px solid #dce5e8; }
        .steps { display:grid; gap:10px; }
        .step { display:grid; grid-template-columns:52px 1fr; gap:16px; align-items:start; padding:20px; border:1px solid #d8e3e7; border-radius:12px; background:#fff; }
        .step>span { color:#d85c28; font-size:12px; font-weight:950; letter-spacing:.1em; }
        .step h3 { margin:0 0 4px; color:#1b3742; font-size:15px; }
        .step p { margin:0; color:#73858d; font-size:12px; line-height:1.55; }
        .cta { width:min(1220px,calc(100% - 40px)); margin:0 auto 54px; padding:30px 32px; display:grid; grid-template-columns:1fr auto; gap:28px; align-items:center; border:1px solid #cfdde1; border-radius:16px; background:#fff; box-shadow:0 18px 38px rgba(24,54,65,.07); }
        .cta p { max-width:820px; margin-bottom:0; font-size:13px; }
        .cta button { white-space:nowrap; }
        footer { display:flex; justify-content:space-between; gap:24px; padding:24px max(24px,calc((100vw - 1220px)/2)); border-top:1px solid #d6e1e4; color:#7b8b91; font-size:10px; background:#eaf0f2; }
        @media(max-width:900px) {
          .hero-wrap { grid-template-columns:1fr; padding-top:48px; }
          .workflow-card { max-width:none; }
          .trust-strip { grid-template-columns:1fr 1fr; }
          .capability-grid { grid-template-columns:1fr 1fr; }
          .how-section { grid-template-columns:1fr; gap:24px; }
          .cta { grid-template-columns:1fr; }
          .cta button { justify-self:start; }
        }
        @media(max-width:620px) {
          .topbar { height:auto; padding:16px 18px; align-items:flex-start; }
          .brand-copy { font-size:9px; }
          .login-link { padding:9px 10px; font-size:11px; }
          .hero-wrap,.section,.cta { width:min(100% - 28px,1220px); }
          .hero-wrap { padding:38px 0 38px; gap:30px; }
          h1 { font-size:42px; }
          .lead { font-size:15px; }
          .trust-strip { grid-template-columns:1fr; }
          .capability-grid { grid-template-columns:1fr; }
          .section { padding:46px 0; }
          .workflow-card { padding:22px; }
          .workflow-card h2 { font-size:24px; }
          .section-heading h2,.how-heading h2,.cta h2 { font-size:27px; }
          footer { flex-direction:column; padding:20px 18px; }
        }
      `}</style>
    </main>
  );
}
