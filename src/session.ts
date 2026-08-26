import { loadSave, type GameSave } from './sim/save';

export interface ResultData { victory: boolean; stageId: string; wave: number; highestSword: number; orderRolls: number; chaosRolls: number; scrapped: number; shards: number; recipe: string | null }
export const session: { save: GameSave; stageId: string; formation: string[]; miner: string | null; result: ResultData | null } = {
  save: loadSave(), stageId: 'S1', formation: [], miner: null, result: null,
};
