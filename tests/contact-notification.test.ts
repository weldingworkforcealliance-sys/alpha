import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks=vi.hoisted(()=>({update:vi.fn(),eq:vi.fn()}));
vi.mock('@supabase/supabase-js',()=>({createClient:()=>({from:()=>({update:mocks.update})})}));
import { notifyLead } from '../lib/contact-server';
import { parseContact } from '../lib/contact';
const lead=parseContact({name:'<script>test</script>',institution:'School',email:'test@example.com',inquiry_type:'General information'});
beforeEach(()=>{vi.clearAllMocks();mocks.update.mockReturnValue({eq:mocks.eq});mocks.eq.mockResolvedValue({error:null});vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL','https://ezlvivmeneefiiwqwgqd.supabase.co');vi.stubEnv('CONTACT_SUPABASE_SERVICE_ROLE_KEY','test');vi.stubEnv('CONTACT_RESEND_API_KEY','test');vi.stubEnv('CONTACT_FROM_EMAIL','LTG <test@example.com>');vi.stubEnv('CONTACT_NOTIFICATION_EMAIL','owner@example.com');vi.stubEnv('NEXT_PUBLIC_DEPLOYMENT_ENV','staging');});
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});
it('uses fixed recipients, plain text, a staging label and stable retry key',async()=>{
  const fetcher=vi.fn().mockResolvedValue({ok:true});vi.stubGlobal('fetch',fetcher);
  expect(await notifyLead('test-id',lead)).toBe(true);
  const request=fetcher.mock.calls[0][1];const body=JSON.parse(request.body);
  expect(body).toMatchObject({to:['owner@example.com'],reply_to:'test@example.com',subject:'[STAGING] New LTG inquiry'});
  expect(body.html).toBeUndefined();expect(request.headers['Idempotency-Key']).toBe('ltg-contact/test-id');expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({notification_status:'sent'}));
});
it('records provider failure without deleting the saved lead',async()=>{vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new Error('timeout')));expect(await notifyLead('test-id',lead)).toBe(false);expect(mocks.update).toHaveBeenCalledWith({notification_status:'failed',notified_at:null});});
it('records missing notification configuration as a failure',async()=>{vi.stubEnv('CONTACT_RESEND_API_KEY','');const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);expect(await notifyLead('test-id',lead)).toBe(false);expect(fetcher).not.toHaveBeenCalled();});
