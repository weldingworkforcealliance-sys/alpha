// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { AnchorHTMLAttributes } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import InstructorNavigation from '@/app/instructor-navigation';
import { publishSelectedSection } from '@/lib/section-selection';

const mock=vi.hoisted(()=>({pathname:'/dashboard',search:'',owner:false,role:'instructor',rpc:vi.fn(),from:vi.fn()}));
vi.mock('next/navigation',()=>({usePathname:()=>mock.pathname,useSearchParams:()=>new URLSearchParams(mock.search)}));
vi.mock('next/link',()=>({default:(props:AnchorHTMLAttributes<HTMLAnchorElement>)=><a {...props} onClick={e=>e.preventDefault()}/>}));
const client={rpc:mock.rpc,from:mock.from,auth:{getSession:async()=>({data:{session:{user:{id:'teacher'}}}})}};
vi.mock('@/lib/supabase-browser',()=>({getSupabase:()=>client}));
beforeEach(()=>{
  mock.pathname='/dashboard';mock.search='';mock.owner=false;mock.role='instructor';mock.rpc.mockReset();mock.from.mockReset();
  mock.rpc.mockImplementation(async()=>({data:mock.owner,error:null}));
  mock.from.mockImplementation(()=>{const q={select:()=>q,eq:()=>q,then:(resolve:(value:unknown)=>unknown)=>Promise.resolve({data:[{role:mock.role,status:'active'}],error:null}).then(resolve)};return q;});
  window.localStorage.clear();window.localStorage.setItem('ltp_selected_section_id','class-a');
  vi.stubEnv('NEXT_PUBLIC_GRADEBOOK_ENABLED','true');
});
afterEach(()=>{cleanup();vi.unstubAllEnvs();});
const more=()=>screen.getByRole('button',{name:'More tools'});
const renderNav=()=>render(<InstructorNavigation pathname={mock.pathname} onNavigate={()=>{}}/>);

it('shows the five demo essentials and keeps additional tools collapsed',async()=>{
  renderNav();
  expect(screen.getAllByRole('link').map(link=>link.textContent)).toEqual(['Today','Attendance','Grading','Live Classroom','Resources']);
  expect(more().getAttribute('aria-expanded')).toBe('false');
  expect(screen.queryByRole('link',{name:'Full Detailed Planner'})).toBeNull();
  expect(screen.getByRole('link',{name:'Today'}).getAttribute('aria-current')).toBe('page');
  fireEvent.click(more());
  expect(screen.queryByRole('link',{name:'Full Detailed Planner'})).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'Plan & teach'}));
  expect(screen.getByRole('link',{name:'Full Detailed Planner'}).getAttribute('href')).toBe('/dashboard?view=detailed');
  expect(screen.getByRole('link',{name:'Planner Workspace'}).getAttribute('href')).toBe('/planner');
  expect(screen.getByRole('link',{name:'Agenda Workspace'}).getAttribute('href')).toBe('/agenda');
  fireEvent.click(screen.getByRole('button',{name:'Time & reports'}));
  expect(screen.queryByRole('link',{name:'Full Detailed Planner'})).toBeNull();
  expect(screen.getByRole('link',{name:'Employee Time Clock'}).getAttribute('href')).toBe('/time-clock');
  expect(screen.getByRole('link',{name:'Reporting & Analytics'}).getAttribute('href')).toBe('/reports');
});

it('carries the selected class into attendance, classroom activities and job cards',()=>{
  renderNav();fireEvent.click(more());fireEvent.click(screen.getByRole('button',{name:'Plan & teach'}));
  for(const [name,path] of [['Attendance','/attendance'],['Grading','/gradebook'],['Live Classroom','/classroom'],['Classroom Activities','/classroom/planner'],['Student Job Cards','/classroom/job-card']]) {
    expect(screen.getByRole('link',{name}).getAttribute('href')).toBe(`${path}?section=class-a`);
  }
  act(()=>publishSelectedSection('class-b'));
  expect(screen.getByRole('link',{name:'Student Job Cards'}).getAttribute('href')).toBe('/classroom/job-card?section=class-b');
});

it.each([
  {role:'instructor',owner:false,school:false,payroll:false,review:false},
  {role:'viewer',owner:false,school:true,payroll:false,review:false},
  {role:'school_admin',owner:false,school:true,payroll:true,review:true},
  {role:'instructor',owner:true,school:true,payroll:true,review:true},
])('preserves live role gates for $role (owner=$owner)',async(expected)=>{
  mock.role=expected.role;mock.owner=expected.owner;
  renderNav();fireEvent.click(more());
  await waitFor(()=>expect(mock.rpc).toHaveBeenCalledTimes(3));
  await act(async()=>{});
  fireEvent.click(screen.getByRole('button',{name:'Administration'}));
  expect(Boolean(screen.queryByRole('link',{name:'School Dashboard'}))).toBe(expected.school);
  expect(Boolean(screen.queryByRole('link',{name:'Owner Dashboard'}))).toBe(expected.owner);
  expect(screen.getByRole('link',{name:'Training Mode'})).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'Time & reports'}));
  expect(Boolean(screen.queryByRole('link',{name:'Weekly Time Reports'}))).toBe(expected.payroll);
  fireEvent.click(screen.getByRole('button',{name:'Plan & teach'}));
  expect(Boolean(screen.queryByRole('link',{name:'Review Queue'}))).toBe(expected.review);
});

it('opens More tools for secondary destinations and marks only the actual page current',()=>{
  mock.pathname='/classroom/job-card';const view=renderNav();
  expect(more().getAttribute('aria-expanded')).toBe('true');
  expect(screen.getByRole('link',{name:'Student Job Cards'}).getAttribute('aria-current')).toBe('page');
  expect(screen.getByRole('link',{name:'Live Classroom'}).getAttribute('aria-current')).toBeNull();
  mock.pathname='/dashboard';mock.search='view=detailed';
  view.rerender(<InstructorNavigation pathname={mock.pathname} onNavigate={()=>{}}/>);
  expect(screen.getByRole('link',{name:'Full Detailed Planner'}).getAttribute('aria-current')).toBe('page');
  expect(screen.getByRole('link',{name:'Today'}).getAttribute('aria-current')).toBeNull();
  mock.search='';view.rerender(<InstructorNavigation pathname={mock.pathname} onNavigate={()=>{}}/>);
  expect(more().getAttribute('aria-expanded')).toBe('false');
});

it('retains the contextual account tools and closes the mobile menu on navigation',()=>{
  mock.pathname='/accounts/diagnostics';const onNavigate=vi.fn();
  render(<InstructorNavigation pathname={mock.pathname} onNavigate={onNavigate}/>);
  expect(screen.getByRole('link',{name:'Account Management'}).getAttribute('href')).toBe('/accounts');
  fireEvent.click(screen.getByRole('link',{name:'Invitation Diagnostics'}));
  expect(onNavigate).toHaveBeenCalledOnce();
});

it('does not advertise grading when its feature flag is disabled',()=>{
  vi.stubEnv('NEXT_PUBLIC_GRADEBOOK_ENABLED','false');renderNav();
  expect(screen.queryByRole('link',{name:'Grading'})).toBeNull();
});

it('allows a category to collapse without navigating and opens the current category on route changes',()=>{
 const onNavigate=vi.fn();const view=render(<InstructorNavigation pathname="/dashboard" onNavigate={onNavigate}/>);
 fireEvent.click(more());const admin=screen.getByRole('button',{name:'Administration'});fireEvent.click(admin);fireEvent.click(admin);
 expect(admin.getAttribute('aria-expanded')).toBe('false');expect(onNavigate).not.toHaveBeenCalled();
 view.rerender(<InstructorNavigation pathname="/reports" onNavigate={onNavigate}/>);
 expect(screen.getByRole('button',{name:'Time & reports'}).getAttribute('aria-expanded')).toBe('true');
 expect(screen.getByRole('link',{name:'Reporting & Analytics'}).getAttribute('aria-current')).toBe('page');
});
