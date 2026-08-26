import { describe, expect, it } from 'vitest';
import { constants } from '../src/data';
import { tickCombat } from '../src/sim/combat';
import { SeededRng } from '../src/sim/rng';
import { createUnits } from '../src/sim/units';
import { createWaveState, spawnMonster } from '../src/sim/wave';

describe('stage boss patterns', () => {
  it('telegraphs the S1 charge before damaging the wall and pushing units', () => {
    const rng = new SeededRng(12);
    const wave = createWaveState('S1', rng);
    wave.waveIndex = wave.stage.waves!.length - 1;
    const boss = spawnMonster(wave, 'zeus', true, rng);
    boss.bossPatternTimer = 0;
    const fighter = createUnits(['ttekkai'])[0]!;
    fighter.pos = { x: boss.pos.x, y: 900 };
    const context = { wallHp: 1000, wallMax: 1000, materials: 0, freezeEnemies: 0, stunCooldown: constants.stun.cooldownSec };

    const start = tickCombat([fighter], [boss], 0.05, rng, context);
    expect(start.some((event) => event.type === 'bossPatternStart' && event.pattern === 'charge')).toBe(true);
    expect(context.wallHp).toBe(1000);
    const beforeY = fighter.pos.y;
    tickCombat([fighter], [boss], constants.bossPatterns.S1[0]!.windup, rng, context);
    expect(context.wallHp).toBeLessThan(1000);
    expect(fighter.pos.y).toBeGreaterThan(beforeY);
    expect(Math.hypot(fighter.pos.x - boss.pos.x, fighter.pos.y - boss.pos.y)).toBeGreaterThanOrEqual(constants.battle.bossUnitSeparationRadius - 0.01);
  });

  it('raises every successive infinite-mode giant rank', () => {
    const firstRng = new SeededRng(9);
    const wave = createWaveState('INF', firstRng);
    wave.waveIndex = 0;
    const first = spawnMonster(wave, 'hermes', true, firstRng, 0);
    wave.waveIndex = 1;
    const second = spawnMonster(wave, 'poseidon', true, firstRng, 0);
    expect(second.infiniteRank).toBe(1);
    const baseWave = createWaveState('S3', new SeededRng(9));
    baseWave.waveIndex = 1;
    const unscaled = spawnMonster(baseWave, 'poseidon', true, new SeededRng(9), 0);
    expect(second.hp).toBeGreaterThan(unscaled.hp);
    expect(first.infiniteRank).toBe(0);
  });
});
