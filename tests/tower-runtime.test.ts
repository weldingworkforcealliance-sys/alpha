import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { describe, expect, it } from 'vitest';

function runtime() {
  const listeners: Record<string, (event: unknown) => void> = {};
  const sent: unknown[] = [];
  const elements = new Map<string, { addEventListener: () => void; setAttribute: () => void; dataset: object; classList: { toggle: () => void }; textContent: string; innerHTML: string }>();
  const element = (id: string) => {
    if(!elements.has(id))elements.set(id,{ addEventListener() {}, setAttribute() {}, dataset: {}, classList: { toggle() {} }, textContent: '', innerHTML: '' });
    return elements.get(id)!;
  };
  const parent = { postMessage: (message: unknown) => sent.push(structuredClone(message)) };
  const context = vm.createContext({
    document: { getElementById: element, querySelectorAll: () => [], addEventListener() {} },
    window: { addEventListener: (name: string, handler: (event: unknown) => void) => { listeners[name] = handler; } },
    crypto: webcrypto, location: { origin: 'https://ltg.test' }, parent, console,
  });
  vm.runInContext(readFileSync('public/tower-ui/app.js', 'utf8'), context);
  return { run: (code: string) => vm.runInContext(code, context), listeners, sent, parent, element };
}
const attempt = (value: number, defects: string[] = []) => JSON.stringify({
  scores: { consistency: value, defects: value, procedure: value, restarts: value, beadSize: value }, defects,
});

function initialized() {
  const r=runtime();
  r.listeners.message({origin:'https://ltg.test',source:r.parent,data:{type:'tower-init',payload:{
    book:{id:'class-1',course_code:'WLD 110',section_name:'Synthetic test class'},
    students:[{id:'student-1',name:'Synthetic Student',weldTestId:'0017',active:true,revision:0,data:{}}],
    assignments:[{id:'smaw-fillet-1F',name:'SMAW 1F',processId:'smaw',process:'SMAW',material:'Carbon Steel',family:'Fillet',backing:'N/A',position:'1F',type:'position',rubricType:'weld'}],
  }}});
  return r;
}
describe('Tower authenticated-data adapter',()=>{
  it.each(['home','lab','courses','competencies','exams','qualifications','destructive','passport','admin'])('renders %s from a real-shaped roster payload',view=>{
    const r=initialized();
    r.run(`setView('${view}')`);
    expect(r.element('appContent').innerHTML.length).toBeGreaterThan(100);
    expect(r.run('activeStudent().ltgStudentId')).toBe('student-1');
    expect(r.run('activeStudent().weldTestId')).toBe('0017');
  });
  it('holds unsaved edits after a failure and retries the same request',()=>{
    const r=initialized();
    const id=r.run('lastRequest.requestId');
    r.listeners.message({origin:'https://ltg.test',source:r.parent,data:{type:'tower-error',requestId:id,message:'Offline'}});
    expect(r.run('stopped')).toBe(true);
    expect(r.element('saveStatus').textContent).toBe('Offline');
    expect(r.run('lastRequest.studentId')).toBe('student-1');
  });
  it('does not change the data snapshot of an in-flight save',()=>{
    const r=initialized();
    const before=r.run('JSON.stringify(lastRequest.data)');
    r.run('activeStudent().aws.candidateId="new entry";persistRecords()');
    expect(r.run('JSON.stringify(lastRequest.data)')).toBe(before);
    expect(r.run('pending.size')).toBe(1);
  });
});
describe('Tower grading policy', () => {
  it('counts an unreplaced critical-defect Attempt 1 as zero', () => {
    const r = runtime();
    expect(r.run(`officialLabResult({lab:{weld:{attempt1:${attempt(20, ['crack'])},attempt2:null}}},'weld')`).numeric).toBe(0);
  });
  it('keeps the zero until Attempt 2 is complete', () => {
    const r = runtime();
    expect(r.run(`officialLabResult({lab:{weld:{attempt1:${attempt(20, ['lackFusion'])},attempt2:{scores:{consistency:20},defects:[]}}}},'weld')`).numeric).toBe(0);
  });
  it('replaces Attempt 1 with a lower completed Attempt 2', () => {
    const r = runtime();
    const result = r.run(`officialLabResult({lab:{weld:{attempt1:${attempt(20)},attempt2:${attempt(10)}}}},'weld')`);
    expect(result.numeric).toBe(47.5);
    expect(result.attempt).toBe(2);
  });
  it('preserves the 95% maximum', () => {
    expect(runtime().run(`officialLabResult({lab:{weld:{attempt1:${attempt(20)},attempt2:null}}},'weld')`).numeric).toBe(95);
  });
  it('enforces the second-attempt critical cap even if its stored defects score is nonzero', () => {
    expect(runtime().run(`officialLabResult({lab:{weld:{attempt1:${attempt(20)},attempt2:${attempt(20, ['crack'])}}}},'weld')`).numeric).toBe(76);
  });
  it('includes a critical F in the numeric course category average', () => {
    expect(runtime().run('categoryAverage([{score:0,possible:100},{score:95,possible:100}])')).toBe(47.5);
  });
  it('does not initialize from untrusted window messages', () => {
    const r = runtime();
    r.listeners.message({ origin: 'https://other.test', source: r.parent, data: { type: 'tower-init' } });
    r.listeners.message({ origin: 'https://ltg.test', source: {}, data: { type: 'tower-init' } });
    expect(r.run('state')).toBeNull();
  });
});

describe('Gradebook context',()=>{
 it('keeps student and assignment when switching between assessment and student record',()=>{
  const r=initialized();
  r.run('saving=false;stopped=false;pending.clear()');
  r.listeners.message({origin:'https://ltg.test',source:r.parent,data:{type:'tower-context',view:'passport',studentId:'student-1',assignmentId:'smaw-fillet-1F'}});
  expect(r.run('state.ui.view')).toBe('passport');
  expect(r.run('state.activeStudentId')).toBe('student-1');
  expect(r.run('state.ui.labAssignmentId')).toBe('smaw-fillet-1F');
 });
 it('refuses a context change while an edit is being saved',()=>{
  const r=initialized();const before=r.run('state.ui.view');
  r.listeners.message({origin:'https://ltg.test',source:r.parent,data:{type:'tower-context',view:'passport'}});
  expect(r.run('state.ui.view')).toBe(before);
 });
});
