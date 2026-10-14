// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, configure, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
configure({ asyncUtilTimeout: 10000 });
vi.setConfig({ testTimeout: 20000 });
const mock = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn(), getSession: vi.fn(), push: vi.fn() }));
const router = { push: mock.push };
vi.mock('next/navigation', () => ({ useRouter: () => router }));
const client = { rpc: mock.rpc, from: mock.from, auth: { getSession: mock.getSession } };
vi.mock('@/lib/supabase-browser', () => ({ getSupabase: () => client }));
import TimeClockPage from '../app/time-clock/page';
const employees = ['First instructor', 'Second instructor'].map((display_name,i)=>({id:`employee-${i}`,school_id:'school',profile_id:`user-${i}`,display_name,active:true,clocking_enabled:true,pin_configured:false}));
const entries = employees.map((e,i)=>({id:`entry-${i}`,school_id:'school',employee_id:e.id,clock_in_at:`2020-10-${12+i}T14:29:25.000Z`,clock_out_at:null,clock_in_method:'self',clock_out_method:null,notes:null}));
let scroll: ReturnType<typeof vi.fn>;
beforeEach(() => {
 vi.clearAllMocks(); scroll=vi.fn(); HTMLElement.prototype.scrollIntoView=scroll;
 mock.getSession.mockResolvedValue({data:{session:{user:{id:'user-0'}}}});
 mock.rpc.mockResolvedValue({data:true,error:null});
 mock.from.mockImplementation((table:string)=>{
  const data=table==='timeclock_employees'?employees:table==='timeclock_entries'?entries:table==='schools'?[{id:'school',name:'Test school'}]:table==='school_memberships'?[{school_id:'school',user_id:'user-0',role:'school_admin',status:'active'}]:[];
  const q:Record<string,unknown>={then:(resolve:(result:{data:unknown;error:null})=>unknown)=>Promise.resolve({data,error:null}).then(resolve)};
  for(const key of ['select','eq','gte','lte','order','is','in']) q[key]=()=>q;
  return q;
 });
});
afterEach(cleanup);
describe('payroll exception correction controls',()=>{
 it('reveals and focuses the right shift, including repeated clicks, without saving payroll',async()=>{
  render(<TimeClockPage/>);
  const buttons=await screen.findAllByRole('button',{name:'Correct Shift'});
  expect(buttons).toHaveLength(2);
  for(const index of [0,1,1]) {
   fireEvent.click(buttons[index]);
   const form=await screen.findByRole('region',{name:'Correct Time Entry'});
   expect(within(form).getByText(employees[index].display_name)).toBeTruthy();
   await waitFor(()=>expect(document.activeElement).toBe(within(form).getByLabelText('Clock out')));
   expect(buttons[index].getAttribute('aria-expanded')).toBe('true');
  }
  expect(scroll).toHaveBeenCalledTimes(3);
  expect(mock.rpc.mock.calls.every(([name])=>name==='is_platform_owner')).toBe(true);
 });
 it('shows missing correction requirements inside the visible form without submitting',async()=>{
  render(<TimeClockPage/>);
  fireEvent.click((await screen.findAllByRole('button',{name:'Correct Shift'}))[0]);
  const form=await screen.findByRole('region',{name:'Correct Time Entry'});
  fireEvent.click(within(form).getByRole('button',{name:'Save Correction'}));
  expect(within(form).getByRole('alert').textContent).toContain('reason');
  expect(mock.rpc.mock.calls.every(([name])=>name==='is_platform_owner')).toBe(true);
 });
});

