import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const page = readFileSync(join(process.cwd(), 'app/classroom/planner/page.tsx'), 'utf8');

describe('planner Live Classroom instructor reference block', () => {
  it('loads the same safe class-reference payload used by the student Live Classroom', () => {
    expect(page).toContain("supabase.rpc('get_classroom_assessment'");
    expect(page).toContain('reference_title');
    expect(page).toContain('reference_image_url');
    expect(page).toContain('reference_body');
  });

  it('renders the class reference before Live Progress', () => {
    const referenceIndex = page.indexOf('Class Reference / Visual');
    const progressIndex = page.indexOf('Live Progress');

    expect(referenceIndex).toBeGreaterThan(-1);
    expect(progressIndex).toBeGreaterThan(referenceIndex);
  });

  it('supports visual, text, and maximized reference views', () => {
    expect(page).toContain('reference?.imageUrl');
    expect(page).toContain('reference?.body');
    expect(page).toContain('Maximize Reference');
    expect(page).toContain('Close Reference');
  });
});
