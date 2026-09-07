import { describe, expect, it } from 'vitest';
import { HELP_ITEMS, HELP_QA, searchHelpItems } from '../lib/help-content';

describe('LTG help content', () => {
  it('uses unique stable ids', () => {
    const ids = HELP_ITEMS.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('keeps all articles searchable by useful text', () => {
    expect(searchHelpItems('attendance roster').some((item) => item.id === 'guide-add-roster')).toBe(true);
    expect(searchHelpItems('clock out').some((item) => item.id === 'guide-clock-in-out')).toBe(true);
    expect(searchHelpItems('school admin').some((item) => item.id === 'guide-add-school-admin')).toBe(true);
  });

  it('states the current instructor assignment limitation correctly', () => {
    const item = HELP_QA.find((qa) => qa.id === 'qa-add-remove-instructor-class');
    expect(item).toBeTruthy();
    expect(item?.answer).toContain('only the Platform Owner');
    expect(item?.answer).toContain('School Dashboard');
    expect(item?.route).toBe('/owner/admin');
  });

  it('does not require exact phrasing for search', () => {
    expect(searchHelpItems('remove instructor').some((item) => item.id === 'qa-add-remove-instructor-class')).toBe(true);
    expect(searchHelpItems('where roster').some((item) => item.id === 'qa-where-roster')).toBe(true);
  });
});
