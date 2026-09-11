'use client';

import { useRouter } from 'next/navigation';

export default function ProgramDemoSelectorPage() {
  const router = useRouter();

  return (
    <div className="shell">
      <header>
        <div className="brand">LTG</div>
        <div>
          <div className="eyebrow">Education Operating System</div>
          <h1>One platform. Different programs.</h1>
          <p>Select an implementation to see how the same LTG operating model adapts to different instructional environments.</p>
        </div>
      </header>

      <main>
        <section className="proof">
          <span>School / Organization</span><b>→</b><span>Program</span><b>→</b><span>Course</span><b>→</b><span>Section</span><b>→</b><span>Daily Instruction</span>
        </section>

        <section className="programs">
          <article className="card welding">
            <div className="tag">LIVE IMPLEMENTATION DEMO</div>
            <h2>Welding Technology</h2>
            <p>Shop-based technical instruction with daily planners, resources, attendance, performance evidence, instructor notes, timekeeping, and school reporting.</p>
            <div className="chips">
              <span>Shop / Lab</span><span>Performance Testing</span><span>Attendance</span><span>Resources</span><span>Reporting</span>
            </div>
            <button onClick={() => router.push('/demo')}>Open Welding Demo</button>
          </article>

          <article className="card radiography">
            <div className="tag">ACTIVE HEALTH SCIENCES DEMONSTRATION</div>
            <h2>Radiography</h2>
            <p>Classroom, lab, and clinical-practicum workflow using synthetic learners, faculty review, clinical evidence status, attendance, and protected curriculum boundaries.</p>
            <div className="chips">
              <span>Classroom + Lab</span><span>Clinical Evidence</span><span>Faculty Review</span><span>Attendance</span><span>Program Oversight</span>
            </div>
            <button onClick={() => router.push('/demo/radiography')}>Open Radiography Demo</button>
          </article>

          <article className="card nursing">
            <div className="tag">FUTURE HEALTH SCIENCES DEMONSTRATION</div>
            <h2>Nursing</h2>
            <p>Classroom and skills-lab demonstration retained for future development with protected outcomes, competency evidence, checkoffs, attendance, quality review, and program-level oversight.</p>
            <div className="chips">
              <span>Skills Lab</span><span>Competency Evidence</span><span>Attendance</span><span>Quality Review</span><span>Protected Outcomes</span>
            </div>
            <button onClick={() => router.push('/demo/nursing')}>Open Nursing Demo</button>
          </article>
        </section>

        <section className="message">
          <div>
            <div className="eyebrow">The point of the demonstration</div>
            <h3>Welding content does not define LTG.</h3>
          </div>
          <p>The core platform remains the same while each department controls its terminology, curriculum, outcomes, resources, teaching workflow, evidence model, branding, and reporting context.</p>
        </section>
      </main>

      <style jsx>{`
        .shell { min-height:100vh; background:#eef4f6; color:#243942; }
        header { display:flex; gap:16px; align-items:center; padding:34px max(24px,calc((100vw - 1280px)/2)); background:white; border-bottom:1px solid #d7e3e8; }
        .brand { width:58px; height:58px; display:grid; place-items:center; border-radius:14px; background:#11191d; color:white; font-weight:950; letter-spacing:.04em; }
        .eyebrow { color:#0e7898; font-size:10px; font-weight:900; letter-spacing:.12em; text-transform:uppercase; }
        h1,h2,h3 { margin:5px 0; } h1 { color:#172f39; font-size:31px; } h2 { font-size:25px; } h3 { color:#17313c; font-size:18px; }
        header p { margin:6px 0 0; color:#6f8189; font-size:13px; line-height:1.5; }
        main { width:min(1280px,calc(100% - 30px)); margin:auto; padding:28px 0 60px; }
        .proof { display:flex; gap:8px; align-items:center; flex-wrap:wrap; padding:14px 16px; border:1px solid #d5e3e8; background:white; border-radius:11px; margin-bottom:18px; box-shadow:0 8px 20px rgba(42,77,90,.05); }
        .proof span { padding:8px 10px; border-radius:7px; background:#f5f9fa; border:1px solid #dfe9ed; font-size:10px; font-weight:850; color:#46606b; } .proof b { color:#8b9ca4; }
        .programs { display:grid; grid-template-columns:repeat(3,1fr); gap:18px; }
        .card { min-height:380px; padding:26px; border-radius:15px; display:grid; align-content:start; box-shadow:0 14px 30px rgba(42,77,90,.09); }
        .card .tag { font-size:9px; font-weight:900; letter-spacing:.12em; margin-bottom:8px; }
        .card p { line-height:1.62; font-size:13px; margin:8px 0 18px; }
        .chips { display:flex; flex-wrap:wrap; gap:7px; margin-bottom:24px; }
        .chips span { padding:7px 9px; border-radius:999px; font-size:9px; font-weight:800; }
        button { justify-self:start; margin-top:auto; border-radius:8px; padding:11px 14px; font-weight:850; cursor:pointer; }
        .welding { background:#111619; color:#dbe1e4; border:1px solid #252d31; } .welding h2 { color:white; } .welding .tag { color:#60d4ff; } .welding p { color:#9ba7ac; } .welding .chips span { background:#1b2226; border:1px solid #303b40; color:#bbc6ca; } .welding button { background:#151c20; border:1px solid #5dcfff; color:#5dcfff; }
        .radiography { background:#f7fbfd; color:#435a64; border:1px solid #cfe0e8; border-top:5px solid #235e7b; } .radiography h2 { color:#17394b; } .radiography .tag { color:#235e7b; } .radiography .chips span { background:#e9f5fa; border:1px solid #c7e1ec; color:#315f73; } .radiography button { background:#235e7b; border:1px solid #235e7b; color:white; }
        .nursing { background:white; color:#435a64; border:1px solid #d6e4e9; border-top:5px solid #7198a8; } .nursing h2 { color:#17313c; } .nursing .tag { color:#7198a8; } .nursing .chips span { background:#f2f7f9; border:1px solid #d7e4e9; color:#5e7984; } .nursing button { background:#6d8f9d; border:1px solid #6d8f9d; color:white; }
        .message { display:grid; grid-template-columns:.8fr 1.2fr; gap:24px; align-items:center; margin-top:18px; padding:22px; border-radius:12px; background:white; border:1px solid #d7e4e9; }
        .message p { color:#657983; line-height:1.6; font-size:12px; }
        @media(max-width:980px) { .programs { grid-template-columns:1fr; } .card { min-height:310px; } }
        @media(max-width:760px) { header { align-items:flex-start; padding:24px 16px; } h1 { font-size:25px; } .message { grid-template-columns:1fr; } .card { padding:22px; } }
      `}</style>
    </div>
  );
}
