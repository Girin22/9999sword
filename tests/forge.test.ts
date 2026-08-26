import { describe, expect, it } from 'vitest';
import { constants } from '../src/data';
import { attackAtLevel, createForgeState, enhance } from '../src/sim/forge';
import { SeededRng, sequenceRng } from '../src/sim/rng';

const growth = { forgeLevel: 1, enhancePerClick: 1, lines: 2, recipes: [], optionRecipes: [] };
const context = { stageId: 'S2', tutorial: false };
describe('forge', () => {
  it('matches the enhancement probability over 10,000 clicks', () => {
    const rng = new SeededRng(42); let state = createForgeState(); let failures = 0;
    for (let i = 0; i < 10_000; i += 1) { const result = enhance(state, 1_000_000_000, rng, growth, context); state = result.state; if (result.events.includes('fail')) failures += 1; }
    expect(failures / 10_000).toBeGreaterThan(0.18); expect(failures / 10_000).toBeLessThan(0.22);
  });
  it('guarantees artisan spirit on the eleventh dry click', () => {
    const rng = sequenceRng([0.5]); let state = createForgeState();
    for (let i = 0; i < 10; i += 1) { const result = enhance(state, 999, rng, growth, context); state = result.state; expect(result.events).not.toContain('spirit'); }
    expect(enhance(state, 999, rng, growth, context).events).toContain('spirit');
  });
  it('rerolls shape every five clicks and keeps one trait slot', () => {
    const rng = new SeededRng(7); let state = createForgeState();
    for (let i = 0; i < 5; i += 1) state = enhance(state, 999, rng, growth, context).state;
    expect(state.shapeCounter).toBe(0); expect(state.options.length).toBeLessThanOrEqual(1);
    state.spiritCounter = 10; state.trait = 'tempering'; state = enhance(state, 999, rng, growth, context).state;
    expect(typeof state.trait).toBe('string'); expect(Array.isArray(state.trait)).toBe(false);
  });
  it('applies the softened breakthrough curve', () => { expect(attackAtLevel(10)).toBeCloseTo((constants.forge.atk.base + constants.forge.atk.perLevel * 10) * constants.forge.atk.breakthroughMult); });
});
