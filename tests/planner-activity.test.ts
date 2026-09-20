import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import PlannerActivity from '../app/planner-activity';
import { parsePlannerActivity } from '../lib/planner-activity';

describe('planner teaching cues', () => {
  it('keeps safety and checks visibly labeled alongside teaching bullets', () => {
    const text = 'FIRST ARC\n\n🟥 SAFETY — Unplug before setup.\n\n🟦 DEMO + PRACTICE\n• Fit helmet.\n• Inspect grinder.\n\n🟩 CHECK — Confirm setup.';
    const result = parsePlannerActivity(text);
    expect(result.title).toBe('FIRST ARC');
    expect(result.sections.map((s) => s.tone)).toEqual(['safety', 'teach', 'check']);
    const html = renderToStaticMarkup(createElement(PlannerActivity, { text }));
    expect(html).toContain('<h5 class="planner-activity-title">FIRST ARC</h5>');
    expect(html).toContain('Unplug before setup.');
    expect(html).toContain('<li>Fit helmet.</li>');
    expect(html).toContain('Confirm setup.');
    expect(html).not.toContain('<details');
  });

  it('preserves ordinary directions and safely renders legacy emphasis', () => {
    const text = 'Inspect the station.\n\nKeep **safety glasses** on.\n1. Check tools.\n2. Stop for defects.';
    const html = renderToStaticMarkup(createElement(PlannerActivity, { text, fallbackTitle: 'Preparation' }));
    expect(html).toContain('Inspect the station.');
    expect(html).toContain('<strong>safety glasses</strong>');
    expect(html).toContain('<li>Check tools.</li>');
    expect(html).toContain('<li>Stop for defects.</li>');
  });

  it('treats embedded HTML as text, never as executable markup', () => {
    const html = renderToStaticMarkup(createElement(PlannerActivity, { text: '<img src=x onerror=alert(1)>' }));
    expect(html).toContain('&lt;img');
    expect(html).not.toContain('<img');
  });

  it('reads legacy Markdown headings without dropping their following directions', () => {
    const result = parsePlannerActivity('### Shop orientation\n\n#### Emergency tour\nShow exits.\n\nKeep the class together.');
    expect(result.title).toBe('Shop orientation');
    expect(result.sections[0].label).toBe('Emergency tour');
    expect(result.sections[0].lines.map((l) => l.text)).toEqual(['Show exits.', 'Keep the class together.']);
  });
});
