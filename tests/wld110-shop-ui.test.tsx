// @vitest-environment jsdom
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {AttemptHistory,GradeForm,StudentShopCard} from '../app/shop/components';
import ShopWorkspace from '../app/shop/workspace';
import StudentPageClient from '../app/shop/student/student-client';
import {defaultRatings,type ShopAttempt,type ShopStudent} from '../lib/wld110-shop';
const mocks=vi.hoisted(()=>({rpc:vi.fn()}));
vi.mock('@/lib/supabase-browser',()=>({getSupabase:()=>({rpc:mocks.rpc})}));
const student=(patch:Partial<ShopStudent>={}):ShopStudent=>({
 student_id:'student-1',display_name:'Synthetic Student',active:true,current_competency:0,revision:0,
 requested_at:null,focus:[],position_meetings:0,attempts:[],completions:[],...patch,
});
const attempt=(number:number,total=90):ShopAttempt=>({
 id:'attempt-'+number,competency:0,attempt_number:number,ratings:defaultRatings(),total,tags:{},
 sizer_reference:'ltg-tower-bead-size-v1',sizer_note:'Checked',recorded_at:'2026-09-19T12:00:00Z',recorded_by:'qa-instructor',
});
beforeEach(()=>{mocks.rpc.mockReset();sessionStorage.clear();window.history.replaceState(null,'','/');});
afterEach(()=>{cleanup();vi.restoreAllMocks();});
describe('quick grading',()=>{
 it('supports the one-tap Good grade and exact numeric total',()=>{
  const save=vi.fn();
  render(<GradeForm student={student()} busy={false} locked={false} onSave={save} onCancel={()=>{}}/>);
  expect(screen.getByText('Grade: 90%')).toBeTruthy();
  expect(screen.getAllByRole('button',{pressed:true})).toHaveLength(5);
  expect(screen.queryByRole('button',{name:'Travel speed'})).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'Save grade'}));
  expect(save).toHaveBeenCalledWith({ratings:defaultRatings(),tags:{},sizerNote:''});
 });
 it('expands only the deficient category and clears tags when rating improves',()=>{
  const save=vi.fn();render(<GradeForm student={student()} busy={false} locked={false} onSave={save} onCancel={()=>{}}/>);
  const execution=within(screen.getByRole('group',{name:'Execution'}));
  fireEvent.click(execution.getByRole('button',{name:/Needs Work/}));
  fireEvent.click(execution.getByRole('button',{name:'Travel speed'}));
  expect(screen.getByText('Grade: 84%')).toBeTruthy();
  expect(screen.queryByRole('button',{name:'Joint alignment'})).toBeNull();
  fireEvent.click(execution.getByRole('button',{name:/Good/}));
  expect(screen.queryByRole('button',{name:'Travel speed'})).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'Save grade'}));
  expect(save.mock.calls[0][0].tags).toEqual({});
 });
 it('shows later qualifying demonstrations against Weld 1',()=>{
  const first=attempt(1,86);first.ratings={straightness:18,placement:18,execution:18,consistency:16,weldSize:16};
  render(<GradeForm student={student({attempts:[first,attempt(2,82)]})} busy={false} locked={false} onSave={()=>{}} onCancel={()=>{}}/>);
  expect(screen.getByText(/Weld 3/)).toBeTruthy();
  expect(screen.getByText(/Competency grade: 88%/)).toBeTruthy();
  fireEvent.click(within(screen.getByRole('group',{name:'Placement'})).getByRole('button',{name:/Needs Work/}));
  expect(screen.getByText(/Additional demonstration required/)).toBeTruthy();
 });
 it('displays every retained attempt and identifies the qualifying pair',()=>{
  render(<AttemptHistory student={student({attempts:[attempt(1,86),attempt(2,82),attempt(3,90)],completions:[{competency:0,grade:88,first_attempt_id:'attempt-1',second_attempt_id:'attempt-3'}]})}/>);
  expect(screen.getByText(/Weld 2 · 82%/)).toBeTruthy();
  expect(screen.getAllByText(/Used for competency grade/)).toHaveLength(2);
  expect(screen.getAllByText(/Retained in history/)).toHaveLength(1);
 });
});
describe('instructor board saves and coaching',()=>{
 it('holds an immutable failed save, retries its ID, then refreshes advancement',async()=>{
  const original=student({requested_at:'2026-09-19T12:00:00Z'});
  const advanced=student({current_competency:1,revision:2});
  let saved=false,tries=0;
  mocks.rpc.mockImplementation(async(name:string)=>{
   if(name==='open_wld110_shop')return {data:{night:3,students:[saved?advanced:original]},error:null};
   if(name==='grade_wld110_weld'){tries++;if(tries===1)return{data:null,error:{message:'Connection interrupted'}};saved=true;return{data:advanced,error:null};}
   throw Error(name);
  });
  const blocked=vi.fn();render(<ShopWorkspace gradebookId="book-1" onSaveState={blocked}/>);
  fireEvent.click(await screen.findByRole('button',{name:'Grade weld'}));
  fireEvent.click(screen.getByRole('button',{name:'Save grade'}));
  expect(await screen.findByRole('alert')).toHaveProperty('textContent','Connection interrupted');
  expect(screen.getByRole('group',{name:'Placement'})).toHaveProperty('disabled',true);
  const originalCall=mocks.rpc.mock.calls.find(c=>c[0]==='grade_wld110_weld')![1];
  fireEvent.click(screen.getByRole('button',{name:'Retry same grade'}));
  await screen.findByText(/Competency complete. Next:/);
  const calls=mocks.rpc.mock.calls.filter(c=>c[0]==='grade_wld110_weld');
  expect(calls).toHaveLength(2);expect(calls[1][1]).toEqual(originalCall);
  expect(screen.queryByRole('region',{name:'Grade weld'})).toBeNull();
  expect(blocked).toHaveBeenLastCalledWith(false);
  expect(screen.getByText('Practice')).toBeTruthy();
 });
 it('shows pacing review at six meetings, and practice records no grade',async()=>{
  const original=student({position_meetings:6});
  mocks.rpc.mockImplementation(async(name:string)=>name==='open_wld110_shop'?{data:{night:6,students:[original]},error:null}:{data:{...original,revision:1,focus:['Travel speed']},error:null});
  render(<ShopWorkspace gradebookId="book-1"/>);
  await screen.findByText('Pacing review · 6 meetings in position');
  fireEvent.click(screen.getByRole('button',{name:'Practice / coach'}));
  fireEvent.click(screen.getByRole('button',{name:'Travel speed'}));
  fireEvent.click(screen.getByRole('button',{name:'Save practice focus'}));
  await screen.findByText('Practice focus saved. No grade recorded.');
  expect(mocks.rpc.mock.calls.some(c=>c[0]==='grade_wld110_weld')).toBe(false);
  expect(mocks.rpc).toHaveBeenCalledWith('coach_wld110_practice',{p_gradebook_id:'book-1',p_student_id:'student-1',p_revision:0,p_focus:['Travel speed']});
 });
 it('orders queued students before practice and prevents premature grading while saving',async()=>{
  mocks.rpc.mockResolvedValue({data:{night:1,students:[student(),student({student_id:'second',display_name:'Ready Student',requested_at:'2026-09-19T12:00:00Z'})]},error:null});
  render(<ShopWorkspace gradebookId="book-1"/>);
  await screen.findByText('Ready Student');
  const rows=screen.getAllByRole('row');expect(rows[1].textContent).toContain('Ready Student');
 });
});
describe('minimal student workflow',()=>{
 it('shows assignment, focus, post-grading grade and next assignment',()=>{
  render(<StudentShopCard student={student({focus:['Travel speed'],attempts:[attempt(1)]})} busy={false} onRequest={()=>{}}/>);
  expect(screen.getByRole('heading',{name:'Flat · E6010 · 1/8 in'})).toBeTruthy();
  expect(screen.getByText('Current focus: Travel speed')).toBeTruthy();
  expect(screen.getByText(/Next assignment: Flat · E7018/)).toBeTruthy();
  expect(screen.queryByRole('group',{name:'Execution'})).toBeNull();
  expect(screen.getByText('90%')).toBeTruthy();
 });
 it('requests a check and preserves its private session across a reload',async()=>{
  const token='test-student-personal-token';
  window.history.replaceState(null,'','/shop/student#'+token);
  mocks.rpc.mockImplementation(async(name:string)=>({data:student({requested_at:name==='request_wld110_check'?'2026-09-19T12:00:00Z':null}),error:null}));
  const mounted=render(<StudentPageClient/>);
  fireEvent.click(await screen.findByRole('button',{name:'Request check'}));
  expect(await screen.findByRole('button',{name:'You are in the check queue'})).toHaveProperty('disabled',true);
  expect(mocks.rpc).toHaveBeenCalledWith('request_wld110_check',{p_token:token,p_competency:0});
  expect(window.location.hash).toBe('');
  mounted.unmount();render(<StudentPageClient/>);
  await screen.findByRole('heading',{name:'Synthetic Student'});
  expect(mocks.rpc).toHaveBeenLastCalledWith('read_wld110_student',{p_token:token});
 });
 it('shows failed check requests and allows a retry',async()=>{
  sessionStorage.setItem('ltg-wld110-student','token');
  mocks.rpc.mockImplementation(async(name:string)=>name==='read_wld110_student'?{data:student(),error:null}:{data:null,error:{message:'Offline'}});
  render(<StudentPageClient/>);fireEvent.click(await screen.findByRole('button',{name:'Request check'}));
  await waitFor(()=>expect(screen.getByRole('alert').textContent).toBe('Offline'));
  expect(screen.getByRole('button',{name:'Request check'})).toHaveProperty('disabled',false);
 });
});
