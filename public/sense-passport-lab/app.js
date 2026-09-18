const STORAGE_KEY = "awsSenseTowerLab.v2";

const MODULES = [
  {id:"m1",name:"Occupational Orientation",category:"foundation",competencies:[
    "Prepares time/job records","Performs housekeeping duties","Follows verbal instructions","Follows written instructions"
  ]},
  {id:"m2",name:"Safety and Health of Welders",category:"compulsory",competencies:[
    "Uses and inspects PPE","Uses safe work-area practices","Uses ventilation equipment","Demonstrates Hot Zone operation",
    "Works safely in confined spaces","Uses precautionary labels and SDS information","Inspects equipment for welding/cutting processes"
  ]},
  {id:"m3",name:"Drawing and Welding Symbol Interpretation",category:"compulsory",competencies:[
    "Interprets basic drawing/sketch elements","Interprets welding symbols","Fabricates from a drawing/sketch"
  ]},
  {id:"m4",name:"Shielded Metal Arc Welding (SMAW)",category:"process",competencies:[
    "Performs SMAW equipment safety inspection","Makes minor external repairs","Sets up SMAW on carbon steel",
    "Operates SMAW on carbon steel","Makes fillet welds in all positions","Makes groove welds in all positions",
    "Completes required SMAW performance qualification tests"
  ]},
  {id:"m5",name:"Gas Metal Arc Welding (GMAW)",category:"process",competencies:[
    "Performs GMAW equipment safety inspection","Makes minor external repairs","Sets up GMAW-S on carbon steel",
    "Operates GMAW-S on carbon steel","Makes fillet welds in all positions","Makes groove welds in all positions",
    "Completes GMAW-S workmanship qualification","Sets up GMAW spray","Operates GMAW spray",
    "Makes GMAW spray fillet welds in 1F/2F","Makes GMAW spray groove welds in 1G","Completes GMAW spray workmanship qualification"
  ]},
  {id:"m6",name:"Flux Cored Arc Welding (FCAW)",category:"process",competencies:[
    "Performs FCAW equipment safety inspection","Makes minor external repairs","Sets up FCAW-G","Operates FCAW-G",
    "Makes fillet welds in all positions","Makes groove welds in all positions","Completes FCAW-G workmanship qualification",
    "Sets up FCAW-S","Operates FCAW-S","Completes FCAW-S workmanship qualification"
  ]},
  {id:"m7",name:"Gas Tungsten Arc Welding (GTAW)",category:"process",competencies:[
    "Performs GTAW equipment safety inspection","Makes minor external repairs","Sets up GTAW on carbon steel",
    "Operates GTAW on carbon steel","Makes fillet welds in all positions","Makes groove welds in all positions",
    "Completes GTAW carbon-steel workmanship qualification","Performs GTAW on stainless steel",
    "Completes GTAW stainless workmanship qualification","Performs GTAW on aluminum","Completes GTAW aluminum workmanship qualification"
  ]},
  {id:"m8",name:"Thermal Cutting Processes",category:"compulsory",competencies:[
    "Manual oxyfuel gas cutting (OFC)","Mechanized oxyfuel cutting (optional hands-on)",
    "Manual plasma arc cutting (PAC)","Manual air carbon arc cutting (optional hands-on)"
  ]},
  {id:"m9",name:"Welding Inspection and Testing",category:"compulsory",competencies:[
    "Examines cut surfaces and prepared edges","Examines tacks, root passes, intermediate layers, and completed welds"
  ]}
];

const EXAMS = {
  m2:{label:"Safety and Health of Welders",pass:100},
  m3:{label:"Drawing and Welding Symbol Interpretation",pass:75},
  m4:{label:"SMAW",pass:75},
  m5:{label:"GMAW",pass:75},
  m6:{label:"FCAW",pass:75},
  m7:{label:"GTAW",pass:75},
  m8:{label:"Thermal Cutting Processes",pass:75},
  m9:{label:"Welding Inspection and Testing",pass:75}
};

const AWS_QUALIFICATIONS = [
  {id:"q1",moduleId:"m5",name:"Test 1 — GMAW-S",detail:"Workmanship qualification",swps:"B2.1-1-004"},
  {id:"q2",moduleId:"m5",name:"Test 2 — GMAW Spray",detail:"Workmanship qualification",swps:"B2.1-1-235"},
  {id:"q3",moduleId:"m6",name:"Test 3 — FCAW-G",detail:"Workmanship qualification",swps:"B2.1-1-019 / B2.1-1-020"},
  {id:"q4",moduleId:"m6",name:"Test 4 — FCAW-S",detail:"Workmanship qualification",swps:"B2.1-1-027 / B2.1-1-018"},
  {id:"q5",moduleId:"m7",name:"Test 5 — GTAW Carbon Steel",detail:"Workmanship qualification",swps:"B2.1-1-008"},
  {id:"q6",moduleId:"m7",name:"Test 6 — GTAW Stainless",detail:"Workmanship qualification",swps:"B2.1-8-009"},
  {id:"q7",moduleId:"m7",name:"Test 7 — GTAW Aluminum",detail:"Workmanship qualification",swps:"B2.1-22-015"},
  {id:"q8",moduleId:"m4",name:"Test 8 — SMAW 2G",detail:"Welder performance qualification",swps:"B2.1-1-016"},
  {id:"q9",moduleId:"m4",name:"Test 9 — SMAW 3G uphill",detail:"Welder performance qualification",swps:"B2.1-1-016"}
];

const STATUS_OPTIONS = ["Not Started","Introduced","Practicing","Competent","Verified"];

const LEVEL1_PROCESS_RULES = [
  {id:"smaw",label:"SMAW",material:"Carbon Steel",fillet:["1F","2F","3F","4F"],groove:["1G","2G","3G","4G"]},
  {id:"gmaw-s",label:"GMAW-S",material:"Carbon Steel",fillet:["1F","2F","3F","4F"],groove:["1G","2G","3G","4G"]},
  {id:"gmaw-spray",label:"GMAW Spray",material:"Carbon Steel",fillet:["1F","2F"],groove:["1G"]},
  {id:"fcaw-g",label:"FCAW-G",material:"Carbon Steel",fillet:["1F","2F","3F","4F"],groove:["1G","2G","3G","4G"]},
  {id:"fcaw-s",label:"FCAW-S",material:"Carbon Steel",fillet:["1F","2F","3F","4F"],groove:["1G","2G","3G","4G"]},
  {id:"gtaw-carbon",label:"GTAW",material:"Carbon Steel",fillet:["1F","2F","3F","4F"],groove:["1G","2G","3G","4G"]},
  {id:"gtaw-stainless",label:"GTAW",material:"Stainless Steel",fillet:["1F","2F","3F"],groove:["1G","2G","3G","4G"]},
  {id:"gtaw-aluminum",label:"GTAW",material:"Aluminum",fillet:["1F","2F"],groove:["1G"]}
];

function projectId(rule, family, position, backing=""){
  return [rule.id,family,backing,position].filter(Boolean).join("-");
}

function buildLevel1WeldingProjects(){
  const out=[];
  LEVEL1_PROCESS_RULES.forEach(rule=>{
    rule.fillet.forEach(position=>out.push({
      id:projectId(rule,"fillet",position),
      processId:rule.id,process:rule.label,material:rule.material,
      family:"Fillet",backing:"N/A",position,
      name:`${rule.label} ${rule.material} ${position} Fillet Weld`,
      electrode: rule.id==="smaw" ? '1/8" electrode' : "",
      type:"position"
    }));
    ["Backing","No Backing"].forEach(backing=>{
      rule.groove.forEach(position=>out.push({
        id:projectId(rule,"groove",position,backing==="Backing"?"backing":"no-backing"),
        processId:rule.id,process:rule.label,material:rule.material,
        family:"Groove",backing,position,
        name:`${rule.label} ${rule.material} ${position} Groove — ${backing}`,
        electrode: rule.id==="smaw" ? '1/8" electrode' : "",
        type:"position"
      }));
    });
  });
  return out;
}

const LEVEL1_WELDING_PROJECTS = buildLevel1WeldingProjects();

const CUTTING_PROJECTS = [
  {id:"ofc-straight-square",processId:"ofc",process:"OFC",material:"Carbon Steel",family:"Cutting",backing:"N/A",position:"Flat / Horizontal",name:"OFC Straight Square-Edge Cutting",rubricType:"pending"},
  {id:"ofc-shape-square",processId:"ofc",process:"OFC",material:"Carbon Steel",family:"Cutting",backing:"N/A",position:"Flat / Horizontal",name:"OFC Shape Square-Edge Cutting",rubricType:"pending"},
  {id:"ofc-straight-bevel",processId:"ofc",process:"OFC",material:"Carbon Steel",family:"Cutting",backing:"N/A",position:"Flat / Horizontal",name:"OFC Straight Bevel-Edge Cutting",rubricType:"pending"},
  {id:"ofc-scarf-gouge",processId:"ofc",process:"OFC",material:"Carbon Steel",family:"Cutting",backing:"N/A",position:"Flat / Horizontal",name:"OFC Scarfing / Gouging",rubricType:"pending"},
  {id:"pac-straight-square",processId:"pac",process:"PAC",material:"Carbon / Stainless / Aluminum",family:"Cutting",backing:"N/A",position:"Flat / Horizontal",name:"PAC Straight Square-Edge Cutting",rubricType:"pending"},
  {id:"pac-shape-square",processId:"pac",process:"PAC",material:"Carbon / Stainless / Aluminum",family:"Cutting",backing:"N/A",position:"Flat / Horizontal",name:"PAC Shape Square-Edge Cutting",rubricType:"pending"},
  {id:"caca-scarf-gouge",processId:"cac-a",process:"CAC-A",material:"Carbon Steel",family:"Cutting",backing:"N/A",position:"Flat / Horizontal",name:"CAC-A Scarfing / Gouging",rubricType:"pending"}
];

const POSITION_QUALIFICATIONS = LEVEL1_WELDING_PROJECTS.map(project=>({
  id:"pq-"+project.id,
  projectId:project.id,
  processId:project.processId,
  process:project.process,
  material:project.material,
  family:project.family,
  backing:project.backing,
  position:project.position,
  name:project.name
}));

const RUBRIC = [
  {id:"consistency",name:"Consistency",help:"Straightness, even width, even profile",choices:[
    [20,"Excellent"],[18,"Minor variation"],[16,"Noticeable"],[14,"Poor"],[10,"Major"]
  ]},
  {id:"defects",name:"Weld Defects",help:"Visible discontinuities and overall soundness",choices:[
    [20,"None"],[18,"Minor"],[16,"Several"],[14,"Major"],[10,"Severe"]
  ]},
  {id:"procedure",name:"Following Procedure",help:"Setup, settings, cleaning, cooling, sequence, safe work",choices:[
    [20,"Independent"],[18,"Minor help"],[16,"Some help"],[14,"Repeated help"],[10,"Major issue"]
  ]},
  {id:"restarts",name:"Restarts",help:"Crater treatment, tie-in and bead continuity",choices:[
    [20,"Seamless"],[18,"Good"],[16,"Noticeable"],[14,"Poor"],[10,"Major"]
  ]},
  {id:"beadSize",name:"Bead Size",help:'1/8" rod: 3/16" min · 1/4" target · 3/8" max',choices:[
    [20,'1/4" target'],[18,"Near target"],[16,"Acceptable"],[14,"At limit"],[10,"Outside range"]
  ]}
];

const DEFECT_TAGS = [
  {id:"crack",label:"Crack",critical:true},
  {id:"lackFusion",label:"Lack of Fusion",critical:true},
  {id:"undercut",label:"Undercut"},
  {id:"porosity",label:"Porosity"},
  {id:"overlap",label:"Overlap"},
  {id:"slag",label:"Slag Inclusion"}
];

const COMMENT_TAGS = [
  "Watch travel speed","Shorten arc","Improve work angle","Bead too wide","Bead too narrow",
  "Restart needs work","Clean between passes","Good improvement"
];

const DEFAULT_ASSIGNMENTS = [
  ...LEVEL1_WELDING_PROJECTS.map(project=>({...project,rubricType:"weld"})),
  ...CUTTING_PROJECTS
];

function uid(prefix="id"){
  if (crypto.randomUUID) return crypto.randomUUID();
  return prefix+"-"+Date.now()+"-"+Math.random().toString(16).slice(2);
}

function newAttempt(){
  return {scores:{},defects:[],comments:[],notes:"",startedAt:new Date().toISOString(),completedAt:""};
}

function blankStudent(name,studentId){
  const competencies={};
  MODULES.forEach(m=>competencies[m.id]=m.competencies.map((label,i)=>({id:m.id+"-c"+(i+1),label,status:"Not Started",date:""})));
  const exams={};
  Object.keys(EXAMS).forEach(id=>exams[id]={attempts:[],retrainingConfirmed:false});
  const qualifications={};
  AWS_QUALIFICATIONS.forEach(q=>qualifications[q.id]={status:"Not Started",date:"",notes:""});
  const positionQualifications={};
  POSITION_QUALIFICATIONS.forEach(q=>positionQualifications[q.id]={status:"Not Started",date:"",notes:""});
  return {
    id:uid("student"),name,studentId,email:"",cohort:"Level 1 Test Cohort",
    aws:{registrationStatus:"Not registered",candidateId:"",enrollmentDate:"",submissionStatus:"Not submitted"},
    competencies,exams,qualifications,positionQualifications,lab:{}
  };
}

function makeDemoState(){
  const names=["Demo Student A","Demo Student B","Demo Student C","Demo Student D","Demo Student E","Demo Student F","Demo Student G","Demo Student H"];
  const students=names.map((n,i)=>blankStudent(n,"TEST-"+String(i+1).padStart(3,"0")));
  students[0].aws.registrationStatus="Registered";
  students[0].exams.m2.attempts=[{score:100,date:"2026-09-10"}];
  students[0].competencies.m4[4].status="Practicing";
  students[1].competencies.m4[4].status="Introduced";
  return {
    schemaVersion:3,
    program:{name:"PCCC Welding — AWS SENSE Level I Tower Lab",standardBasis:"AWS QC10:2017 / AWS EG2.0:2017 / Supplement"},
    assignments:JSON.parse(JSON.stringify(DEFAULT_ASSIGNMENTS)),
    students,
    activeStudentId:students[0].id,
    ui:{view:"home",labAssignmentId:"smaw-fillet-3F",labIndex:0,labAttempt:"attempt1",moduleId:"m4",competencyIndex:4,competencyIndexStudent:0,examModuleId:"m2",examStudentIndex:0,qualificationProcessId:"smaw",qualificationFamily:"Groove",qualificationBacking:"Backing",qualificationPosition:"1G",qualificationStudentIndex:0}
  };
}

function loadState(){
  try{
    const raw=localStorage.getItem(STORAGE_KEY);
    if(!raw) return makeDemoState();
    const parsed=JSON.parse(raw);
    if(parsed?.schemaVersion!==3 || !Array.isArray(parsed.students)) return makeDemoState();
    return parsed;
  }catch{return makeDemoState();}
}
let state=loadState();

function saveState(){
  localStorage.setItem(STORAGE_KEY,JSON.stringify(state));
  renderStudentSelect();
}

function escapeHtml(v=""){
  return String(v).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
}
function activeStudent(){return state.students.find(s=>s.id===state.activeStudentId)||state.students[0]||null;}
function studentAt(i){return state.students[Math.max(0,Math.min(i,state.students.length-1))]||null;}
function moduleById(id){return MODULES.find(m=>m.id===id);}
function assignmentById(id){return state.assignments.find(a=>a.id===id);}
function qualificationById(id){return AWS_QUALIFICATIONS.find(q=>q.id===id);}
function qualificationRulesForProcess(processId){
  return LEVEL1_PROCESS_RULES.find(r=>r.id===processId)||LEVEL1_PROCESS_RULES[0];
}
function selectedPositionQualification(){
  const processId=state.ui.qualificationProcessId||LEVEL1_PROCESS_RULES[0].id;
  const family=state.ui.qualificationFamily||"Groove";
  const backing=family==="Groove"?(state.ui.qualificationBacking||"Backing"):"N/A";
  const rule=qualificationRulesForProcess(processId);
  const allowed=family==="Groove"?rule.groove:rule.fillet;
  const position=allowed.includes(state.ui.qualificationPosition)?state.ui.qualificationPosition:allowed[0];
  state.ui.qualificationPosition=position;
  return POSITION_QUALIFICATIONS.find(q=>q.processId===processId&&q.family===family&&q.backing===backing&&q.position===position);
}
function projectGroupKey(a){return [a.processId||a.process,a.material,a.family,a.backing].join("|");}
function tone(status){
  if(["Verified","Pass","Registered","Complete"].includes(status)) return "green";
  if(["Competent","Attempt 2"].includes(status)) return "blue";
  if(["Practicing","Introduced","In progress","Retest"].includes(status)) return "yellow";
  if(["Fail","F","Blocked"].includes(status)) return "red";
  return "gray";
}
function badge(label,t="gray"){return '<span class="badge '+t+'">'+escapeHtml(label)+'</span>';}

function ensureLabRecord(student,assignmentId){
  if(!student.lab[assignmentId]) student.lab[assignmentId]={attempt1:newAttempt(),attempt2:null};
  return student.lab[assignmentId];
}
function hasCritical(attempt){return !!attempt && attempt.defects.some(id=>id==="crack"||id==="lackFusion");}
function attemptComplete(attempt){return !!attempt && RUBRIC.every(c=>Number.isFinite(Number(attempt.scores[c.id])));}
function recalcAttempt(attempt){
  if(!attempt) return;
  if(attemptComplete(attempt) && !attempt.completedAt) attempt.completedAt=new Date().toISOString();
}
function rawScore(attempt){
  if(!attempt) return null;
  const values=RUBRIC.map(c=>Number(attempt.scores[c.id]));
  if(values.some(v=>!Number.isFinite(v))) return null;
  return values.reduce((a,b)=>a+b,0);
}
function adjustedScore(attempt){
  const raw=rawScore(attempt);
  return raw===null?null:Math.round(raw*0.95*10)/10;
}
function officialLabResult(student,assignmentId){
  const rec=ensureLabRecord(student,assignmentId);
  if(rec.attempt2 && attemptComplete(rec.attempt2)){
    return {attempt:2,display:adjustedScore(rec.attempt2).toFixed(1)+"%",numeric:adjustedScore(rec.attempt2),status:"Complete"};
  }
  if(attemptComplete(rec.attempt1)){
    if(hasCritical(rec.attempt1)) return {attempt:1,display:"F",numeric:null,status:"Retest"};
    return {attempt:1,display:adjustedScore(rec.attempt1).toFixed(1)+"%",numeric:adjustedScore(rec.attempt1),status:"Complete"};
  }
  if(hasCritical(rec.attempt1)) return {attempt:1,display:"F*",numeric:null,status:"In progress"};
  return {attempt:1,display:"—",numeric:null,status:"In progress"};
}
function labProgress(assignmentId){
  let done=0;
  state.students.forEach(s=>{
    const rec=ensureLabRecord(s,assignmentId);
    if((rec.attempt2&&attemptComplete(rec.attempt2))||attemptComplete(rec.attempt1)) done++;
  });
  return done;
}

function examPassed(student,moduleId){
  const rule=EXAMS[moduleId]; if(!rule) return true;
  return student.exams[moduleId].attempts.some(a=>Number(a.score)>=rule.pass);
}
function qualificationPassed(student,moduleId){
  const qs=AWS_QUALIFICATIONS.filter(q=>q.moduleId===moduleId);
  return !qs.length || qs.every(q=>student.qualifications[q.id].status==="Pass");
}
function requiredCompetencies(student,moduleId){
  const list=student.competencies[moduleId]||[];
  if(moduleId!=="m8") return list;
  return list.filter(c=>!c.label.includes("optional hands-on"));
}
function competenciesVerified(student,moduleId){
  const list=requiredCompetencies(student,moduleId);
  return list.length>0 && list.every(c=>c.status==="Verified");
}
function moduleComplete(student,moduleId){
  return competenciesVerified(student,moduleId)&&examPassed(student,moduleId)&&qualificationPassed(student,moduleId);
}
function moduleProgress(student,moduleId){
  const weights={"Not Started":0,"Introduced":.25,"Practicing":.5,"Competent":.75,"Verified":1};
  const comps=requiredCompetencies(student,moduleId);
  const comp=comps.length?comps.reduce((n,c)=>n+(weights[c.status]||0),0)/comps.length:0;
  const pieces=[comp];
  if(EXAMS[moduleId]) pieces.push(examPassed(student,moduleId)?1:0);
  if(AWS_QUALIFICATIONS.some(q=>q.moduleId===moduleId)) pieces.push(qualificationPassed(student,moduleId)?1:0);
  return Math.round(pieces.reduce((a,b)=>a+b,0)/pieces.length*100);
}
function credentialSummary(student){
  const compulsory=["m2","m3","m8","m9"],processes=["m4","m5","m6","m7"];
  const compulsoryDone=compulsory.filter(id=>moduleComplete(student,id)).length;
  const processDone=processes.filter(id=>moduleComplete(student,id)).length;
  return {partial:compulsoryDone===4&&processDone>=1,full:compulsoryDone===4&&processDone===4,compulsoryDone,processDone};
}

function setView(view){
  state.ui.view=view;
  document.querySelectorAll(".nav-btn").forEach(b=>b.classList.toggle("active",b.dataset.view===view));
  render();
}
function renderStudentSelect(){
  const el=document.getElementById("activeStudentSelect");
  if(!el) return;
  el.innerHTML=state.students.map(s=>'<option value="'+escapeHtml(s.id)+'" '+(s.id===state.activeStudentId?"selected":"")+'>'+escapeHtml(s.name)+" · "+escapeHtml(s.studentId)+"</option>").join("");
}
function viewTitle(){
  return {home:"Tower Home",lab:"Lab Grade Tower",competencies:"SENSE Competency Tower",exams:"Knowledge Exam Tower",qualifications:"Performance Qualification Tower",passport:"Student Passport",admin:"Admin / AWS Readiness"}[state.ui.view]||"AWS SENSE Tower";
}

function renderHome(){
  const labGrades=state.students.reduce((n,s)=>n+state.assignments.filter(a=>officialLabResult(s,a.id).display!=="—").length,0);
  const verified=state.students.reduce((n,s)=>n+MODULES.reduce((x,m)=>x+(s.competencies[m.id]||[]).filter(c=>c.status==="Verified").length,0),0);
  const partial=state.students.filter(s=>credentialSummary(s).partial).length;
  return '<div class="grid cols-4">'+
    '<div class="card"><div class="stat">'+state.students.length+'</div><div class="stat-label">Test students</div></div>'+
    '<div class="card"><div class="stat">'+labGrades+'</div><div class="stat-label">Official lab grades recorded</div></div>'+
    '<div class="card"><div class="stat">'+verified+'</div><div class="stat-label">Verified SENSE competencies</div></div>'+
    '<div class="card"><div class="stat">'+partial+'</div><div class="stat-label">Partial-completion eligible</div></div>'+
  '</div>'+
  '<div class="section-head"><div><h3>One tower, one instructor pattern</h3><div class="muted small">Choose the thing once, work student-to-student, tap the result, move on.</div></div></div>'+
  '<div class="grid cols-3">'+
    towerCard("Lab Grade Tower","Five taps for a normal weld. Attempt logic, critical defects, math and replacement rules happen automatically.","lab","Grade welds")+
    towerCard("Competency Tower","Choose one AWS competency, then move down the class with the same fast queue.","competencies","Verify competencies")+
    towerCard("Knowledge Exam Tower","Choose one exam, enter the result, move to the next student. Attempt limits stay underneath.","exams","Enter exam results")+
    towerCard("Qualification Tower","Choose one SENSE performance test and mark each student Pass/Fail without reopening forms.","qualifications","Record qualifications")+
    towerCard("Student Passport","See academic lab evidence and SENSE evidence together without mixing the two records.","passport","Open passport")+
    towerCard("Admin / Readiness","AWS registration fields, test assignments and prototype controls live away from the daily instructor workflow.","admin","Open admin")+
  '</div>'+
  '<div class="card" style="margin-top:14px"><div class="alert blue"><strong>Design boundary:</strong> Lab grades are PCCC academic records. AWS SENSE competency and qualification evidence remain separate records, even when the same weld supports both.</div></div>';
}
function towerCard(title,body,view,button){
  return '<div class="card tower-card"><h3>'+title+'</h3><p>'+body+'</p><div class="tower-actions"><button class="primary-btn" data-go="'+view+'">'+button+'</button></div></div>';
}

function renderLab(){
  if(!state.students.length) return '<div class="card">No test students.</div>';
  const assignment=assignmentById(state.ui.labAssignmentId)||state.assignments[0];
  state.ui.labAssignmentId=assignment.id;
  state.ui.labIndex=Math.max(0,Math.min(state.ui.labIndex,state.students.length-1));
  const student=studentAt(state.ui.labIndex);
  state.activeStudentId=student.id;
  const rec=ensureLabRecord(student,assignment.id);
  let attemptKey=state.ui.labAttempt==="attempt2"&&rec.attempt2?"attempt2":"attempt1";
  state.ui.labAttempt=attemptKey;
  const attempt=rec[attemptKey];
  const attemptNumber=attemptKey==="attempt2"?2:1;
  const official=officialLabResult(student,assignment.id);
  const done=labProgress(assignment.id);
  const pct=Math.round(done/state.students.length*100);
  const critical=hasCritical(attempt);
  const raw=rawScore(attempt),adjusted=adjustedScore(attempt);

  return '<div class="card">'+
    '<div class="queue-toolbar"><label>Grade one assignment for the whole class<select id="labAssignmentSelect">'+
      LEVEL1_PROCESS_RULES.map(rule=>{
        const items=state.assignments.filter(a=>a.rubricType==="weld"&&a.processId===rule.id);
        return '<optgroup label="'+escapeHtml(rule.label+" · "+rule.material)+'">'+items.map(a=>'<option value="'+a.id+'" '+(a.id===assignment.id?"selected":"")+'>'+escapeHtml(a.family+(a.family==="Groove"?" · "+a.backing:"")+" · "+a.position)+'</option>').join("")+'</optgroup>';
      }).join("")+
    '</select></label><div class="muted small">'+escapeHtml(assignment.process)+" · "+escapeHtml(assignment.position)+" · "+escapeHtml(assignment.electrode)+'</div></div>'+
    '<div class="queue-status"><div style="flex:1"><div class="small muted">'+done+' of '+state.students.length+' students graded</div><div class="progress-track"><div class="progress-fill" style="width:'+pct+'%"></div></div></div>'+
    '<div class="queue-nav"><button class="secondary-btn" data-lab-nav="-1">← Previous</button><button class="primary-btn" data-lab-nav="1">Next student →</button></div></div>'+
  '</div>'+
  '<div class="card">'+
    '<div class="student-banner"><div><div class="eyebrow">Student '+(state.ui.labIndex+1)+' of '+state.students.length+'</div><h3>'+escapeHtml(student.name)+'</h3><div class="student-meta">'+escapeHtml(student.studentId)+' · '+escapeHtml(assignment.name)+'</div></div>'+
      '<div class="official-grade"><div class="label">Official grade</div><div class="grade">'+official.display+'</div><div>'+badge(official.attempt===2?"Attempt 2":"Attempt 1",official.attempt===2?"blue":"gray")+' '+badge(official.status,tone(official.status))+'</div></div></div>'+
    '<div class="attempt-tabs"><button class="attempt-tab '+(attemptKey==="attempt1"?"active":"")+'" data-attempt="attempt1">Attempt 1</button>'+
      (rec.attempt2?'<button class="attempt-tab '+(attemptKey==="attempt2"?"active":"")+'" data-attempt="attempt2">Attempt 2</button>':
      '<button class="attempt-tab '+(!attemptComplete(rec.attempt1)?"locked":"")+'" '+(!attemptComplete(rec.attempt1)?"disabled":"data-start-attempt2")+'>'+(attemptComplete(rec.attempt1)?"Start Attempt 2":"Attempt 2 unlocks after Attempt 1")+'</button>')+
    '</div>'+
    (attemptNumber===1&&critical?'<div class="alert red"><strong>Critical defect:</strong> Attempt 1 is automatically F. Finish the rubric for feedback; then Attempt 2 becomes available.</div>':"")+
    (attemptNumber===2&&critical?'<div class="alert red"><strong>Attempt 2 critical-defect rule:</strong> Weld Defects is automatically 0/20. The other four criteria still count.</div>':"")+
    '<div class="rubric-grid">'+RUBRIC.map(c=>renderRubricRow(c,attempt,attemptNumber,critical)).join("")+'</div>'+
    '<div class="tag-area"><div class="small muted"><strong>Visible defects</strong> · tap only what you see</div><div class="tag-row">'+DEFECT_TAGS.map(t=>'<button class="tag-btn '+(t.critical?"critical ":"")+(attempt.defects.includes(t.id)?"selected":"")+'" data-defect="'+t.id+'">'+escapeHtml(t.label)+'</button>').join("")+'</div></div>'+
    '<div class="tag-area"><div class="small muted"><strong>Quick feedback</strong> · optional</div><div class="tag-row">'+COMMENT_TAGS.map(t=>'<button class="tag-btn '+(attempt.comments.includes(t)?"selected":"")+'" data-comment="'+escapeHtml(t)+'">'+escapeHtml(t)+'</button>').join("")+'</div></div>'+
    '<div class="grade-summary"><div class="raw"><span>Raw rubric</span><strong>'+(raw===null?"—":raw+"/100")+'</strong></div><div class="final"><span>Adjusted grade</span><strong>'+(adjusted===null?"—":adjusted.toFixed(1)+"%")+'</strong></div></div>'+
    '<div class="alert"><strong>No Save button.</strong> Every tap auto-saves. A completed Attempt 2 automatically replaces Attempt 1 as the official grade.</div>'+
  '</div>'+
  renderGradebookOverview(assignment.id);
}

function renderRubricRow(c,attempt,attemptNumber,critical){
  const forced=c.id==="defects"&&attemptNumber===2&&critical;
  const current=attempt.scores[c.id];
  return '<div class="rubric-row"><div><div class="criterion-title">'+c.name+'</div><div class="criterion-help">'+c.help+'</div></div>'+
    '<div class="score-choices">'+(forced?
      '<button class="score-btn forced" disabled><strong>0</strong><span>Critical defect</span></button>':
      c.choices.map(([score,label])=>'<button class="score-btn '+(Number(current)===score?"selected":"")+'" data-score-criterion="'+c.id+'" data-score="'+score+'"><strong>'+score+'</strong><span>'+escapeHtml(label)+'</span></button>').join("")
    )+'</div><div class="criterion-score">'+(forced?"0/20":Number.isFinite(Number(current))?current+"/20":"—")+'</div></div>';
}

function renderGradebookOverview(selectedAssignmentId){
  const selected=assignmentById(selectedAssignmentId);
  const siblings=selected?state.assignments.filter(a=>a.rubricType==="weld"&&projectGroupKey(a)===projectGroupKey(selected)):state.assignments.filter(a=>a.rubricType==="weld").slice(0,4);
  const title=selected?`${selected.process} ${selected.material} · ${selected.family}${selected.family==="Groove"?" · "+selected.backing:""}`:"Current project group";
  return '<div class="card"><div class="section-head"><div><h3>Class gradebook overview</h3><div class="muted small">'+escapeHtml(title)+' · only the current project group is shown so the gradebook stays usable.</div></div></div>'+
  '<div class="table-wrap"><table><thead><tr><th>Student</th>'+siblings.map(a=>'<th>'+escapeHtml(a.position||a.name)+'</th>').join("")+'</tr></thead><tbody>'+
  state.students.map((s,si)=>'<tr><td><strong>'+escapeHtml(s.name)+'</strong><div class="muted tiny">'+escapeHtml(s.studentId)+'</div></td>'+
    siblings.map(a=>{const r=officialLabResult(s,a.id);return '<td class="clickable" data-open-grade="'+si+'|'+a.id+'">'+(r.display==="—"?badge("Needs grading","gray"):badge((r.attempt===2?"A2 ":"")+r.display,r.status==="Retest"?"red":r.attempt===2?"blue":"green"))+'</td>';}).join("")+
  '</tr>').join("")+'</tbody></table></div></div>';
}

function renderCompetencies(){
  const module=moduleById(state.ui.moduleId)||MODULES[3];
  state.ui.moduleId=module.id;
  state.ui.competencyIndex=Math.max(0,Math.min(state.ui.competencyIndex,module.competencies.length-1));
  state.ui.competencyIndexStudent=Math.max(0,Math.min(state.ui.competencyIndexStudent,state.students.length-1));
  const student=studentAt(state.ui.competencyIndexStudent);
  state.activeStudentId=student.id;
  const item=student.competencies[module.id][state.ui.competencyIndex];
  const verified=state.students.filter(s=>s.competencies[module.id][state.ui.competencyIndex]?.status==="Verified").length;
  return '<div class="card"><div class="queue-toolbar">'+
    '<label>Module<select id="moduleSelect">'+MODULES.map(m=>'<option value="'+m.id+'" '+(m.id===module.id?"selected":"")+'>'+escapeHtml(m.name)+'</option>').join("")+'</select></label>'+
    '<label>Competency<select id="competencySelect">'+module.competencies.map((c,i)=>'<option value="'+i+'" '+(i===state.ui.competencyIndex?"selected":"")+'>'+escapeHtml(c)+'</option>').join("")+'</select></label>'+
    '</div><div class="queue-status"><div style="flex:1"><div class="small muted">'+verified+' of '+state.students.length+' Verified</div><div class="progress-track"><div class="progress-fill" style="width:'+Math.round(verified/state.students.length*100)+'%"></div></div></div>'+
    '<div class="queue-nav"><button class="secondary-btn" data-competency-nav="-1">← Previous</button><button class="primary-btn" data-competency-nav="1">Next student →</button></div></div></div>'+
    '<div class="card"><div class="student-banner"><div><div class="eyebrow">Student '+(state.ui.competencyIndexStudent+1)+' of '+state.students.length+'</div><h3>'+escapeHtml(student.name)+'</h3><div class="student-meta">'+escapeHtml(item.label)+'</div></div><div>'+badge(item.status,tone(item.status))+'</div></div>'+
    '<div class="section-head"><div><h3>Tap the current level</h3><div class="muted small">Same pattern as lab grading: one item selected, student-to-student, auto-save.</div></div></div>'+
    '<div class="status-row">'+STATUS_OPTIONS.map(s=>'<button class="status-btn '+(s==="Verified"?"verify ":"")+(item.status===s?"selected":"")+'" data-competency-status="'+s+'">'+s+'</button>').join("")+'</div>'+
    '<div class="alert blue"><strong>Verified</strong> remains a deliberate instructor action. Academic lab grades do not automatically create AWS verification.</div></div>';
}

function renderExams(){
  const moduleId=EXAMS[state.ui.examModuleId]?state.ui.examModuleId:"m2";
  state.ui.examModuleId=moduleId;
  state.ui.examStudentIndex=Math.max(0,Math.min(state.ui.examStudentIndex,state.students.length-1));
  const student=studentAt(state.ui.examStudentIndex); state.activeStudentId=student.id;
  const exam=student.exams[moduleId],rule=EXAMS[moduleId],passed=examPassed(student,moduleId);
  return '<div class="card"><div class="queue-toolbar"><label>Exam<select id="examSelect">'+Object.entries(EXAMS).map(([id,e])=>'<option value="'+id+'" '+(id===moduleId?"selected":"")+'>'+escapeHtml(e.label)+'</option>').join("")+'</select></label><div class="muted small">Pass mark: '+rule.pass+'%</div></div>'+
    '<div class="queue-status"><div></div><div class="queue-nav"><button class="secondary-btn" data-exam-nav="-1">← Previous</button><button class="primary-btn" data-exam-nav="1">Next student →</button></div></div></div>'+
    '<div class="card"><div class="student-banner"><div><div class="eyebrow">Student '+(state.ui.examStudentIndex+1)+' of '+state.students.length+'</div><h3>'+escapeHtml(student.name)+'</h3><div class="student-meta">'+escapeHtml(rule.label)+'</div></div><div>'+badge(passed?"Pass":exam.attempts.length?"In progress":"Not Started",passed?"green":exam.attempts.length?"yellow":"gray")+'</div></div>'+
    '<div class="section-head"><div><h3>Attempts</h3><div class="muted small">Maximum three. Retraining is required before Attempt 3 after two failed attempts.</div></div></div>'+
    '<div class="status-row">'+(exam.attempts.length?exam.attempts.map((a,i)=>badge("Attempt "+(i+1)+": "+a.score+"%",Number(a.score)>=rule.pass?"green":"red")).join(""):badge("No attempts","gray"))+'</div>'+
    (!passed&&exam.attempts.length<3?
      '<div class="queue-toolbar" style="margin-top:14px"><label>Score<input id="examScoreInput" type="number" min="0" max="100" placeholder="0–100" /></label>'+
      (exam.attempts.length>=2?'<label style="display:flex;align-items:center;gap:7px;margin-top:18px"><input id="retrainingCheck" type="checkbox" '+(exam.retrainingConfirmed?"checked":"")+' style="width:auto" /> Retraining complete</label>':"")+
      '<button class="primary-btn" id="recordExamBtn" style="margin-top:18px">Record attempt</button></div>':
      '<div class="alert '+(passed?"blue":"red")+'">'+(passed?"Exam passed. No additional attempt is needed.":"Three attempts are already recorded.")+'</div>')+
    '</div>';
}

function renderQualifications(){
  const rule=qualificationRulesForProcess(state.ui.qualificationProcessId||"smaw");
  state.ui.qualificationProcessId=rule.id;
  const family=state.ui.qualificationFamily==="Fillet"?"Fillet":"Groove";
  state.ui.qualificationFamily=family;
  const backing=family==="Groove"?(state.ui.qualificationBacking||"Backing"):"N/A";
  state.ui.qualificationBacking=backing;
  const positions=family==="Groove"?rule.groove:rule.fillet;
  if(!positions.includes(state.ui.qualificationPosition)) state.ui.qualificationPosition=positions[0];
  state.ui.qualificationStudentIndex=Math.max(0,Math.min(state.ui.qualificationStudentIndex,state.students.length-1));
  const q=selectedPositionQualification();
  const student=studentAt(state.ui.qualificationStudentIndex); state.activeStudentId=student.id;
  const rec=student.positionQualifications[q.id];
  const passed=state.students.filter(s=>s.positionQualifications[q.id]?.status==="Pass").length;
  const officialTests=AWS_QUALIFICATIONS.filter(x=>{
    if(rule.id==="smaw") return x.moduleId==="m4";
    if(rule.id.startsWith("gmaw")) return x.moduleId==="m5";
    if(rule.id.startsWith("fcaw")) return x.moduleId==="m6";
    if(rule.id.startsWith("gtaw")) return x.moduleId==="m7";
    return false;
  });

  return '<div class="card"><div class="section-head"><div><h3>Position Qualification Tower</h3><div class="muted small">PCCC position tracking. Groove welds are split into Backing and No Backing as separate qualification categories.</div></div></div>'+
    '<div class="queue-toolbar">'+
      '<label>Process / material<select id="qualificationProcessSelect">'+LEVEL1_PROCESS_RULES.map(x=>'<option value="'+x.id+'" '+(x.id===rule.id?"selected":"")+'>'+escapeHtml(x.label+" · "+x.material)+'</option>').join("")+'</select></label>'+
      '<label>Joint category<select id="qualificationFamilySelect"><option value="Fillet" '+(family==="Fillet"?"selected":"")+'>Fillet Welds</option><option value="Groove" '+(family==="Groove"?"selected":"")+'>Groove Welds</option></select></label>'+
      (family==="Groove"?'<label>Groove category<select id="qualificationBackingSelect"><option '+(backing==="Backing"?"selected":"")+'>Backing</option><option '+(backing==="No Backing"?"selected":"")+'>No Backing</option></select></label>':"")+
      '<label>Position<select id="qualificationPositionSelect">'+positions.map(p=>'<option '+(p===state.ui.qualificationPosition?"selected":"")+'>'+p+'</option>').join("")+'</select></label>'+
    '</div>'+
    '<div class="queue-status"><div style="flex:1"><div class="small muted">'+passed+' of '+state.students.length+' marked Pass · '+escapeHtml(q.name)+'</div><div class="progress-track"><div class="progress-fill" style="width:'+Math.round(passed/state.students.length*100)+'%"></div></div></div><div class="queue-nav"><button class="secondary-btn" data-qualification-nav="-1">← Previous</button><button class="primary-btn" data-qualification-nav="1">Next student →</button></div></div></div>'+
    '<div class="card"><div class="student-banner"><div><div class="eyebrow">Student '+(state.ui.qualificationStudentIndex+1)+' of '+state.students.length+'</div><h3>'+escapeHtml(student.name)+'</h3><div class="student-meta">'+escapeHtml(q.name)+'</div></div><div>'+badge(rec.status,tone(rec.status))+'</div></div>'+
    '<div class="section-head"><div><h3>Tap the result</h3><div class="muted small">This is position-level PCCC qualification readiness. It does not automatically mark an official AWS SENSE performance test Pass.</div></div></div>'+
    '<div class="status-row">'+["Not Started","Pass","Fail"].map(s=>'<button class="status-btn '+(s==="Pass"?"verify ":"")+(rec.status===s?"selected":"")+'" data-position-qualification-status="'+s+'">'+s+'</button>').join("")+'</div>'+
    '<div class="queue-toolbar" style="margin-top:14px"><label>Date<input id="positionQualificationDate" type="date" value="'+escapeHtml(rec.date||"")+'" /></label><label style="flex:1">Optional note<input id="positionQualificationNote" value="'+escapeHtml(rec.notes||"")+'" placeholder="Short note only if needed" /></label></div>'+
    '</div>'+
    '<div class="card"><div class="section-head"><div><h3>Official AWS SENSE tests for this process</h3><div class="muted small">Preserved separately from the PCCC position matrix.</div></div></div>'+
    (officialTests.length?'<div class="table-wrap"><table><thead><tr><th>AWS Test</th><th>SWPS</th><th>Active student status</th></tr></thead><tbody>'+officialTests.map(x=>'<tr><td>'+escapeHtml(x.name)+'</td><td>'+escapeHtml(x.swps)+'</td><td>'+badge(student.qualifications[x.id]?.status||"Not Started",tone(student.qualifications[x.id]?.status||"Not Started"))+'</td></tr>').join("")+'</tbody></table></div>':'<div class="muted small">No official test definition mapped in the supplied Level I test list for this process/material variation.</div>')+
    '</div>';
}

function renderPassport(){
  const student=activeStudent();
  if(!student) return '<div class="card">No test students.</div>';
  const sum=credentialSummary(student);
  return '<div class="card"><div class="student-banner"><div><div class="eyebrow">Student Passport</div><h3>'+escapeHtml(student.name)+'</h3><div class="student-meta">'+escapeHtml(student.studentId)+' · '+escapeHtml(student.cohort)+'</div></div><div>'+badge(sum.full?"Full completion eligible":sum.partial?"Partial completion eligible":"In progress",sum.full?"green":sum.partial?"blue":"yellow")+'</div></div></div>'+
    '<div class="grid cols-2" style="margin-top:14px"><div class="card"><h3>AWS SENSE progress</h3><div class="module-progress">'+MODULES.map(m=>{const p=moduleProgress(student,m.id);return '<div class="module-line"><span>'+escapeHtml(m.name)+'</span><div class="progress-track"><div class="progress-fill" style="width:'+p+'%"></div></div><b>'+p+'%</b></div>';}).join("")+'</div></div>'+
    '<div class="card"><h3>Academic lab grades</h3><div class="table-wrap"><table><thead><tr><th>Assignment</th><th>Official</th><th>Attempt</th></tr></thead><tbody>'+state.assignments.map(a=>{const r=officialLabResult(student,a.id);return '<tr><td>'+escapeHtml(a.name)+'</td><td>'+escapeHtml(r.display)+'</td><td>'+r.attempt+'</td></tr>';}).join("")+'</tbody></table></div></div></div>'+
    '<div class="card"><div class="alert blue"><strong>Important:</strong> The Passport shows both records together for convenience. It does not treat a PCCC academic grade as automatic AWS SENSE verification.</div></div>';
}

function renderAdmin(){
  const student=activeStudent();
  return '<div class="grid cols-2"><div class="card"><h3>Prototype assignment setup</h3><p class="muted small">Daily instructors should not configure this. Setup lives here so the grading screen stays clean.</p>'+
    '<button class="primary-btn" id="openAssignmentDialog">+ Add test assignment</button><div class="alert blue"><strong>Level I build:</strong> '+LEVEL1_WELDING_PROJECTS.length+' welding-position projects are loaded from the Level I position requirements. Cutting projects are listed separately until their grading rubric is defined.</div><div class="table-wrap" style="margin-top:12px"><table><thead><tr><th>Name</th><th>Process</th><th>Joint</th><th>Position</th></tr></thead><tbody>'+state.assignments.map(a=>'<tr><td>'+escapeHtml(a.name)+'</td><td>'+escapeHtml(a.process)+'</td><td>'+escapeHtml(a.family+(a.family==="Groove"?" · "+a.backing:""))+'</td><td>'+escapeHtml(a.position)+'</td></tr>').join("")+'</tbody></table></div></div>'+
    '<div class="card"><h3>AWS administrative record</h3><p class="muted small">For the active test student only.</p>'+
      '<div class="form-grid"><label>Registration status<select id="awsRegistration"><option '+(student.aws.registrationStatus==="Not registered"?"selected":"")+'>Not registered</option><option '+(student.aws.registrationStatus==="Pending"?"selected":"")+'>Pending</option><option '+(student.aws.registrationStatus==="Registered"?"selected":"")+'>Registered</option></select></label>'+
      '<label>Candidate / trainee ID<input id="awsCandidateId" value="'+escapeHtml(student.aws.candidateId||"")+'" /></label>'+
      '<label>Enrollment date<input id="awsEnrollmentDate" type="date" value="'+escapeHtml(student.aws.enrollmentDate||"")+'" /></label>'+
      '<label>Completion submission<select id="awsSubmission"><option '+(student.aws.submissionStatus==="Not submitted"?"selected":"")+'>Not submitted</option><option '+(student.aws.submissionStatus==="Pending"?"selected":"")+'>Pending</option><option '+(student.aws.submissionStatus==="Submitted"?"selected":"")+'>Submitted</option></select></label></div>'+
    '</div></div>'+
    '<div class="card"><h3>Prototype boundaries</h3><div class="alert">No LTG authentication, no production Supabase, no attendance linkage, no AWS submission, no real student PII, and no deployment from this v2 branch yet.</div></div>';
}

function render(){
  document.getElementById("viewTitle").textContent=viewTitle();
  renderStudentSelect();
  const content=document.getElementById("appContent");
  const view=state.ui.view;
  content.innerHTML=view==="home"?renderHome():view==="lab"?renderLab():view==="competencies"?renderCompetencies():view==="exams"?renderExams():view==="qualifications"?renderQualifications():view==="passport"?renderPassport():renderAdmin();
  saveState();
}

function moveQueue(kind,delta){
  const key={lab:"labIndex",competency:"competencyIndexStudent",exam:"examStudentIndex",qualification:"qualificationStudentIndex"}[kind];
  if(!key) return;
  state.ui[key]=(state.ui[key]+delta+state.students.length)%state.students.length;
  render();
}

document.querySelectorAll(".nav-btn").forEach(btn=>btn.addEventListener("click",()=>setView(btn.dataset.view)));
document.getElementById("activeStudentSelect").addEventListener("change",e=>{
  state.activeStudentId=e.target.value;
  const idx=state.students.findIndex(s=>s.id===state.activeStudentId);
  state.ui.labIndex=idx;state.ui.competencyIndexStudent=idx;state.ui.examStudentIndex=idx;state.ui.qualificationStudentIndex=idx;
  render();
});

document.getElementById("appContent").addEventListener("click",e=>{
  const go=e.target.closest("[data-go]"); if(go){setView(go.dataset.go);return;}
  const nav=e.target.closest("[data-lab-nav]"); if(nav){moveQueue("lab",Number(nav.dataset.labNav));return;}
  const cnav=e.target.closest("[data-competency-nav]"); if(cnav){moveQueue("competency",Number(cnav.dataset.competencyNav));return;}
  const enav=e.target.closest("[data-exam-nav]"); if(enav){moveQueue("exam",Number(enav.dataset.examNav));return;}
  const qnav=e.target.closest("[data-qualification-nav]"); if(qnav){moveQueue("qualification",Number(qnav.dataset.qualificationNav));return;}

  const attemptBtn=e.target.closest("[data-attempt]");
  if(attemptBtn){state.ui.labAttempt=attemptBtn.dataset.attempt;render();return;}
  const start2=e.target.closest("[data-start-attempt2]");
  if(start2){
    const s=studentAt(state.ui.labIndex),rec=ensureLabRecord(s,state.ui.labAssignmentId);
    if(attemptComplete(rec.attempt1)){rec.attempt2=newAttempt();state.ui.labAttempt="attempt2";render();}
    return;
  }

  const scoreBtn=e.target.closest("[data-score-criterion]");
  if(scoreBtn){
    const s=studentAt(state.ui.labIndex),rec=ensureLabRecord(s,state.ui.labAssignmentId),a=rec[state.ui.labAttempt];
    a.scores[scoreBtn.dataset.scoreCriterion]=Number(scoreBtn.dataset.score);
    recalcAttempt(a);saveState();render();return;
  }

  const defect=e.target.closest("[data-defect]");
  if(defect){
    const s=studentAt(state.ui.labIndex),rec=ensureLabRecord(s,state.ui.labAssignmentId),a=rec[state.ui.labAttempt],id=defect.dataset.defect;
    if(a.defects.includes(id)) a.defects=a.defects.filter(x=>x!==id); else a.defects.push(id);
    if(state.ui.labAttempt==="attempt2"){
      if(hasCritical(a)) a.scores.defects=0;
      else if(Number(a.scores.defects)===0) delete a.scores.defects;
    }
    recalcAttempt(a);saveState();render();return;
  }

  const comment=e.target.closest("[data-comment]");
  if(comment){
    const s=studentAt(state.ui.labIndex),rec=ensureLabRecord(s,state.ui.labAssignmentId),a=rec[state.ui.labAttempt],label=comment.dataset.comment;
    if(a.comments.includes(label)) a.comments=a.comments.filter(x=>x!==label); else a.comments.push(label);
    saveState();render();return;
  }

  const openGrade=e.target.closest("[data-open-grade]");
  if(openGrade){
    const [idx,aid]=openGrade.dataset.openGrade.split("|");
    state.ui.labIndex=Number(idx);state.ui.labAssignmentId=aid;
    const s=studentAt(state.ui.labIndex),rec=ensureLabRecord(s,aid);
    state.ui.labAttempt=rec.attempt2?"attempt2":"attempt1";setView("lab");return;
  }

  const cs=e.target.closest("[data-competency-status]");
  if(cs){
    const s=studentAt(state.ui.competencyIndexStudent),m=moduleById(state.ui.moduleId),item=s.competencies[m.id][state.ui.competencyIndex];
    item.status=cs.dataset.competencyStatus;if(item.status==="Verified"&&!item.date)item.date=new Date().toISOString().slice(0,10);
    saveState();render();return;
  }

  const pqs=e.target.closest("[data-position-qualification-status]");
  if(pqs){
    const s=studentAt(state.ui.qualificationStudentIndex),q=selectedPositionQualification(),rec=s.positionQualifications[q.id];
    rec.status=pqs.dataset.positionQualificationStatus;if(rec.status!=="Not Started"&&!rec.date)rec.date=new Date().toISOString().slice(0,10);
    saveState();render();return;
  }

  if(e.target.id==="recordExamBtn"){
    const input=document.getElementById("examScoreInput"),score=Number(input.value),s=studentAt(state.ui.examStudentIndex),exam=s.exams[state.ui.examModuleId];
    if(!Number.isFinite(score)||score<0||score>100){alert("Enter a score from 0 to 100.");return;}
    if(exam.attempts.length>=2&&!exam.retrainingConfirmed){alert("Confirm retraining before Attempt 3.");return;}
    if(exam.attempts.length>=3)return;
    exam.attempts.push({score,date:new Date().toISOString().slice(0,10)});saveState();render();return;
  }

  if(e.target.id==="openAssignmentDialog"){document.getElementById("assignmentDialog").showModal();return;}
});

document.getElementById("appContent").addEventListener("change",e=>{
  if(e.target.id==="labAssignmentSelect"){state.ui.labAssignmentId=e.target.value;state.ui.labIndex=0;state.ui.labAttempt="attempt1";render();}
  if(e.target.id==="moduleSelect"){state.ui.moduleId=e.target.value;state.ui.competencyIndex=0;state.ui.competencyIndexStudent=0;render();}
  if(e.target.id==="competencySelect"){state.ui.competencyIndex=Number(e.target.value);state.ui.competencyIndexStudent=0;render();}
  if(e.target.id==="examSelect"){state.ui.examModuleId=e.target.value;state.ui.examStudentIndex=0;render();}
  if(e.target.id==="retrainingCheck"){studentAt(state.ui.examStudentIndex).exams[state.ui.examModuleId].retrainingConfirmed=e.target.checked;saveState();}
  if(e.target.id==="qualificationProcessSelect"){state.ui.qualificationProcessId=e.target.value;state.ui.qualificationPosition="";state.ui.qualificationStudentIndex=0;render();}
  if(e.target.id==="qualificationFamilySelect"){state.ui.qualificationFamily=e.target.value;state.ui.qualificationBacking=e.target.value==="Groove"?"Backing":"N/A";state.ui.qualificationPosition="";state.ui.qualificationStudentIndex=0;render();}
  if(e.target.id==="qualificationBackingSelect"){state.ui.qualificationBacking=e.target.value;state.ui.qualificationPosition="";state.ui.qualificationStudentIndex=0;render();}
  if(e.target.id==="qualificationPositionSelect"){state.ui.qualificationPosition=e.target.value;state.ui.qualificationStudentIndex=0;render();}
  if(e.target.id==="positionQualificationDate"){const s=studentAt(state.ui.qualificationStudentIndex),q=selectedPositionQualification();s.positionQualifications[q.id].date=e.target.value;saveState();}
  if(e.target.id==="awsRegistration"){activeStudent().aws.registrationStatus=e.target.value;saveState();}
  if(e.target.id==="awsEnrollmentDate"){activeStudent().aws.enrollmentDate=e.target.value;saveState();}
  if(e.target.id==="awsSubmission"){activeStudent().aws.submissionStatus=e.target.value;saveState();}
});

document.getElementById("appContent").addEventListener("input",e=>{
  if(e.target.id==="positionQualificationNote"){const s=studentAt(state.ui.qualificationStudentIndex),q=selectedPositionQualification();s.positionQualifications[q.id].notes=e.target.value;saveState();}
  if(e.target.id==="awsCandidateId"){activeStudent().aws.candidateId=e.target.value;saveState();}
});

document.getElementById("createAssignmentBtn").addEventListener("click",e=>{
  e.preventDefault();
  const form=document.getElementById("assignmentForm"),data=new FormData(form);
  const name=String(data.get("name")||"").trim(),process=String(data.get("process")||"").trim();
  if(!name||!process)return;
  const id=uid("assignment");
  state.assignments.push({id,name,process,position:String(data.get("position")||""),electrode:String(data.get("electrode")||""),type:String(data.get("type")||"position")});
  state.ui.labAssignmentId=id;form.reset();document.getElementById("assignmentDialog").close();saveState();render();
});

document.getElementById("exportBtn").addEventListener("click",()=>{
  const blob=new Blob([JSON.stringify(state,null,2)],{type:"application/json"}),a=document.createElement("a");
  a.href=URL.createObjectURL(blob);a.download="aws-sense-tower-lab-v3.json";a.click();URL.revokeObjectURL(a.href);
});
document.getElementById("importInput").addEventListener("change",e=>{
  const file=e.target.files[0];if(!file)return;const reader=new FileReader();
  reader.onload=()=>{try{const parsed=JSON.parse(reader.result);if(parsed.schemaVersion!==3)throw new Error();state=parsed;saveState();render();}catch{alert("That file is not a valid Tower Lab v3 export.");}};
  reader.readAsText(file);
});
document.getElementById("resetBtn").addEventListener("click",()=>{if(confirm("Reset all standalone v2 test data?")){localStorage.removeItem(STORAGE_KEY);state=makeDemoState();render();}});

render();