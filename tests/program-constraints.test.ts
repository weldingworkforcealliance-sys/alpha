import { describe, expect, it } from 'vitest';
import { MAX_WELDING_CLASS_CAPACITY } from '../lib/program-constraints';

describe('welding program constraints', () => {
  it('keeps the lab-supported class maximum at 17 students', () => {
    expect(MAX_WELDING_CLASS_CAPACITY).toBe(17);
  });
});
