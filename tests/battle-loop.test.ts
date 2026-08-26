import { describe, expect, it } from 'vitest';
import { BattleSimulation } from '../src/sim/battle';
import { freshSave } from '../src/sim/save';

const run = (scripted: boolean) => {
  const sim = new BattleSimulation('S1', ['ireukkun', 'ttekkai', 'hareubang', 'dongki'], 'ireukkun', freshSave(), 1122);
  let elapsed = 0; let actionAt = 0; const classes = ['knight', 'thrower', 'mage'] as const;
  while (elapsed < 600 && sim.wave.phase !== 'victory' && sim.wave.phase !== 'defeat') {
    if (scripted && elapsed >= actionAt) {
      let guard = 0; while (sim.materials >= 5 && guard++ < 8) sim.enhance();
      const weakest = [...classes].sort((a, b) => Math.max(...sim.units.filter((unit) => unit.class === a).map((unit) => unit.sword.n), 0) - Math.max(...sim.units.filter((unit) => unit.class === b).map((unit) => unit.sword.n), 0))[0]!;
      const current = Math.max(...sim.units.filter((unit) => unit.class === weakest).map((unit) => unit.sword.n), 0);
      if (sim.forge.n > current) sim.supply(weakest); actionAt += 5;
    }
    sim.tick(0.1); elapsed += 0.1;
  }
  return { phase: sim.wave.phase, elapsed, wave: sim.wave.waveIndex + 1, wall: sim.wall.hp, highest: sim.stats.highestSword, materials: sim.materials, units: sim.units.map((unit) => ({ id: unit.defId, state: unit.state, n: unit.sword.n })) };
};
describe('S1 headless loop', () => {
  it('fails without player forging decisions', () => { expect(run(false).phase).toBe('defeat'); });
  it('clears with a five-second forge and supply script in three to five minutes', () => { const result = run(true); expect(result.phase).toBe('victory'); expect(result.elapsed).toBeGreaterThanOrEqual(180); expect(result.elapsed).toBeLessThanOrEqual(300); });
});
