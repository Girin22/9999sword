import { byId, constants, monsterData, stageData } from '../data';
import type { StageDef } from '../data/types';
import type { RandomSource } from './rng';
import type { Monster } from './types';

export type WavePhase = 'mobs' | 'warning' | 'giant' | 'victory' | 'defeat';
export interface WaveState { stage: StageDef; waveIndex: number; phase: WavePhase; phaseTime: number; spawnQueue: string[]; spawned: number; nextSpawnAt: number; serial: number }

export const resolveStage = (id: string): StageDef => {
  const stage = byId(stageData.stages, id);
  return stage.repeatOf ? { ...byId(stageData.stages, stage.repeatOf), ...stage, waves: byId(stageData.stages, stage.repeatOf).waves } : stage;
};
export const makeQueue = (record: Record<string, number>, rng: RandomSource, countMult = 1): string[] => {
  const items = Object.entries(record).flatMap(([id, count]) => Array.from({ length: Math.round(count * countMult) }, () => id));
  return items.sort(() => rng.next() - 0.5);
};
export function createWaveState(stageId: string, rng: RandomSource): WaveState {
  const stage = resolveStage(stageId);
  const queue = makeQueue(stage.waves![0]!.mobs, rng, stage.mobCountMult ?? 1);
  return { stage, waveIndex: 0, phase: 'mobs', phaseTime: 0, spawnQueue: queue, spawned: 0, nextSpawnAt: constants.wave.mobPhaseSec / (queue.length + 1), serial: 0 };
}
export function spawnMonster(state: WaveState, id: string, giant: boolean, rng: RandomSource, loop = 0): Monster {
  const source = byId(giant ? monsterData.giants : monsterData.mobs, id);
  const stageSteps = Math.max(0, state.stage.stageIndex - 1);
  const scale = giant ? monsterData.scaling.giant : monsterData.scaling.mob;
  const stageMult = scale.hpAtkMultPerStage ** stageSteps;
  const infiniteRank = state.stage.id === 'INF' && giant ? loop * state.stage.waves!.length + state.waveIndex : loop;
  // Infinite giants grow per appearance (bossMultPerAppearance); everything else per loop.
  const perRank = state.stage.id === 'INF' && giant ? state.stage.loopScaling?.bossMultPerAppearance ?? 1.3 : 1.3;
  const loopMult = perRank ** infiniteRank;
  const bossStage = giant ? state.stage.waves![state.waveIndex]?.bossStage : undefined;
  const hp = source.hp * stageMult * loopMult;
  return { uid: `${id}-${state.serial++}`, defId: id, hp, maxHp: hp, atk: source.atk * stageMult * loopMult, def: source.def + scale.defAddPerStage * stageSteps + infiniteRank * 15, speed: source.moveSpeed, attackInterval: source.attackInterval, range: source.range ?? 72, drop: source.drop, pos: { x: 140 + rng.next() * 800, y: constants.battle.enemySpawnY - rng.next() * 90 }, actionTimer: 0, specialTimer: Number(source.special?.every ?? 99), giant, wallSeconds: (source.wallSeconds ?? 999) * (state.stage.wallSecondsMult ?? 1), dead: false, atkMult: 1, moveMult: 1, defMult: 1, dotPct: 0, stageId: state.stage.id, bossStage, bossPatternTimer: giant && id === 'zeus' ? 1.5 : undefined, bossPatternIndex: 0, infiniteRank };
}
export function advanceWave(state: WaveState, monsters: Monster[], dt: number, rng: RandomSource, wall: { hp: number; max: number }, loop = 0): Monster[] {
  if (wall.hp <= 0) { state.phase = 'defeat'; return []; }
  if (state.phase === 'victory' || state.phase === 'defeat') return [];
  state.phaseTime += dt;
  const spawned: Monster[] = [];
  if (state.phase === 'mobs') {
    if (state.spawned < state.spawnQueue.length && state.phaseTime >= state.nextSpawnAt) {
      spawned.push(spawnMonster(state, state.spawnQueue[state.spawned]!, false, rng, loop));
      state.spawned += 1;
      state.nextSpawnAt = constants.wave.mobPhaseSec * (state.spawned + 1) / (state.spawnQueue.length + 1);
    }
    if (state.phaseTime >= constants.wave.mobPhaseSec) { state.phase = 'warning'; state.phaseTime = 0; }
  } else if (state.phase === 'warning') {
    const giantId = state.stage.waves![state.waveIndex]!.giant;
    const warning = giantId === 'hermes' ? constants.wave.warningSecHermes : constants.wave.warningSec;
    if (state.phaseTime >= warning) { spawned.push(spawnMonster(state, giantId, true, rng, loop)); state.phase = 'giant'; state.phaseTime = 0; }
  } else if (state.phase === 'giant') {
    const giantAlive = monsters.some((monster) => monster.giant && !monster.dead && monster.hp > 0);
    const giantSpawned = monsters.some((monster) => monster.giant);
    if (giantSpawned && !giantAlive) {
      wall.hp = Math.min(wall.max, wall.hp + wall.max * constants.wall.regenOnWaveClear);
      if (state.waveIndex >= state.stage.waves!.length - 1) state.phase = 'victory';
      else {
        state.waveIndex += 1; state.phase = 'mobs'; state.phaseTime = 0; state.spawned = 0;
        state.spawnQueue = makeQueue(state.stage.waves![state.waveIndex]!.mobs, rng, state.stage.mobCountMult ?? 1);
        state.nextSpawnAt = constants.wave.mobPhaseSec / (state.spawnQueue.length + 1);
        monsters.splice(0, monsters.length, ...monsters.filter((monster) => !monster.dead));
      }
    }
  }
  return spawned;
}
