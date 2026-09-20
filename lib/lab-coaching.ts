export type LabCoaching = {
 student_id:string;display_name:string;course_code:string;section_name:string;revision:number;
 assignment_id:string|null;assignment:{name:string;process:string;position:string;electrode:string}|null;
 focus:string[];note:string;saved_at:string|null;requested_at:string|null;
};
export type LabContext={studentId:string;assignmentId:string;action?:'coach'|'qr';requestId?:number};
export const PRACTICE_FOCUS=['Continue current project','Targeted booth coaching','Instructor demonstration','Scrap exercise','Additional coupon','Setup / fit-up','Arc length','Travel speed','Work angle','Travel angle','Starts / stops','Cleaning','Weld size / profile','Inspection / measurement'];
