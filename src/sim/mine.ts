import { constants } from '../data';
import type { Unit } from './types';

export const mineRate = (units: Unit[]): number => units.filter((unit) => unit.state === 'mining').reduce((sum, unit) => sum + constants.mine.baseRatePerSec * (1 + constants.mine.levelCoef * unit.sword.n), 0);
export const mineTick = (units: Unit[], dt: number): number => mineRate(units) * dt;
export function assignMiner(units: Unit[], uid: string | null): void {
  for (const unit of units) if (unit.state === 'mining') unit.state = 'fight';
  const selected = uid ? units.find((unit) => unit.uid === uid) : undefined;
  if (selected && selected.state === 'fight') selected.state = 'mining';
}
