import { byId, constants, optionsData, swordData, traitData, unitData } from '../data';
import type { Unit } from './types';

export interface SwordStats {
  atk: number; weight: number; attackInterval: number; moveSpeed: number; range: number;
  hits: number; hitMult: number; shape: string; pierce: boolean; defIgnore: number;
  critChance: number; critDamage: number; defMult: number; hpRegenPct: number;
  enemyMoveSpeedMult: number; enemyAtkMult: number; enemyDefMult: number; enemyDotPct: number;
}

const numberOption = (record: Record<string, number | boolean | string>, key: string, fallback: number) => typeof record[key] === 'number' ? record[key] as number : fallback;

export function swordStats(unit: Unit): SwordStats {
  const def = byId(unitData.units, unit.defId);
  const sword = unit.sword;
  if (sword.isScrap) {
    const base = constants.classBase[unit.class];
    return { atk: swordData.scrap.atkFixed * unit.auraAtkMult, weight: swordData.scrap.weight, attackInterval: base.attackInterval / unit.auraAttackSpeedMult, moveSpeed: base.moveSpeed * unit.auraMoveSpeedMult, range: base.range, hits: 1, hitMult: 1, shape: 'single', pierce: false, defIgnore: 0, critChance: constants.critBase.chance, critDamage: constants.critBase.damage, defMult: unit.auraDefMult, hpRegenPct: unit.auraRegenPct, enemyMoveSpeedMult: 1, enemyAtkMult: 1, enemyDefMult: 1, enemyDotPct: 0 };
  }
  const kind = byId(swordData.kinds, sword.kind);
  const fitTable = constants.fitness[unit.class] as Record<string, { mult: number; optionsActive: boolean }>;
  const fit = fitTable[kind.category]!;
  const kindOptions = kind.options;
  let weight = kind.weight;
  let atkMult = fit.mult * numberOption(kindOptions, 'atkMult', 1);
  let attackSpeedMult = numberOption(kindOptions, 'attackSpeedMult', 1);
  let rangeMult = fit.optionsActive ? numberOption(kindOptions, 'rangeMult', 1) : 1;
  const hits = fit.optionsActive ? numberOption(kindOptions, 'hits', 1) : 1;
  const hitMult = fit.optionsActive ? numberOption(kindOptions, 'hitMult', 1) : 1;
  let defIgnore = fit.optionsActive ? numberOption(kindOptions, 'defIgnore', 0) : 0;
  let critChance = constants.critBase.chance + (fit.optionsActive ? numberOption(kindOptions, 'critChanceAdd', 0) : 0);
  let critDamage = constants.critBase.damage + (fit.optionsActive ? numberOption(kindOptions, 'critDamageAdd', 0) : 0);
  let defMult = 1;
  let hpRegenPct = 0;
  let enemyMoveSpeedMult = 1;
  let enemyAtkMult = 1;
  let enemyDefMult = 1;
  let enemyDotPct = 0;

  if (def.option.id === 'greatswordMaster' && sword.kind === 'greatsword') weight = Number(def.option.weightAs);
  if (def.option.id === 'spearMaster' && kind.category === 'spear') atkMult *= 1 + Number(def.option.atkBonus);
  if (def.option.id === 'unhitHaste' && unit.lastHitAgo > 3) attackSpeedMult *= 1 + Number(def.option.attackSpeedBonus);

  for (const id of sword.options) {
    const option = byId(optionsData.options, id);
    if (!fit.optionsActive && (option.group === 'buff' || option.group === 'debuff')) continue;
    switch (option.stat) {
      case 'atkMult': atkMult *= 1 + option.value; break;
      case 'attackSpeedMult': attackSpeedMult *= 1 + option.value; break;
      case 'moveSpeedMult': break;
      case 'critChanceAdd': critChance += option.value; break;
      case 'critDamageAdd': critDamage += option.value; break;
      case 'defIgnore': defIgnore += option.value; break;
      case 'defMult': defMult *= 1 + option.value; break;
      case 'hpRegenPct': hpRegenPct += option.value; break;
      case 'enemyMoveSpeedMult': enemyMoveSpeedMult *= 1 + option.value; break;
      case 'enemyAtkMult': enemyAtkMult *= 1 + option.value; break;
      case 'enemyDefMult': enemyDefMult *= 1 + option.value; break;
      case 'enemyDotPct': enemyDotPct += option.value; break;
    }
  }

  const trait = sword.trait ? traitData.traits.find((item) => item.id === sword.trait) : undefined;
  if (trait) {
    const effect = trait.effect as unknown as Record<string, number>;
    if (trait.id === 'tempering') defMult *= 1 + sword.stacks * effect.perStack;
    if (trait.id === 'rumination') atkMult *= 1 + sword.stacks * effect.perStack;
    if (trait.id === 'preheat') attackSpeedMult *= 1 + sword.stacks * effect.perStack;
    if (trait.id === 'rooted' && unit.traitTimer >= effect.stillSec) defMult *= 1 + effect.value;
    if (trait.id === 'formation' && unit.traitTimer >= effect.afterSec) atkMult *= 1 + effect.value;
    if (trait.id === 'kingsMarch' && unit.traitTimer % effect.cooldown <= effect.durationSec) attackSpeedMult *= 1 + Number((trait.effect as any).allStat?.attackSpeedMult ?? 0);
    if (effect.atkMult) atkMult *= 1 + effect.atkMult;
    if (effect.atkMultTotal) atkMult *= effect.atkMultTotal;
    if (effect.attackSpeedMultTotal) attackSpeedMult *= effect.attackSpeedMultTotal;
    if (effect.rangeMult) rangeMult *= 1 + effect.rangeMult;
    if (effect.selfDefMult) defMult *= 1 + effect.selfDefMult;
    if (effect.weightAdd) weight = Math.min(effect.weightMax ?? 4, weight + effect.weightAdd);
    if (effect.allStatMult) { atkMult *= effect.allStatMult; attackSpeedMult *= effect.allStatMult; }
    if (trait.id === 'curse') enemyDefMult *= 1 + effect.enemyDefMult;
    if (trait.id === 'plague') { enemyAtkMult *= 1 + effect.enemyAtkMult; enemyMoveSpeedMult *= effect.enemySlow; }
    if (trait.id === 'sunspot') { enemyMoveSpeedMult = 1 + (enemyMoveSpeedMult - 1) * effect.debuffEffectMultTotal; enemyAtkMult = 1 + (enemyAtkMult - 1) * effect.debuffEffectMultTotal; enemyDefMult = 1 + (enemyDefMult - 1) * effect.debuffEffectMultTotal; enemyDotPct *= effect.debuffEffectMultTotal; }
  }
  const base = constants.classBase[unit.class];
  return {
    atk: (constants.forge.atk.base + constants.forge.atk.perLevel * sword.n) * constants.forge.atk.breakthroughMult ** Math.floor(sword.n / constants.forge.atk.breakthroughEvery) * atkMult * unit.auraAtkMult,
    weight,
    attackInterval: base.attackInterval * (1 + constants.weight.attackSpeedCoef * weight) / attackSpeedMult / unit.auraAttackSpeedMult,
    moveSpeed: base.moveSpeed / (1 + constants.weight.moveSpeedCoef * weight) * unit.auraMoveSpeedMult,
    range: base.range * rangeMult,
    hits, hitMult, shape: String(kindOptions.shape ?? 'single'), pierce: Boolean(fit.optionsActive && kindOptions.pierce),
    defIgnore: Math.min(1, defIgnore), critChance: Math.min(1, critChance), critDamage, defMult: defMult * unit.auraDefMult, hpRegenPct: hpRegenPct + unit.auraRegenPct,
    enemyMoveSpeedMult, enemyAtkMult, enemyDefMult, enemyDotPct,
  };
}
