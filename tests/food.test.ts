import { describe, expect, it } from 'vitest';
import { foodLimitFor } from '../src/sim/food';
import { freshSave } from '../src/sim/save';

describe('food progression', () => {
  it('starts at the first stage limit and grows with clears, applying to earlier stages too', () => {
    const save = freshSave();
    expect(foodLimitFor('S1', save)).toBe(8);
    save.cleared.S1 = true;
    expect(foodLimitFor('S1', save)).toBe(10);
    save.cleared.S2 = true;
    expect(foodLimitFor('S1', save)).toBe(12);
    save.cleared.S3 = true;
    expect(foodLimitFor('S1', save)).toBe(12);
    expect(foodLimitFor('INF', save)).toBe(20);
  });
});
