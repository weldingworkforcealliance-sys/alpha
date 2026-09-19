import { createSupabaseServerClient } from '@/lib/supabase-server';
import { createTestRecordPdf } from '@/lib/tower-test-record-pdf';
import {createPcccCertificate,usesPcccCertificate,PCCC_SCHOOL_ID} from '@/lib/pccc-certificate-pdf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const privateHeaders = {'Cache-Control':'private, no-store', 'X-Content-Type-Options':'nosniff'};

export async function GET(_request: Request, {params}: {params: Promise<{testId: string}>}) {
  const {testId} = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(testId)) {
    return new Response('Record not found', {status:404,headers:privateHeaders});
  }
  const client = await createSupabaseServerClient();
  const {data:auth,error:authError} = await client.auth.getUser();
  if (authError || !auth.user) return new Response('Sign in to view this record', {status:401,headers:privateHeaders});
  // The signed-in client applies the same school/class RLS as the record page.
  const {data,error} = await client.from('tower_certificates').select('id,snapshot,issued_at,gradebook_id').eq('test_id',testId).maybeSingle();
  if (error) return new Response('Record could not be loaded', {status:503,headers:privateHeaders});
  if (!data) return new Response('Record not found', {status:404,headers:privateHeaders});
  try {
    const {data:template,error:templateError}=await client.rpc('certificate_template_for_test',{p_test_id:testId});
    if(templateError)throw new Error('Certificate template unavailable');
    const branded=template?.layout==='pccc-guided-bend-v2' && usesPcccCertificate(PCCC_SCHOOL_ID,data.snapshot);
    if(branded && (typeof template.pdf!=='string'||template.pdf.length>2800000))throw new Error('Invalid template');
    const bytes = branded
      ? await createPcccCertificate(data,Buffer.from(template.pdf,'base64')) : await createTestRecordPdf(data);
    return new Response(new Uint8Array(bytes), {headers:{...privateHeaders,
      'Content-Type':'application/pdf',
      'Content-Disposition':`attachment; filename="LTG-test-record-${testId}.pdf"`}});
  } catch {
    return new Response('PDF could not be generated. Open the test record and use Print / save PDF.',
      {status:422,headers:privateHeaders});
  }
}
