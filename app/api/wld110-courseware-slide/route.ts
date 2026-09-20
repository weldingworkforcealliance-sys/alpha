import { createHash } from 'node:crypto';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PCCC_SCHOOL_ID = '08ccb452-83ab-482f-bb28-5576e02741b2';
const ALLOWED_CHAPTERS = new Set(['ofc', 'smaw', 'safety']);

type SlideAsset = {
  slide_number: number;
  image_b64: string;
  mime_type: string;
  source_filename: string;
  sha256: string;
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const chapter = (url.searchParams.get('chapter') || '').toLowerCase();
  const slide = Number.parseInt(url.searchParams.get('slide') || '', 10);

  if (!ALLOWED_CHAPTERS.has(chapter) || !Number.isInteger(slide) || slide < 1 || slide > 200) {
    return new Response('Invalid courseware slide.', { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data: claims, error: authError } = await supabase.auth.getClaims();
  if (authError || !claims?.claims?.sub) {
    return new Response('Authentication required.', { status: 401 });
  }

  const { data, error } = await supabase
    .from('instructor_courseware_slide_assets')
    .select('slide_number,image_b64,mime_type,source_filename,sha256')
    .eq('school_id', PCCC_SCHOOL_ID)
    .eq('chapter_key', chapter)
    .eq('slide_number', slide)
    .maybeSingle();

  if (error || !data) {
    return new Response('Instructor courseware access required.', { status: 403 });
  }

  const asset = data as SlideAsset;
  const image = Buffer.from(asset.image_b64, 'base64');
  const actualHash = createHash('sha256').update(image).digest('hex');
  if (!asset.sha256 || actualHash !== asset.sha256) {
    return new Response('Courseware slide verification failed.', { status: 503 });
  }

  return new Response(image, {
    status: 200,
    headers: {
      'Content-Type': asset.mime_type || 'image/webp',
      'Content-Disposition': `inline; filename="${chapter}-slide-${slide}.webp"`,
      'Cache-Control': 'private, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
      'X-Robots-Tag': 'noindex, nofollow, noarchive',
    },
  });
}
