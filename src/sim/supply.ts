import { byId, constants, traitData } from '../data';
import type { UnitClass } from '../data/types';
import { swordStats } from './swordStats';
import type { SwordInstance, Unit } from './types';

const clonedSword = (sword: SwordInstance, old: SwordInstance): SwordInstance => {
  const trait = sword.trait ? byId(traitData.traits, sword.trait) : null;
  const inherited = trait?.axis === 'order' && trait.inherit && old.trait === sword.trait ? old.stacks : 0;
  return { ...sword, options: [...sword.options], stacks: inherited };
};

/**
 * Hands the forged sword to every unit of the class.
 * Units in the mine receive it on the spot; fighters stop fighting and run back
 * to the wall, swap swords there (see tickReturns) and head back to the front.
 */
export function beginSupply(units: Unit[], unitClass: UnitClass, sword: SwordInstance): number {
  let count = 0;
  for (const unit of units) {
    if (unit.class !== unitClass || unit.state === 'avatar') continue;
    count += 1;
    if (unit.state === 'mining') { unit.sword = clonedSword(sword, unit.sword); continue; }
    unit.pendingSword = clonedSword(sword, unit.sword);
    unit.returnState = 'fight';
    unit.state = 'returning';
    unit.pendingAttack = undefined;
    unit.returnTimer = constants.battle.supplyTravelSec;
  }
  return count;
}

/** Returning units sprint straight down to the wall; the hand-off happens on contact. */
export function tickReturns(units: Unit[], dt: number): void {
  for (const unit of units) {
    if (unit.state !== 'returning') continue;
    const speed = swordStats(unit).moveSpeed * constants.battle.supplyRunSpeedMult;
    unit.pos.y = Math.min(constants.battle.wallContactY, unit.pos.y + speed * dt);
    if (unit.pos.y < constants.battle.wallContactY) continue;
    if (unit.pendingSword) {
      unit.sword = unit.pendingSword;
      unit.pendingSword = undefined;
      unit.state = unit.returnState ?? 'fight';
      unit.returnState = undefined;
      unit.sprintTimer = constants.battle.supplySprintBackSec;
    } else if (unit.returnState === 'resting') {
      unit.state = 'resting';
      unit.returnState = undefined;
      unit.restTimer = constants.stun.cooldownSec / constants.stun.restSpeedMultiplier;
    } else {
      unit.state = 'fight';
      unit.returnState = undefined;
    }
  }
}
