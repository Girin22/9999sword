import { constants } from '../data';
import type { Unit } from './types';
import { createSword } from './forge';

export function scrapUnit(unit: Unit, cooldown = constants.stun.cooldownSec): boolean {
  if (unit.state === 'stunned') return false;
  unit.hp = 0;
  unit.state = 'stunned';
  unit.stunTimer = cooldown;
  unit.stunTotal = cooldown;
  unit.sword = { ...createSword(1, 'basic'), isScrap: true };
  unit.pendingAttack = undefined;
  unit.orderStacks = 0;
  return true;
}

export function requestRecovery(units: Unit[], beds = constants.barracks.beds): Unit | null {
  const occupied = units.filter((unit) => unit.state === 'resting' || (unit.state === 'returning' && unit.returnState === 'resting')).length;
  if (occupied >= beds) return null;
  const candidates = units.filter((unit) => unit.state === 'fight' && unit.hp / unit.maxHp <= constants.barracks.recoverThreshold);
  candidates.sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp);
  const unit = candidates[0];
  if (!unit) return null;
  unit.state = 'returning';
  unit.returnState = 'resting';
  unit.returnTimer = constants.battle.supplyTravelSec;
  return unit;
}

export function tickBarracks(units: Unit[], dt: number, stunCooldown = constants.stun.cooldownSec): void {
  for (const unit of units) {
    if (unit.state === 'stunned') {
      unit.stunTimer -= dt;
      if (unit.stunTimer <= 0) { unit.state = 'fight'; if (!unit.divineStun) unit.hp = unit.maxHp * 0.3; unit.divineStun = false; }
    } else if (unit.state === 'resting') {
      unit.restTimer -= dt;
      if (unit.restTimer <= 0) { unit.hp = unit.maxHp; unit.state = 'fight'; unit.pos.y = constants.battle.wallContactY; unit.pendingAttack = undefined; }
    }
  }
  void stunCooldown;
}
