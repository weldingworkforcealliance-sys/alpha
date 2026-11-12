import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseContact } from '../lib/contact';
import { contactChallenge, verifyChallenge, sameOrigin } from '../lib/contact-server';
import { isPublicRoute } from '../lib/auth-routes';

export const validContact = { name:'Test Person', institution:'Test School', email:'TEST@example.com', inquiry_type:'LTG demonstration' };
afterEach(()=>vi.unstubAllEnvs());
describe('contact validation and request security',()=>{
  it('normalizes email and supplies bounded optional fields',()=>{expect(parseContact(validContact)).toMatchObject({email:'test@example.com',phone:'',source_page:'/contact'});});
  it.each([{name:''},{institution:''},{email:'bad\r\nBcc: attacker@example.com'},{inquiry_type:'bogus'},{message:'a'.repeat(5001)},{phone:123}])('rejects malformed input %j',change=>{expect(()=>parseContact({...validContact,...change})).toThrow();});
  it('requires a signed, aged, unexpired challenge',()=>{
    vi.stubEnv('CONTACT_SIGNING_SECRET','a'.repeat(32));const now=10000000; const token=contactChallenge(now);
    expect(verifyChallenge(token,now)).toBe(false);expect(verifyChallenge(token,now+2000)).toBe(true);
    expect(verifyChallenge(token,now+3600001)).toBe(false);expect(verifyChallenge(token+'0',now+2000)).toBe(false);
    expect(verifyChallenge('bogus',now)).toBe(false);
  });
  it('requires the same origin',()=>{expect(sameOrigin(new Request('https://ltgeducation.com/api/contact',{headers:{origin:'https://evil.example'}}))).toBe(false);expect(sameOrigin(new Request('https://ltgeducation.com/api/contact',{headers:{origin:'https://ltgeducation.com'}}))).toBe(true);});
  it('opens only the intended public endpoints',()=>{expect(isPublicRoute('/contact')).toBe(true);expect(isPublicRoute('/api/contact')).toBe(true);expect(isPublicRoute('/api/contact/notify')).toBe(false);expect(isPublicRoute('/owner/admin/prospective-schools')).toBe(false);});
  it('checks the configured public origin behind a hosting proxy',()=>{
    vi.stubEnv('CONTACT_SITE_ORIGIN','https://deploy-preview-148--livingtguide.netlify.app');
    expect(sameOrigin(new Request('https://internal.example/api/contact',{headers:{origin:'https://deploy-preview-148--livingtguide.netlify.app'}}))).toBe(true);
    expect(sameOrigin(new Request('https://internal.example/api/contact',{headers:{origin:'https://evil.example','x-forwarded-host':'evil.example'}}))).toBe(false);
  });
});
