// @vitest-environment jsdom
import {afterEach,beforeEach,it,expect,vi} from 'vitest';
import {cleanup,render,screen,waitFor} from '@testing-library/react';
import WeldingHistory from '../app/lab/welding-history';
const mock=vi.hoisted(()=>({queries:[] as {table:string;filters:Record<string,string>}[],fail:false}));
vi.mock('@/lib/supabase-browser',()=>({getSupabase:()=>({from:(table:string)=>{
 const filters:Record<string,string>={};
 const query={select:()=>query,eq:(key:string,value:string)=>{filters[key]=value;return query;},order:()=>query,range:async()=>{
  mock.queries.push({table,filters:{...filters}});
  const data=table==='wld110_shop_attempts'?[{id:'w',student_id:filters.student_id??'student-1',competency:0,attempt_number:1,total:90,recorded_at:'2026-10-07'}]:table==='gradebook_roster'?[{student_id:filters.student_id??'student-1',display_name:'Synthetic Student',active:true}]:[];
  return {data,error:mock.fail?new Error('unavailable'):null};
 }};return query;
}})}));
beforeEach(()=>{mock.queries=[];mock.fail=false;});
afterEach(cleanup);
it('shows an unfinished demonstration and scopes every student record read to its class and student',async()=>{
 render(<WeldingHistory gradebookId="class-1" studentId="student-1"/>);
 await screen.findByText('90 / 100 (90%)');
 expect(screen.getByText('Graded demonstration · Not a completed competency')).toBeTruthy();
 expect(mock.queries).toHaveLength(6);
 expect(mock.queries.every(q=>q.filters.gradebook_id==='class-1')).toBe(true);
 expect(mock.queries.filter(q=>q.table!=='gradebook_items').every(q=>q.filters.student_id==='student-1')).toBe(true);
});
it('does not turn a failed read into a false no-grades statement',async()=>{
 mock.fail=true;render(<WeldingHistory gradebookId="class-1"/>);
 await screen.findByRole('alert');
 expect(screen.queryByText(/No welding grades/)).toBeNull();
});
it('loads the newly selected student rather than retaining the previous evidence',async()=>{
 const view=render(<WeldingHistory gradebookId="class-1" studentId="student-1"/>);
 await screen.findByText('90 / 100 (90%)');mock.queries=[];
 view.rerender(<WeldingHistory gradebookId="class-2" studentId="student-2"/>);
 await waitFor(()=>expect(mock.queries).toHaveLength(6));
 expect(mock.queries.every(q=>q.filters.gradebook_id==='class-2')).toBe(true);
 expect(mock.queries.filter(q=>q.table!=='gradebook_items').every(q=>q.filters.student_id==='student-2')).toBe(true);
});
