// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import AttendanceFinalizationAlert from '@/app/attendance-finalization-alert';
import { notifyAttendanceFinalized } from '@/lib/attendance-events';

const mock=vi.hoisted(()=>({rpc:vi.fn()}));
const client={rpc:mock.rpc,auth:{getSession:async()=>({data:{session:{}}})}};
vi.mock('@/lib/supabase-browser',()=>({getSupabase:()=>client}));
const alert={session_id:'old-session',pair_id:'pair',pair_name:'Test pair',attendance_date:'2026-09-29',completion_section_id:'completion',attendance_mode:'standard',marked_count:2,student_count:2,is_overdue:true};
type Result={data:typeof alert[];error:null};
function deferred(){let resolve!:(value:Result)=>void;const promise=new Promise<Result>(r=>{resolve=r;});return {promise,resolve};}
beforeEach(()=>{mock.rpc.mockReset();mock.rpc.mockResolvedValue({data:[alert],error:null});window.localStorage.clear();});
afterEach(cleanup);

it('opens the exact completion course/date and only describes PVHS reporting for PVHS sessions',async()=>{
  render(<AttendanceFinalizationAlert pathname="/dashboard"/>);
  await screen.findByRole('alert');
  expect(screen.getByRole('link',{name:'Review & Finalize'}).getAttribute('href')).toBe('/attendance?section=completion&date=2026-09-29');
  expect(screen.queryByText(/PVHS email/)).toBeNull();
  mock.rpc.mockResolvedValue({data:[{...alert,attendance_mode:'pvhs'}],error:null});
  act(()=>notifyAttendanceFinalized());
  await screen.findByText('The final PVHS email is queued after pair finalization.');
});

it.each(['same tab','another tab','focus','visible'])('refreshes confirmed completion from %s',async(trigger)=>{
  render(<AttendanceFinalizationAlert pathname="/dashboard"/>);await screen.findByRole('alert');
  mock.rpc.mockResolvedValue({data:[],error:null});
  if(trigger==='same tab')act(()=>notifyAttendanceFinalized());
  if(trigger==='another tab')fireEvent(window,new StorageEvent('storage',{key:'ltg_attendance_finalized',newValue:'changed'}));
  if(trigger==='focus')fireEvent(window,new Event('focus'));
  if(trigger==='visible')fireEvent(document,new Event('visibilitychange'));
  await waitFor(()=>expect(screen.queryByRole('alert')).toBeNull());
});

it('does not restore an old warning when a slower pre-finalization request finishes last',async()=>{
  render(<AttendanceFinalizationAlert pathname="/dashboard"/>);await screen.findByRole('alert');
  const old=deferred();mock.rpc.mockReturnValueOnce(old.promise);
  act(()=>notifyAttendanceFinalized());await waitFor(()=>expect(mock.rpc).toHaveBeenCalledTimes(2));
  mock.rpc.mockResolvedValue({data:[],error:null});act(()=>notifyAttendanceFinalized());
  await waitFor(()=>expect(screen.queryByRole('alert')).toBeNull());
  await act(async()=>old.resolve({data:[alert],error:null}));
  expect(screen.queryByRole('alert')).toBeNull();
});

it('reloads on return to the dashboard without briefly showing the old warning',async()=>{
  const view=render(<AttendanceFinalizationAlert pathname="/dashboard"/>);await screen.findByRole('alert');
  view.rerender(<AttendanceFinalizationAlert pathname="/attendance"/>);
  const fresh=deferred();mock.rpc.mockReturnValueOnce(fresh.promise);
  view.rerender(<AttendanceFinalizationAlert pathname="/dashboard"/>);
  expect(screen.queryByRole('alert')).toBeNull();
  await waitFor(()=>expect(mock.rpc).toHaveBeenCalledTimes(2));
  await act(async()=>fresh.resolve({data:[],error:null}));
  expect(screen.queryByRole('alert')).toBeNull();
});

it('reports a failed verification instead of claiming completion or leaving an unhandled rejection',async()=>{
  render(<AttendanceFinalizationAlert pathname="/dashboard"/>);await screen.findByRole('alert');
  mock.rpc.mockRejectedValueOnce(new Error('Offline'));act(()=>notifyAttendanceFinalized());
  await screen.findByRole('status');
  expect(screen.getByRole('status').textContent).toContain('could not be verified');
  mock.rpc.mockResolvedValue({data:[alert],error:null});act(()=>notifyAttendanceFinalized());
  await screen.findByRole('alert');
});
