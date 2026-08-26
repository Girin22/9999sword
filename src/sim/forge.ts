import { byId, constants, optionsData, swordData, traitData } from '../data';
import type { TraitAxis } from '../data/types';
import type { RandomSource } from './rng';
import type { ForgeState, SwordInstance } from './types';

export interface ForgeGrowth {
  forgeLevel: number; enhancePerClick: number; lines: number; recipes: string[]; optionRecipes: string[];
}
export interface ForgeContext { stageId: string; tutorial: boolean }
export type ForgeEvent = 'fail' | 'success' | 'great' | 'shape' | 'spirit' | 'order' | 'chaos' | 'avatar' | 'breakthrough';
export interface EnhanceResult { state: ForgeState; materials: number; cost: number; events: ForgeEvent[] }

export const createSword = (n = 0, kind = constants.forge.startKind): SwordInstance => ({ n, kind, trait: null, options: [], stacks: 0 });
export const createForgeState = (): ForgeState => ({ ...createSword(), clicksTotal: 0, shapeCounter: 0, spiritCounter: 0, avatarReady: false, tutorialChaosAt: null, tutorialChaosGiven: false });
export const forgeCost = (n: number): number => constants.forge.costBase + Math.floor(n / 5) * constants.forge.costPerFiveLevels;
export const attackAtLevel = (n: number): number => (constants.forge.atk.base + constants.forge.atk.perLevel * n) * constants.forge.atk.breakthroughMult ** Math.floor(n / constants.forge.atk.breakthroughEvery);

const rollTier = (rng: RandomSource, level: number): number => {
  const table = constants.forge.tierByForgeLevel[String(Math.min(3, Math.max(1, level))) as '1' | '2' | '3'];
  const r = rng.next();
  return r < table.T1 ? 1 : r < table.T1 + table.T2 ? 2 : 3;
};

const traitPool = (axis: TraitAxis, tier: number, growth: ForgeGrowth) => traitData.traits.filter((trait) => trait.axis === axis && trait.tier === tier && (traitData.startPool.includes(trait.id) || growth.recipes.includes(trait.id)));
const optionPool = (growth: ForgeGrowth) => optionsData.options.filter((option) => optionsData.startPool.includes(option.id) || growth.optionRecipes.includes(`opt:${option.id}`) || growth.optionRecipes.includes(option.id));

export function enhance(current: ForgeState, materials: number, rng: RandomSource, growth: ForgeGrowth, context: ForgeContext): EnhanceResult {
  const cost = forgeCost(current.n);
  if (materials < cost) return { state: current, materials, cost, events: [] };
  const state: ForgeState = { ...current, options: [...current.options] };
  const events: ForgeEvent[] = [];
  state.clicksTotal += 1;
  state.shapeCounter += 1;
  state.spiritCounter += 1;
  if (context.tutorial && state.tutorialChaosAt === null) state.tutorialChaosAt = rng.int(constants.forge.tutorialStage1.guaranteedChaosClickRange[0], constants.forge.tutorialStage1.guaranteedChaosClickRange[1]);

  const level = String(Math.min(3, Math.max(1, growth.forgeLevel))) as '1' | '2' | '3';
  const chances = constants.forge.resultByForgeLevel[level];
  const r = rng.next();
  let gain = 0;
  if (context.tutorial && state.clicksTotal <= constants.forge.tutorialStage1.guaranteedSuccessClicks) { gain = growth.enhancePerClick; events.push('success'); }
  else if (r < chances.fail) events.push('fail');
  else if (r < chances.fail + chances.success) { gain = growth.enhancePerClick; events.push('success'); }
  else { gain = growth.enhancePerClick * 2; events.push('great'); }
  const beforeBreak = Math.floor(state.n / constants.forge.atk.breakthroughEvery);
  state.n += gain;
  if (Math.floor(state.n / constants.forge.atk.breakthroughEvery) > beforeBreak) events.push('breakthrough');

  if (state.shapeCounter >= constants.forge.shapeRerollEveryClicks) {
    state.shapeCounter = 0;
    state.kind = rng.pick(swordData.kinds).id;
    events.push('shape');
    const pool = optionPool(growth).filter((candidate) => !state.options.some((id) => byId(optionsData.options, id).stat === candidate.stat));
    if (pool.length > 0) {
      const rolled = rng.pick(pool).id;
      const cap = Math.max(0, growth.lines - optionsData.lines.traitLines);
      if (state.options.length < cap) state.options.push(rolled);
      else if (cap > 0) state.options[rng.int(0, cap - 1)] = rolled;
    }
  }

  const forceChaos = context.tutorial && !state.tutorialChaosGiven && state.clicksTotal >= (state.tutorialChaosAt ?? 8);
  const spirit = forceChaos || state.spiritCounter > constants.forge.spirit.pityClicks || rng.next() < constants.forge.spirit.perClickChance;
  if (spirit) {
    state.spiritCounter = 0;
    events.push('spirit');
    const axis: TraitAxis = forceChaos ? 'chaos' : rng.next() < constants.forge.spirit.orderRatio ? 'order' : 'chaos';
    events.push(axis);
    if (forceChaos) {
      state.trait = constants.forge.tutorialStage1.guaranteedChaosTrait;
      state.tutorialChaosGiven = true;
    } else if (axis === 'order' && rng.next() < constants.forge.avatarChanceWithinOrder) {
      state.avatarReady = true;
      state.trait = 'avatar';
      events.push('avatar');
    } else {
      const tier = rollTier(rng, growth.forgeLevel);
      const pool = traitPool(axis, tier, growth);
      const fallback = traitData.traits.filter((trait) => trait.axis === axis && traitData.startPool.includes(trait.id) && trait.id !== 'avatar');
      state.trait = rng.pick(pool.length ? pool : fallback).id;
    }
    state.stacks = 0;
  }
  return { state, materials: materials - cost, cost, events };
}

export const resetForgeAfterSupply = (state: ForgeState): ForgeState => ({ ...createForgeState(), spiritCounter: constants.forge.spirit.keepCounterOnSupply ? state.spiritCounter : 0, clicksTotal: state.clicksTotal, tutorialChaosGiven: state.tutorialChaosGiven, tutorialChaosAt: state.tutorialChaosAt });
