import { createHash } from 'node:crypto';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PCCC_SCHOOL_ID = '08ccb452-83ab-482f-bb28-5576e02741b2';
const ALLOWED_CHAPTERS = new Set(['ofc', 'smaw', 'safety']);

type CoursewareChunk = {
  chunk_index: number;
  chunk_b64: string;
  total_chunks: number;
  mime_type: string;
  source_filename: string;
  sha256: string;
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const chapter = (url.searchParams.get('chapter') || '').toLowerCase();

  if (!ALLOWED_CHAPTERS.has(chapter)) {
    return new Response('Invalid courseware chapter.', { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data: claims, error: authError } = await supabase.auth.getClaims();
  if (authError || !claims?.claims?.sub) {
    return new Response('Authentication required.', { status: 401 });
  }

  const { data, error } = await supabase
    .from('instructor_courseware_pdf_chunks')
    .select('chunk_index,chunk_b64,total_chunks,mime_type,source_filename,sha256')
    .eq('school_id', PCCC_SCHOOL_ID)
    .eq('chapter_key', chapter)
    .order('chunk_index');

  if (error) {
    return new Response('Licensed courseware could not be loaded.', { status: 403 });
  }

  const rows = (data ?? []) as CoursewareChunk[];
  if (!rows.length) {
    return new Response('Instructor courseware access required.', { status: 403 });
  }

  const expectedChunks = rows[0].total_chunks;
  if (
    rows.length !== expectedChunks ||
    rows.some((row, index) => row.chunk_index !== index || row.total_chunks !== expectedChunks)
  ) {
    return new Response('Courseware asset is incomplete.', { status: 503 });
  }

  const pdf = Buffer.concat(rows.map((row) => Buffer.from(row.chunk_b64, 'base64')));
  const expectedHash = rows[0].sha256;
  const actualHash = createHash('sha256').update(pdf).digest('hex');
  if (!expectedHash || expectedHash !== actualHash) {
    return new Response('Courseware asset verification failed.', { status: 503 });
  }

  const sourceFilename = rows[0].source_filename.replace(/[^a-zA-Z0-9._ -]/g, '_');
  return new Response(pdf, {
    status: 200,
    headers: {
      'Content-Type': rows[0].mime_type || 'application/pdf',
      'Content-Disposition': `inline; filename="${sourceFilename}"`,
      'Cache-Control': 'private, max-age=900',
      'X-Content-Type-Options': 'nosniff',
      'X-Robots-Tag': 'noindex, nofollow, noarchive',
    },
  });
}
