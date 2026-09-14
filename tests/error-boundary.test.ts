import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(join(process.cwd(), 'app/error.tsx'), 'utf8');

describe('LTG route error boundary', () => {
  it('offers retry and dashboard recovery actions', () => {
    expect(source).toContain('onClick={reset}');
    expect(source).toContain('href="/dashboard"');
  });

  it('does not render raw error messages or stacks to the user', () => {
    expect(source).not.toContain('{error.message}');
    expect(source).not.toContain('{error.stack}');
  });

  it('keeps a digest reference for support without exposing internals', () => {
    expect(source).toContain('Reference: {error.digest}');
  });
});
