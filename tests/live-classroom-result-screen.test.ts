import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const page = readFileSync(join(process.cwd(), 'app/join/[code]/page.tsx'), 'utf8');

describe('Live Classroom result screen', () => {
  it('separates completion, answered count, and score in the shared student route', () => {
    expect(page).toContain('Activity Completed');
    expect(page).toContain('questions answered');
    expect(page).toContain('Score: {result.score}/{result.possible_score} correct · {result.percent}%');
    expect(page).not.toContain('Activity Submitted');
    expect(page).not.toContain('Readiness Check Submitted');
  });

  it('keeps hidden-score readiness activities score-free for students', () => {
    expect(page).toContain('info.show_student_score&&');
    expect(page).toContain('Your instructor received your readiness evidence.');
    expect(page).toContain('Your instructor received your results.');
  });
});
