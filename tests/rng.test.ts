import { describe, expect, it } from 'vitest';
import { SeededRng } from '../src/sim/rng';

describe('seeded rng', () => {
  it('repeats a sequence for the same seed', () => {
    const a = new SeededRng(9999); const b = new SeededRng(9999);
    expect(Array.from({ length: 20 }, () => a.next())).toEqual(Array.from({ length: 20 }, () => b.next()));
  });
});
