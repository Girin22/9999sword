import { describe, expect, it } from 'vitest';
import { constants } from '../src/data';
import { BattleSimulation } from '../src/sim/battle';
import { requestRecovery, scrapUnit, tickBarracks } from '../src/sim/barracks';
import { createSword } from '../src/sim/forge';
import { assignMiner, mineRate } from '../src/sim/mine';
import { beginSupply, tickReturns } from '../src/sim/supply';
import { createUnits } from '../src/sim/units';
import { freshSave } from '../src/sim/save';

describe('units, supply and barracks', () => {
  it('supplies only one class and inherits matching order stacks', () => {
    const units = createUnits(['ireukkun', 'ttekkai', 'hareubang']); units[0]!.sword = { ...createSword(3), trait: 'tempering', stacks: 4 };
    beginSupply(units, 'knight', { ...createSword(8, 'axe'), trait: 'tempering', stacks: 0 }); tickReturns(units, constants.battle.supplyTravelSec + 0.1);
    expect(units[0]!.sword.n).toBe(8); expect(units[0]!.sword.stacks).toBe(4); expect(units[1]!.sword.n).toBe(8); expect(units[2]!.sword.n).toBe(1);
  });
  it('turns a fallen sword into scrap and stands up in place', () => {
    const unit = createUnits(['ireukkun'])[0]!; const y = unit.pos.y; unit.sword = { ...createSword(12), trait: 'bloodsword', stacks: 3 };
    expect(scrapUnit(unit, 1)).toBe(true); expect(unit.sword.isScrap).toBe(true); expect(unit.sword.trait).toBeNull(); tickBarracks([unit], 1.1); expect(unit.state).toBe('fight'); expect(unit.pos.y).toBe(y);
  });
  it('locks recovery while its only bed is occupied', () => {
    const units = createUnits(['ireukkun', 'hareubang']); units[0]!.hp = 10; units[1]!.hp = 5;
    expect(requestRecovery(units, 1)?.uid).toBe(units[1]!.uid); expect(requestRecovery(units, 1)).toBeNull();
  });
  it('produces mine material from headcount and sword level', () => {
    const units = createUnits(['ireukkun']); units[0]!.sword.n = 10; assignMiner(units, units[0]!.uid);
    expect(mineRate(units)).toBeCloseTo(constants.mine.baseRatePerSec * (1 + constants.mine.levelCoef * 10));
  });
  it('gives every deployed unit a basic +1 sword', () => {
    const units = createUnits(['ireukkun', 'ttekkai', 'hareubang']);
    expect(units.every((unit) => unit.sword.kind === 'basic' && unit.sword.n === 1)).toBe(true);
  });
  it('sends the assigned miner out and recalls the same unit', () => {
    const sim = new BattleSimulation('S1', ['ireukkun', 'ttekkai'], 'ireukkun', freshSave(), 7);
    const assigned = sim.units.find((unit) => unit.uid === sim.mineAssigneeUid)!;
    expect(assigned.state).toBe('mining');
    expect(sim.toggleMiner()).toBe(false);
    expect(assigned.state).toBe('fight');
    expect(sim.toggleMiner()).toBe(true);
    expect(assigned.state).toBe('mining');
  });
});
