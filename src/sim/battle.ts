import { byId, constants, growthData, stageData, traitData, unitData } from '../data';
import type { UnitClass } from '../data/types';
import { requestRecovery, tickBarracks } from './barracks';
import { tickCombat, type CombatContext, type CombatEvent } from './combat';
import { createForgeState, enhance, resetForgeAfterSupply, successChance, type ForgeEvent, type ForgeGrowth } from './forge';
import { assignMiner, mineTick } from './mine';
import { SeededRng, type RandomSource } from './rng';
import type { GameSave } from './save';
import { beginSupply, tickReturns } from './supply';
import type { BattleStats, ForgeState, Monster, Unit } from './types';
import { createUnits } from './units';
import { advanceWave, createWaveState, type WaveState } from './wave';

export interface BattleEvent extends CombatEvent { forge?: ForgeEvent[] }
export interface BattleSnapshot { phase: WaveState['phase']; wave: number; waveCount: number; phaseTime: number; materials: number; wallHp: number; wallMax: number; forge: ForgeState; units: Unit[]; monsters: Monster[]; stats: BattleStats; speed: number }

const growthValue = (save: GameSave, id: string): number => {
  const item = growthData.items.find((entry) => entry.id === id);
  if (!item) return 0;
  const level = id === 'unitUpgrade' ? 0 : save.growth[id as keyof GameSave['growth']] ?? 0;
  return Number(item.levels[Math.min(level, item.levels.length - 1)]!.value);
};

export class BattleSimulation {
  readonly rng: RandomSource;
  readonly stageId: string;
  readonly wave: WaveState;
  readonly units: Unit[];
  readonly monsters: Monster[] = [];
  forge = createForgeState();
  materials = constants.battle.startMaterials;
  wall = { max: constants.wall.hpBase, hp: constants.wall.hpBase };
  speed = 1;
  freezeEnemies = 0;
  mineAssigneeUid: string | null = null;
  events: BattleEvent[] = [];
  stats: BattleStats = { highestSword: 0, orderRolls: 0, chaosRolls: 0, scrapped: 0, materialsEarned: 0 };
  private materialCarry = 0;
  private readonly save: GameSave;

  constructor(stageId: string, formation: string[], minerId: string | null, save: GameSave, seed = Date.now()) {
    this.rng = new SeededRng(seed); this.stageId = stageId; this.save = save;
    this.wave = createWaveState(stageId, this.rng);
    this.units = createUnits(formation, save.unitUpgrades);
    const miner = minerId ? this.units.find((unit) => unit.defId === minerId) : undefined;
    this.mineAssigneeUid = miner?.uid ?? null;
    assignMiner(this.units, this.mineAssigneeUid);
    const wallLevel = growthValue(save, 'wallLevel') || 1;
    this.wall.max = constants.wall.hpBase * wallLevel; this.wall.hp = this.wall.max;
  }

  private forgeGrowth(): ForgeGrowth {
    return { forgeLevel: growthValue(this.save, 'forgeLevel') || 1, enhancePerClick: growthValue(this.save, 'enhancePerClick') || 1, lines: this.save.lines, recipes: this.save.recipes, optionRecipes: this.save.optionRecipes };
  }

  /** Chance (0..1) that the next enhance click raises the sword (success or great). */
  enhanceSuccessChance(): number {
    return successChance(this.forge, this.forgeGrowth().forgeLevel, { stageId: this.stageId, tutorial: Boolean(this.wave.stage.tutorial) });
  }

  enhance(): ForgeEvent[] {
    const result = enhance(this.forge, Math.floor(this.materials), this.rng, this.forgeGrowth(), { stageId: this.stageId, tutorial: Boolean(this.wave.stage.tutorial) });
    if (result.events.length) {
      this.materials -= result.cost; this.forge = result.state;
      this.stats.highestSword = Math.max(this.stats.highestSword, this.forge.n);
      if (result.events.includes('order')) this.stats.orderRolls += 1;
      if (result.events.includes('chaos')) this.stats.chaosRolls += 1;
      this.events.push({ type: 'special', forge: result.events });
    }
    return result.events;
  }

  supply(unitClass: UnitClass): boolean {
    if (this.forge.n <= 0 && !this.forge.avatarReady) return false;
    if (this.forge.avatarReady) return this.descend();
    const sword = { n: this.forge.n, kind: this.forge.kind, trait: this.forge.trait, options: [...this.forge.options], stacks: this.forge.stacks };
    if (sword.trait === 'mortgage') { this.wall.hp = Math.max(0, this.wall.hp - this.wall.max * 0.15); sword.n += 10; }
    const count = beginSupply(this.units, unitClass, sword);
    if (!count) return false;
    if (sword.trait === 'sacrifice') {
      const targets = this.units.filter((unit) => unit.class === unitClass && unit.pendingSword);
      targets.forEach((unit, index) => { if (index % 2 === 1) unit.pendingSword = { n: 1, kind: 'basic', trait: null, options: [], stacks: 0, isScrap: true }; });
    }
    this.forge = resetForgeAfterSupply(this.forge);
    return true;
  }

  descend(): boolean {
    const candidates = this.units.filter((unit) => unit.state !== 'mining' && unit.state !== 'stunned');
    candidates.sort((a, b) => b.hp - a.hp || b.food - a.food);
    const unit = candidates[0];
    if (!unit) return false;
    unit.originalDefId = unit.defId; unit.state = 'avatar'; unit.maxHp = constants.avatar.hp; unit.hp = constants.avatar.hp; unit.def = constants.avatar.def;
    unit.sword = { n: this.forge.n, kind: this.forge.kind, trait: null, options: [...this.forge.options], stacks: 0 };
    this.forge = resetForgeAfterSupply(this.forge); this.forge.avatarReady = false;
    return true;
  }

  recover(): boolean { return requestRecovery(this.units, growthValue(this.save, 'beds') || 1) !== null; }
  setMiner(uid: string | null): void { if (uid) this.mineAssigneeUid = uid; assignMiner(this.units, uid); }
  toggleMiner(): boolean {
    const active = this.units.find((unit) => unit.state === 'mining');
    if (active) {
      this.mineAssigneeUid = active.uid;
      assignMiner(this.units, null);
      return false;
    }
    const assigned = this.mineAssigneeUid ? this.units.find((unit) => unit.uid === this.mineAssigneeUid) : undefined;
    if (!assigned || assigned.state !== 'fight') return false;
    assignMiner(this.units, assigned.uid);
    return true;
  }
  toggleSpeed(): number { this.speed = this.speed === constants.speedOptions[0] ? constants.speedOptions[1]! : constants.speedOptions[0]!; return this.speed; }

  tick(realDt: number): void {
    if (this.wave.phase === 'victory' || this.wave.phase === 'defeat') return;
    let remaining = Math.min(realDt * this.speed, 0.25);
    while (remaining > 0) {
      const dt = Math.min(constants.battle.tickSec, remaining); remaining -= dt;
      this.materialCarry += mineTick(this.units, dt);
      if (this.materialCarry >= 1) { const whole = Math.floor(this.materialCarry); this.materials += whole; this.stats.materialsEarned += whole; this.materialCarry -= whole; }
      tickReturns(this.units, dt); tickBarracks(this.units, dt, growthValue(this.save, 'stunCooldown') || constants.stun.cooldownSec);
      const spawned = advanceWave(this.wave, this.monsters, dt, this.rng, this.wall, this.stageId === 'INF' ? this.save.infLoop : 0);
      this.monsters.push(...spawned);
      const beforeMaterials = this.materials;
      const context: CombatContext = { wallHp: this.wall.hp, wallMax: this.wall.max, materials: this.materials, freezeEnemies: this.freezeEnemies, stunCooldown: growthValue(this.save, 'stunCooldown') || constants.stun.cooldownSec };
      const combatEvents = tickCombat(this.units, this.monsters, dt, this.rng, context);
      this.wall.hp = context.wallHp; this.materials = context.materials; this.freezeEnemies = context.freezeEnemies;
      this.stats.materialsEarned += Math.max(0, Math.floor(this.materials - beforeMaterials));
      this.stats.scrapped += combatEvents.filter((event) => event.type === 'unitStunned').length;
      this.events.push(...combatEvents);
      if (this.wall.hp <= 0) this.wave.phase = 'defeat';
    }
    if (this.events.length > 80) this.events.splice(0, this.events.length - 80);
  }

  snapshot(): BattleSnapshot { return { phase: this.wave.phase, wave: this.wave.waveIndex + 1, waveCount: this.wave.stage.waves!.length, phaseTime: this.wave.phaseTime, materials: Math.floor(this.materials), wallHp: this.wall.hp, wallMax: this.wall.max, forge: this.forge, units: this.units, monsters: this.monsters.filter((monster) => !monster.dead), stats: this.stats, speed: this.speed }; }
  consumeEvents(): BattleEvent[] { return this.events.splice(0); }
}

export interface BattleReward { shards: number; recipe: string | null }
export function awardBattle(save: GameSave, stageId: string, victory: boolean, waveReached: number, rng: RandomSource): BattleReward {
  const stage = byId(stageData.stages, stageId === 'INF' ? 'INF' : stageId);
  let shards = victory ? stage.reward.fixed + Math.floor(rng.next() * ((stage.reward.randomMax ?? 0) + 1)) : stage.reward.failPerWave * waveReached;
  let recipe: string | null = null;
  if (victory && rng.next() < stageData.recipeDropChance && Array.isArray(stage.recipes)) {
    const owned = new Set([...save.recipes, ...save.optionRecipes]);
    const candidates = stage.recipes.filter((id) => !owned.has(id));
    if (candidates.length) recipe = rng.pick(candidates);
    else shards += stageData.recipeDuplicateToCurrency;
  }
  save.shards += shards;
  if (recipe) {
    if (recipe.startsWith('opt:')) save.optionRecipes.push(recipe);
    else if (recipe.startsWith('anvil:')) { save.recipes.push(recipe); save.lines = Math.max(save.lines, Number(recipe.split(':')[1])); }
    else save.recipes.push(recipe);
  }
  if (victory && stageId !== 'INF') {
    save.cleared[stageId as keyof GameSave['cleared']] = true;
    for (const id of stage.unlocksOnClear ?? []) if (!save.unlockedUnits.includes(id)) save.unlockedUnits.push(id);
  }
  if (victory && stageId === 'INF') save.infLoop += 1;
  return { shards, recipe };
}

export const traitName = (id: string | null): string => id ? byId(traitData.traits, id).name : '';
export const unitName = (id: string): string => byId(unitData.units, id).name;
