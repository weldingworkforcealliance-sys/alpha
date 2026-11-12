import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks=vi.hoisted(()=>({rpc:vi.fn(),notify:vi.fn()}));
vi.mock('../lib/contact-server',()=>({contactService:()=>({rpc:mocks.rpc}),contactChallenge:()=> 'test-challenge',contactFingerprint:()=> 'a'.repeat(64),verifyChallenge:(x:unknown)=>x==='signed.valid.token',sameOrigin:(r:Request)=>r.headers.get('origin')===new URL(r.url).origin,notifyLead:mocks.notify}));
import { POST } from '../app/api/contact/route';
const valid={name:'Test',institution:'School',email:'test@example.com',inquiry_type:'LTG demonstration',challenge:'signed.valid.token'};
function req(body:unknown,origin='https://ltgeducation.com'){return new Request('https://ltgeducation.com/api/contact',{method:'POST',headers:{'content-type':'application/json',origin},body:JSON.stringify(body)});}
beforeEach(()=>{vi.clearAllMocks();mocks.rpc.mockResolvedValue({data:{id:'saved-id',duplicate:false},error:null});mocks.notify.mockResolvedValue(true);});
describe('contact submission route',()=>{
  it('saves before sending and returns no PII',async()=>{const r=await POST(req(valid));expect(r.status).toBe(200);expect(await r.json()).toEqual({ok:true});expect(mocks.rpc).toHaveBeenCalledTimes(1);expect(mocks.notify).toHaveBeenCalledWith('saved-id',expect.objectContaining({institution:'School'}));expect(mocks.rpc.mock.invocationCallOrder[0]).toBeLessThan(mocks.notify.mock.invocationCallOrder[0]);});
  it('does not send if persistence fails',async()=>{mocks.rpc.mockResolvedValue({error:{message:'db error'}});expect((await POST(req(valid))).status).toBe(503);expect(mocks.notify).not.toHaveBeenCalled();});
  it('keeps success when notification fails after persistence',async()=>{mocks.notify.mockResolvedValue(false);expect((await POST(req(valid))).status).toBe(200);});
  it('does not resend duplicate submissions',async()=>{mocks.rpc.mockResolvedValue({data:{id:'saved-id',duplicate:true},error:null});expect((await POST(req(valid))).status).toBe(200);expect(mocks.notify).not.toHaveBeenCalled();});
  it('returns 429 at the database rate limit',async()=>{mocks.rpc.mockResolvedValue({data:{rate_limited:true},error:null});expect((await POST(req(valid))).status).toBe(429);expect(mocks.notify).not.toHaveBeenCalled();});
  it('rejects cross-origin submissions',async()=>{expect((await POST(req(valid,'https://evil.example'))).status).toBe(403);expect(mocks.rpc).not.toHaveBeenCalled();});
  it('discards honeypot submissions',async()=>{expect((await POST(req({...valid,website:'spam'}))).status).toBe(200);expect(mocks.rpc).not.toHaveBeenCalled();});
  it('rejects unsigned requests',async()=>{expect((await POST(req({...valid,challenge:'invalid'}))).status).toBe(400);expect(mocks.rpc).not.toHaveBeenCalled();});
  it('bounds the body even without content length',async()=>{expect((await POST(req({...valid,message:'x'.repeat(20001)}))).status).toBe(413);expect(mocks.rpc).not.toHaveBeenCalled();});
});
