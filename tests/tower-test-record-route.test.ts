import {beforeEach,describe,it,expect,vi} from 'vitest';
const mocks=vi.hoisted(()=>({getUser:vi.fn(),maybeSingle:vi.fn(),pdf:vi.fn(),eq:vi.fn()}));
vi.mock('@/lib/supabase-server',()=>({createSupabaseServerClient:async()=>({
  auth:{getUser:mocks.getUser},from:()=>({select:()=>({eq:(...args:unknown[])=>{
    mocks.eq(...args); return {maybeSingle:mocks.maybeSingle};
  }})}),
})}));
vi.mock('@/lib/tower-test-record-pdf',()=>({createTestRecordPdf:mocks.pdf}));
import {GET} from '../app/tower/certificates/[testId]/pdf/route';
const id='00000000-0000-4000-8000-000000000005';
const get=(testId=id)=>GET(new Request('https://example.test'),{params:Promise.resolve({testId})});
beforeEach(()=>{
  vi.clearAllMocks();
  mocks.getUser.mockResolvedValue({data:{user:{id:'authorized-user'}},error:null});
  mocks.maybeSingle.mockResolvedValue({data:{id,snapshot:{result:'Pass'},issued_at:'2026-09-19'},error:null});
  mocks.pdf.mockResolvedValue(new Uint8Array([37,80,68,70]));
});
describe('private test-record download',()=>{
  it('requires a valid id and signed-in user before querying records',async()=>{
    expect((await get('invalid')).status).toBe(404);
    expect(mocks.getUser).not.toHaveBeenCalled();
    mocks.getUser.mockResolvedValue({data:{user:null},error:null});
    expect((await get()).status).toBe(401);
    expect(mocks.maybeSingle).not.toHaveBeenCalled();
  });
  it('does not generate a PDF for records hidden by RLS',async()=>{
    mocks.maybeSingle.mockResolvedValue({data:null,error:null});
    expect((await get()).status).toBe(404);
    expect(mocks.pdf).not.toHaveBeenCalled();
  });
  it('downloads the saved snapshot without shared caching',async()=>{
    const response=await get();
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(response.headers.get('Content-Type')).toBe('application/pdf');
    expect(mocks.eq).toHaveBeenCalledWith('test_id',id);
    expect(mocks.pdf).toHaveBeenCalledWith({id,snapshot:{result:'Pass'},issued_at:'2026-09-19'});
  });
  it('returns safe messages on database or rendering failures',async()=>{
    mocks.maybeSingle.mockResolvedValueOnce({data:null,error:{message:'private detail'}});
    expect((await get()).status).toBe(503);
    mocks.pdf.mockRejectedValueOnce(new Error('private student information'));
    const response=await get();
    expect(response.status).toBe(422);
    expect(await response.text()).not.toContain('private student');
  });
});
