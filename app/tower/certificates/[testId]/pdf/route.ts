import { createSupabaseServerClient } from '@/lib/supabase-server';
import { createTestRecordPdf } from '@/lib/tower-test-record-pdf';

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
  const {data,error} = await client.from('tower_certificates').select('id,snapshot,issued_at').eq('test_id',testId).maybeSingle();
  if (error) return new Response('Record could not be loaded', {status:503,headers:privateHeaders});
  if (!data) return new Response('Record not found', {status:404,headers:privateHeaders});
  try {
    const bytes = await createTestRecordPdf(data);
    return new Response(new Uint8Array(bytes), {headers:{...privateHeaders,
      'Content-Type':'application/pdf',
      'Content-Disposition':`attachment; filename="LTG-test-record-${testId}.pdf"`}});
  } catch {
    return new Response('PDF could not be generated. Open the test record and use Print / save PDF.',
      {status:422,headers:privateHeaders});
  }
}
