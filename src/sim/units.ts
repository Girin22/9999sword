import { byId, constants, unitData } from '../data';
import type { Unit } from './types';
import { createSword } from './forge';

export function createUnits(ids: string[], upgrades: Record<string, number> = {}): Unit[] {
  return ids.map((id, index) => {
    const def = byId(unitData.units, id);
    const mult = 1 + (upgrades[id] ?? 0) * 0.1;
    const maxHp = def.hp * mult;
    const pos = { x: 250 + (index % 4) * 190, y: constants.battle.allySpawnY - (index % 2) * 100 - Math.floor(index / 4) * 140 };
    return {
      uid: `${id}-${index}`, defId: id, class: def.class, food: def.food, hp: maxHp, maxHp, def: def.def * mult,
      damageReduction: def.option.id === 'tank' ? Number(def.option.damageReduction) : 0,
      sword: createSword(1), state: 'fight', pos: { ...pos }, homePos: { ...pos }, idleTimer: 0, idlePhase: index * 1.73,
      stunTimer: 0, stunTotal: 0, sprintTimer: 0, actionTimer: 0, returnTimer: 0, restTimer: 0, traitTimer: 0, orderStacks: 0, lastHitAgo: 99,
      auraAtkMult: 1, auraAttackSpeedMult: 1, auraMoveSpeedMult: 1, auraDefMult: 1, auraRegenPct: 0,
    };
  });
}
