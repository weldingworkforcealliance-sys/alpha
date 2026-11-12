const STORAGE_KEY = "sensePassportLab.v1";

const MODULES = [
  {
    id: "m1",
    name: "Occupational Orientation",
    category: "foundation",
    credentialRequired: false,
    competencies: [
      "Prepares time or job cards, reports, or records",
      "Performs housekeeping duties",
      "Follows verbal instructions to complete work assignments",
      "Follows written instructions to complete work assignments"
    ]
  },
  {
    id: "m2",
    name: "Safety and Health of Welders",
    category: "compulsory",
    credentialRequired: true,
    competencies: [
      "Demonstrates proper use and inspection of PPE",
      "Demonstrates proper safe operation practices in the work area",
      "Demonstrates proper use and inspection of ventilation equipment",
      "Demonstrates proper Hot Zone operation",
      "Demonstrates proper work actions for working in confined spaces",
      "Demonstrates proper use of precautionary labeling and SDS/MSDS information",
      "Demonstrates proper inspection and operation of equipment used for each required welding and thermal cutting process"
    ]
  },
  {
    id: "m3",
    name: "Drawing and Welding Symbol Interpretation",
    category: "compulsory",
    credentialRequired: true,
    competencies: [
      "Interprets basic elements of a drawing or sketch",
      "Interprets welding symbol information",
      "Fabricates parts from a drawing or sketch"
    ]
  },
  {
    id: "m4",
    name: "Shielded Metal Arc Welding (SMAW)",
    category: "optional-process",
    credentialRequired: true,
    competencies: [
      "Performs safety inspections of SMAW equipment and accessories",
      "Makes minor external repairs to SMAW equipment and accessories",
      "Sets up for SMAW operations on carbon steel",
      "Operates SMAW equipment on carbon steel",
      "Makes fillet welds in all positions on carbon steel",
      "Makes groove welds in all positions on carbon steel",
      "Completes required SMAW performance qualification tests"
    ]
  },
  {
    id: "m5",
    name: "Gas Metal Arc Welding (GMAW-S, GMAW Spray)",
    category: "optional-process",
    credentialRequired: true,
    competencies: [
      "Performs safety inspections of GMAW equipment and accessories",
      "Makes minor external repairs to GMAW equipment and accessories",
      "Sets up for GMAW-S operations on carbon steel",
      "Operates GMAW-S equipment on carbon steel",
      "Makes fillet welds in all positions on carbon steel",
      "Makes groove welds in all positions on carbon steel",
      "Completes GMAW-S workmanship qualification",
      "Sets up for GMAW spray operations on carbon steel",
      "Operates GMAW spray equipment on carbon steel",
      "Makes fillet welds in 1F and 2F positions on carbon steel",
      "Makes groove welds in 1G position on carbon steel",
      "Completes GMAW spray workmanship qualification"
    ]
  },
  {
    id: "m6",
    name: "Flux Cored Arc Welding (FCAW-G/GMAW, FCAW-S)",
    category: "optional-process",
    credentialRequired: true,
    competencies: [
      "Performs safety inspections of FCAW equipment and accessories",
      "Makes minor external repairs to FCAW equipment and accessories",
      "Sets up for FCAW-G/GMAW operations on carbon steel",
      "Operates FCAW-G/GMAW equipment on carbon steel",
      "Makes fillet welds in all positions on carbon steel",
      "Makes groove welds in all positions on carbon steel",
      "Completes FCAW-G/GMAW workmanship qualification",
      "Sets up for FCAW-S operations on carbon steel",
      "Operates FCAW-S equipment on carbon steel",
      "Completes FCAW-S workmanship qualification"
    ]
  },
  {
    id: "m7",
    name: "Gas Tungsten Arc Welding (GTAW)",
    category: "optional-process",
    credentialRequired: true,
    competencies: [
      "Performs safety inspections of GTAW equipment and accessories",
      "Makes minor external repairs to GTAW equipment and accessories",
      "Sets up for GTAW operations on carbon steel",
      "Operates GTAW equipment on carbon steel",
      "Makes fillet welds in all positions on carbon steel",
      "Makes groove welds in all positions on carbon steel",
      "Completes GTAW workmanship qualification on carbon steel",
      "Performs GTAW operations on austenitic stainless steel",
      "Completes GTAW workmanship qualification on austenitic stainless steel",
      "Performs GTAW operations on aluminum",
      "Completes GTAW workmanship qualification on aluminum"
    ]
  },
  {
    id: "m8",
    name: "Thermal Cutting Processes",
    category: "compulsory",
    credentialRequired: true,
    competencies: [
      "Manual oxyfuel gas cutting (OFC)",
      "Mechanized oxyfuel gas cutting (optional hands-on)",
      "Manual plasma arc cutting (PAC)",
      "Manual air carbon arc cutting (CAC-A, optional hands-on)"
    ]
  },
  {
    id: "m9",
    name: "Welding Inspection and Testing",
    category: "compulsory",
    credentialRequired: true,
    competencies: [
      "Examines cut surfaces and edges of prepared base metal parts",
      "Examines tacks, root passes, intermediate layers, and completed welds"
    ]
  }
];

const EXAM_RULES = {
  m2: { label: "Safety and Health of Welders", passMark: 100 },
  m3: { label: "Drawing and Welding Symbol Interpretation", passMark: 75 },
  m4: { label: "SMAW", passMark: 75 },
  m5: { label: "GMAW", passMark: 75 },
  m6: { label: "FCAW", passMark: 75 },
  m7: { label: "GTAW", passMark: 75 },
  m8: { label: "Thermal Cutting Processes", passMark: 75 },
  m9: { label: "Welding Inspection and Testing", passMark: 75 }
};

const QUALIFICATIONS = [
  { id: "q1", moduleId: "m5", test: 1, name: "GMAW-S (Short Circuiting)", type: "Workmanship", material: "Steel", position: "Multiple", swps: "B2.1-1-004" },
  { id: "q2", moduleId: "m5", test: 2, name: "GMAW Spray", type: "Workmanship", material: "Steel", position: "2G, 1F", swps: "B2.1-1-235" },
  { id: "q3", moduleId: "m6", test: 3, name: "FCAW-G", type: "Workmanship", material: "Steel", position: "Multiple", swps: "B2.1-1-019 or B2.1-1-020" },
  { id: "q4", moduleId: "m6", test: 4, name: "FCAW-S", type: "Workmanship", material: "Steel", position: "Multiple", swps: "B2.1-1-027 or B2.1-1-018" },
  { id: "q5", moduleId: "m7", test: 5, name: "GTAW Carbon Steel", type: "Workmanship", material: "Steel", position: "Multiple", swps: "B2.1-1-008" },
  { id: "q6", moduleId: "m7", test: 6, name: "GTAW Stainless", type: "Workmanship", material: "Stainless", position: "Multiple", swps: "B2.1-8-009" },
  { id: "q7", moduleId: "m7", test: 7, name: "GTAW Aluminum", type: "Workmanship", material: "Aluminum", position: "1G, 2F", swps: "B2.1-22-015" },
  { id: "q8", moduleId: "m4", test: 8, name: "SMAW Limited Thickness Plate", type: "Welder Performance", material: "Steel", position: "2G", swps: "B2.1-1-016" },
  { id: "q9", moduleId: "m4", test: 9, name: "SMAW Limited Thickness Plate", type: "Welder Performance", material: "Steel", position: "3G uphill", swps: "B2.1-1-016" }
];

const STATUS_OPTIONS = ["Not Started", "Introduced", "Practicing", "Competent", "Verified"];

function blankStudent({ name, studentId, email = "", cohort = "" }) {
  const competencies = {};
  MODULES.forEach(module => {
    competencies[module.id] = module.competencies.map((label, index) => ({
      id: `${module.id}-c${index + 1}`,
      label,
      status: "Not Started",
      date: "",
      instructor: ""
    }));
  });

  const exams = {};
  Object.keys(EXAM_RULES).forEach(moduleId => {
    exams[moduleId] = { attempts: [], retrainingConfirmed: false };
  });

  const qualifications = {};
  QUALIFICATIONS.forEach(q => {
    qualifications[q.id] = { status: "Not Started", date: "", instructor: "", notes: "" };
  });

  return {
    id: crypto.randomUUID ? crypto.randomUUID() : `student-${Date.now()}-${Math.random()}`,
    name,
    studentId,
    email,
    cohort,
    level: "AWS SENSE Level I — Entry Welder",
    aws: {
      registrationStatus: "Not registered",
      candidateId: "",
      enrollmentDate: "",
      completionSubmission: "Not submitted",
      adminNotes: ""
    },
    competencies,
    exams,
    qualifications,
    createdAt: new Date().toISOString()
  };
}

function makeDemoState() {
  const a = blankStudent({ name: "Demo Student A", studentId: "TEST-001", email: "student.a@example.edu", cohort: "Level 1 Test Cohort" });
  const b = blankStudent({ name: "Demo Student B", studentId: "TEST-002", email: "student.b@example.edu", cohort: "Level 1 Test Cohort" });
  const c = blankStudent({ name: "Demo Student C", studentId: "TEST-003", email: "student.c@example.edu", cohort: "Level 1 Test Cohort" });

  // Seed one student with believable progress so the interface is useful immediately.
  ["m1", "m2", "m3"].forEach(moduleId => a.competencies[moduleId].forEach(item => item.status = "Verified"));
  a.exams.m2.attempts.push({ score: 100, date: "2026-09-10", instructor: "Demo Instructor" });
  a.exams.m3.attempts.push({ score: 82, date: "2026-09-14", instructor: "Demo Instructor" });
  a.competencies.m4.slice(0, 4).forEach(item => item.status = "Competent");
  a.aws.registrationStatus = "Registered";
  a.aws.candidateId = "DEMO-AWS-ID";

  b.competencies.m1.forEach(item => item.status = "Verified");
  b.competencies.m2.slice(0, 4).forEach(item => item.status = "Practicing");
  b.exams.m2.attempts.push({ score: 90, date: "2026-09-12", instructor: "Demo Instructor" });

  return {
    schemaVersion: 1,
    program: {
      name: "PCCC Welding — AWS SENSE Level I Prototype",
      mode: "Standalone Lab",
      standardBasis: "AWS QC10:2017 / AWS EG2.0:2017 / AWS EG2.0:2017 Supplement"
    },
    activeStudentId: a.id,
    students: [a, b, c]
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return makeDemoState();
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.schemaVersion !== 1 || !Array.isArray(parsed.students)) return makeDemoState();
    return parsed;
  } catch {
    return makeDemoState();
  }
}

let state = loadState();
let currentView = "dashboard";

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  renderActiveStudentSelect();
}

function activeStudent() {
  return state.students.find(s => s.id === state.activeStudentId) || state.students[0] || null;
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function examPassed(student, moduleId) {
  const rule = EXAM_RULES[moduleId];
  if (!rule) return true;
  return (student.exams[moduleId]?.attempts || []).some(a => Number(a.score) >= rule.passMark);
}

function moduleQualifications(student, moduleId) {
  return QUALIFICATIONS.filter(q => q.moduleId === moduleId);
}

function qualificationsPassed(student, moduleId) {
  const quals = moduleQualifications(student, moduleId);
  if (!quals.length) return true;
  return quals.every(q => student.qualifications[q.id]?.status === "Pass");
}

function competenciesVerified(student, moduleId) {
  const list = student.competencies[moduleId] || [];
  return list.length > 0 && list.every(c => c.status === "Verified");
}

function moduleComplete(student, moduleId) {
  return competenciesVerified(student, moduleId) && examPassed(student, moduleId) && qualificationsPassed(student, moduleId);
}

function moduleProgress(student, moduleId) {
  const module = MODULES.find(m => m.id === moduleId);
  const comps = student.competencies[moduleId] || [];
  const statusWeights = { "Not Started": 0, "Introduced": .25, "Practicing": .5, "Competent": .75, "Verified": 1 };
  const compScore = comps.length ? comps.reduce((sum, c) => sum + (statusWeights[c.status] || 0), 0) / comps.length : 0;
  const examWeight = EXAM_RULES[moduleId] ? (examPassed(student, moduleId) ? 1 : 0) : 1;
  const quals = moduleQualifications(student, moduleId);
  const qualWeight = quals.length ? quals.filter(q => student.qualifications[q.id]?.status === "Pass").length / quals.length : 1;

  let pieces = [compScore];
  if (EXAM_RULES[moduleId]) pieces.push(examWeight);
  if (quals.length) pieces.push(qualWeight);
  if (!module) return 0;
  return Math.round((pieces.reduce((a, b) => a + b, 0) / pieces.length) * 100);
}

function credentialSummary(student) {
  const compulsory = ["m2", "m3", "m8", "m9"];
  const optional = ["m4", "m5", "m6", "m7"];
  const compulsoryDone = compulsory.filter(id => moduleComplete(student, id));
  const optionalDone = optional.filter(id => moduleComplete(student, id));
  const partialEligible = compulsoryDone.length === compulsory.length && optionalDone.length >= 1;
  const fullEligible = compulsoryDone.length === compulsory.length && optionalDone.length === optional.length;
  const tracked = [...compulsory, ...optional];
  const average = Math.round(tracked.reduce((sum, id) => sum + moduleProgress(student, id), 0) / tracked.length);
  return { compulsoryDone, optionalDone, partialEligible, fullEligible, average };
}

function badge(label, tone = "gray") {
  return `<span class="badge ${tone}">${escapeHtml(label)}</span>`;
}

function statusTone(status) {
  if (["Verified", "Pass", "Registered", "Submitted", "Full completion eligible"].includes(status)) return "green";
  if (["Competent", "Partial completion eligible"].includes(status)) return "blue";
  if (["Practicing", "Introduced", "Pending", "Not submitted"].includes(status)) return "yellow";
  if (["Fail", "Blocked"].includes(status)) return "red";
  return "gray";
}

function renderActiveStudentSelect() {
  const select = document.getElementById("activeStudentSelect");
  if (!select) return;
  if (!state.students.length) {
    select.innerHTML = `<option>No students</option>`;
    select.disabled = true;
    return;
  }
  select.disabled = false;
  if (!state.students.some(s => s.id === state.activeStudentId)) state.activeStudentId = state.students[0].id;
  select.innerHTML = state.students.map(s => `<option value="${escapeHtml(s.id)}" ${s.id === state.activeStudentId ? "selected" : ""}>${escapeHtml(s.name)} · ${escapeHtml(s.studentId)}</option>`).join("");
}

function renderDashboard() {
  const students = state.students;
  const registered = students.filter(s => s.aws.registrationStatus === "Registered").length;
  const partial = students.filter(s => credentialSummary(s).partialEligible).length;
  const full = students.filter(s => credentialSummary(s).fullEligible).length;
  const avg = students.length ? Math.round(students.reduce((sum, s) => sum + credentialSummary(s).average, 0) / students.length) : 0;

  return `
    <div class="grid cols-4">
      <div class="card"><div class="stat-value">${students.length}</div><div class="stat-label">Tracked students</div></div>
      <div class="card"><div class="stat-value">${registered}</div><div class="stat-label">AWS registration marked complete</div></div>
      <div class="card"><div class="stat-value">${partial}</div><div class="stat-label">Partial-completion eligible</div></div>
      <div class="card"><div class="stat-value">${full}</div><div class="stat-label">Full-completion eligible</div></div>
    </div>

    <div class="section-title">
      <div><h3>Program readiness</h3><p>Computed from verified competencies, passing knowledge exams, and required process qualification records.</p></div>
      ${badge(`${avg}% cohort progress`, avg >= 75 ? "green" : "yellow")}
    </div>

    <div class="table-wrap">
      <table>
        <thead><tr><th>Student</th><th>AWS registration</th><th>Overall progress</th><th>Compulsory modules</th><th>Optional welding modules</th><th>Credential status</th></tr></thead>
        <tbody>
          ${students.map(student => {
            const summary = credentialSummary(student);
            const cred = summary.fullEligible ? ["Full completion eligible", "green"] : summary.partialEligible ? ["Partial completion eligible", "blue"] : ["In progress", "yellow"];
            return `<tr data-select-student="${student.id}">
              <td><div class="row-title">${escapeHtml(student.name)}</div><div class="subtext">${escapeHtml(student.studentId)} · ${escapeHtml(student.cohort || "No cohort")}</div></td>
              <td>${badge(student.aws.registrationStatus, statusTone(student.aws.registrationStatus))}</td>
              <td><div class="progress-track"><div class="progress-fill" style="width:${summary.average}%"></div></div><div class="subtext">${summary.average}%</div></td>
              <td>${summary.compulsoryDone.length}/4 complete</td>
              <td>${summary.optionalDone.length}/4 complete</td>
              <td>${badge(cred[0], cred[1])}</td>
            </tr>`;
          }).join("") || `<tr><td colspan="6" class="empty">No students yet.</td></tr>`}
        </tbody>
      </table>
    </div>

    <div class="section-title"><div><h3>Prototype boundaries</h3></div></div>
    <div class="grid cols-2">
      <div class="callout info"><strong>Standalone by design.</strong> This lab does not import LTG users, attendance, grades, Supabase data, or production routes. All edits remain in browser localStorage until exported.</div>
      <div class="callout"><strong>Standards mapped, not republished.</strong> The prototype stores structured module names, competency labels, passing thresholds, test identifiers, and SWPS references. It does not embed the full copyrighted AWS publications.</div>
    </div>
  `;
}

function renderStudents() {
  return `
    <div class="section-title">
      <div><h3>Test roster</h3><p>These records exist only inside this prototype.</p></div>
      <button class="primary-btn" data-action="add-student">+ Add student</button>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Name</th><th>ID</th><th>Email</th><th>Cohort</th><th>AWS status</th><th></th></tr></thead>
        <tbody>
          ${state.students.map(student => `<tr>
            <td><button class="secondary-btn" data-action="open-student" data-student-id="${student.id}">${escapeHtml(student.name)}</button></td>
            <td>${escapeHtml(student.studentId)}</td>
            <td>${escapeHtml(student.email || "—")}</td>
            <td>${escapeHtml(student.cohort || "—")}</td>
            <td>${badge(student.aws.registrationStatus, statusTone(student.aws.registrationStatus))}</td>
            <td><button class="danger-btn" data-action="delete-student" data-student-id="${student.id}">Delete</button></td>
          </tr>`).join("") || `<tr><td colspan="6" class="empty">No students yet.</td></tr>`}
        </tbody>
      </table>
    </div>
  `;
}

function renderPassport() {
  const student = activeStudent();
  if (!student) return `<div class="empty">Add a student to begin.</div>`;
  const summary = credentialSummary(student);
  const statusLabel = summary.fullEligible ? "Full completion eligible" : summary.partialEligible ? "Partial completion eligible" : "In progress";

  return `
    <div class="card student-hero">
      <div>
        <div class="eyebrow">Digital training achievement record</div>
        <h2>${escapeHtml(student.name)}</h2>
        <div class="student-meta"><span>${escapeHtml(student.studentId)}</span><span>${escapeHtml(student.cohort || "No cohort")}</span><span>${escapeHtml(student.level)}</span></div>
        <div class="passport-summary" style="margin-top:14px">
          ${badge(student.aws.registrationStatus, statusTone(student.aws.registrationStatus))}
          ${badge(statusLabel, statusTone(statusLabel))}
          ${badge(`${summary.compulsoryDone.length}/4 compulsory complete`, "gray")}
          ${badge(`${summary.optionalDone.length}/4 welding modules complete`, "gray")}
        </div>
      </div>
      <div class="completion-box"><div class="big">${summary.average}%</div><div class="stat-label">SENSE readiness progress</div></div>
    </div>

    <div class="section-title"><div><h3>Module map</h3><p>Competency status is intentionally separate from academic letter grades.</p></div></div>
    <div class="module-list">
      ${MODULES.map(module => renderModuleCard(student, module)).join("")}
    </div>
  `;
}

function renderModuleCard(student, module) {
  const progress = moduleProgress(student, module.id);
  const complete = moduleComplete(student, module.id);
  const categoryLabel = module.category === "compulsory" ? "Compulsory" : module.category === "optional-process" ? "Welding process" : "Foundation";
  const exam = EXAM_RULES[module.id];
  const quals = moduleQualifications(student, module.id);
  return `
    <div class="module-card">
      <div class="module-head">
        <div>
          <div class="module-name">Module ${module.id.slice(1)} · ${escapeHtml(module.name)}</div>
          <div class="subtext">${categoryLabel}${exam ? ` · knowledge exam ${exam.passMark}% minimum` : ""}${quals.length ? ` · ${quals.length} qualification record${quals.length > 1 ? "s" : ""}` : ""}</div>
        </div>
        ${badge(complete ? "Complete" : `${progress}%`, complete ? "green" : "yellow")}
      </div>
      <div class="progress-track" style="margin-bottom:12px"><div class="progress-fill" style="width:${progress}%"></div></div>
      <div class="competency-grid">
        ${(student.competencies[module.id] || []).map(comp => `
          <div class="competency-item">
            <span>${escapeHtml(comp.label)}</span>
            <select data-action="competency-status" data-module-id="${module.id}" data-competency-id="${comp.id}">
              ${STATUS_OPTIONS.map(option => `<option ${comp.status === option ? "selected" : ""}>${option}</option>`).join("")}
            </select>
          </div>`).join("")}
      </div>
    </div>
  `;
}

function renderExams() {
  const student = activeStudent();
  if (!student) return `<div class="empty">Add a student to begin.</div>`;

  return `
    <div class="callout info"><strong>Attempt control:</strong> the prototype stores up to three knowledge-exam attempts. If attempts 1 and 2 both fail, the third attempt is blocked until retraining is marked complete.</div>
    <div class="section-title"><div><h3>${escapeHtml(student.name)} · Knowledge exams</h3><p>Safety requires 100%. Other tracked Level I knowledge exams require 75%.</p></div></div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Module</th><th>Passing score</th><th>Attempts</th><th>Status</th><th>Add attempt</th></tr></thead>
        <tbody>
          ${Object.entries(EXAM_RULES).map(([moduleId, rule]) => {
            const exam = student.exams[moduleId] || { attempts: [], retrainingConfirmed: false };
            const passed = examPassed(student, moduleId);
            const twoFails = exam.attempts.length >= 2 && !passed;
            const blocked = twoFails && !exam.retrainingConfirmed && exam.attempts.length < 3;
            return `<tr>
              <td><div class="row-title">Module ${moduleId.slice(1)}</div><div class="subtext">${escapeHtml(rule.label)}</div></td>
              <td>${rule.passMark}%</td>
              <td>
                <div class="exam-attempts">
                  ${exam.attempts.map((a, idx) => `<span class="attempt-pill" title="${escapeHtml(a.date || "No date")}">#${idx + 1} ${escapeHtml(a.score)}%</span>`).join("") || `<span class="subtext">None</span>`}
                </div>
              </td>
              <td>${passed ? badge("PASS", "green") : blocked ? badge("RETRAINING REQUIRED", "red") : badge(exam.attempts.length ? "NOT YET PASSED" : "NOT STARTED", exam.attempts.length ? "yellow" : "gray")}</td>
              <td>
                ${blocked ? `<button class="secondary-btn" data-action="confirm-retraining" data-module-id="${moduleId}">Mark retraining complete</button>` : exam.attempts.length >= 3 || passed ? `<span class="subtext">No additional attempt needed</span>` : `
                  <div class="inline-controls">
                    <input type="number" min="0" max="100" placeholder="Score" data-score-input="${moduleId}" />
                    <input type="date" data-date-input="${moduleId}" />
                    <button class="primary-btn" data-action="add-exam-attempt" data-module-id="${moduleId}">Save</button>
                  </div>`}
              </td>
            </tr>`;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderQualifications() {
  const student = activeStudent();
  if (!student) return `<div class="empty">Add a student to begin.</div>`;
  return `
    <div class="section-title"><div><h3>${escapeHtml(student.name)} · Performance qualifications</h3><p>Tracks AWS Level I test identity, process, material, position, SWPS reference, result, date, instructor, and notes.</p></div></div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Test</th><th>Process / type</th><th>Material / position</th><th>SWPS</th><th>Result</th><th>Date</th><th>Instructor</th></tr></thead>
        <tbody>
          ${QUALIFICATIONS.map(q => {
            const record = student.qualifications[q.id] || {};
            return `<tr>
              <td><div class="row-title">Test ${q.test}</div><div class="subtext">${escapeHtml(q.name)}</div></td>
              <td>${escapeHtml(q.type)}<div class="subtext">Module ${q.moduleId.slice(1)}</div></td>
              <td>${escapeHtml(q.material)}<div class="subtext">${escapeHtml(q.position)}</div></td>
              <td>${escapeHtml(q.swps)}</td>
              <td><select data-action="qualification-field" data-qualification-id="${q.id}" data-field="status"><option ${record.status === "Not Started" ? "selected" : ""}>Not Started</option><option ${record.status === "Pass" ? "selected" : ""}>Pass</option><option ${record.status === "Fail" ? "selected" : ""}>Fail</option></select></td>
              <td><input type="date" value="${escapeHtml(record.date || "")}" data-action="qualification-field" data-qualification-id="${q.id}" data-field="date" /></td>
              <td><input value="${escapeHtml(record.instructor || "")}" placeholder="Instructor" data-action="qualification-field" data-qualification-id="${q.id}" data-field="instructor" /></td>
            </tr>
            <tr><td colspan="7"><textarea placeholder="Qualification notes / evidence reference" data-action="qualification-field" data-qualification-id="${q.id}" data-field="notes">${escapeHtml(record.notes || "")}</textarea></td></tr>`;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderAdmin() {
  const student = activeStudent();
  if (!student) return `<div class="empty">Add a student to begin.</div>`;
  const summary = credentialSummary(student);
  const nextGaps = [];
  ["m2", "m3", "m8", "m9"].forEach(id => { if (!moduleComplete(student, id)) nextGaps.push(`Module ${id.slice(1)} compulsory requirements incomplete`); });
  if (!summary.optionalDone.length) nextGaps.push("At least one welding-process module must be complete for partial-completion eligibility");
  if (student.aws.registrationStatus !== "Registered") nextGaps.push("AWS trainee registration not marked complete in this prototype");

  return `
    <div class="grid cols-3">
      <div class="card"><div class="stat-value">${summary.compulsoryDone.length}/4</div><div class="stat-label">Compulsory modules complete</div></div>
      <div class="card"><div class="stat-value">${summary.optionalDone.length}/4</div><div class="stat-label">Optional welding modules complete</div></div>
      <div class="card"><div class="stat-value">${summary.fullEligible ? "FULL" : summary.partialEligible ? "PARTIAL" : "NO"}</div><div class="stat-label">Computed completion eligibility</div></div>
    </div>

    <div class="section-title"><div><h3>AWS administration record</h3><p>This is a local tracking aid only. It does not submit anything to AWS.</p></div></div>
    <div class="card">
      <div class="form-grid">
        <label>Registration status
          <select data-action="aws-field" data-field="registrationStatus">
            ${["Not registered", "Registration pending", "Registered"].map(v => `<option ${student.aws.registrationStatus === v ? "selected" : ""}>${v}</option>`).join("")}
          </select>
        </label>
        <label>AWS candidate / trainee ID<input data-action="aws-field" data-field="candidateId" value="${escapeHtml(student.aws.candidateId || "")}" /></label>
        <label>Enrollment date<input type="date" data-action="aws-field" data-field="enrollmentDate" value="${escapeHtml(student.aws.enrollmentDate || "")}" /></label>
        <label>Completion submission
          <select data-action="aws-field" data-field="completionSubmission">
            ${["Not submitted", "Partial submitted", "Full submitted"].map(v => `<option ${student.aws.completionSubmission === v ? "selected" : ""}>${v}</option>`).join("")}
          </select>
        </label>
      </div>
      <label style="display:grid;gap:6px;margin-top:12px;color:var(--muted);font-size:12px">Administrative notes
        <textarea data-action="aws-field" data-field="adminNotes">${escapeHtml(student.aws.adminNotes || "")}</textarea>
      </label>
    </div>

    <div class="section-title"><div><h3>Readiness check</h3></div></div>
    ${nextGaps.length ? `<div class="callout danger"><strong>Not ready for submission yet.</strong><ul>${nextGaps.map(g => `<li>${escapeHtml(g)}</li>`).join("")}</ul></div>` : `<div class="callout info"><strong>Internal readiness check is clear.</strong> Verify the official AWS system and current administrative requirements before submitting any completion record.</div>`}

    <div class="section-title"><div><h3>Credential logic used by this prototype</h3></div></div>
    <div class="card">
      <p><strong>Partial completion:</strong> all four compulsory modules (2, 3, 8, 9) plus at least one completed welding-process module (4, 5, 6, or 7), including the applicable knowledge exam and associated qualification record(s).</p>
      <p><strong>Full completion:</strong> all four compulsory modules plus all four welding-process modules.</p>
      <p class="subtext">Module 1 Occupational Orientation is tracked as a foundation module but is not used by this prototype in the partial/full completion calculation because QC10:2017 §6.1.3 explicitly lists Modules 2, 3, 8, and 9 as compulsory modules for that registration-status rule.</p>
    </div>
  `;
}

function render() {
  renderActiveStudentSelect();
  const titleMap = {
    dashboard: "Program Dashboard",
    students: "Test Students",
    passport: "AWS SENSE Passport",
    exams: "Knowledge Exams",
    qualifications: "Performance Qualifications",
    admin: "Admin / AWS Readiness"
  };
  document.getElementById("viewTitle").textContent = titleMap[currentView] || "SENSE Passport Lab";
  document.querySelectorAll(".nav-btn").forEach(btn => btn.classList.toggle("active", btn.dataset.view === currentView));
  const content = document.getElementById("appContent");
  const renders = { dashboard: renderDashboard, students: renderStudents, passport: renderPassport, exams: renderExams, qualifications: renderQualifications, admin: renderAdmin };
  content.innerHTML = (renders[currentView] || renderDashboard)();
}

function setActiveStudent(id, view = null) {
  if (state.students.some(s => s.id === id)) {
    state.activeStudentId = id;
    if (view) currentView = view;
    saveState();
    render();
  }
}

function openStudentDialog() {
  const form = document.getElementById("studentForm");
  form.reset();
  document.getElementById("studentDialog").showModal();
}

function addStudentFromForm() {
  const form = document.getElementById("studentForm");
  if (!form.reportValidity()) return;
  const data = new FormData(form);
  const student = blankStudent({
    name: String(data.get("name") || "").trim(),
    studentId: String(data.get("studentId") || "").trim(),
    email: String(data.get("email") || "").trim(),
    cohort: String(data.get("cohort") || "").trim()
  });
  state.students.push(student);
  state.activeStudentId = student.id;
  saveState();
  currentView = "passport";
  document.getElementById("studentDialog").close();
  render();
}

function exportJson() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `sense-passport-lab-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

async function importJson(file) {
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    if (!parsed || parsed.schemaVersion !== 1 || !Array.isArray(parsed.students)) throw new Error("Unsupported or invalid prototype export.");
    state = parsed;
    saveState();
    render();
  } catch (error) {
    alert(`Import failed: ${error.message}`);
  }
}

// Navigation and global controls.
document.querySelectorAll(".nav-btn").forEach(btn => btn.addEventListener("click", () => {
  currentView = btn.dataset.view;
  render();
}));

document.getElementById("activeStudentSelect").addEventListener("change", event => setActiveStudent(event.target.value));
document.getElementById("addStudentBtn").addEventListener("click", openStudentDialog);
document.getElementById("saveStudentBtn").addEventListener("click", event => {
  event.preventDefault();
  addStudentFromForm();
});
document.getElementById("exportJsonBtn").addEventListener("click", exportJson);
document.getElementById("importJsonInput").addEventListener("change", event => {
  const file = event.target.files?.[0];
  if (file) importJson(file);
  event.target.value = "";
});
document.getElementById("resetDemoBtn").addEventListener("click", () => {
  if (!confirm("Reset all prototype data back to the demo roster?")) return;
  state = makeDemoState();
  saveState();
  currentView = "dashboard";
  render();
});

// Event delegation for the rendered views.
document.getElementById("appContent").addEventListener("click", event => {
  const target = event.target.closest("[data-action], [data-select-student]");
  if (!target) return;

  if (target.dataset.selectStudent) {
    setActiveStudent(target.dataset.selectStudent, "passport");
    return;
  }

  const action = target.dataset.action;
  const student = activeStudent();

  if (action === "add-student") openStudentDialog();
  if (action === "open-student") setActiveStudent(target.dataset.studentId, "passport");
  if (action === "delete-student") {
    const id = target.dataset.studentId;
    const victim = state.students.find(s => s.id === id);
    if (!victim || !confirm(`Delete test record for ${victim.name}?`)) return;
    state.students = state.students.filter(s => s.id !== id);
    if (state.activeStudentId === id) state.activeStudentId = state.students[0]?.id || null;
    saveState();
    render();
  }
  if (action === "confirm-retraining" && student) {
    const moduleId = target.dataset.moduleId;
    student.exams[moduleId].retrainingConfirmed = true;
    saveState();
    render();
  }
  if (action === "add-exam-attempt" && student) {
    const moduleId = target.dataset.moduleId;
    const scoreInput = document.querySelector(`[data-score-input="${moduleId}"]`);
    const dateInput = document.querySelector(`[data-date-input="${moduleId}"]`);
    const score = Number(scoreInput?.value);
    if (!Number.isFinite(score) || score < 0 || score > 100) {
      alert("Enter a score from 0 to 100.");
      return;
    }
    const exam = student.exams[moduleId];
    if (exam.attempts.length >= 3) return;
    const alreadyPassed = examPassed(student, moduleId);
    if (alreadyPassed) return;
    if (exam.attempts.length >= 2 && !exam.retrainingConfirmed) {
      alert("Mark retraining complete before recording attempt 3.");
      return;
    }
    exam.attempts.push({ score, date: dateInput?.value || "", instructor: "" });
    saveState();
    render();
  }
});

document.getElementById("appContent").addEventListener("change", event => {
  const target = event.target.closest("[data-action]");
  if (!target) return;
  const student = activeStudent();
  if (!student) return;

  if (target.dataset.action === "competency-status") {
    const moduleId = target.dataset.moduleId;
    const competencyId = target.dataset.competencyId;
    const item = student.competencies[moduleId]?.find(c => c.id === competencyId);
    if (item) {
      item.status = target.value;
      if (target.value === "Verified" && !item.date) item.date = new Date().toISOString().slice(0, 10);
      saveState();
      render();
    }
  }

  if (target.dataset.action === "qualification-field") {
    const qid = target.dataset.qualificationId;
    const field = target.dataset.field;
    if (student.qualifications[qid]) {
      student.qualifications[qid][field] = target.value;
      saveState();
      if (field === "status") render();
    }
  }

  if (target.dataset.action === "aws-field") {
    const field = target.dataset.field;
    student.aws[field] = target.value;
    saveState();
    render();
  }
});

document.getElementById("appContent").addEventListener("input", event => {
  const target = event.target.closest("[data-action]");
  if (!target) return;
  const student = activeStudent();
  if (!student) return;
  if (target.dataset.action === "qualification-field" && ["instructor", "notes"].includes(target.dataset.field)) {
    student.qualifications[target.dataset.qualificationId][target.dataset.field] = target.value;
    saveState();
  }
  if (target.dataset.action === "aws-field" && ["candidateId", "adminNotes"].includes(target.dataset.field)) {
    student.aws[target.dataset.field] = target.value;
    saveState();
  }
});

render();
