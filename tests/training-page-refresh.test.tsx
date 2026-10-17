// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import TeacherPage from '@/app/training/session/[id]/teacher/page';
import SchoolPage from '@/app/training/session/[id]/school/page';

const fixture = vi.hoisted(() => ({ exists:true, replace:vi.fn(), push:vi.fn() }));
vi.mock('next/navigation', () => ({ useParams:()=>({id:'session'}), useRouter:()=>({replace:fixture.replace,push:fixture.push}) }));
vi.mock('@/lib/guarded-signout', () => ({guardedSignOut:vi.fn()}));
vi.mock('@/app/components/planner/PlannerTeachingConsole', () => ({default:(p:{dayNumber:number;onSelectDay:(day:number)=>void;actionPanel:ReactNode})=><div>{p.actionPanel}<p>Viewing day {p.dayNumber}</p><button onClick={()=>p.onSelectDay(2)}>Browse second day</button></div>}));

const states = ['first','second'].map(id=>({id:'state-'+id,source_section_id:id,simulated_current_day:1,manual_hold:false,active_timer_started_at:null}));
const sections = ['first','second'].map(id=>({id,section_name:id,course_id:'course',planned_instructional_days:3}));
function from(table:string) {
  let single=false;
  const query = {
    select:()=>query,eq:()=>query,in:()=>query,order:()=>query,limit:()=>query,
    maybeSingle:()=>{single=true;return query;},
    then(resolve:(result:{data:unknown;error:null})=>unknown) {
      const rows:Record<string,unknown[]>={
        training_sessions:fixture.exists?[{id:'session',session_name:'Test training',status:'active',started_at:'2026-10-17',expires_at:'2099-01-01'}]:[],
        training_section_state:fixture.exists?states:[],sections,courses:[{id:'course',course_code:'WLD 110'}],
        planner_days:[{planner_day_number:1,guide_day_id:'g1'},{planner_day_number:2,guide_day_id:'g2'}],
        course_guide_days:[{id:'guide',title:'Practice',objective:'Practice safely'}],
      };
      return Promise.resolve(resolve({data:single?(rows[table]?.[0]??null):(rows[table]??[]),error:null}));
    },
  };return query;
}
vi.mock('@/lib/supabase-browser', () => ({ getSupabase:()=>({
  from,auth:{getSession:async()=>({data:{session:{user:{id:'teacher'}}}})},rpc:async()=>({data:true,error:null}),
  channel:()=>{const c={on:()=>c,subscribe:()=>c};return c;},removeChannel:vi.fn(),
}) }));
afterEach(()=>{cleanup();vi.useRealTimers();fixture.exists=true;fixture.replace.mockClear();});

it('keeps the selected class and browsed day through polling and focus refresh',async()=>{
  vi.useFakeTimers();
  await act(async()=>{render(<TeacherPage />);});
  await act(async()=>{fireEvent.change(screen.getByRole('combobox'),{target:{value:'second'}});});
  await act(async()=>{fireEvent.click(screen.getByText('Browse second day'));});
  await act(async()=>{await vi.advanceTimersByTimeAsync(60000);});
  await act(async()=>{window.dispatchEvent(new Event('focus'));});
  expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('second');
  expect(screen.getByText('Viewing day 2')).toBeTruthy();
});
it.each([['teacher',TeacherPage],['school',SchoolPage]] as const)('leaves a purged %s session even without a Realtime event',async(_name,Page)=>{
  vi.useFakeTimers();
  await act(async()=>{render(<Page />);});
  fixture.exists=false;
  await act(async()=>{await vi.advanceTimersByTimeAsync(30000);});
  expect(fixture.replace).toHaveBeenCalledWith('/training');
});
