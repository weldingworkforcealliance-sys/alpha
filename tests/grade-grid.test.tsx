// @vitest-environment jsdom
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {render,screen,fireEvent,cleanup,within,waitFor} from '@testing-library/react';
import GradeGrid,{cellAttempts} from '../app/gradebook/grade-grid';
const mock=vi.hoisted(()=>({rpc:vi.fn(),failHistory:false}));
vi.mock('@/lib/supabase-browser',()=>({getSupabase:()=>({rpc:mock.rpc,from:()=>{const q={select:()=>q,eq:()=>q,order:()=>q,range:async()=>({data:mock.failHistory?null:[{id:1,score:8,possible_score:10,status_label:'Graded',recorded_at:'2026-10-01',note:'Original'}],error:mock.failHistory?new Error('offline'):null})};return q;}})}));
const students=[{student_id:'s1',display_name:'Student Alpha',active:true},{student_id:'s2',display_name:'Student Beta',active:true}];
const items=[{id:'i1',title:'Fractions',assessment_slug:'math'},{id:'i2',title:'Safety',assessment_slug:'safety'}];
const attempt={id:'a1',student_id:'s1',item_id:'i1',score:8,possible_score:10,status_label:'Graded',status_code:'graded',attempted_at:'2026-10-01',revision_id:1};
const props=()=>({bookId:'b1',students,items,attempts:[attempt],statuses:[{code:'graded',label:'Graded',active:true,requires_score:true}],countedIds:[],onRecord:vi.fn(),onWelding:vi.fn(),onRefresh:vi.fn()});
beforeEach(()=>{mock.rpc.mockReset().mockResolvedValue({error:null});mock.failHistory=false;HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};});
afterEach(cleanup);
function open(){fireEvent.click(screen.getAllByRole('button',{name:/Student Alpha · Fractions/})[0]);return screen.getByRole('dialog');}
it('uses the latest ordinary attempt and the counted welding attempt, retaining all attempts',()=>{
 const older={...attempt,id:'older',attempted_at:'2026-09-01',score:10};
 expect(cellAttempts([older,attempt],'s1',items[0],[]).counted?.id).toBe('a1');
 expect(cellAttempts([older,attempt],'s1',{...items[0],assessment_slug:'tower:weld'},['older']).counted?.id).toBe('older');
 expect(cellAttempts([older,attempt],'s1',{...items[0],assessment_slug:'tower:weld'},[]).counted).toBeUndefined();
 expect(cellAttempts([older,attempt],'s1',items[0],[]).rows).toHaveLength(2);
});
it('filters students and assignments while distinguishing unrecorded work from zero',()=>{
 render(<GradeGrid {...props()}/>);expect(screen.getByText('2 student(s) · 1 assessment(s). Select a score for attempts, history or corrections. “Not recorded” is not a zero.')).toBeTruthy();
 fireEvent.change(screen.getByRole('searchbox'),{target:{value:'beta'}});
 expect(screen.queryByRole('button',{name:'Student Alpha'})).toBeNull();
 expect(screen.getAllByText('Not recorded')).toHaveLength(2);
 fireEvent.change(screen.getByLabelText('Assessment'),{target:{value:'i2'}});
 expect(screen.queryByRole('columnheader',{name:'Fractions'})).toBeNull();expect(screen.getByRole('columnheader',{name:'Safety'})).toBeTruthy();
});
it('opens a focused dialog and cancels without writing',async()=>{
 render(<GradeGrid {...props()}/>);const d=open();await within(d).findByText('Original');
 expect(document.activeElement).toBe(within(d).getByRole('button',{name:'Close'}));
 fireEvent.click(within(d).getByRole('button',{name:'Correct this grade'}));fireEvent.change(within(d).getByLabelText('Score'),{target:{value:'9'}});
 fireEvent.click(within(d).getByRole('button',{name:'Cancel correction'}));fireEvent.click(within(d).getByRole('button',{name:'Close'}));
 expect(mock.rpc).not.toHaveBeenCalled();expect(screen.queryByRole('dialog')).toBeNull();
});
it('saves a correction against the original identity and refreshes only after success',async()=>{
 const p=props();render(<GradeGrid {...p}/>);const d=open();await within(d).findByText('Original');fireEvent.click(within(d).getByRole('button',{name:'Correct this grade'}));
 fireEvent.change(within(d).getByLabelText('Score'),{target:{value:'9'}});fireEvent.change(within(d).getByLabelText('Correction reason'),{target:{value:'Rechecked calculation'}});
 fireEvent.click(within(d).getByRole('button',{name:'Save correction'}));
 await waitFor(()=>expect(p.onRefresh).toHaveBeenCalledOnce());
 expect(mock.rpc).toHaveBeenCalledWith('record_gradebook_attempt',{p_gradebook_id:'b1',p_item_id:'i1',p_student_id:'s1',p_status_code:'graded',p_score:9,p_possible_score:10,p_note:'Rechecked calculation',p_attempt_id:'a1'});
});
it('retains a failed correction and does not show a success',async()=>{
 mock.rpc.mockResolvedValue({error:{message:'Network unavailable'}});const p=props();render(<GradeGrid {...p}/>);const d=open();await within(d).findByText('Original');fireEvent.click(within(d).getByRole('button',{name:'Correct this grade'}));
 fireEvent.change(within(d).getByLabelText('Score'),{target:{value:'9'}});fireEvent.change(within(d).getByLabelText('Correction reason'),{target:{value:'Recheck'}});fireEvent.click(within(d).getByRole('button',{name:'Save correction'}));
 await within(d).findByRole('alert');expect((within(d).getByLabelText('Score') as HTMLInputElement).value).toBe('9');expect(p.onRefresh).not.toHaveBeenCalled();
});
it('does not permit correction when history failed to load',async()=>{
 mock.failHistory=true;render(<GradeGrid {...props()}/>);const d=open();await within(d).findByRole('alert');expect((within(d).getByRole('button',{name:'Correct this grade'}) as HTMLButtonElement).disabled).toBe(true);
});
it('routes welding to its rubric instead of the generic correction form',async()=>{
 const p={...props(),items:[{...items[0],assessment_slug:'tower:smaw'}],countedIds:['a1']};render(<GradeGrid {...p}/>);const d=open();await within(d).findByText('Original');
 expect(within(d).queryByRole('button',{name:'Correct this grade'})).toBeNull();fireEvent.click(within(d).getByRole('button',{name:'Open welding assessment'}));expect(p.onWelding).toHaveBeenCalledWith('s1','tower:smaw');expect(mock.rpc).not.toHaveBeenCalled();
});

it('shows ungraded shop projects and the full roster by default',()=>{
 const p=props();render(<GradeGrid {...p} items={[{id:'shop',title:'WLD 110 · 1F (flat) · E6010/11 · 1/8 in',assessment_slug:'wld110-shop:0'}]} attempts={[]}/>);
 expect(screen.getByRole('checkbox')).toHaveProperty('checked',true);
 expect(screen.getAllByText('Not recorded')).toHaveLength(4);
 expect(screen.getAllByRole('button',{name:'Student Beta'})).toHaveLength(2);
});
