import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const config = readFileSync('netlify.toml', 'utf8');

describe('Netlify Deploy Preview isolation', () => {
  it('pins Deploy Previews to the Gltg staging Supabase project', () => {
    expect(config).toContain('[context.deploy-preview.environment]');
    expect(config).toContain('https://ezlvivmeneefiiwqwgqd.supabase.co');
    expect(config).toContain('NEXT_PUBLIC_DEPLOYMENT_ENV = "staging"');
  });

  it('does not point Deploy Previews at the beta genco production project', () => {
    expect(config).not.toContain('qsmvgyyaemjmklceyikr');
  });

  it('does not define privileged server credentials', () => {
    expect(config).not.toMatch(/^\s*SUPABASE_SERVICE_ROLE_KEY\s*=/m);
    expect(config).not.toMatch(/^\s*RESEND_API_KEY\s*=/m);
    expect(config).not.toMatch(/^\s*ATTENDANCE_CRON_SECRET\s*=/m);
  });
});
