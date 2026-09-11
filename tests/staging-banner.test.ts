import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const layout = readFileSync('app/layout.tsx', 'utf8');

describe('staging safety banner', () => {
  it('shows a visible warning only when the staging environment flag is set', () => {
    expect(layout).toContain("process.env.NEXT_PUBLIC_DEPLOYMENT_ENV === 'staging'");
    expect(layout).toContain('STAGING · NO LIVE DATA');
  });
});
