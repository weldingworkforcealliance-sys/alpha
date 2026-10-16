// @vitest-environment jsdom
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {render,screen,fireEvent,cleanup,within,waitFor} from '@testing-library/react';
import Workspace from '../app/gradebook/workspace';
const state=vi.hoisted(()=>({rpc:vi.fn(),search:'',unassigned:false}));
vi.mock('next/navigation',()=>({useSearchParams:()=>new URLSearchParams(state.search)}));
vi.mock('../app/tower/workspace',()=>({default:({gradebookId,onSaveState}:{gradebookId:string;onSaveState:(blocked:boolean)=>void})=> <section aria-label="Qualification workspace"><p>Qualification workspace</p><span>{gradebookId}</span><button onClick={()=>onSaveState(true)}>Start rubric</button><button onClick={()=>onSaveState(false)}>Finish rubric</button></section>}));
vi.mock('../app/shop/workspace',()=>({default:({gradebookId}:{gradebookId:string})=> <section aria-label="Shop workspace"><p>Shop workspace</p><span>{gradebookId}</span></section>}));
vi.mock('../app/lab/welding-history',()=>({default:({studentId,gradebookId}:{studentId:string;gradebookId:string})=><p>Welding evidence {gradebookId} {studentId}</p>}));
vi.mock('@/lib/supabase-browser',()=>({getSupabase:()=>({rpc:state.rpc,from:(table:string)=>{
 const filters:Record<string,string>={};const q={select:()=>q,eq:(key:string,value:string)=>{filters[key]=value;return q;},order:()=>q,then:(resolve:(value:unknown)=>unknown)=>Promise.resolve({data:table==='gradebook_roster'?[{student_id:'s1',display_name:'Student Alpha',active:true}]:[],error:null}).then(resolve),range:async()=>{
 const shared={section_status:'active',course_pair_id:'pair',cohort_id:'cohort',term_id:'term',program_id:'p',program_name:'Welding',level_id:'l',level_name:'Level 1',semester_id:'sem',semester_name:'Semester 1'};
 const data=table==='gradebook_directory'?[{...shared,id:'theory',section_id:'section-105',course_role:'theory',course_code:'WLD 105',section_name:'Example 105'},{...shared,id:'lab',section_id:'section-110',course_role:'lab',course_code:'WLD 110',section_name:'Example 110'},{...shared,id:'lab210',section_id:'section-210',course_pair_id:state.unassigned?null:'pair2',cohort_id:'cohort2',course_role:state.unassigned?'unassigned':'lab',course_code:'WLD 210',section_name:'Example 210'}]:table==='gradebook_roster'?[{student_id:'s1',display_name:'Student Alpha',active:true},{student_id:'s2',display_name:'Student Beta',active:true}]:table==='gradebook_items'?[{id:'i1',title:'Fractions',category_id:'c',assessment_slug:'math'}]:table==='gradebook_latest_attempts'&&filters.gradebook_id==='theory'?[{id:'a1',student_id:'s1',item_id:'i1',score:8,possible_score:10,status_code:'graded',status_label:'Graded',attempted_at:'2026-10-01',revision_id:1}]:[];
 return {data,error:null};}};return q;
}})}));
beforeEach(()=>{state.search='';state.unassigned=false;window.localStorage.clear();state.rpc.mockReset().mockResolvedValue({data:{unresolved:0},error:null});vi.stubEnv('NEXT_PUBLIC_TOWER_ENABLED','true');vi.stubEnv('NEXT_PUBLIC_WLD110_SHOP_ENABLED','true');});
afterEach(()=>{cleanup();vi.unstubAllEnvs();});
it('opens a native student record with evidence scoped to the selected student',async()=>{
 render(<Workspace/>);const buttons=await screen.findAllByRole('button',{name:'Student Alpha'},{timeout:5000});fireEvent.click(buttons[0]);
 const record=screen.getByRole('region',{name:'Student record'});
 expect(within(record).getByLabelText('Student')).toHaveProperty('value','s1');
 expect(within(record).getByText('Welding evidence lab s1')).toBeTruthy();expect(screen.queryByText('Qualification workspace')).toBeNull();
 fireEvent.change(within(record).getByLabelText('Student'),{target:{value:'s2'}});
 expect(within(record).getByText('Welding evidence lab s2')).toBeTruthy();expect(within(record).queryByText('Welding evidence lab s1')).toBeNull();
 expect(state.rpc.mock.calls.every(c=>c[0]==='refresh_gradebook')).toBe(true);
});
it('clears the student selection when the class changes and leaves qualification tools reachable',async()=>{
 render(<Workspace/>);fireEvent.click((await screen.findAllByRole('button',{name:'Student Alpha'},{timeout:5000}))[0]);
 fireEvent.change(screen.getByLabelText('Class'),{target:{value:'lab'}});
 expect(within(screen.getByRole('region',{name:'Student record'})).getByLabelText('Student')).toHaveProperty('value','');
 fireEvent.click(screen.getByText('More'));fireEvent.click(screen.getByRole('button',{name:'Qualifications'}));expect(await screen.findByText('Qualification workspace')).toBeTruthy();
});

it('makes grading prominent and keeps secondary views under More',async()=>{
 render(<Workspace/>);
 const action=await screen.findByRole('button',{name:'Shop grades & welding rubric · WLD 110'},{timeout:5000});
 expect(screen.queryByRole('button',{name:'Shop board'})).toBeNull();
 expect(screen.queryByRole('link',{name:'Open WLD 110 shop board'})).toBeNull();
 expect(screen.getByRole('button',{name:'Qualifications'}).closest('details')?.open).toBe(false);
 await screen.findAllByRole('button',{name:'Student Alpha'},{timeout:5000});
 fireEvent.click(action);expect(await screen.findByText('Shop workspace')).toBeTruthy();
 fireEvent.click(screen.getByText('More'));expect(screen.getByRole('button',{name:'Earlier welding assessments'})).toBeTruthy();
});

it.each([['110','lab','Shop workspace'],['210','lab210','Qualification workspace']])('opens the selected WLD %s class and its existing rubric',async(course,book,region)=>{
 state.search='section=section-'+course;window.localStorage.setItem('ltp_selected_section_id','section-105');
 render(<Workspace/>);
 await waitFor(()=>expect(screen.getByLabelText('Class')).toHaveProperty('value',book));
 const action=screen.getByRole('button',{name:'Shop grades & welding rubric · WLD '+course});
 await waitFor(()=>expect(action).toHaveProperty('disabled',false));fireEvent.click(action);
 expect(within(await screen.findByRole('region',{name:region})).getByText(book)).toBeTruthy();
 expect(state.rpc.mock.calls.some(c=>c[0]==='refresh_gradebook'&&c[1].p_gradebook_id===book)).toBe(true);
});

it('uses the planner selection on a plain grading link and allows a manual class change',async()=>{
 window.localStorage.setItem('ltp_selected_section_id','section-210');render(<Workspace/>);
 await waitFor(()=>expect(screen.getByLabelText('Class')).toHaveProperty('value','lab210'));
 fireEvent.change(screen.getByLabelText('Class'),{target:{value:'lab'}});
 await waitFor(()=>expect(screen.getByLabelText('Class')).toHaveProperty('value','lab'));
});

it('never substitutes another gradebook for an unavailable explicit class',async()=>{
 state.search='section=not-authorized';render(<Workspace/>);
 expect(await screen.findByRole('alert')).toHaveProperty('textContent',expect.stringContaining('not available'));
 expect(screen.getByLabelText('Class')).toHaveProperty('value','');expect(state.rpc).not.toHaveBeenCalled();
 expect(screen.queryByRole('button',{name:/Shop grades/})).toBeNull();
});

it('explains missing catalog mapping without offering the wrong rubric',async()=>{
 state.search='section=section-210';state.unassigned=true;render(<Workspace/>);
 expect(await screen.findByText(/course mapping is incomplete/)).toBeTruthy();
 expect(screen.queryByRole('button',{name:/Shop grades/})).toBeNull();
});

it('keeps an open rubric and its class until the pending save finishes',async()=>{
 state.search='section=section-210';const view=render(<Workspace/>);
 const action=await screen.findByRole('button',{name:'Shop grades & welding rubric · WLD 210'});
 await waitFor(()=>expect(action).toHaveProperty('disabled',false));fireEvent.click(action);fireEvent.click(screen.getByText('Start rubric'));
 state.search='section=section-110';view.rerender(<Workspace/>);
 expect(screen.getByLabelText('Class')).toHaveProperty('value','lab210');expect(screen.getByLabelText('Class')).toHaveProperty('disabled',true);
 expect(within(screen.getByRole('region',{name:'Qualification workspace'})).getByText('lab210')).toBeTruthy();
 fireEvent.click(screen.getByText('Finish rubric'));
 await waitFor(()=>expect(screen.getByLabelText('Class')).toHaveProperty('value','lab'));
 expect(screen.queryByRole('region',{name:'Qualification workspace'})).toBeNull();
});


it('keeps WLD 105 fabrication tools in Grading and loads them only when opened',async()=>{
 vi.stubEnv('NEXT_PUBLIC_GRADEBOOK_ENABLED','true');state.search='section=section-105';
 state.rpc.mockImplementation(async(name:string)=>({data:name==='get_wld105_homework_status'?{students:[]}:name==='get_wld105_grade_tower'?{students:[]}:{unresolved:0},error:null}));
 render(<Workspace/>);
 const action=await screen.findByRole('button',{name:/WLD 105 Grade Tower/});
 expect(state.rpc.mock.calls.some(c=>c[0]==='ensure_wld105_gradebook_setup')).toBe(false);
 fireEvent.click(action);
 await screen.findByRole('button',{name:'Save fabrication grade'});
 expect(state.rpc).toHaveBeenCalledWith('ensure_wld105_gradebook_setup',{p_gradebook_id:'theory'});
 let finish:(value:unknown)=>void=()=>{};
 state.rpc.mockImplementation((name:string)=>name==='record_wld105_fabrication_grade'?new Promise(resolve=>{finish=resolve;}):Promise.resolve({data:{students:[]},error:null}));
 fireEvent.change(screen.getByLabelText('Blueprint / Layout Accuracy score'),{target:{value:'20'}});
 fireEvent.click(screen.getByRole('button',{name:'Save fabrication grade'}));
 await waitFor(()=>expect(screen.getByLabelText('Class')).toHaveProperty('disabled',true));
 finish({data:{percent:100},error:null});
 await waitFor(()=>expect(screen.getByLabelText('Class')).toHaveProperty('disabled',false));
 fireEvent.change(screen.getByLabelText('Class'),{target:{value:'lab210'}});
 expect(screen.queryByRole('button',{name:/WLD 105 Grade Tower/})).toBeNull();
});
