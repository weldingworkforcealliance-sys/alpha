import {describe,it,expect} from 'vitest';
import {weldingEvidence} from '../lib/welding-evidence';
describe('combined welding evidence',()=>{
 it('preserves a legacy grade alongside an unfinished first shop demonstration',()=>{
  const rows=weldingEvidence([{id:'old',student_id:'a',item_id:'i',score:85.5,possible_score:100,status_label:'Graded',attempted_at:'2026-10-02'}],
   [{id:'i',title:'Existing FCAW record',assessment_slug:'tower:fcaw-1F'}],
   [{id:'first',student_id:'b',competency:0,attempt_number:1,total:90,recorded_at:'2026-10-07'}],[],['old']);
  expect(rows).toHaveLength(2);
  expect(rows[0]).toMatchObject({studentId:'b',score:90,status:'Graded demonstration · Not a completed competency'});
  expect(rows[1]).toMatchObject({title:'Existing FCAW record',score:85.5,status:'Earlier welding system · Counted grade'});
 });
 it('labels retained and counted evidence without conflating students or dropping failed attempts',()=>{
  const rows=weldingEvidence([],[],[
   {id:'one',student_id:'a',competency:0,attempt_number:1,total:80,recorded_at:'1'},
   {id:'two',student_id:'a',competency:0,attempt_number:2,total:70,recorded_at:'2'},
   {id:'three',student_id:'a',competency:0,attempt_number:3,total:90,recorded_at:'3'},
  ],[{student_id:'a',competency:0,first_attempt_id:'one',second_attempt_id:'three'}],[]);
  expect(rows.filter(row=>row.status==='Demonstration used for competency grade')).toHaveLength(2);
  expect(rows.find(row=>row.id==='weld:two')?.score).toBe(70);
 });
});
