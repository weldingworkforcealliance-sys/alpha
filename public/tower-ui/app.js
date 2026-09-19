

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
  courseId:"wld110",
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
  {id:"beadSize",name:"Bead Size",help:"",choices:[]}
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
  ...LEVEL1_WELDING_PROJECTS.map(project=>({...project,rubricType:"weld",courseId:"wld110"})),
  ...CUTTING_PROJECTS
];

const DEFAULT_COURSE_CATALOG = [
  {id:"wld105",code:"WLD 105",level:"Level I",semester:1,role:"theory",label:"Theory / Projects",pairedCourse:"WLD 110",
    gradingPolicy:{version:"pccc-theory-v1",passingScore:65,categories:[
      {code:"theory_assessments",label:"Theory / Assessments",weight:50},
      {code:"fabrication_projects",label:"Fabrication Projects",weight:25},
      {code:"homework",label:"Homework",weight:25}
    ]}},
  {id:"wld110",code:"WLD 110",level:"Level I",semester:1,role:"shop",label:"Shop / Certifications",pairedCourse:"WLD 105",
    gradingPolicy:{version:"pccc-shop-v1",passingScore:65,categories:[
      {code:"weld_performance",label:"Weld Performance",weight:75},
      {code:"shop_projects",label:"Shop Projects",weight:25}
    ],passFailOutsideGrade:["Qualifications","Destructive Tests","Certificates"]}},
  {id:"wld205",code:"WLD 205",level:"Level II",semester:1,role:"theory",label:"Theory / Projects",pairedCourse:"WLD 210",
    gradingPolicy:{version:"pccc-theory-v1",passingScore:65,categories:[
      {code:"theory_assessments",label:"Theory / Assessments",weight:50},
      {code:"fabrication_projects",label:"Fabrication Projects",weight:25},
      {code:"homework",label:"Homework",weight:25}
    ]}},
  {id:"wld210",code:"WLD 210",level:"Level II",semester:1,role:"shop",label:"Shop / Certifications",pairedCourse:"WLD 205",
    gradingPolicy:{version:"pccc-shop-v1",passingScore:65,categories:[
      {code:"weld_performance",label:"Weld Performance",weight:75},
      {code:"shop_projects",label:"Shop Projects",weight:25}
    ],passFailOutsideGrade:["Qualifications","Destructive Tests","Certificates"]}}
];

const PLANNER_PROJECT_SEED = [
  {id:"steel-dice",courseId:"wld105",title:"Steel Dice Fabrication Project",category:"Fabrication Projects",source:"WLD 105 planner"},
  {id:"fabricated-m",courseId:"wld105",title:"Fabricated M Fabrication Project",category:"Fabrication Projects",source:"WLD 105 planner"}
];

function blankCourseRecord(course){
  const record={finalization:{status:"Open",officialFinal:null,finalizedAt:"",revisions:[]},items:[]};
  if(course.role==="theory"){
    record.items.push({
      id:course.id+"-live-classroom",
      courseId:course.id,
      title:"Live Classroom Assessments",
      category:"Theory Assessments",
      source:"Existing theory gradebook",
      status:"Imported by gradebook",score:null,possible:null
    });
    record.items.push({
      id:course.id+"-homework-category",
      courseId:course.id,
      title:"Homework",
      category:"Homework",
      source:"Instructor / planner",
      status:"No homework graded yet",score:null,possible:null
    });
    if(course.id==="wld105"){
      record.items.push({
        id:"theory-math",courseId:"wld105",title:"Welding Math Assessments",
        category:"Theory Assessments",source:"Existing theory gradebook",
        status:"Imported by gradebook",score:null,possible:null
      });
      record.items.push(...PLANNER_PROJECT_SEED.map(item=>({...item,status:"Planner-linked",score:null,possible:null})));
    }
  }
  return record;
}

function blankCourseRecords(catalog=DEFAULT_COURSE_CATALOG){
  const records={};
  catalog.forEach(course=>{records[course.id]=blankCourseRecord(course);});
  return records;
}

function courseCatalog(targetState=state){
  return Array.isArray(targetState?.courseCatalog)&&targetState.courseCatalog.length
    ? targetState.courseCatalog
    : DEFAULT_COURSE_CATALOG;
}

function ensurePermanentRecordState(targetState){
  if(!Array.isArray(targetState.courseCatalog)||!targetState.courseCatalog.length){
    targetState.courseCatalog=JSON.parse(JSON.stringify(DEFAULT_COURSE_CATALOG));
  }else{
    const defaults=JSON.parse(JSON.stringify(DEFAULT_COURSE_CATALOG));
    targetState.courseCatalog.forEach(course=>{
      const fallback=defaults.find(x=>x.id===course.id);
      if(fallback&&!course.gradingPolicy) course.gradingPolicy=fallback.gradingPolicy;
    });
  }
  if(!targetState.program) targetState.program={};
  if(!targetState.program.instructorEmail) targetState.program.instructorEmail="demo.instructor@example.test";
  if(!targetState.program.certificatePrintEmail) targetState.program.certificatePrintEmail="jhconnolly@pccc.edu";
  if(!targetState.program.certificatePrintNote) targetState.program.certificatePrintNote="ASAP print on thick paper.";
  if(!Number.isFinite(Number(targetState.destructiveTestCounter))||Number(targetState.destructiveTestCounter)<1) targetState.destructiveTestCounter=1;
  if(!Array.isArray(targetState.assignments)) targetState.assignments=JSON.parse(JSON.stringify(DEFAULT_ASSIGNMENTS));
  targetState.assignments.forEach(assignment=>{
    if(assignment.rubricType==="weld"&&!assignment.courseId) assignment.courseId="wld110";
  });
  targetState.students.forEach(student=>{
    if(!student.ltgStudentId) student.ltgStudentId=student.id;
    if(!student.courseRecords) student.courseRecords=blankCourseRecords(targetState.courseCatalog);
    targetState.courseCatalog.forEach(course=>{
      if(!student.courseRecords[course.id]) student.courseRecords[course.id]=blankCourseRecord(course);
      if(!student.courseRecords[course.id].finalization) student.courseRecords[course.id].finalization={status:"Open",officialFinal:null,finalizedAt:"",revisions:[]};
    });
    if(!Array.isArray(student.destructiveTests)) student.destructiveTests=[];
  });
  if(!targetState.ui) targetState.ui={};
  if(!targetState.ui.courseId) targetState.ui.courseId="wld105";
  if(!targetState.ui.destructiveProcessId) targetState.ui.destructiveProcessId="smaw";
  if(!targetState.ui.destructiveFamily) targetState.ui.destructiveFamily="Groove";
  if(!targetState.ui.destructiveBacking) targetState.ui.destructiveBacking="Backing";
  if(!targetState.ui.destructivePosition) targetState.ui.destructivePosition="2G";
  return targetState;
}

function courseById(id){const catalog=courseCatalog();return catalog.find(course=>course.id===id)||catalog[0];}

function itemCategoryCode(item,course){
  if(course.role==="shop"){
    return item.category==="Shop Projects" ? "shop_projects" : "weld_performance";
  }
  if(item.category==="Fabrication Projects") return "fabrication_projects";
  if(item.category==="Homework") return "homework";
  return "theory_assessments";
}

function categoryAverage(items){
  const graded=items.filter(item=>Number.isFinite(Number(item.score))&&Number.isFinite(Number(item.possible))&&Number(item.possible)>0);
  if(!graded.length) return null;
  const earned=graded.reduce((sum,item)=>sum+Number(item.score),0);
  const possible=graded.reduce((sum,item)=>sum+Number(item.possible),0);
  return possible>0 ? earned/possible*100 : null;
}

function courseGradePreview(student,courseId){
  const course=courseById(courseId);
  const policy=course.gradingPolicy;
  if(!policy) return {ready:false,final:null,categories:[]};
  const items=courseItemsFor(student,courseId);
  let weighted=0;
  let ready=true;
  const categories=policy.categories.map(cat=>{
    const rows=items.filter(item=>itemCategoryCode(item,course)===cat.code);
    const average=categoryAverage(rows);
    if(average===null) ready=false;
    else weighted+=average*(cat.weight/100);
    return {...cat,average,itemCount:rows.length};
  });
  return {ready,final:ready?Math.round(weighted*10)/10:null,categories,passingScore:policy.passingScore,version:policy.version};
}

function courseGradingPolicyHtml(course,student){
  const preview=courseGradePreview(student,course.id);
  const rows=preview.categories.map(cat=>'<tr><td>'+escapeHtml(cat.label)+'</td><td>'+cat.weight+'%</td><td>'+(cat.average===null?badge("No graded items","gray"):badge((Math.round(cat.average*10)/10)+"%","blue"))+'</td></tr>').join("");
  return '<div class="table-wrap"><table><thead><tr><th>Grade category</th><th>Weight</th><th>Current category grade</th></tr></thead><tbody>'+rows+'</tbody></table></div>'+
    '<div class="alert blue"><strong>Course policy:</strong> Passing is '+preview.passingScore+'% or higher. '+(course.role==="theory"?"Homework is 25% of the final grade.":"Qualifications, destructive tests and certificates remain Pass/Fail records outside the numeric grade.")+'</div>'+
    '<div class="grade-summary"><div class="final"><span>Calculated course preview</span><strong>'+(preview.ready?preview.final.toFixed(1)+"%":"—")+'</strong></div></div>';
}


function shopAcademicItems(student,courseId){
  return state.assignments.filter(a=>a.rubricType==="weld"&&a.courseId===courseId).map(a=>{
    const result=officialLabResult(student,a.id);
    return {
      id:a.id,title:a.name,category:a.type==="project"?"Shop Projects":"Weld Performance",
      source:"Shop Grade Tower",status:result.status,score:result.numeric,possible:result.numeric===null?null:100,
      attempt:result.attempt,display:result.display
    };
  }).filter(item=>item.display!=="—");
}

function courseItemsFor(student,courseId){
  const course=courseById(courseId);
  if(course.role==="shop") return shopAcademicItems(student,courseId);
  return student.courseRecords?.[courseId]?.items||[];
}

function nextDestructiveTestId(){return crypto.randomUUID();}

function certificateIdForTest(test){return "CERT-"+test.id;}

function destructiveRule(processId){
  return LEVEL1_PROCESS_RULES.find(rule=>rule.id===processId)||LEVEL1_PROCESS_RULES[0];
}

function selectedDestructivePosition(){
  const rule=destructiveRule(state.ui.destructiveProcessId);
  const family=state.ui.destructiveFamily==="Fillet"?"Fillet":"Groove";
  const allowed=family==="Fillet"?rule.fillet:rule.groove;
  if(!allowed.includes(state.ui.destructivePosition)) state.ui.destructivePosition=allowed[0];
  return state.ui.destructivePosition;
}

function recordDestructiveTest(student,payload){
  const test={
    id:nextDestructiveTestId(state),
    studentRecordId:student.ltgStudentId,
    weldTestId:student.weldTestId,
    studentName:student.name,
    courseId:payload.courseId||"wld110",
    courseCode:payload.courseCode||"WLD 110",
    processId:payload.processId,
    process:payload.process,
    material:payload.material,
    family:payload.family,
    backing:payload.family==="Groove"?payload.backing:"N/A",
    position:payload.position,
    specification:payload.specification||"",
    fillerMetal:payload.fillerMetal||"",
    plate:payload.plate||"",
    testMethod:payload.testMethod,
    faceBendResult:payload.faceBendResult||"",
    rootBendResult:payload.rootBendResult||"",
    result:payload.result,
    testDate:payload.testDate,
    inspector:payload.inspector,
    notes:payload.notes||"",
    recordedAt:new Date().toISOString(),
    certificate:null,
    revisions:[]
  };
  student.destructiveTests.push(test);
  return test;
}

function createCertificateRecord(student,test){
  if(!test||test.result!=="Pass"||test.certificate) return test?.certificate||null;
  test.certificate={
    id:certificateIdForTest(test),
    version:1,
    issuedAt:new Date().toISOString(),
    renderedFileReference:"",
    deliveries:[],
    snapshot:{
      studentRecordId:student.ltgStudentId,
      studentName:student.name,
      weldTestId:student.weldTestId,
      destructiveTestId:test.id,
      courseId:test.courseId,
      courseCode:test.courseCode,
      process:test.process,
      material:test.material,
      specification:test.specification,
      fillerMetal:test.fillerMetal,
      plate:test.plate,
      family:test.family,
      backing:test.backing,
      position:test.position,
      testMethod:test.testMethod,
      faceBendResult:test.faceBendResult,
      rootBendResult:test.rootBendResult,
      result:test.result,
      testDate:test.testDate,
      inspector:test.inspector
    }
  };
  return test.certificate;
}

function buildCertificateEmailPacket(student,test){
  if(!test?.certificate) return null;
  const instructorEmail=String(state.program?.instructorEmail||"").trim();
  const printEmail=String(state.program?.certificatePrintEmail||"jhconnolly@pccc.edu").trim();
  const studentEmail=String(student.email||"").trim();
  const recipients=[
    {role:"Student",email:studentEmail},
    {role:"Instructor",email:instructorEmail},
    {role:"Print / Dean",email:printEmail}
  ];
  const subject="PCCC Welding Certificate — "+student.name+" — "+test.process+" "+test.position+" — "+test.certificate.id;
  const printNote=String(state.program?.certificatePrintNote||"ASAP print on thick paper.").trim();
  const body=[
    "Attached is the PCCC welding qualification certificate for "+student.name+".",
    "Weld Test ID: "+student.weldTestId,
    "Certificate: "+test.certificate.id,
    "Destructive Test: "+test.id,
    "Process / Position: "+test.process+" "+test.position+(test.family==="Groove"?" · "+test.backing:""),
    "Specification / Filler / Plate: "+(test.specification||"")+" / "+(test.fillerMetal||"")+" / "+(test.plate||""),
    "Guided Bend: Face "+(test.faceBendResult||"")+" · Root "+(test.rootBendResult||""),
    "",
    "For jhconnolly@pccc.edu: "+printNote
  ].join("\n");
  return {
    recipients,
    subject,
    body,
    printNote,
    attachmentReference:test.certificate.renderedFileReference||test.certificate.id+".pdf"
  };
}

function queueCertificateEmail(student,test){
  if(!test?.certificate||test.result!=="Pass") return null;
  const packet=buildCertificateEmailPacket(student,test);
  if(!packet||packet.recipients.some(recipient=>!recipient.email)) return null;
  if(!Array.isArray(test.certificate.deliveries)) test.certificate.deliveries=[];
  const existing=test.certificate.deliveries.find(delivery=>delivery.version===test.certificate.version&&["Queued","Sent"].includes(delivery.status));
  if(existing) return existing;
  const delivery={
    id:"MAIL-"+test.certificate.id+"-V"+test.certificate.version,
    version:test.certificate.version,
    status:"Queued",
    queuedAt:new Date().toISOString(),
    sentAt:"",
    recipients:packet.recipients,
    subject:packet.subject,
    body:packet.body,
    printNote:packet.printNote,
    attachmentReference:packet.attachmentReference,
    providerMessageId:"",
    error:""
  };
  test.certificate.deliveries.push(delivery);
  return delivery;
}


const WELD_TEST_ID_PATTERN = /^\d{4}$/;

function formatWeldTestId(value){
  return String(value).padStart(4,"0");
}

function nextAvailableWeldTestId(registry){
  const used=new Set((registry||[]).filter(id=>WELD_TEST_ID_PATTERN.test(id)));
  for(let n=0;n<=9999;n++){
    const candidate=formatWeldTestId(n);
    if(!used.has(candidate)) return candidate;
  }
  throw new Error("No 4-digit weld test IDs remain available.");
}

function ensureStudentWeldTestIds(targetState){
  if(!Array.isArray(targetState.testIdRegistry)) targetState.testIdRegistry=[];
  const registry=new Set(targetState.testIdRegistry.filter(id=>WELD_TEST_ID_PATTERN.test(id)));
  const assigned=new Set();

  targetState.students.forEach(student=>{
    let current=String(student.weldTestId||"").trim();
    if(!WELD_TEST_ID_PATTERN.test(current)||assigned.has(current)){
      current=nextAvailableWeldTestId([...registry,...assigned]);
      student.weldTestId=current;
    }else{
      student.weldTestId=current;
    }
    assigned.add(current);
    registry.add(current);
  });

  targetState.testIdRegistry=[...registry].sort();
  return targetState;
}

function assignWeldTestId(student,targetState){
  ensureStudentWeldTestIds(targetState);
  if(WELD_TEST_ID_PATTERN.test(String(student.weldTestId||""))) return student.weldTestId;
  const id=nextAvailableWeldTestId(targetState.testIdRegistry);
  student.weldTestId=id;
  targetState.testIdRegistry.push(id);
  targetState.testIdRegistry=[...new Set(targetState.testIdRegistry)].sort();
  return id;
}

function weldTestIdIsImmutable(student,requested){
  return String(requested||"").trim()===String(student.weldTestId||"").trim();
}

function uid(prefix="id"){
  if (crypto.randomUUID) return crypto.randomUUID();
  return prefix+"-"+Date.now()+"-"+Math.random().toString(16).slice(2);
}

function newAttempt(){
  return {scores:{},defects:[],comments:[],notes:"",startedAt:new Date().toISOString(),completedAt:""};
}

function blankStudent(name,studentId){
  const id=uid("student");
  const competencies={};
  MODULES.forEach(m=>competencies[m.id]=m.competencies.map((label,i)=>({id:m.id+"-c"+(i+1),label,status:"Not Started",date:""})));
  const exams={};
  Object.keys(EXAMS).forEach(id=>exams[id]={attempts:[],retrainingConfirmed:false});
  const qualifications={};
  AWS_QUALIFICATIONS.forEach(q=>qualifications[q.id]={status:"Not Started",date:"",notes:""});
  const positionQualifications={};
  POSITION_QUALIFICATIONS.forEach(q=>positionQualifications[q.id]={status:"Not Started",date:"",notes:""});
  return {
    id,ltgStudentId:id,name,studentId,email:"",cohort:"Level 1 Test Cohort",weldTestId:"",
    aws:{registrationStatus:"Not registered",candidateId:"",enrollmentDate:"",submissionStatus:"Not submitted"},
    competencies,exams,qualifications,positionQualifications,lab:{},courseRecords:blankCourseRecords(),destructiveTests:[]
  };
}

function makeDemoState(){
  const names=["Demo Student A","Demo Student B","Demo Student C","Demo Student D","Demo Student E","Demo Student F","Demo Student G","Demo Student H"];
  const students=names.map((n,i)=>blankStudent(n,"TEST-"+String(i+1).padStart(3,"0")));
  students.forEach((student,i)=>{student.email="demo.student"+String(i+1)+"@example.test";});
  students[0].aws.registrationStatus="Registered";
  students[0].exams.m2.attempts=[{score:100,date:"2026-09-10"}];
  students[0].competencies.m4[4].status="Practicing";
  students[1].competencies.m4[4].status="Introduced";
  const demoState={
    schemaVersion:6,
    program:{name:"PCCC Welding — AWS SENSE Level I Tower Lab",standardBasis:"AWS QC10:2017 / AWS EG2.0:2017 / Supplement",instructorEmail:"demo.instructor@example.test",certificatePrintEmail:"jhconnolly@pccc.edu",certificatePrintNote:"ASAP print on thick paper."},
    assignments:JSON.parse(JSON.stringify(DEFAULT_ASSIGNMENTS)),
    courseCatalog:JSON.parse(JSON.stringify(DEFAULT_COURSE_CATALOG)),
    students,
    activeStudentId:students[0].id,
    testIdRegistry:[],
    destructiveTestCounter:1,
    ui:{view:"home",courseId:"wld105",labAssignmentId:"smaw-fillet-3F",labIndex:0,labAttempt:"attempt1",moduleId:"m4",competencyIndex:4,competencyIndexStudent:0,examModuleId:"m2",examStudentIndex:0,qualificationProcessId:"smaw",qualificationFamily:"Groove",qualificationBacking:"Backing",qualificationPosition:"1G",qualificationStudentIndex:0,destructiveProcessId:"smaw",destructiveFamily:"Groove",destructiveBacking:"Backing",destructivePosition:"2G",certificatePreviewId:""}
  };
  ensureStudentWeldTestIds(demoState);
  ensurePermanentRecordState(demoState);
  return demoState;
}

let state=null;
function saveState(){ if(state) persistRecords(); }

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
function adjustedScore(attempt,attemptNumber=1){
  let raw=rawScore(attempt);
  if(raw!==null && attemptNumber===2 && hasCritical(attempt))raw-=Number(attempt.scores.defects);
  return raw===null?null:Math.round(raw*0.95*10)/10;
}
function officialLabResult(student,assignmentId){
  const rec=ensureLabRecord(student,assignmentId);
  if(rec.attempt2 && attemptComplete(rec.attempt2)){
    return {attempt:2,display:adjustedScore(rec.attempt2,2).toFixed(1)+"%",numeric:adjustedScore(rec.attempt2,2),status:"Complete"};
  }
  if(attemptComplete(rec.attempt1)){
    if(hasCritical(rec.attempt1)) return {attempt:1,display:"F (0%)",numeric:0,status:"Retest"};
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
  return {home:"Tower Home",lab:"Lab Grade Tower",courses:"Course Records",competencies:"SENSE Competency Tower",exams:"Knowledge Exam Tower",qualifications:"Performance Qualification Tower",destructive:"Destructive Test Records",passport:"Student Passport",admin:"Admin / AWS Readiness"}[state.ui.view]||"Welding Record Tower";
}

function renderHome(){
  const labGrades=state.students.reduce((n,s)=>n+state.assignments.filter(a=>officialLabResult(s,a.id).display!=="—").length,0);
  const verified=state.students.reduce((n,s)=>n+MODULES.reduce((x,m)=>x+(s.competencies[m.id]||[]).filter(c=>c.status==="Verified").length,0),0);
  const partial=state.students.filter(s=>credentialSummary(s).partial).length;
  return '<div class="grid cols-4">'+
    '<div class="card"><div class="stat">'+state.students.length+'</div><div class="stat-label">Enrolled students</div></div>'+
    '<div class="card"><div class="stat">'+labGrades+'</div><div class="stat-label">Official lab grades recorded</div></div>'+
    '<div class="card"><div class="stat">'+verified+'</div><div class="stat-label">Verified SENSE competencies</div></div>'+
    '<div class="card"><div class="stat">'+partial+'</div><div class="stat-label">Partial-completion eligible</div></div>'+
  '</div>'+
  '<div class="section-head"><div><h3>One tower, one instructor pattern</h3><div class="muted small">Choose the thing once, work student-to-student, tap the result, move on.</div></div></div>'+
  '<div class="grid cols-3">'+
    towerCard("Lab Grade Tower","Five taps for a normal weld. Attempt logic, critical defects, math and replacement rules happen automatically.","lab","Grade welds")+
    towerCard("Course Records","WLD 105 and 110 remain separate grades. Same for WLD 205/210 and future pairs. Theory/projects and shop grades meet here without being averaged together.","courses","Open course records")+
    towerCard("Competency Tower","Choose one AWS competency, then move down the class with the same fast queue.","competencies","Verify competencies")+
    towerCard("Knowledge Exam Tower","Choose one exam, enter the result, move to the next student. Attempt limits stay underneath.","exams","Enter exam results")+
    towerCard("Qualification Tower","Qualification and certification evidence is Pass/Fail only and never changes the numeric shop-course grade.","qualifications","Record qualifications")+
    towerCard("Destructive Tests","Keep permanent destructive-test records under the student's immutable Weld Test ID and create certificate records from passing tests.","destructive","Open destructive tests")+
    towerCard("Student Passport","See academic lab evidence and SENSE evidence together without mixing the two records.","passport","Open passport")+
    towerCard("Admin / Readiness","AWS registration fields, test assignments and prototype controls live away from the daily instructor workflow.","admin","Open admin")+
  '</div>'+
  '<div class="card" style="margin-top:14px"><div class="alert blue"><strong>Design boundary:</strong> Lab grades are PCCC academic records. AWS SENSE competency and qualification evidence remain separate records, even when the same weld supports both.</div></div>';
}
function towerCard(title,body,view,button){
  return '<div class="card tower-card"><h3>'+title+'</h3><p>'+body+'</p><div class="tower-actions"><button class="primary-btn" data-go="'+view+'">'+button+'</button></div></div>';
}

function renderLab(){
  if(!state.students.length) return '<div class="card">No students.</div>';
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
  const raw=rawScore(attempt),adjusted=adjustedScore(attempt,attemptNumber);

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
    '<div class="alert"><strong>Automatic saving.</strong> Check the Saved to LTG status before leaving. A completed Attempt 2 automatically replaces Attempt 1 as the official grade.</div>'+
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

function buildLtgIntegrationSnapshot(targetState=state){
  ensureStudentWeldTestIds(targetState);
  ensurePermanentRecordState(targetState);
  const catalog=courseCatalog(targetState);

  return {
    schema:"pccc-welding-record-tower-ltg-bridge/v1",
    generatedAt:new Date().toISOString(),
    students:targetState.students.map(student=>({
      studentId:student.ltgStudentId,
      externalStudentId:student.studentId,
      displayName:student.name,
      weldTestId:student.weldTestId
    })),
    courseCatalog:catalog.map(course=>({...course})),
    gradingPolicies:catalog.map(course=>({courseId:course.id,courseCode:course.code,gradingPolicy:course.gradingPolicy||null})),
    academicShopGrades:targetState.students.flatMap(student=>
      targetState.assignments.filter(a=>a.rubricType==="weld"&&a.courseId).flatMap(assignment=>{
        const result=officialLabResult(student,assignment.id);
        if(result.display==="—") return [];
        return [{
          studentId:student.ltgStudentId,
          courseId:assignment.courseId,
          sourceSystem:"welding_record_tower",
          sourceKey:"shop:"+assignment.id,
          itemTitle:assignment.name,
          attemptNumber:result.attempt,
          officialScore:result.numeric,
          possibleScore:result.numeric===null?null:100,
          gradebookWriteReady:result.numeric!==null,
          academicOverride:result.numeric===null?result.display:null,
          display:result.display,
          status:result.status
        }];
      })
    ),
    plannerProjectItems:targetState.students.flatMap(student=>
      catalog.filter(course=>course.role==="theory").flatMap(course=>
        (student.courseRecords?.[course.id]?.items||[])
          .filter(item=>item.source&&String(item.source).toLowerCase().includes("planner"))
          .map(item=>({
            studentId:student.ltgStudentId,
            courseId:course.id,
            sourceSystem:"planner",
            sourceKey:"planner:"+item.id,
            itemTitle:item.title,
            category:item.category,
            score:item.score,
            possibleScore:item.possible,
            status:item.status
          }))
      )
    ),
    qualifications:targetState.students.flatMap(student=>
      Object.entries(student.positionQualifications||{}).flatMap(([qualificationId,record])=>{
        if(!record||record.status==="Not Started") return [];
        const definition=POSITION_QUALIFICATIONS.find(q=>q.id===qualificationId);
        return [{
          studentId:student.ltgStudentId,weldTestId:student.weldTestId,
          courseId:definition?.courseId||"wld110",
          qualificationId,result:record.status,date:record.date,notes:record.notes,
          process:definition?.process||"",material:definition?.material||"",
          family:definition?.family||"",backing:definition?.backing||"",position:definition?.position||""
        }];
      })
    ),
    destructiveTests:targetState.students.flatMap(student=>
      (student.destructiveTests||[]).map(test=>JSON.parse(JSON.stringify(test)))
    ),
    certificates:targetState.students.flatMap(student=>
      (student.destructiveTests||[]).filter(test=>test.certificate).map(test=>JSON.parse(JSON.stringify(test.certificate)))
    )
  };
}

function renderCourseRecords(){
  const student=activeStudent();
  const course=courseById(state.ui.courseId);
  const record=student.courseRecords[course.id];
  const items=courseItemsFor(student,course.id);
  const graded=items.filter(item=>Number.isFinite(Number(item.score))&&Number.isFinite(Number(item.possible))&&Number(item.possible)>0);
  const finalization=record.finalization;
  const linked=courseCatalog().find(c=>c.code===course.pairedCourse);

  return '<div class="card"><div class="section-head"><div><h3>Academic Course Records</h3><div class="muted small">Each course keeps its own permanent grade. Linked course pairs are shown together for context only; they are never averaged into one semester grade.</div></div></div>'+
    '<div class="queue-toolbar"><label>Course<select id="courseRecordSelect">'+courseCatalog().map(c=>'<option value="'+c.id+'" '+(c.id===course.id?"selected":"")+'>'+escapeHtml(c.code+" · "+c.label)+'</option>').join("")+'</select></label>'+
    '<div>'+badge(course.level+" · Semester "+course.semester,"blue")+' '+badge(course.role==="theory"?"Theory / Projects":"Shop / Certifications",course.role==="theory"?"yellow":"green")+'</div></div></div>'+
    '<div class="grid cols-2"><div class="card"><div class="student-banner"><div><div class="eyebrow">'+escapeHtml(course.code)+' permanent academic record</div><h3>'+escapeHtml(student.name)+'</h3><div class="student-meta">'+escapeHtml(student.studentId)+' · Weld Test ID '+escapeHtml(student.weldTestId)+'</div></div><div>'+badge(finalization.status,finalization.status==="Finalized"?"green":"yellow")+'</div></div>'+
      '<div class="section-head"><div><h3>'+escapeHtml(course.code)+' grade evidence</h3><div class="muted small">'+(course.role==="theory"?"Existing theory gradebook assessments plus planner-linked fabrication projects and Homework (25%).":"Numeric academic shop grades from the Lab Grade Tower only.")+'</div></div></div>'+
      '<div class="table-wrap"><table><thead><tr><th>Category</th><th>Item</th><th>Source</th><th>Grade / status</th></tr></thead><tbody>'+
      (items.length?items.map(item=>'<tr><td>'+escapeHtml(item.category||"")+'</td><td>'+escapeHtml(item.title)+'</td><td>'+escapeHtml(item.source||"")+'</td><td>'+(Number.isFinite(Number(item.score))&&Number.isFinite(Number(item.possible))&&Number(item.possible)>0?badge((Math.round(Number(item.score)/Number(item.possible)*1000)/10)+"%","green"):badge(item.status||"Not graded","gray"))+'</td></tr>').join(""):'<tr><td colspan="4" class="muted">No academic grade evidence recorded yet.</td></tr>')+
      '</tbody></table></div>'+
      courseGradingPolicyHtml(course,student)+
      '<div class="alert blue"><strong>Permanent-record rule:</strong> Attempts and corrections append history. Existing evidence is not overwritten. The current approved prototype weights are stored with the course policy version.</div>'+
    '</div>'+
    '<div class="card"><h3>Linked course</h3><div class="stat" style="font-size:28px">'+escapeHtml(linked?.code||course.pairedCourse)+'</div><div class="stat-label">'+escapeHtml(linked?.label||"Linked course")+'</div>'+
      '<div class="alert"><strong>No combined grade.</strong> '+escapeHtml(course.code)+' and '+escapeHtml(course.pairedCourse)+' each produce their own final course grade.</div>'+
      (course.role==="shop"?'<h3 style="margin-top:16px">Qualification / certification status</h3><p class="muted small">Pass/Fail records are retained alongside the shop course but do not add or subtract numeric grade points.</p>'+
        '<div class="status-row">'+badge("Position qualifications: Pass / Fail","blue")+badge("Destructive tests: Pass / Fail","blue")+badge("Certificates: Record only","gray")+'</div>':
        '<h3 style="margin-top:16px">Planner fabrication projects</h3><p class="muted small">WLD 105/205 can receive planner-linked fabrication project grade items without moving them into the shop-course grade.</p>')+
      '<h3 style="margin-top:16px">Final course grade</h3><div class="stat" style="font-size:30px">'+(finalization.officialFinal===null?"—":escapeHtml(finalization.officialFinal)+"%")+'</div><div class="stat-label">'+(finalization.status==="Finalized"?"Permanent final":"Not finalized · course grading rules still control calculation")+'</div>'+
    '</div></div>';
}

function renderDestructiveTests(){
  const student=activeStudent();
  ensurePermanentRecordState(state);
  const rule=destructiveRule(state.ui.destructiveProcessId);
  const family=state.ui.destructiveFamily==="Fillet"?"Fillet":"Groove";
  state.ui.destructiveFamily=family;
  const positions=family==="Fillet"?rule.fillet:rule.groove;
  const position=selectedDestructivePosition();
  const backing=family==="Groove"?(state.ui.destructiveBacking||"Backing"):"N/A";
  state.ui.destructiveBacking=backing;
  const tests=student.destructiveTests||[];
  const previewTest=tests.find(t=>t.certificate?.id===state.ui.certificatePreviewId);

  return '<div class="card"><div class="student-banner"><div><div class="eyebrow">Permanent destructive-test ledger</div><h3>'+escapeHtml(student.name)+'</h3><div class="student-meta">'+escapeHtml(student.studentId)+' · Weld Test ID '+escapeHtml(student.weldTestId)+'</div></div><div>'+badge(tests.length+" test record"+(tests.length===1?"":"s"),tests.length?"blue":"gray")+'</div></div>'+
    '<div class="alert blue"><strong>Record rule:</strong> Destructive tests are Pass/Fail permanent records. They do not change the numeric WLD 110/210 grade. Once recorded, this prototype provides no edit or delete action.</div></div>'+
    '<div class="card"><div class="section-head"><div><h3>Record destructive test</h3><div class="muted small">The test record is tied to the student\'s immutable four-digit Weld Test ID. Test method stays free-text until the program approves the final destructive-testing catalog.</div></div></div>'+
      '<div class="form-grid">'+
        '<label>Shop course<select id="destructiveCourse">'+courseCatalog().filter(c=>c.role==="shop").map(c=>'<option value="'+escapeHtml(c.id)+'">'+escapeHtml(c.code)+'</option>').join("")+'</select></label>'+
        '<label>Process / material<select id="destructiveProcessSelect">'+LEVEL1_PROCESS_RULES.map(x=>'<option value="'+x.id+'" '+(x.id===rule.id?"selected":"")+'>'+escapeHtml(x.label+" · "+x.material)+'</option>').join("")+'</select></label>'+
        '<label>Joint category<select id="destructiveFamilySelect"><option '+(family==="Fillet"?"selected":"")+'>Fillet</option><option '+(family==="Groove"?"selected":"")+'>Groove</option></select></label>'+
        (family==="Groove"?'<label>Backing<select id="destructiveBackingSelect"><option '+(backing==="Backing"?"selected":"")+'>Backing</option><option '+(backing==="No Backing"?"selected":"")+'>No Backing</option></select></label>':"")+
        '<label>Position<select id="destructivePositionSelect">'+positions.map(p=>'<option '+(p===position?"selected":"")+'>'+p+'</option>').join("")+'</select></label>'+
        '<label>Specification<input id="destructiveSpecification" value="AWS D1.1" /></label>'+
        '<label>Filler Metal<input id="destructiveFiller" placeholder="e.g. E-7018" /></label>'+
        '<label>Plate<input id="destructivePlate" placeholder="e.g. 3/8\"" /></label>'+
        '<label>Test date<input id="destructiveDate" type="date" /></label>'+
        '<label>Test method<input id="destructiveMethod" value="Guided Bend" /></label>'+
        '<label>Face Bend<select id="destructiveFaceBend"><option value="">Choose result</option><option>Satisfactory</option><option>Unsatisfactory</option></select></label>'+
        '<label>Root Bend<select id="destructiveRootBend"><option value="">Choose result</option><option>Satisfactory</option><option>Unsatisfactory</option></select></label>'+
        '<label>Inspector<input id="destructiveInspector" placeholder="Instructor / inspector" /></label>'+
        '<label>Overall Result<select id="destructiveResult"><option value="">Choose result</option><option>Pass</option><option>Fail</option></select></label>'+
        '<label style="grid-column:1/-1">Notes<input id="destructiveNotes" placeholder="Optional record note" /></label>'+
      '</div><div class="modal-actions"><button class="primary-btn" id="recordDestructiveTestBtn">Record permanent test</button></div>'+
    '</div>'+
    '<div class="card"><div class="section-head"><div><h3>Destructive-test history</h3><div class="muted small">Certificate records can only be created from passing tests.</div></div></div>'+
      '<div class="table-wrap"><table><thead><tr><th>Record</th><th>Date</th><th>Test</th><th>Cert data</th><th>Result</th><th>Certificate</th></tr></thead><tbody>'+
      (tests.length?tests.map(test=>'<tr><td><strong>'+escapeHtml(test.id)+'</strong><div class="muted tiny">Weld ID '+escapeHtml(test.weldTestId)+'</div></td><td>'+escapeHtml(test.testDate||"—")+'</td><td>'+escapeHtml(test.process+" "+test.position+(test.family==="Groove"?" · "+test.backing:""))+'</td><td>'+escapeHtml(test.testMethod||"—")+'</td><td>'+badge(test.result,test.result==="Pass"?"green":"red")+'</td><td>'+(test.certificate?'<button class="secondary-btn" data-preview-certificate="'+escapeHtml(test.certificate.id)+'">'+escapeHtml(test.certificate.id)+'</button>':test.result==="Pass"?'<button class="primary-btn" data-create-certificate="'+escapeHtml(test.id)+'">Create certificate record</button>':badge("Not eligible","gray"))+'</td></tr>').join(""):'<tr><td colspan="6" class="muted">No destructive-test records yet.</td></tr>')+
      '</tbody></table></div></div>'+
    (previewTest?renderCertificatePreview(previewTest):"");
}

function renderPrototypeCertificatePreview(test){
  const cert=test.certificate;
  const s=cert.snapshot;
  return '<div class="card"><div class="section-head"><div><div class="eyebrow">Certificate record preview</div><h3>'+escapeHtml(cert.id)+'</h3><div class="muted small">Version '+cert.version+' · generated from immutable test record '+escapeHtml(test.id)+'</div></div>'+badge("Certificate record created","green")+'</div>'+
    '<div class="grid cols-2"><div><p><strong>Student:</strong> '+escapeHtml(s.studentName)+'</p><p><strong>Weld Test ID:</strong> '+escapeHtml(s.weldTestId)+'</p><p><strong>Course:</strong> '+escapeHtml(s.courseCode)+'</p><p><strong>Destructive Test:</strong> '+escapeHtml(s.destructiveTestId)+'</p></div>'+
    '<div><p><strong>Process:</strong> '+escapeHtml(s.process)+'</p><p><strong>Specification:</strong> '+escapeHtml(s.specification||"—")+'</p><p><strong>Filler Metal:</strong> '+escapeHtml(s.fillerMetal||"—")+'</p><p><strong>Plate:</strong> '+escapeHtml(s.plate||"—")+'</p><p><strong>Position:</strong> '+escapeHtml(s.position)+'</p><p><strong>Backing:</strong> '+escapeHtml(s.backing)+'</p><p><strong>Face Bend:</strong> '+escapeHtml(s.faceBendResult||"—")+'</p><p><strong>Root Bend:</strong> '+escapeHtml(s.rootBendResult||"—")+'</p><p><strong>Result:</strong> '+escapeHtml(s.result)+'</p></div></div>'+
    '<p><strong>Test method:</strong> '+escapeHtml(s.testMethod||"—")+' · <strong>Test date:</strong> '+escapeHtml(s.testDate||"—")+' · <strong>Inspector:</strong> '+escapeHtml(s.inspector||"—")+'</p>'+
    '<div class="section-head"><div><h3>Certificate email distribution</h3><div class="muted small">Student + section instructor + jhconnolly@pccc.edu. The print recipient receives the standing note: ASAP print on thick paper.</div></div></div>'+
    ((cert.deliveries||[]).length
      ? '<div class="table-wrap"><table><thead><tr><th>Status</th><th>Recipients</th><th>Attachment</th></tr></thead><tbody>'+cert.deliveries.map(delivery=>'<tr><td>'+badge(delivery.status,delivery.status==="Sent"?"green":"yellow")+'</td><td>'+delivery.recipients.map(r=>escapeHtml(r.role+": "+r.email)).join("<br>")+'</td><td>'+escapeHtml(delivery.attachmentReference)+'</td></tr>').join("")+'</tbody></table></div>'
      : '<button class="primary-btn" data-queue-certificate-email="'+escapeHtml(test.id)+'">Queue certificate email</button>')+
    '<div class="alert">This is the certificate-record data source, not the final designed certificate/PDF. The final certificate keeps the approved PCCC certificate layout and is emailed only after its rendered PDF is attached.</div></div>';
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
    '<div class="queue-toolbar" style="margin-top:14px"><div><div class="small muted">4-Digit Weld Test ID</div><div class="stat" style="font-size:28px;letter-spacing:.12em">'+escapeHtml(student.weldTestId)+'</div></div><div class="muted small">Automatically assigned starting at 0000. Permanent once issued. It cannot be edited, duplicated, or reused and is reserved for qualification and future destructive-test certificate records.</div></div>'+
    '<div class="section-head"><div><h3>Tap the result</h3><div class="muted small">This is position-level PCCC qualification readiness. It does not automatically mark an official AWS SENSE performance test Pass.</div></div></div>'+
    '<div class="status-row">'+["Not Started","Pass","Fail"].map(s=>'<button class="status-btn '+(s==="Pass"?"verify ":"")+(rec.status===s?"selected":"")+'" data-position-qualification-status="'+s+'">'+s+'</button>').join("")+'</div>'+
    '<div class="queue-toolbar" style="margin-top:14px"><label>Date<input id="positionQualificationDate" type="date" value="'+escapeHtml(rec.date||"")+'" /></label><label style="flex:1">Optional note<input id="positionQualificationNote" value="'+escapeHtml(rec.notes||"")+'" placeholder="Short note only if needed" /></label></div>'+
    '</div>'+
    '<div class="card"><div class="section-head"><div><h3>Official AWS SENSE tests for this process</h3><div class="muted small">Preserved separately from the PCCC position matrix.</div></div></div>'+
    (officialTests.length?'<div class="table-wrap"><table><thead><tr><th>AWS Test</th><th>SWPS</th><th>Active student status</th></tr></thead><tbody>'+officialTests.map(x=>'<tr><td>'+escapeHtml(x.name)+'</td><td>'+escapeHtml(x.swps)+'</td><td>'+badge(student.qualifications[x.id]?.status||"Not Started",tone(student.qualifications[x.id]?.status||"Not Started"))+'</td></tr>').join("")+'</tbody></table></div>':'<div class="muted small">No official test definition mapped in the supplied Level I test list for this process/material variation.</div>')+
    '</div>';
}

function requestOfficialFinals(studentId){
 const request=++finalRecordRequest;
 officialFinals.set(studentId,{status:'loading',requestId:request});
 parent.postMessage({type:'tower-read-finals',studentId,requestId:request},location.origin);
}
function renderOfficialFinals(student){
 if(!officialFinals.has(student.id))requestOfficialFinals(student.id);
 const result=officialFinals.get(student.id);
 const heading='<h3>Official academic course records</h3>';
 if(result.status==='loading')return heading+'<p role="status">Loading saved course grades…</p>';
 if(result.status==='disabled')return heading+'<p>Official course finalization is not enabled yet.</p>';
 const refresh='<button class="secondary-btn" id="refreshOfficialFinals">Refresh official grades</button>';
 if(result.status==='error')return heading+'<p role="alert">'+escapeHtml(result.message)+'</p>'+refresh;
 const records=result.records||[];
 if(!records.length)return heading+'<p>No finalized course grades are available for this student in your authorized classes.</p>'+refresh;
 const latest=records.filter(r=>r.latest);
 return heading+'<p>Saved LTG final grades. Later assessment edits require a reviewed correction.</p><div class="table-wrap"><table><thead><tr><th>Course / class</th><th>Role</th><th>Final</th><th>Finalized</th></tr></thead><tbody>'+
 latest.map(r=>'<tr><td>'+escapeHtml(r.course)+'<br>'+escapeHtml(r.section)+'</td><td>'+escapeHtml(r.role)+'</td><td>'+badge(escapeHtml(String(r.grade))+'%',r.grade>=r.passingScore?'green':'red')+'</td><td>'+escapeHtml(new Date(r.finalizedAt).toLocaleString())+'</td></tr>').join('')+
 '</tbody></table></div><details><summary>Final-grade correction history</summary><ol>'+records.map(r=>'<li>'+escapeHtml(r.course+' · '+r.section+' · '+r.grade+'% · '+new Date(r.finalizedAt).toLocaleString())+(r.latest?' · Latest final':' · Earlier final')+'<p>'+escapeHtml(r.reason)+'</p></li>').join('')+'</ol></details>'+refresh;
}
function renderPassport(){
  const student=activeStudent();
  if(!student) return '<div class="card">No students.</div>';
  const sum=credentialSummary(student);
  return '<div class="card"><div class="student-banner"><div><div class="eyebrow">Student Passport</div><h3>'+escapeHtml(student.name)+'</h3><div class="student-meta">'+escapeHtml(student.studentId)+' · '+escapeHtml(student.cohort)+' · Weld Test ID '+escapeHtml(student.weldTestId)+'</div></div><div>'+badge(sum.full?"Full completion eligible":sum.partial?"Partial completion eligible":"In progress",sum.full?"green":sum.partial?"blue":"yellow")+'</div></div></div>'+
    '<div class="grid cols-2" style="margin-top:14px"><div class="card"><h3>AWS SENSE progress</h3><div class="module-progress">'+MODULES.map(m=>{const p=moduleProgress(student,m.id);return '<div class="module-line"><span>'+escapeHtml(m.name)+'</span><div class="progress-track"><div class="progress-fill" style="width:'+p+'%"></div></div><b>'+p+'%</b></div>';}).join("")+'</div></div>'+
    '<div class="card">'+renderOfficialFinals(student)+'<div class="alert blue" style="margin-top:12px"><strong>'+student.destructiveTests.length+'</strong> destructive-test record(s) · Weld Test ID '+escapeHtml(student.weldTestId)+'</div></div></div>'+
    '<div class="card"><div class="alert blue"><strong>Important:</strong> The Passport shows both records together for convenience. It does not treat a PCCC academic grade as automatic AWS SENSE verification.</div></div>';
}

function renderPrototypeAdmin(){
  const student=activeStudent();
  return '<div class="grid cols-2"><div class="card"><h3>Prototype assignment setup</h3><p class="muted small">Daily instructors should not configure this. Setup lives here so the grading screen stays clean.</p>'+
    '<button class="primary-btn" id="openAssignmentDialog">+ Add test assignment</button><div class="alert blue"><strong>Level I build:</strong> '+LEVEL1_WELDING_PROJECTS.length+' welding-position projects are loaded from the Level I position requirements. Cutting projects are listed separately until their grading rubric is defined.</div><div class="table-wrap" style="margin-top:12px"><table><thead><tr><th>Name</th><th>Process</th><th>Joint</th><th>Position</th></tr></thead><tbody>'+state.assignments.map(a=>'<tr><td>'+escapeHtml(a.name)+'</td><td>'+escapeHtml(a.process)+'</td><td>'+escapeHtml(a.family+(a.family==="Groove"?" · "+a.backing:""))+'</td><td>'+escapeHtml(a.position)+'</td></tr>').join("")+'</tbody></table></div></div>'+
    '<div class="card"><h3>AWS administrative record</h3><p class="muted small">For the active student only.</p>'+
      '<div class="form-grid"><label>Registration status<select id="awsRegistration"><option '+(student.aws.registrationStatus==="Not registered"?"selected":"")+'>Not registered</option><option '+(student.aws.registrationStatus==="Pending"?"selected":"")+'>Pending</option><option '+(student.aws.registrationStatus==="Registered"?"selected":"")+'>Registered</option></select></label>'+
      '<label>Candidate / trainee ID<input id="awsCandidateId" value="'+escapeHtml(student.aws.candidateId||"")+'" /></label>'+
      '<label>Enrollment date<input id="awsEnrollmentDate" type="date" value="'+escapeHtml(student.aws.enrollmentDate||"")+'" /></label>'+
      '<label>Completion submission<select id="awsSubmission"><option '+(student.aws.submissionStatus==="Not submitted"?"selected":"")+'>Not submitted</option><option '+(student.aws.submissionStatus==="Pending"?"selected":"")+'>Pending</option><option '+(student.aws.submissionStatus==="Submitted"?"selected":"")+'>Submitted</option></select></label></div>'+
    '</div></div>'+
    '<div class="card"><h3>LTG integration bridge</h3><p class="muted small">The prototype now exposes a normalized bridge snapshot keyed by stable LTG student identity, course ID, source system, and source key. Production integration should map these records into the existing append-only gradebook and new permanent welding-record tables.</p><button class="secondary-btn" id="exportLtgBridgeBtn">Export LTG bridge snapshot</button></div>'+
    '<div class="card"><h3>Certificate email routing</h3><p class="muted small">Production routing: student email + section instructor email + <strong>jhconnolly@pccc.edu</strong>. Standing print note: <strong>ASAP print on thick paper.</strong></p></div>'+
    '<div class="card"><h3>Prototype boundaries</h3><div class="alert">No LTG authentication, no production Supabase, no attendance linkage, no AWS submission, no real student PII, and no production write from this standalone build.</div></div>';
}

function applyGradebookContext(context){
 if(!context)return;
 if(['lab','passport'].includes(context.view)){
  if(context.view==='passport'&&state.ui.view!=='passport')officialFinals.clear();
  state.ui.view=context.view;
  document.querySelectorAll('.nav-btn').forEach(button=>{button.hidden=context.view==='lab'?button.dataset.view!=='lab'&&button.dataset.view!=='admin':!['passport','competencies','exams','qualifications','destructive','admin'].includes(button.dataset.view);});
 }
 const index=state.students.findIndex(s=>s.id===context.studentId);
 if(index>=0){state.activeStudentId=context.studentId;for(const key of ['labIndex','competencyIndexStudent','examStudentIndex','qualificationStudentIndex'])state.ui[key]=index;}
 if(state.assignments.some(a=>a.id===context.assignmentId))state.ui.labAssignmentId=context.assignmentId;
}
function render(){
  document.getElementById("viewTitle").textContent=viewTitle();
  renderStudentSelect();
  parent.postMessage({type:"tower-selection",studentId:state.activeStudentId},location.origin);
  const content=document.getElementById("appContent");
  const view=state.ui.view;
  content.innerHTML=view==="home"?renderHome():view==="lab"?renderLab():view==="courses"?renderCourseRecords():view==="competencies"?renderCompetencies():view==="exams"?renderExams():view==="qualifications"?renderQualifications():view==="destructive"?renderDestructiveTests():view==="passport"?renderPassport():renderAdmin();
  saveState();
}

function moveQueue(kind,delta){
  const key={lab:"labIndex",competency:"competencyIndexStudent",exam:"examStudentIndex",qualification:"qualificationStudentIndex"}[kind];
  if(!key) return;
  state.ui[key]=(state.ui[key]+delta+state.students.length)%state.students.length;
  applyGradebookContext({studentId:state.students[state.ui[key]].id});
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
  if(e.target.closest('#refreshOfficialFinals')){requestOfficialFinals(activeStudent().id);render();return;}
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

  if(e.target.id==="recordDestructiveTestBtn"){
    const student=activeStudent();
    const rule=destructiveRule(state.ui.destructiveProcessId);
    const family=state.ui.destructiveFamily==="Fillet"?"Fillet":"Groove";
    const specification=String(document.getElementById("destructiveSpecification")?.value||"").trim();
    const fillerMetal=String(document.getElementById("destructiveFiller")?.value||"").trim();
    const plate=String(document.getElementById("destructivePlate")?.value||"").trim();
    const method=String(document.getElementById("destructiveMethod")?.value||"").trim();
    const faceBendResult=String(document.getElementById("destructiveFaceBend")?.value||"").trim();
    const rootBendResult=String(document.getElementById("destructiveRootBend")?.value||"").trim();
    const result=String(document.getElementById("destructiveResult")?.value||"").trim();
    const testDate=String(document.getElementById("destructiveDate")?.value||"").trim();
    const inspector=String(document.getElementById("destructiveInspector")?.value||"").trim();
    if(!specification||!fillerMetal||!plate||!method||!faceBendResult||!rootBendResult||!result||!testDate||!inspector){
      alert("Enter specification, filler metal, plate, test date, method, face/root bend results, inspector, and overall Pass/Fail result.");return;
    }
    const selectedCourseId=String(document.getElementById("destructiveCourse")?.value||"wld110");
    const selectedCourse=courseById(selectedCourseId);
    const test=recordDestructiveTest(student,{
      courseId:selectedCourse.id,courseCode:selectedCourse.code,
      processId:rule.id,process:rule.label,material:rule.material,specification,fillerMetal,plate,family,
      backing:family==="Groove"?state.ui.destructiveBacking:"N/A",
      position:selectedDestructivePosition(),testMethod:method,faceBendResult,rootBendResult,result,testDate,inspector,
      notes:String(document.getElementById("destructiveNotes")?.value||"").trim()
    });
    state.ui.certificatePreviewId="";
    saveState();render();return;
  }

  const createCert=e.target.closest("[data-create-certificate]");
  if(createCert){
    const student=activeStudent(),test=student.destructiveTests.find(t=>t.id===createCert.dataset.createCertificate);
    const cert=createCertificateRecord(student,test);
    if(cert) state.ui.certificatePreviewId=cert.id;
    saveState();render();return;
  }

  const previewCert=e.target.closest("[data-preview-certificate]");
  if(previewCert){state.ui.certificatePreviewId=previewCert.dataset.previewCertificate;render();return;}

  const queueCertEmail=e.target.closest("[data-queue-certificate-email]");
  if(queueCertEmail){ alert("Use the LTG certificate delivery workspace after the certificate is saved."); return;
    const student=activeStudent(),test=student.destructiveTests.find(t=>t.id===queueCertEmail.dataset.queueCertificateEmail);
    const delivery=queueCertificateEmail(student,test);
    if(!delivery){alert("Certificate email cannot be queued until the certificate exists and student/instructor recipient emails are available.");return;}
    saveState();render();return;
  }

  if(e.target.id==="recordExamBtn"){
    const input=document.getElementById("examScoreInput"),score=Number(input.value),s=studentAt(state.ui.examStudentIndex),exam=s.exams[state.ui.examModuleId];
    if(!Number.isFinite(score)||score<0||score>100){alert("Enter a score from 0 to 100.");return;}
    if(exam.attempts.length>=2&&!exam.retrainingConfirmed){alert("Confirm retraining before Attempt 3.");return;}
    if(exam.attempts.length>=3)return;
    exam.attempts.push({score,date:new Date().toISOString().slice(0,10)});saveState();render();return;
  }

  if(e.target.id==="exportLtgBridgeBtn"){
    const blob=new Blob([JSON.stringify(buildLtgIntegrationSnapshot(state),null,2)],{type:"application/json"}),a=document.createElement("a");
    a.href=URL.createObjectURL(blob);a.download="pccc-welding-record-tower-ltg-bridge.json";a.click();URL.revokeObjectURL(a.href);return;
  }

  if(e.target.id==="openAssignmentDialog"){document.getElementById("assignmentDialog").showModal();return;}
});

document.getElementById("appContent").addEventListener("change",e=>{
  if(e.target.id==="courseRecordSelect"){state.ui.courseId=e.target.value;render();}
  if(e.target.id==="destructiveProcessSelect"){state.ui.destructiveProcessId=e.target.value;state.ui.destructivePosition="";render();}
  if(e.target.id==="destructiveFamilySelect"){state.ui.destructiveFamily=e.target.value;state.ui.destructiveBacking=e.target.value==="Groove"?"Backing":"N/A";state.ui.destructivePosition="";render();}
  if(e.target.id==="destructiveBackingSelect"){state.ui.destructiveBacking=e.target.value;render();}
  if(e.target.id==="destructivePositionSelect"){state.ui.destructivePosition=e.target.value;saveState();}
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
  if(saving||stopped||pending.size){alert("Wait for Saved to LTG before adding an assignment.");return;}
  const form=document.getElementById("assignmentForm"),data=new FormData(form);
  const name=String(data.get("name")||"").trim(),process=String(data.get("process")||"").trim();
  if(!name||!process)return;
  lastRequest={type:"tower-create-assignment",requestId:++requestId,assignmentId:crypto.randomUUID(),definition:{name,process,position:String(data.get("position")||""),electrode:String(data.get("electrode")||""),type:String(data.get("type")||"position")}};
  saving=true;setSavingStatus("Saving assignment to LTG…");parent.postMessage(lastRequest,location.origin);
});


const baseline=new Map(), revisions=new Map(), pending=new Map();
const officialFinals=new Map();
let finalRecordRequest=0;
let requestId=0, saving=false, stopped=false, lastRequest=null;
const statusEl=()=>document.getElementById("saveStatus");
function recordPayload(s){
 return {lab:s.lab,competencies:s.competencies,exams:s.exams,qualifications:s.qualifications,
 positionQualifications:s.positionQualifications,aws:s.aws,destructiveTests:s.destructiveTests};
}
function setSavingStatus(text,error=false){
 parent.postMessage({type:"tower-save-state",blocked:saving||stopped||pending.size>0||error},location.origin);
 statusEl().textContent=text;statusEl().setAttribute("role",error?"alert":"status");
 document.getElementById("retrySave").hidden=!error;
 document.querySelectorAll("#appContent button,#appContent input,#appContent select,#activeStudentSelect").forEach(el=>{if(error){el.dataset.wasDisabled=String(el.disabled);el.disabled=true;}});
}
function persistRecords(){
 if(!state || stopped)return;
 for(const s of state.students){
  const data=recordPayload(s),encoded=JSON.stringify(data);
  if(encoded!==baseline.get(s.id))pending.set(s.id,{data:JSON.parse(encoded),encoded});
 }
 flushRecords();
}
function flushRecords(){
 if(saving||stopped||!pending.size)return;
 const [id,value]=pending.entries().next().value;
 pending.delete(id);saving=true;
 lastRequest={type:"tower-save",requestId:++requestId,studentId:id,revision:revisions.get(id)||0,data:value.data,encoded:value.encoded};
 setSavingStatus("Saving to LTG…");
 parent.postMessage(lastRequest,location.origin);
}
window.addEventListener("beforeunload",e=>{if(saving||pending.size||stopped){e.preventDefault();e.returnValue="";}});
document.getElementById("retrySave").addEventListener("click",()=>{
 if(!lastRequest)return;
 stopped=false;saving=true;setSavingStatus("Retrying save…");
 parent.postMessage(lastRequest,location.origin);
});
window.addEventListener("message",e=>{
 if(e.origin!==location.origin||e.source!==parent)return;
 const m=e.data;
 if(m?.type==='tower-final-records'&&state){
  const requested=officialFinals.get(m.studentId);
  if(requested?.requestId!==m.requestId)return;
  officialFinals.set(m.studentId,{...m});
  if(state.ui.view==='passport'&&state.activeStudentId===m.studentId)render();
  return;
 }
 if(m?.type==="tower-context"&&state&&!saving&&!stopped){applyGradebookContext(m);render();}
 if(m?.type==="tower-init"){
  if(m.payload.weldSizer){
   const size=RUBRIC.find(c=>c.id==="beadSize");
   size.help=m.payload.weldSizer.help;size.choices=m.payload.weldSizer.choices;
  }
  officialFinals.clear();
  const book=m.payload.book;
  const course={id:book.id,code:book.course_code,role:"shop",label:"Shop",level:book.level_name||"",semester:book.semester_number||1,pairedCourse:book.pair_name||"",
   gradingPolicy:{version:"tower-shop-v1",passingScore:65,categories:[{code:"weld_performance",label:"Weld Performance",weight:75},{code:"shop_projects",label:"Shop Projects",weight:25}]}};
  state={schemaVersion:6,program:{name:book.section_name,instructorEmail:"",certificatePrintEmail:"",certificatePrintNote:""},
   courseCatalog:[course],assignments:m.payload.assignments.map(a=>({...a,courseId:book.id})),students:[],
   testIdRegistry:[],ui:{view:"home",courseId:book.id,labAssignmentId:m.payload.assignments[0]?.id,labIndex:0,labAttempt:"attempt1",moduleId:"m4",competencyIndex:0,competencyIndexStudent:0,examModuleId:"m2",examStudentIndex:0,qualificationProcessId:"smaw",qualificationFamily:"Groove",qualificationBacking:"Backing",qualificationPosition:"1G",qualificationStudentIndex:0,destructiveProcessId:"smaw",destructiveFamily:"Groove",destructiveBacking:"Backing",destructivePosition:"2G",certificatePreviewId:""}};
  for(const row of m.payload.students.filter(r=>r.active)){
   const s=blankStudent(row.name,row.weldTestId);
   Object.assign(s,row.data,{id:row.id,ltgStudentId:row.id,name:row.name,studentId:row.weldTestId,weldTestId:row.weldTestId,cohort:book.section_name,courseRecords:blankCourseRecords([course])});
   state.students.push(s);revisions.set(s.id,row.revision);baseline.set(s.id,JSON.stringify(recordPayload(s)));
  }
  state.activeStudentId=state.students[0]?.id;
  if(!state.students.length){document.getElementById("appContent").innerHTML="<p>No active students are enrolled in this class. Update the LTG enrollment roster first.</p>";setSavingStatus("Roster loaded");return;}
  applyGradebookContext(m.context);setSavingStatus("Saved to LTG");render();
 }
 if(m?.type==="tower-saved" && lastRequest?.requestId===m.requestId){
  const id=lastRequest.studentId;revisions.set(id,m.revision);baseline.set(id,lastRequest.encoded);
  saving=false;stopped=false;
  document.querySelectorAll("[data-was-disabled]").forEach(el=>{el.disabled=el.dataset.wasDisabled==="true";delete el.dataset.wasDisabled;});
  const current=state.students.find(s=>s.id===id);
  if(current && JSON.stringify(recordPayload(current))!==baseline.get(id)){
   const encoded=JSON.stringify(recordPayload(current));pending.set(id,{data:JSON.parse(encoded),encoded});
  }
  if(!pending.size)setSavingStatus("Saved to LTG");flushRecords();
 }
 if(m?.type==="tower-assignment-saved" && lastRequest?.requestId===m.requestId){
  saving=false;stopped=false;
  if(!state.assignments.some(a=>a.id===m.assignment.id))state.assignments.push({...m.assignment,courseId:state.courseCatalog[0].id});
  state.ui.labAssignmentId=m.assignment.id;state.ui.view="lab";
  document.getElementById("assignmentForm").reset();document.getElementById("assignmentDialog").close();
  setSavingStatus("Saved to LTG");render();
 }
 if(m?.type==="tower-error" && lastRequest?.requestId===m.requestId){
  saving=false;stopped=true;setSavingStatus(m.message||"Save failed. Keep this page open and retry.",true);
 }
});
function renderAdmin(){
 const student=activeStudent();
 return '<div class="card"><h3>LTG permanent records</h3><p>Records are saved under your authorized class and student identity. Every change preserves a revision history. Existing enrollment determines who is available here.</p><p>Weld Test ID: <strong>'+escapeHtml(student.weldTestId)+'</strong></p><a href="/gradebook" target="_parent">Open course gradebooks and attempt history</a><p><button class="primary-btn" id="openAssignmentDialog">Add class assignment</button></p></div>'+
 '<div class="card"><h3>AWS registration</h3><div class="form-grid"><label>Registration status<select id="awsRegistration">'+["Not registered","Pending","Registered"].map(v=>'<option '+(v===student.aws.registrationStatus?"selected":"")+'>'+v+'</option>').join("")+'</select></label><label>Candidate ID<input id="awsCandidateId" value="'+escapeHtml(student.aws.candidateId||"")+'"></label><label>Enrollment date<input id="awsEnrollmentDate" type="date" value="'+escapeHtml(student.aws.enrollmentDate||"")+'"></label></div><p>AWS submission is a separate authorized process; saving evidence does not submit it to AWS.</p></div>';
}
function renderCertificatePreview(test){
 return '<div class="card"><h3>Certificate record</h3><p>This certificate derives from the permanent passing test record.</p><a class="primary-btn" target="_parent" href="/tower/certificates/'+encodeURIComponent(test.id)+'">Open printable certificate</a></div>';
}
parent.postMessage({type:"tower-ready"},location.origin);

// Keep an unsuccessful save from being hidden by navigation or another edit.
document.addEventListener("click",e=>{
 if(stopped && !e.target.closest("#retrySave")){e.preventDefault();e.stopImmediatePropagation();}
},true);
