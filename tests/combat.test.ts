import { describe, expect, it } from 'vitest';
import { constants } from '../src/data';
import { damageAfterDefense, tickCombat } from '../src/sim/combat';
import { sequenceRng } from '../src/sim/rng';
import type { Monster } from '../src/sim/types';
import { createUnits } from '../src/sim/units';

describe('combat damage layers', () => {
  it('applies defense, defense multiplier, ignore, and reduction', () => {
    expect(damageAfterDefense(100, 100, 1, 0, 0)).toBeCloseTo(50);
    expect(damageAfterDefense(100, 100, 1.5, 0.5, 0.3)).toBeCloseTo(40);
  });

  it('makes a giant chase living fighters before attacking the wall', () => {
    const fighter = createUnits(['ireukkun'])[0]!;
    fighter.pos = { x: 760, y: constants.battle.allySpawnY };
    const giant: Monster = {
      uid: 'giant-test', defId: 'hermes', hp: 9999, maxHp: 9999, atk: 1, def: 999,
      speed: 1, attackInterval: 1, range: 30, drop: 0,
      pos: { x: 850, y: constants.battle.wallContactY }, actionTimer: 0, specialTimer: 99,
      giant: true, wallSeconds: 20, dead: false, atkMult: 1, moveMult: 1, defMult: 1, dotPct: 0,
    };
    const context = { wallHp: 1000, wallMax: 1000, materials: 0, freezeEnemies: 0, stunCooldown: 5 };

    tickCombat([fighter], [giant], 0.1, sequenceRng([0.99]), context);
    expect(context.wallHp).toBe(1000);
    expect(giant.pendingAttack?.bossAoe).toBe(true);
    expect(giant.pos.y).toBe(constants.battle.wallContactY);
    tickCombat([fighter], [giant], constants.battle.bossAoeWindupSec, sequenceRng([0.99]), context);

    fighter.state = 'mining';
    giant.pos.y = constants.battle.wallContactY;
    giant.actionTimer = 0;
    tickCombat([fighter], [giant], 0.1, sequenceRng([0.99]), context);
    tickCombat([fighter], [giant], constants.battle.monsterAttackWindupSec, sequenceRng([0.99]), context);
    expect(context.wallHp).toBeLessThan(1000);
  });

  it('returns idle fighters toward the wall when no monsters remain', () => {
    const fighter = createUnits(['ireukkun'])[0]!;
    fighter.pos.y = 500;
    const before = fighter.pos.y;
    const context = { wallHp: 1000, wallMax: 1000, materials: 0, freezeEnemies: 0, stunCooldown: constants.stun.cooldownSec };
    tickCombat([fighter], [], 0.5, sequenceRng([0.5]), context);
    expect(fighter.pos.y).toBeGreaterThan(before);
  });
});
