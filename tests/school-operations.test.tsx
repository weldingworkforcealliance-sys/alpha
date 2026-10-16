// @vitest-environment jsdom
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import SchoolOperations from '../app/school/operations';
const state = vi.hoisted(()=>({queries:[] as Array<{table:string;filters:Record<string,unknown>}>, fail:'', rpc:vi.fn()}));
vi.mock('next/link',()=>({default:({children,href}:{children:React.ReactNode;href:string})=><a href={href}>{children}</a>}));
vi.mock('../app/school-active-today-employees',()=>({default:({schoolId,canManage}:{schoolId:string;canManage:boolean})=><p>Time scope {schoolId} {canManage?'manage':'view'}</p>}));
vi.mock('@/lib/supabase-browser',()=>({getSupabase:()=>({rpc:state.rpc,from:(table:string)=>{
  const filters:Record<string,unknown>={};
  const q={select:()=>q,order:()=>q,eq:(key:string,value:unknown)=>{filters[key]=value;return q;},in:(key:string,value:unknown)=>{filters[key]=value;return q;},range:async()=>{
    state.queries.push({table,filters});
    if(state.fail===table)return {data:null,error:new Error('Unavailable')};
    return {error:null,data:table==='gradebook_directory'?[{id:'book',section_id:'class105'}]:table==='attendance_pairs'?[{id:'pair',pair_name:'Welding Day',primary_section_id:'class105',completion_section_id:'class110',active:true}]:table==='attendance_sessions'?[{id:'session',pair_id:'pair',finalized_at:null}]:[]};
  }};return q;
}})}));
const classes=[{id:'class105',name:'Morning 105',course:'WLD 105',instructors:'Alex Smith',status:'active'},{id:'class110',name:'Morning 110',course:'WLD 110',instructors:'Alex Smith',status:'active'},{id:'archive',name:'Old class',course:'WLD 210',instructors:'Retired Instructor',status:'archived'}];
beforeEach(()=>{state.queries=[];state.fail='';state.rpc.mockReset().mockResolvedValue({data:[{session_id:'alert',completion_section_id:'class110',pair_name:'Welding Day',attendance_date:'2026-10-15',marked_count:2,student_count:2},{session_id:'foreign',completion_section_id:'other-school',pair_name:'Other school',attendance_date:'2026-10-15'}],error:null});vi.stubEnv('NEXT_PUBLIC_GRADEBOOK_ENABLED','true');});
afterEach(()=>{cleanup();vi.unstubAllEnvs();});
it('scopes queries and grading links to this school and filters archived classes',async()=>{
 render(<SchoolOperations schoolId="school-a" classes={classes} canManage canTimeManage/>);
 expect(await screen.findByRole('link',{name:'Open grading'})).toHaveProperty('href',expect.stringContaining('/gradebook?section=class105'));
 expect(screen.queryByText(/Old class/)).toBeNull();expect(screen.queryByText('Other school')).toBeNull();
 expect(state.queries.find(q=>q.table==='gradebook_directory')?.filters.section_id).toEqual(['archive','class105','class110']);
 expect(state.queries.filter(q=>q.table.startsWith('attendance')).every(q=>q.filters.school_id==='school-a')).toBe(true);
 fireEvent.click(screen.getByLabelText('Include archived classes'));expect(screen.getByText(/Old class/)).toBeTruthy();
 fireEvent.change(screen.getByLabelText('Find a class or instructor'),{target:{value:'Retired'}});
 expect(screen.queryByRole('link',{name:'Open grading'})).toBeNull();expect(screen.getByText(/Old class/)).toBeTruthy();
});
it('carries school, pair and selected date into manager attendance corrections',async()=>{
 render(<SchoolOperations schoolId="school-a" classes={classes} canManage canTimeManage/>);
 await screen.findByRole('link',{name:'Open grading'});fireEvent.click(screen.getByRole('button',{name:/Student attendance/}));
 fireEvent.change(screen.getByLabelText('Attendance date'),{target:{value:'2026-10-14'}});
 await waitFor(()=>expect(screen.getByRole('link',{name:'Correct attendance'}).getAttribute('href')).toBe('/attendance/corrections?school=school-a&pair=pair&date=2026-10-14'));
 expect(screen.getByText('Not finalized')).toBeTruthy();
 expect(state.queries.some(q=>q.table==='attendance_sessions'&&q.filters.attendance_date==='2026-10-14')).toBe(true);
});
it('keeps manager correction controls out of read-only views',async()=>{
 render(<SchoolOperations schoolId="school-a" classes={classes} canManage={false} canTimeManage={false}/>);
 await screen.findByRole('link',{name:'Open grading'});fireEvent.click(screen.getByRole('button',{name:/Student attendance/}));
 expect(screen.queryByRole('link',{name:'Correct attendance'})).toBeNull();expect(screen.queryByRole('link',{name:/Manage rosters/})).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:/Instructor time/}));expect(screen.getByText('Time scope school-a view')).toBeTruthy();expect(screen.queryByRole('link',{name:/Weekly payroll/})).toBeNull();
});
it('offers scoped time correction and payroll tools to managers',async()=>{
 render(<SchoolOperations schoolId="school-a" classes={classes} canManage canTimeManage/>);
 fireEvent.click(screen.getByRole('button',{name:/Instructor time/}));
 expect(screen.getByRole('link',{name:'Manage punches & corrections'}).getAttribute('href')).toBe('/time-clock?school=school-a');
 expect(screen.getByRole('link',{name:'Weekly payroll & exports'}).getAttribute('href')).toBe('/time-clock/payroll?school=school-a');
 await waitFor(()=>expect(screen.getByRole('button',{name:'Refresh status'})).toHaveProperty('disabled',false));
});
it('reports failed attendance status rather than claiming there is no session',async()=>{
 state.fail='attendance_sessions';render(<SchoolOperations schoolId="school-a" classes={classes} canManage canTimeManage/>);
 await screen.findByRole('alert');fireEvent.click(screen.getByRole('button',{name:/Student attendance/}));
 expect(screen.getByText('Status unavailable')).toBeTruthy();expect(screen.queryByText('No attendance session for this date')).toBeNull();
 state.fail='';fireEvent.click(screen.getByRole('button',{name:'Refresh status'}));
 expect(await screen.findByText('Not finalized')).toBeTruthy();expect(screen.queryByRole('alert')).toBeNull();
});
