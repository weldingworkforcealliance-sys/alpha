import { describe, expect, it } from 'vitest';
import config from '../next.config';

describe('browser security policy', () => {
  it('protects all routes while permitting the embedded grading Tower', async () => {
    const rules = await config.headers!();
    expect(rules).toHaveLength(1);
    expect(rules[0].source).toBe('/:path*');
    const headers = Object.fromEntries(rules[0].headers.map(({ key, value }) => [key, value]));
    expect(headers['X-Frame-Options']).toBe('SAMEORIGIN');
    expect(headers['Content-Security-Policy']).toContain("frame-ancestors 'self'");
    expect(headers['Content-Security-Policy']).toContain("object-src 'none'");
    expect(headers['Content-Security-Policy']).toContain("base-uri 'self'");
    // Do not impose untested script, style, or connection restrictions on Next/Supabase.
    expect(headers['Content-Security-Policy']).not.toMatch(/default-src|script-src|style-src|connect-src/);
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
    expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    expect(config.poweredByHeader).toBe(false);
  });
});
