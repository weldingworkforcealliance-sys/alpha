export type HelpAudience =
  | 'All Users'
  | 'Instructor'
  | 'School Admin'
  | 'Program Lead'
  | 'Platform Owner';

export type HelpCategory =
  | 'Getting Started'
  | 'Planner'
  | 'Attendance'
  | 'Live Classroom'
  | 'Time Clock'
  | 'Accounts & Access'
  | 'School Administration';

export type HelpGuide = {
  id: string;
  kind: 'guide';
  category: HelpCategory;
  title: string;
  summary: string;
  steps: string[];
  audience: HelpAudience[];
  keywords: string[];
  route?: string;
  note?: string;
};

export type HelpQA = {
  id: string;
  kind: 'qa';
  category: HelpCategory;
  question: string;
  answer: string;
  steps?: string[];
  audience: HelpAudience[];
  keywords: string[];
  route?: string;
  note?: string;
};

export type HelpItem = HelpGuide | HelpQA;

export const HELP_GUIDES: HelpGuide[] = [
  { id:'guide-select-class',kind:'guide',category:'Planner',title:'Select a class and course in the Planner',summary:'Choose the cohort/class and course before opening the teaching day you want to use.',steps:['Open Planner from the left sidebar.','In Select Class, choose the cohort or class you are teaching.','Choose the course connected to that class.','Confirm the selected class and instructor information before continuing.','Use the Current Teaching Day controls to open the day you need.'],audience:['Instructor','School Admin','Program Lead','Platform Owner'],keywords:['select class','choose class','course','cohort','planner','teaching day'],route:'/dashboard' },
  { id:'guide-navigate-day',kind:'guide',category:'Planner',title:'Move to another Planner day',summary:'Preview another teaching day without changing the approved curriculum.',steps:['Open Planner and select the correct class and course.','Use the Go to Day selector to choose a planner day.','Use Previous Day or Next Day for one-day navigation.','Check the displayed day number and title before teaching from the page.'],audience:['Instructor','School Admin','Program Lead','Platform Owner'],keywords:['go to day','next day','previous day','planner day','day navigation'],route:'/dashboard' },
  { id:'guide-take-attendance',kind:'guide',category:'Attendance',title:'Take student attendance during class',summary:'Attendance can be controlled directly from the open Planner so the instructor does not have to leave the teaching screen.',steps:['Open Planner and select the class you are teaching.','Open the Student Attendance panel near the top of the Planner.','Use Mark All Present when appropriate, then change individual students to Absent, Late, or Excused as needed.','Add student notes or end-of-pair flags when required.','For paired-course completion days, complete the final attendance confirmation before finalizing.'],audience:['Instructor','School Admin','Program Lead','Platform Owner'],keywords:['attendance','present','absent','late','excused','mark all present','planner attendance'],route:'/dashboard',note:'The standalone Student Attendance page remains available for history, date changes, and administrative work.' },
  { id:'guide-add-roster',kind:'guide',category:'Attendance',title:'Add students to an attendance roster',summary:'Create or open the attendance pair first, then paste the shared roster in one batch.',steps:['Open Student Attendance, then open Attendance Pair Configuration.','Choose the school and the two paired courses/sections.','Save the attendance pair.','In Shared Student Roster, paste one student name per line.','Select Add / Reactivate Students.','Confirm the students appear in the active roster.'],audience:['School Admin','Program Lead','Platform Owner'],keywords:['roster','add students','paste students','attendance pair','reactivate students','shared roster'],route:'/attendance/admin' },
  { id:'guide-launch-live-test',kind:'guide',category:'Live Classroom',title:'Launch a planner-linked Live Classroom assessment',summary:'Start the assessment from the Planner resource so LTG keeps the correct class and assessment locked together.',steps:['Open Planner and select the correct class.','Open the planner day containing the assessment.','Use the assessment resource in that day instead of manually choosing a different test.','Confirm the class and assessment shown on the Live Classroom launcher.','Start the session and display the QR code or join code for students.','Watch Live Progress as students submit.','End the session when the class is finished.'],audience:['Instructor','School Admin','Program Lead','Platform Owner'],keywords:['live classroom','assessment','qr code','join code','blueprint','student test','live progress'],route:'/classroom' },
  { id:'guide-clock-in-out',kind:'guide',category:'Time Clock',title:'Clock in or out',summary:'Use the Punch Clock on the Planner or open the full Employee Time Clock.',steps:['Open Planner and locate the Punch Clock near the top of the screen, or open Employee Time Clock from the sidebar.','Select Clock In when beginning paid work.','Confirm LTG shows an active clock session.','Select Clock Out when finished.','If LTG warns about an open shift during sign out, return to the time clock and close the shift first.'],audience:['Instructor','School Admin','Program Lead','Platform Owner'],keywords:['clock in','clock out','punch clock','employee time clock','hours','open shift'],route:'/time-clock' },
  { id:'guide-theme',kind:'guide',category:'Getting Started',title:'Change between light and dark appearance',summary:'LTG remembers the appearance selected on that browser for the user experience.',steps:['Go to the bottom of the left sidebar.','Use the theme control to switch between the light and dark versions.','Continue using LTG normally; the page layout and controls stay in the same places.'],audience:['All Users'],keywords:['light','dark','theme','appearance','color','display'] },
  { id:'guide-add-school-admin',kind:'guide',category:'Accounts & Access',title:'Assign a School Administrator',summary:'Only the Platform Owner can assign the School Admin role.',steps:['Open Owner Dashboard, then Account Management.','Choose the school.','For an existing LTG user, use the existing-user workflow and enter the user email. For a new user, use the new-user invitation workflow.','Choose School Admin as the role.','Enter the required reason for the access change.','Save or send the invitation.'],audience:['Platform Owner'],keywords:['school administrator','school admin','account management','role','invite user','existing user'],route:'/accounts' },
  { id:'guide-sign-out',kind:'guide',category:'Getting Started',title:'Sign out of LTG',summary:'The Sign Out control stays at the bottom of the left sidebar.',steps:['Scroll to the bottom of the left sidebar if necessary.','Select Sign Out.','If LTG detects an open employee time-clock shift, follow the warning to the time clock and close the shift before signing out.'],audience:['All Users'],keywords:['sign out','logout','log out','exit','sidebar'] },
];

export const HELP_QA: HelpQA[] = [
  { id:'qa-add-remove-instructor-class',kind:'qa',category:'School Administration',question:'On the School Dashboard, how do I add or remove instructors from a class?',answer:'Currently, only the Platform Owner can add or remove instructors from a class. The School Dashboard shows instructor assignments, but it does not currently provide assignment controls.',steps:['Sign in as the Platform Owner.','Open Owner Dashboard, then Owner Admin.','Choose the class/section in the instructor assignment controls.','To add an instructor, choose the instructor, choose the assignment role, enter the required reason, and save.','To remove an instructor, select the active instructor assignment, enter the required reason, remove the instructor, and confirm. Historical records remain.'],audience:['School Admin','Program Lead','Platform Owner'],keywords:['add instructor','remove instructor','assign instructor','class instructor','section instructor','school dashboard','owner admin'],route:'/owner/admin',note:'This is a current permission limitation, not a missing button on the School Dashboard.' },
  { id:'qa-where-roster',kind:'qa',category:'Attendance',question:'Where do I add the student roster?',answer:'Use Attendance Pair Configuration. The Shared Student Roster becomes active after the attendance pair is saved.',steps:['Open Student Attendance, then Attendance Pair Configuration.','Save or open the correct attendance pair.','Paste one student name per line into Shared Student Roster.','Select Add / Reactivate Students.'],audience:['School Admin','Program Lead','Platform Owner'],keywords:['where roster','student roster','add names','attendance admin','shared student roster'],route:'/attendance/admin' },
  { id:'qa-calendar-location',kind:'qa',category:'Planner',question:'Where is the class calendar?',answer:'The Class Calendar is inside the Planner. Scroll below the teaching-day content to the Class Calendar section.',audience:['Instructor','School Admin','Program Lead','Platform Owner'],keywords:['calendar','class calendar','schedule','planner calendar'],route:'/dashboard' },
  { id:'qa-school-dashboard-access',kind:'qa',category:'School Administration',question:'Why can I not see the School Dashboard?',answer:'School Dashboard visibility depends on LTG access. Platform Owners and users with an eligible active school-management role can open it. Standard instructor-only accounts use the teaching workspace instead.',audience:['All Users'],keywords:['school dashboard missing','cannot see school dashboard','permissions','access','role'],route:'/school' },
  { id:'qa-time-clock-not-assigned',kind:'qa',category:'Time Clock',question:'Why does the Punch Clock say “Time clock not assigned”?',answer:'The LTG login currently being used is not linked to an active employee time-clock record. Class assignment and time-clock employee assignment are separate records.',audience:['Instructor','School Admin','Program Lead','Platform Owner'],keywords:['time clock not assigned','punch clock','employee record','clock not working'],route:'/time-clock' },
];

export const HELP_ITEMS: HelpItem[] = [...HELP_GUIDES, ...HELP_QA];

function itemSearchText(item: HelpItem) {
  const common = [item.category, ...item.audience, ...item.keywords, item.route ?? '', item.note ?? ''];
  if (item.kind === 'guide') return [...common, item.title, item.summary, ...item.steps].join(' ').toLowerCase();
  return [...common, item.question, item.answer, ...(item.steps ?? [])].join(' ').toLowerCase();
}

export function searchHelpItems(query: string, items: HelpItem[] = HELP_ITEMS) {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!tokens.length) return items;
  return items.filter((item) => {
    const haystack = itemSearchText(item);
    return tokens.every((token) => haystack.includes(token));
  });
}
