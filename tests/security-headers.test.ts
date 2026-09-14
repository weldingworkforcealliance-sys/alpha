import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const netlify = readFileSync(join(process.cwd(), 'netlify.toml'), 'utf8');

describe('Netlify browser security headers', () => {
  it('ships baseline clickjacking, MIME, referrer, permission, and HSTS protections', () => {
    expect(netlify).toContain('X-Content-Type-Options = "nosniff"');
    expect(netlify).toContain('X-Frame-Options = "DENY"');
    expect(netlify).toContain('Referrer-Policy = "strict-origin-when-cross-origin"');
    expect(netlify).toContain('Permissions-Policy = "camera=(), microphone=(), geolocation=()"');
    expect(netlify).toContain('Strict-Transport-Security = "max-age=31536000; includeSubDomains"');
  });

  it('does not commit server-only credentials into Netlify configuration', () => {
    expect(netlify).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY\s*=/);
    expect(netlify).not.toMatch(/RESEND_API_KEY\s*=/);
    expect(netlify).not.toMatch(/ATTENDANCE_CRON_SECRET\s*=/);
  });
});
