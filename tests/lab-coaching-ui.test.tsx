// @vitest-environment jsdom
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import LabCoachingPanel from '../app/lab/coaching-panel';
import LabStudentClient from '../app/lab/student/student-client';
import type {LabCoaching} from '../lib/lab-coaching';
const mocks=vi.hoisted(()=>({rpc:vi.fn(),qr:vi.fn()}));
vi.mock('@/lib/supabase-browser',()=>({getSupabase:()=>({rpc:mocks.rpc})}));
vi.mock('qrcode',()=>({default:{toDataURL:mocks.qr}}));
const row=(patch:Partial<LabCoaching>={}):LabCoaching=>({
 student_id:'one',display_name:'Synthetic Welder',course_code:'WLD 210',section_name:'Level 2',revision:0,
 assignment_id:null,assignment:null,focus:[],note:'',saved_at:null,requested_at:null,...patch,
});
const props={gradebookId:'lab-210',context:{studentId:'one',assignmentId:'3g'},assignments:[{id:'3g',name:'Level 2 3G'}],disabled:false,onBlocked:vi.fn(),onSelect:vi.fn()};
function setup({saveError=false,linkError=false}={}){
 let current=row(),saves=0,links=0;
 mocks.rpc.mockImplementation(async(name:string,args:Record<string,unknown>)=>{
  if(name==='open_lab_coaching')return {data:[current,row({student_id:'two',display_name:'Second Welder'})],error:null};
  if(name==='save_lab_coaching'){
   if(saveError&&saves++===0)return {data:null,error:{message:'Connection interrupted'}};
   current={...current,revision:1,assignment_id:'3g',assignment:{name:'Level 2 3G',process:'SMAW',position:'3G',electrode:'E7018'},focus:args.p_focus as string[],note:args.p_note as string};
   return {data:current,error:null};
  }
  if(name==='issue_lab_student_link'){
   if(linkError&&links++===0)return {data:null,error:{message:'Offline'}};
   return {data:'token-'+args.p_student_id,error:null};
  }
  throw Error(name);
 });
}
beforeEach(()=>{mocks.rpc.mockReset();mocks.qr.mockReset().mockResolvedValue('data:image/png;base64,synthetic');sessionStorage.clear();window.history.replaceState(null,'','/');props.onBlocked.mockClear();props.onSelect.mockClear();});
afterEach(()=>{cleanup();vi.restoreAllMocks();});
async function coaching(){
 fireEvent.click(await screen.findByRole('button',{name:'Practice / coach'}));
 fireEvent.click(screen.getByRole('button',{name:'Travel speed'}));
 fireEvent.change(screen.getByRole('textbox',{name:'Coaching note (optional)'}),{target:{value:'Keep a steady arc.'}});
 fireEvent.click(screen.getByRole('button',{name:'Save practice focus'}));
}
describe('core lab coaching handoff',()=>{
 it.each(['WLD 210','FAB 900'])('shows the saved student QR in a %s lab without changing grades',async(course)=>{
  setup();render(<LabCoachingPanel {...props} gradebookId={course}/>);
  await coaching();
  await screen.findByRole('img',{name:'Scan to open the shop card for Synthetic Welder'});
  const card=within(screen.getByRole('region',{name:'Student QR code'}));
  expect(card.getByText('Coaching saved · No grade recorded')).toBeTruthy();
  expect(card.getByText(/Level 2 3G/)).toBeTruthy();
  expect(card.getByText('Keep a steady arc.')).toBeTruthy();
  expect(card.getByText(/Travel speed/)).toBeTruthy();
  expect(screen.queryByRole('region',{name:'Practice coaching form'})).toBeNull();
  expect(mocks.rpc.mock.calls.filter(c=>c[0].includes('grade')||c[0]==='save_tower_student')).toHaveLength(0);
  expect(mocks.qr).toHaveBeenCalledWith(window.location.origin+'/lab/student#token-one',expect.objectContaining({width:280,margin:4}));
  expect(props.onBlocked).toHaveBeenLastCalledWith(false);
 });
 it('keeps an uncertain coaching save immutable and retries the same ID',async()=>{
  setup({saveError:true});render(<LabCoachingPanel {...props}/>);
  await coaching();await screen.findByText('Connection interrupted');
  expect(screen.getByRole('textbox')).toHaveProperty('disabled',true);
  expect(screen.queryByRole('region',{name:'Student QR code'})).toBeNull();
  const first=mocks.rpc.mock.calls.find(c=>c[0]==='save_lab_coaching')![1];
  fireEvent.click(screen.getByRole('button',{name:'Retry coaching save'}));
  await screen.findByRole('img');
  expect(mocks.rpc.mock.calls.filter(c=>c[0]==='save_lab_coaching')[1][1]).toEqual(first);
 });
 it('retries a failed QR without repeating the coaching save',async()=>{
  setup({linkError:true});render(<LabCoachingPanel {...props}/>);
  await coaching();await screen.findByText('Student QR code could not load. Try again.');
  expect(screen.getByText('Coaching saved · No grade recorded')).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'Retry student QR'}));
  await screen.findByRole('img');
  expect(mocks.rpc.mock.calls.filter(c=>c[0]==='save_lab_coaching')).toHaveLength(1);
 });
 it('hides the previous QR when switching students and reuses that student’s link',async()=>{
  setup();const mounted=render(<LabCoachingPanel {...props}/>);
  await coaching();await screen.findByRole('img');
  mounted.rerender(<LabCoachingPanel {...props} context={{studentId:'two',assignmentId:'3g'}}/>);
  expect(screen.queryByRole('img')).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'Student QR'}));
  await screen.findByRole('img',{name:'Scan to open the shop card for Second Welder'});
  mounted.rerender(<LabCoachingPanel {...props}/>);
  expect(screen.queryByRole('img')).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'Student QR'}));
  await screen.findByRole('img',{name:'Scan to open the shop card for Synthetic Welder'});
  expect(mocks.rpc.mock.calls.filter(c=>c[0]==='issue_lab_student_link'&&c[1].p_student_id==='one')).toHaveLength(1);
 });
 it('opens coaching from the assessment screen and holds navigation until it closes',async()=>{
  setup();render(<LabCoachingPanel {...props} context={{...props.context,action:'coach',requestId:1}}/>);
  await screen.findByRole('region',{name:'Practice coaching form'});
  expect(props.onBlocked).toHaveBeenLastCalledWith(true);
  fireEvent.click(screen.getByRole('button',{name:'Cancel'}));
  await waitFor(()=>expect(props.onBlocked).toHaveBeenLastCalledWith(false));
  expect(screen.queryByRole('region',{name:'Practice coaching form'})).toBeNull();
 });
 it('routes a queued check to the correct student and assignment',async()=>{
  mocks.rpc.mockResolvedValue({data:[row({requested_at:'2026-09-20T12:00:00Z',assignment_id:'3g'})],error:null});
  render(<LabCoachingPanel {...props}/>);
  fireEvent.click(await screen.findByRole('button',{name:'Synthetic Welder · Ready for check'}));
  expect(props.onSelect).toHaveBeenCalledWith('one','3g');
 });
});
describe('core student QR page',()=>{
 it('shows the course’s actual coaching and requests a check without grade editing controls',async()=>{
  window.history.replaceState(null,'','/lab/student#synthetic-token');
  mocks.rpc.mockImplementation(async(name:string)=>({data:row({revision:3,assignment_id:'3g',assignment:{name:'Level 2 3G',process:'SMAW',position:'3G',electrode:'E7018'},focus:['Arc length'],note:'Practice note',requested_at:name==='request_lab_check'?'2026-09-20T12:00:00Z':null}),error:null}));
  const mounted=render(<LabStudentClient/>);
  fireEvent.click(await screen.findByRole('button',{name:'Request check'}));
  expect(await screen.findByRole('button',{name:'You are in the check queue'})).toHaveProperty('disabled',true);
  expect(screen.getByRole('heading',{name:'Level 2 3G'})).toBeTruthy();
  expect(screen.getByText('Arc length')).toBeTruthy();
  expect(screen.queryByRole('button',{name:'Save grade'})).toBeNull();
  expect(mocks.rpc).toHaveBeenCalledWith('request_lab_check',{p_token:'synthetic-token',p_revision:3});
  expect(window.location.hash).toBe('');
  mounted.unmount();render(<LabStudentClient/>);
  await screen.findByRole('heading',{name:'Synthetic Welder'});
  expect(mocks.rpc).toHaveBeenLastCalledWith('read_lab_student',{p_token:'synthetic-token'});
 });
 it('does not offer a check before the instructor has assigned practice',async()=>{
  sessionStorage.setItem('ltg-lab-student','synthetic-token');mocks.rpc.mockResolvedValue({data:row(),error:null});
  render(<LabStudentClient/>);await screen.findByRole('heading',{name:'Synthetic Welder'});
  expect(screen.queryByRole('button',{name:'Request check'})).toBeNull();
 });
});
