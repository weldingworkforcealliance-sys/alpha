import {assignmentLabel,shopItemTitle} from './wld110-shop';

export type EvidenceGrade = {id:string;student_id:string;item_id:string;score:number|null;possible_score:number|null;status_label:string;attempted_at:string};
export type EvidenceItem = {id:string;title:string;assessment_slug:string|null};
export type EvidenceWeld = {id:string;student_id:string;competency:number;attempt_number:number;total:number;recorded_at:string};
export type EvidenceCompletion = {student_id:string;competency:number;first_attempt_id:string;second_attempt_id:string};
export type WeldingEvidence = {id:string;studentId:string;title:string;score:number|null;possible:number|null;status:string;date:string};

// Individual demonstrations are evidence, not additional weighted course grades.
export function weldingEvidence(grades:EvidenceGrade[],items:EvidenceItem[],welds:EvidenceWeld[],completions:EvidenceCompletion[],countedIds:string[]):WeldingEvidence[] {
 const catalog=new Map(items.map(item=>[item.id,item]));
 const counted=new Set(countedIds);
 return [
  ...grades.flatMap(grade=>{
   const item=catalog.get(grade.item_id);
   if(!item||!(/^(tower:|wld110-shop:)/.test(item.assessment_slug??'')))return [];
   return [{id:'grade:'+grade.id,studentId:grade.student_id,title:shopItemTitle(item),score:grade.score,possible:grade.possible_score,date:grade.attempted_at,
    status:item.assessment_slug?.startsWith('tower:')?(counted.has(grade.id)?'Earlier welding system · Counted grade':'Earlier welding system · Retained attempt'):'Completed competency · '+grade.status_label}];
  }),
  ...welds.map(weld=>({id:'weld:'+weld.id,studentId:weld.student_id,title:assignmentLabel(weld.competency)+' · Weld '+weld.attempt_number,score:weld.total,possible:100,date:weld.recorded_at,
   status:completions.some(c=>c.student_id===weld.student_id&&c.competency===weld.competency&&[c.first_attempt_id,c.second_attempt_id].includes(weld.id))?'Demonstration used for competency grade':'Graded demonstration · Not a completed competency'})),
 ].sort((a,b)=>b.date.localeCompare(a.date)||a.id.localeCompare(b.id));
}
