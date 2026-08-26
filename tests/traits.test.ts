import { describe, expect, it } from 'vitest';
import { constants, traitData } from '../src/data';
import { tickCombat, type CombatContext } from '../src/sim/combat';
import { SeededRng } from '../src/sim/rng';
import { swordStats } from '../src/sim/swordStats';
import type { Monster } from '../src/sim/types';
import { createUnits } from '../src/sim/units';

const context = (): CombatContext => ({ wallHp: 1000, wallMax: 1000, materials: 100, freezeEnemies: 0, stunCooldown: constants.stun.cooldownSec });
const monster = (): Monster => ({ uid: 'dummy', defId: 'calf', hp: 1000, maxHp: 1000, atk: 0, def: 10, speed: 0, attackInterval: 99, range: 0, drop: 0, pos: { x: 250, y: constants.battle.allySpawnY - 30 }, actionTimer: 99, specialTimer: 99, giant: false, wallSeconds: 999, dead: false, atkMult: 1, moveMult: 1, defMult: 1, dotPct: 0 });

describe('all trait hooks', () => {
  it('keeps every catalog trait executable with finite derived stats', () => {
    expect(traitData.traits).toHaveLength(32);
    for (const trait of traitData.traits) {
      const unit = createUnits(['ireukkun'])[0]!; unit.sword = { n: 10, kind: 'basic', trait: trait.id, options: [], stacks: 0 }; unit.traitTimer = 100;
      if (trait.id === 'avatar') unit.state = 'avatar';
      expect(() => tickCombat([unit], [monster()], 0.1, new SeededRng(4), context())).not.toThrow();
      const stats = swordStats(unit); expect(Number.isFinite(stats.atk)).toBe(true); expect(Number.isFinite(stats.attackInterval)).toBe(true);
    }
  });
  it('activates order auras and one-time immortality', () => {
    const [source, ally] = createUnits(['ireukkun', 'hareubang']); source!.sword.trait = 'formation'; source!.traitTimer = 31; ally!.pos = { ...source!.pos };
    tickCombat([source!, ally!], [], 0.1, new SeededRng(1), context()); expect(ally!.auraAtkMult).toBeGreaterThan(1);
    source!.sword.trait = 'immortal'; source!.sword.stacks = 0; source!.traitTimer = 91; source!.hp = 0;
    tickCombat([source!], [], 0.1, new SeededRng(1), context()); expect(source!.hp).toBe(1); expect(source!.sword.stacks).toBe(1);
  });
  it('applies chaos costs and persistent monster debuffs', () => {
    const unit = createUnits(['ireukkun'])[0]!; unit.sword = { n: 10, kind: 'basic', trait: 'plague', options: [], stacks: 0 }; const enemy = monster(); const ctx = context();
    tickCombat([unit], [enemy], 0.1, new SeededRng(2), ctx);
    tickCombat([unit], [enemy], constants.battle.unitAttackWindupSec, new SeededRng(2), ctx);
    expect(enemy.atkMult).toBeLessThan(1); expect(enemy.moveMult).toBeLessThan(1);
    unit.sword.trait = 'wallBlood'; unit.actionTimer = 0; tickCombat([unit], [enemy], 0.1, new SeededRng(2), ctx); expect(ctx.wallHp).toBeLessThan(ctx.wallMax);
  });
});
