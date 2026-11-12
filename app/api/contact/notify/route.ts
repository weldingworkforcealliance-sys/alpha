import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { notifyLead, sameOrigin } from '@/lib/contact-server';
import { parseContact } from '@/lib/contact';

export async function POST(request: Request) {
  const reply = (body: object, status=200) => NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});
  if(!sameOrigin(request))return reply({error:'Invalid origin.'},403);
  const db=await createSupabaseServerClient();
  const {data:{user}}=await db.auth.getUser();
  if(!user)return reply({error:'Sign in required.'},401);
  const {data:owner,error:ownerError}=await db.rpc('is_platform_owner');
  if(ownerError || owner!==true)return reply({error:'Platform owner required.'},403);
  try{
    const {id}=await request.json();
    if(typeof id!=='string' || !/^[a-f0-9-]{36}$/.test(id))return reply({error:'Invalid inquiry.'},400);
    const {data,error}=await db.from('contact_leads').select('*').eq('id',id).single();
    if(error || !data)return reply({error:'Inquiry unavailable.'},404);
    if(data.notification_status==='sent')return reply({ok:true});
    // Reuse the original provider idempotency key for manual retries.
    const sent=await notifyLead(id,parseContact(data));
    return sent?reply({ok:true}):reply({error:'Inquiry is saved, but email failed. Check notification configuration and retry.'},503);
  }catch{return reply({error:'Unable to retry notification.'},503);}
}
