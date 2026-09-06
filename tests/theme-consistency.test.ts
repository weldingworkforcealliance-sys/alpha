import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function read(path: string) {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

describe('LTG visual theme consistency', () => {
  it('loads the normalization layers after the legacy theme files', () => {
    const layout = read('app/layout.tsx');
    const launchIndex = layout.indexOf("import './launch-theme.css';");
    const consistencyIndex = layout.indexOf("import './theme-consistency.css';");
    const componentIndex = layout.indexOf("import './theme-component-overrides.css';");

    expect(launchIndex).toBeGreaterThan(-1);
    expect(consistencyIndex).toBeGreaterThan(launchIndex);
    expect(componentIndex).toBeGreaterThan(consistencyIndex);
  });

  it('defines one semantic token set for both light and dark modes', () => {
    const css = read('app/theme-consistency.css');

    expect(css).toContain("html[data-theme='light']");
    expect(css).toContain("html[data-theme='dark']");
    for (const token of [
      '--ltg-canvas',
      '--ltg-surface',
      '--ltg-input',
      '--ltg-text',
      '--ltg-muted',
      '--ltg-border',
      '--ltg-accent',
      '--ltg-info',
      '--ltg-success',
      '--ltg-danger',
    ]) {
      expect(css).toContain(token);
    }
  });

  it('keeps the teaching console on global LTG theme tokens', () => {
    const css = read('app/components/planner/PlannerTeachingConsole.module.css');

    expect(css).toContain('var(--ltg-canvas');
    expect(css).toContain('var(--ltg-surface');
    expect(css).toContain('var(--ltg-text');
    expect(css).toContain('var(--ltg-accent');
    expect(css).not.toContain('#07100f');
    expect(css).not.toContain('#0b1716');
    expect(css).not.toContain('#00ff88');
  });

  it('keeps attendance on the same global theme tokens', () => {
    const css = read('app/attendance/attendance.module.css');

    expect(css).toContain('var(--ltg-surface');
    expect(css).toContain('var(--ltg-input');
    expect(css).toContain('var(--ltg-text');
    expect(css).toContain('var(--ltg-accent');
    expect(css).not.toContain('#06100e');
    expect(css).not.toContain('#00ff88');
  });

  it('removes legacy neon styling from shared planner chrome', () => {
    const workspace = read('app/cohort-workspace-bar.tsx');
    const identity = read('app/teacher-identity-bar.tsx');
    const reviewLink = read('app/review-queue-link.tsx');
    const agendaBanner = read('app/agenda-note-policy-banner.tsx');

    for (const source of [workspace, identity, reviewLink, agendaBanner]) {
      expect(source).not.toContain('#00ff88');
    }

    expect(workspace).toContain('var(--ltg-accent)');
    expect(identity).toContain('var(--ltg-accent)');
  });

  it('makes the projector-safe student display theme-aware', () => {
    const display = read('app/student-display/[guideDayId]/page.tsx');

    expect(display).toContain('var(--ltg-canvas)');
    expect(display).toContain('var(--ltg-text)');
    expect(display).toContain('var(--ltg-accent)');
    expect(display).not.toContain('#06100f');
  });
});
