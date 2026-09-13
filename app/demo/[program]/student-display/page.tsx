import { notFound } from 'next/navigation';
import { getDemoProgram } from '../../_data/programs';

export default async function DemoStudentDisplayPage({
  params,
  searchParams,
}: {
  params: Promise<{ program: string }>;
  searchParams: Promise<{ course?: string; day?: string }>;
}) {
  const { program: programId } = await params;
  const query = await searchParams;
  const program = getDemoProgram(programId);
  if (!program) notFound();

  const requestedCourse = query.course ?? program.courses[0]?.code;
  const course = program.courses.find((item) => item.code === requestedCourse) ?? program.courses[0];
  if (!course) notFound();

  const requestedDay = Number(query.day ?? 1);
  const dayNumber = Number.isFinite(requestedDay) ? requestedDay : 1;
  const day = course.days.find((item) => item.dayNumber === dayNumber) ?? course.days[0];
  if (!day) notFound();

  const studentResources = day.resources.filter((resource) => resource.studentSafe !== false);

  return (
    <main className="student-display">
      <header>
        <div>
          <div className="eyebrow">LTG Student Display · Public Demo</div>
          <h1>{course.code} · Day {day.dayNumber}</h1>
          <p>{day.title}</p>
        </div>
        <div className="demo-badge">TEMPORARY DEMO</div>
      </header>

      <section className="objective">
        <span>Today&apos;s Objective</span>
        <h2>{day.objective}</h2>
      </section>

      <section className="plan">
        <div className="section-heading">
          <span>Student View</span>
          <h2>Today&apos;s Plan</h2>
        </div>
        <div className="rows">
          {day.rows.map((row) => (
            <article key={row.id}>
              <strong>{row.time}</strong>
              <p>{row.students || 'Follow instructor direction and complete the assigned activity.'}</p>
            </article>
          ))}
        </div>
      </section>

      {studentResources.length > 0 && (
        <section className="resources">
          <div className="section-heading">
            <span>Approved Student Resources</span>
            <h2>Resources</h2>
          </div>
          <div className="resource-grid">
            {studentResources.map((resource) => (
              <article key={resource.id}>
                <strong>{resource.title}</strong>
                {resource.notes && <p>{resource.notes}</p>}
                {resource.url ? (
                  <a href={resource.url} target="_blank" rel="noreferrer">Open Resource</a>
                ) : (
                  <span className="status">Available through instructor launch</span>
                )}
              </article>
            ))}
          </div>
        </section>
      )}

      <footer>
        Instructor coaching, private notes, answer keys, grades, reports, and protected exam content are intentionally excluded.
      </footer>

      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; }
        .student-display { min-height:100vh; padding:34px clamp(20px,4vw,60px) 44px; background:#081014; color:#e7f1f4; font-family:Arial,Helvetica,sans-serif; }
        header { display:flex; justify-content:space-between; gap:24px; align-items:flex-start; padding-bottom:24px; border-bottom:1px solid #26353c; }
        .eyebrow,.section-heading span,.objective span { color:#5bdcff; font-size:11px; font-weight:900; letter-spacing:.12em; text-transform:uppercase; }
        h1 { margin:8px 0 4px; font-size:clamp(34px,5vw,62px); line-height:1; }
        header p { margin:0; color:#9cafb6; font-size:clamp(16px,2vw,24px); }
        .demo-badge { padding:9px 12px; border:1px solid #1b7698; border-radius:999px; background:#0b3544; color:#8ae5ff; font-size:10px; font-weight:900; white-space:nowrap; }
        .objective { margin:28px 0; padding:24px; border:1px solid #2a3b43; border-radius:14px; background:#10191e; }
        .objective h2 { margin:9px 0 0; max-width:1100px; font-size:clamp(24px,3vw,38px); line-height:1.18; }
        .plan,.resources { margin-top:30px; }
        .section-heading h2 { margin:6px 0 14px; font-size:24px; }
        .rows { display:grid; gap:8px; }
        .rows article { display:grid; grid-template-columns:150px 1fr; gap:20px; align-items:start; padding:17px 20px; border:1px solid #26363d; border-radius:10px; background:#0d1519; }
        .rows strong { color:#66dcff; font-size:16px; }
        .rows p { margin:0; color:#d6e1e5; font-size:18px; line-height:1.45; }
        .resource-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; }
        .resource-grid article { padding:18px; border:1px solid #293b43; border-radius:10px; background:#0e171b; }
        .resource-grid strong { display:block; font-size:16px; }
        .resource-grid p { color:#94a8b0; line-height:1.5; }
        .resource-grid a,.status { display:inline-block; margin-top:8px; padding:9px 11px; border:1px solid #287fa1; border-radius:7px; color:#77dfff; text-decoration:none; font-size:12px; font-weight:800; }
        footer { margin-top:34px; padding-top:20px; border-top:1px solid #26353c; color:#738990; font-size:11px; }
        @media(max-width:760px) { header { flex-direction:column; }.rows article { grid-template-columns:1fr; gap:7px; }.resource-grid { grid-template-columns:1fr; } }
      `}</style>
    </main>
  );
}
