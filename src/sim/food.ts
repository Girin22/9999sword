import { stageData } from '../data';
import type { GameSave } from './save';

const isUnlocked = (id: string, save: GameSave): boolean =>
  id === 'S1' || (id === 'S2' && save.cleared.S1) || (id === 'S3' && save.cleared.S2) || (id === 'INF' && save.cleared.S3);

/**
 * Food is a progression stat, not a per-stage cap: clearing a stage raises the limit for
 * every stage. The limit for a stage is the largest foodLimit among the normal stages
 * (S1–S3) the player has unlocked, or the stage's own limit if that is higher (INF).
 */
export function foodLimitFor(stageId: string, save: GameSave): number {
  const stage = stageData.stages.find((entry) => entry.id === stageId);
  const progression = stageData.stages
    .filter((entry) => entry.id !== 'INF' && isUnlocked(entry.id, save))
    .reduce((best, entry) => Math.max(best, entry.foodLimit), 0);
  return Math.max(progression, stage?.foodLimit ?? 0);
}

/** How far below the limit a formation may start before the lobby warns the player. */
export const FOOD_WARNING_SLACK = 3;
