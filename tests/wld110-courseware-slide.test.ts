import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createClient, getClaims, maybeSingle, from, select, eq } = vi.hoisted(() => ({
  createClient: vi.fn(), getClaims: vi.fn(), maybeSingle: vi.fn(), from: vi.fn(), select: vi.fn(), eq: vi.fn(),
}));
vi.mock('@/lib/supabase-server', () => ({ createSupabaseServerClient: createClient }));
import { GET } from '../app/api/wld110-courseware-slide/route';

const bytes = Buffer.from('verified slide response');
const asset = { slide_number: 10, image_b64: bytes.toString('base64'), mime_type: 'image/webp', source_filename: 'purchased.pptx', sha256: createHash('sha256').update(bytes).digest('hex') };
const request = (query = 'chapter=ofc&slide=10') => new Request('https://ltg.example/api/wld110-courseware-slide?' + query);

beforeEach(() => {
  vi.resetAllMocks();
  const query = { select, eq, maybeSingle };
  from.mockReturnValue(query); select.mockReturnValue(query); eq.mockReturnValue(query);
  createClient.mockResolvedValue({ auth: { getClaims }, from });
  getClaims.mockResolvedValue({ data: { claims: { sub: 'instructor' } }, error: null });
  maybeSingle.mockResolvedValue({ data: asset, error: null });
});

describe('private WLD 110 full-slide delivery', () => {
  it.each(['chapter=other&slide=10', 'chapter=ofc&slide=0', 'chapter=ofc&slide=201', 'chapter=smaw&slide=10junk', 'chapter=safety&slide=1.5', 'chapter=ofc&slide=1e2', 'chapter=ofc'])('rejects invalid identifiers: %s', async query => {
    expect((await GET(request(query))).status).toBe(400);
    expect(createClient).not.toHaveBeenCalled();
  });
  it('requires verified authentication before querying licensed data', async () => {
    getClaims.mockResolvedValue({ data: null, error: new Error('no session') });
    expect((await GET(request())).status).toBe(401);
    expect(from).not.toHaveBeenCalled();
  });
  it('denies a signed-in user without an instructor-visible row', async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });
    expect((await GET(request())).status).toBe(403);
  });
  it('fails closed when the database denies access', async () => {
    maybeSingle.mockResolvedValue({ data: null, error: new Error('denied') });
    expect((await GET(request())).status).toBe(403);
  });
  it('rejects damaged slide bytes instead of serving them', async () => {
    maybeSingle.mockResolvedValue({ data: { ...asset, image_b64: 'Y29ycnVwdA==' }, error: null });
    expect((await GET(request())).status).toBe(503);
  });
  it.each(['safety','smaw','ofc'])('serves verified %s bytes through the existing scoped query', async chapter => {
    const response = await GET(request(`chapter=${chapter}&slide=10`));
    expect(response.status).toBe(200);
    expect(Buffer.from(await response.arrayBuffer())).toEqual(bytes);
    expect(from).toHaveBeenCalledWith('instructor_courseware_slide_assets');
    expect(eq).toHaveBeenCalledWith('school_id', '08ccb452-83ab-482f-bb28-5576e02741b2');
    expect(eq).toHaveBeenCalledWith('chapter_key', chapter);
    expect(eq).toHaveBeenCalledWith('slide_number', 10);
    expect(response.headers.get('content-type')).toBe('image/webp');
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
  });
});
