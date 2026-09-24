// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AttendanceWorkspace from '@/app/attendance/attendance-workspace';

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn(), replace: vi.fn(), selection: null as null | ((id:string)=>void) }));
vi.mock('next/navigation',()=>{const router={replace:mocks.replace};return {useRouter:()=>router};});
vi.mock('@/lib/section-selection',()=>({
  readSelectedSectionId:()=> '105', publishSelectedSection:vi.fn(),
  subscribeSelectedSection:(fn:(id:string)=>void)=>{mocks.selection=fn;return ()=>{mocks.selection=null;};},
}));
const client = {rpc:mocks.rpc,from:mocks.from,auth:{getSession:async()=>({data:{session:{}}})}};
vi.mock('@/lib/supabase-browser',()=>({getSupabase:()=>client}));
const day='2026-09-24';
type Row = {id:string;session_id:string;student_id:string;initial_status:string|null;final_status:string|null;completion_flags:string[];completion_confirmed:boolean;notes:string|null};
const rows = new Map<string,Row>();
const finalized = new Set<string>();
let delayOpen: null | ((key:string)=>Promise<unknown> | undefined) = null;
let delayRecords: null | ((key:string)=>Promise<unknown> | undefined) = null;
let delaySave: null | (()=>Promise<unknown> | undefined) = null;
function keyOf(section:string,date=day){return `${Number(section)%100===10?Number(section)-5:section}/${date}`;}
function row(key:string):Row {
  if(!rows.has(key))rows.set(key,{id:`record/${key}`,session_id:key,student_id:'student',initial_status:null,final_status:null,completion_flags:[],completion_confirmed:false,notes:null});
  return rows.get(key)!;
}
function info(section:string,date=day){const key=keyOf(section,date);return {data:[{session_id:key,pair_id:key.split('/')[0],pair_name:`Pair ${key.split('/')[0]}`,attendance_mode:'standard',is_completion_section:section==='110'||section==='210',finalized:finalized.has(key)}],error:null};}
function deferred<T>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(r=>{resolve=r;});return {promise,resolve};}

beforeEach(()=>{
  rows.clear();finalized.clear();delayOpen=null;delayRecords=null;delaySave=null;
  mocks.rpc.mockReset();mocks.from.mockReset();
  window.history.replaceState(null,'',`/attendance?section=105&date=${day}`);
  mocks.rpc.mockImplementation(async(name:string,args:Record<string,string>)=>{
    if(name==='can_manage_school')return {data:false};
    if(name==='open_attendance_session') {
      const key=keyOf(args.p_section_id,args.p_attendance_date);
      if(delayOpen){const pending=delayOpen(key);if(pending)return pending;}
      row(key);return info(args.p_section_id,args.p_attendance_date);
    }
    if(name==='set_section_attendance_record') {
      if(delaySave)return delaySave();
      const current=row(args.p_session_id);
      if(args.p_section_id==='105'||args.p_section_id==='205')current.initial_status=args.p_initial_status;
      else {current.final_status=args.p_final_status;current.notes=args.p_notes;}
      return {data:null,error:null};
    }
    throw Error(`Unexpected mutation: ${name}`);
  });
  mocks.from.mockImplementation((table:string)=>{
    const filters:Record<string,string>={};
    const query={select:()=>query,eq:(k:string,v:string)=>{filters[k]=v;return query;},in:()=>query,order:()=>query,single:()=>query,maybeSingle:()=>query,
      then:(resolve:(result:unknown)=>unknown,reject:(err:unknown)=>unknown)=>{
        let result:unknown;
        if(table==='current_teaching_sections')result={data:[105,110,205,210].map(n=>({school_id:'school',section_id:String(n),course_code:`WLD ${n}`,cohort_name:n<200?'Night Level 1':'Day Level 2'}))};
        else if(table==='attendance_pair_enrollments')result={data:[{student_id:'student'}]};
        else if(table==='attendance_students')result={data:[{id:'student',display_name:'Synthetic Welder',external_student_id:null}]};
        else if(table==='attendance_records')result=delayRecords?.(filters.session_id) ?? {data:[{...row(filters.session_id)}]};
        else if(table==='attendance_sessions')result={data:{instructor_notes:`Saved notes ${filters.id}`}};
        else throw Error(table);
        return Promise.resolve(result).then(resolve,reject);
      }};
    return query;
  });
});
afterEach(()=>{cleanup();vi.clearAllMocks();});
async function take(){fireEvent.click(await screen.findByRole('button',{name:'Take Attendance'}));await screen.findByText('Synthetic Welder');}
function primaryProps(primary:number,date=day){return {embedded:true,lockedSectionId:String(primary),lockedDate:date};}
const pressed = (label:string)=>screen.getByRole('button',{name:label}).getAttribute('aria-pressed');

describe.each([105,205])('WLD %i attendance screen',primary=>{
  it('opens fresh and makes no attendance write until an explicit click',async()=>{
    render(<AttendanceWorkspace {...primaryProps(primary)}/>);await take();
    for(const status of ['Present','Absent','Late','Excused'])expect(pressed(status)).toBe('false');
    expect(mocks.rpc.mock.calls.filter(([name])=>name.includes('set_')||name.includes('mark_'))).toHaveLength(0);
    fireEvent.click(screen.getByRole('button',{name:'Late'}));
    await screen.findByText('Attendance saved.');
    expect(mocks.rpc).toHaveBeenCalledWith('set_section_attendance_record',expect.objectContaining({p_section_id:String(primary),p_attendance_date:day,p_session_id:`${primary}/${day}`,p_initial_status:'late'}));
    cleanup();render(<AttendanceWorkspace {...primaryProps(primary)}/>);await take();expect(pressed('Late')).toBe('true');
  });
  it('preserves saved finalized attendance when reopening',async()=>{
    row(`${primary}/${day}`).initial_status='absent';finalized.add(`${primary}/${day}`);
    render(<AttendanceWorkspace {...primaryProps(primary)}/>);await take();
    expect(pressed('Absent')).toBe('true');expect(screen.getByRole('button',{name:'Absent'})).toHaveProperty('disabled',true);
  });
  it('completion displays only saved primary marks and cannot change initial attendance',async()=>{
    render(<AttendanceWorkspace {...primaryProps(primary+5)}/>);await take();
    expect(pressed('Present')).toBe('false');
    expect(screen.getByRole('button',{name:'Present'})).toHaveProperty('disabled',true);
    expect(screen.queryByRole('button',{name:'Mark All Present'})).toBeNull();
    cleanup();row(`${primary}/${day}`).initial_status='late';
    render(<AttendanceWorkspace {...primaryProps(primary+5)}/>);await take();expect(pressed('Late')).toBe('true');
    fireEvent.change(screen.getByRole('combobox',{name:'Final attendance'}),{target:{value:'left_early'}});
    expect(mocks.rpc.mock.calls.filter(([name])=>name==='set_section_attendance_record')).toHaveLength(0);
    fireEvent.click(screen.getByRole('button',{name:'Save Completion'}));await screen.findByText('Attendance saved.');
    cleanup();render(<AttendanceWorkspace {...primaryProps(primary)}/>);await take();expect(pressed('Late')).toBe('true');
  });
  it('switching the locked date clears prior-day marks and restores the correct saved notes',async()=>{
    row(`${primary}/${day}`).initial_status='present';
    const view=render(<AttendanceWorkspace {...primaryProps(primary)}/>);await take();expect(pressed('Present')).toBe('true');
    view.rerender(<AttendanceWorkspace {...primaryProps(primary,'2026-09-25')}/>);await take();expect(pressed('Present')).toBe('false');
    expect(mocks.rpc).toHaveBeenLastCalledWith('open_attendance_session',{p_section_id:String(primary),p_attendance_date:'2026-09-25'});
  });
});

it('ignores an old open response after the selected class changes',async()=>{
  const old=deferred<unknown>();delayOpen=key=>key.startsWith('105/')?old.promise:undefined;
  row(`105/${day}`).initial_status='present';
  render(<AttendanceWorkspace/>);
  await waitFor(()=>expect(mocks.rpc).toHaveBeenCalledWith('open_attendance_session',expect.objectContaining({p_section_id:'105'})));
  act(()=>mocks.selection?.('205'));await screen.findByText('Synthetic Welder');
  await act(async()=>{old.resolve(info('105'));await old.promise;});
  expect(screen.getByText('Pair 205')).toBeTruthy();expect(pressed('Present')).toBe('false');
});
it('ignores an old roster response after changing class',async()=>{
  const old=deferred<unknown>();delayRecords=key=>key.startsWith('105/')?old.promise:undefined;
  row(`105/${day}`).initial_status='present';render(<AttendanceWorkspace/>);
  await waitFor(()=>expect(mocks.from).toHaveBeenCalledWith('attendance_records'));
  act(()=>mocks.selection?.('205'));await screen.findByText('Synthetic Welder');
  await act(async()=>{old.resolve({data:[{...row(`105/${day}`)}]});await old.promise;});
  expect(screen.getByText('Pair 205')).toBeTruthy();expect(pressed('Present')).toBe('false');
});
it('ignores a failed save from an old session after switching class',async()=>{
  const old=deferred<unknown>();delaySave=()=>old.promise;
  render(<AttendanceWorkspace/>);await screen.findByText('Synthetic Welder');
  fireEvent.click(screen.getByRole('button',{name:'Present'}));
  act(()=>mocks.selection?.('205'));await screen.findByText('Pair 205');
  await act(async()=>{old.resolve({error:new Error('Old save failed')});await old.promise;});
  expect(screen.queryByText('Old save failed')).toBeNull();expect(pressed('Present')).toBe('false');
});
it('removes an optimistic mark when the explicit save fails',async()=>{
  delaySave=async()=>({error:new Error('Save failed')});
  render(<AttendanceWorkspace/>);await screen.findByText('Synthetic Welder');
  fireEvent.click(screen.getByRole('button',{name:'Present'}));
  await screen.findByText('Save failed');
  expect(pressed('Present')).toBe('false');
  cleanup();render(<AttendanceWorkspace/>);await screen.findByText('Synthetic Welder');
  expect(pressed('Present')).toBe('false');
});
it('replaces completion notes when the locked session changes',async()=>{
  const view=render(<AttendanceWorkspace {...primaryProps(110)}/>);await take();
  expect(screen.getByPlaceholderText('Optional overall class attendance note')).toHaveProperty('value',`Saved notes 105/${day}`);
  view.rerender(<AttendanceWorkspace {...primaryProps(210,'2026-09-25')}/>);await take();
  expect(screen.getByPlaceholderText('Optional overall class attendance note')).toHaveProperty('value','Saved notes 205/2026-09-25');
  expect(pressed('Present')).toBe('false');
});
it('never falls back to another class when the locked section is unavailable',async()=>{
  render(<AttendanceWorkspace {...primaryProps(999)}/>);
  const takeButton=await screen.findByRole('button',{name:'Take Attendance'});
  expect(takeButton).toHaveProperty('disabled',true);
  expect(mocks.rpc.mock.calls.filter(([name])=>name==='open_attendance_session')).toHaveLength(0);
});
