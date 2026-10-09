// @vitest-environment jsdom
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {render,screen,fireEvent,cleanup,within} from '@testing-library/react';
import Workspace from '../app/gradebook/workspace';
const state=vi.hoisted(()=>({rpc:vi.fn()}));
vi.mock('../app/tower/workspace',()=>({default:()=> <p>Qualification workspace</p>}));
vi.mock('../app/shop/workspace',()=>({default:()=> <p>Shop workspace</p>}));
vi.mock('../app/lab/welding-history',()=>({default:({studentId,gradebookId}:{studentId:string;gradebookId:string})=><p>Welding evidence {gradebookId} {studentId}</p>}));
vi.mock('@/lib/supabase-browser',()=>({getSupabase:()=>({rpc:state.rpc,from:(table:string)=>{
 const filters:Record<string,string>={};const q={select:()=>q,eq:(key:string,value:string)=>{filters[key]=value;return q;},order:()=>q,range:async()=>{
 const shared={section_status:'active',course_pair_id:'pair',cohort_id:'cohort',term_id:'term',program_id:'p',program_name:'Welding',level_id:'l',level_name:'Level 1',semester_id:'sem',semester_name:'Semester 1'};
 const data=table==='gradebook_directory'?[{...shared,id:'theory',course_role:'theory',course_code:'WLD 105',section_name:'Example 105'},{...shared,id:'lab',course_role:'lab',course_code:'WLD 110',section_name:'Example 110'}]:table==='gradebook_roster'?[{student_id:'s1',display_name:'Student Alpha',active:true},{student_id:'s2',display_name:'Student Beta',active:true}]:table==='gradebook_items'?[{id:'i1',title:'Fractions',category_id:'c',assessment_slug:'math'}]:table==='gradebook_latest_attempts'&&filters.gradebook_id==='theory'?[{id:'a1',student_id:'s1',item_id:'i1',score:8,possible_score:10,status_code:'graded',status_label:'Graded',attempted_at:'2026-10-01',revision_id:1}]:[];
 return {data,error:null};}};return q;
}})}));
beforeEach(()=>{state.rpc.mockReset().mockResolvedValue({data:{unresolved:0},error:null});vi.stubEnv('NEXT_PUBLIC_TOWER_ENABLED','true');vi.stubEnv('NEXT_PUBLIC_WLD110_SHOP_ENABLED','true');});
afterEach(()=>{cleanup();vi.unstubAllEnvs();});
it('opens a native student record with evidence scoped to the selected student',async()=>{
 render(<Workspace/>);const buttons=await screen.findAllByRole('button',{name:'Student Alpha'});fireEvent.click(buttons[0]);
 const record=screen.getByRole('region',{name:'Student record'});
 expect(within(record).getByLabelText('Student')).toHaveProperty('value','s1');
 expect(within(record).getByText('Welding evidence lab s1')).toBeTruthy();expect(screen.queryByText('Qualification workspace')).toBeNull();
 fireEvent.change(within(record).getByLabelText('Student'),{target:{value:'s2'}});
 expect(within(record).getByText('Welding evidence lab s2')).toBeTruthy();expect(within(record).queryByText('Welding evidence lab s1')).toBeNull();
 expect(state.rpc.mock.calls.every(c=>c[0]==='refresh_gradebook')).toBe(true);
});
it('clears the student selection when the class changes and leaves qualification tools reachable',async()=>{
 render(<Workspace/>);fireEvent.click((await screen.findAllByRole('button',{name:'Student Alpha'}))[0]);
 fireEvent.change(screen.getByLabelText('Class'),{target:{value:'lab'}});
 expect(within(screen.getByRole('region',{name:'Student record'})).getByLabelText('Student')).toHaveProperty('value','');
 fireEvent.click(screen.getByRole('button',{name:'Qualifications'}));expect(await screen.findByText('Qualification workspace')).toBeTruthy();
});
