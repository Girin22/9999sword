import constantsJson from '../../data/constants.json';
import growthJson from '../../data/growth.json';
import monstersJson from '../../data/monsters.json';
import optionsJson from '../../data/options.json';
import stagesJson from '../../data/stages.json';
import swordsJson from '../../data/swords.json';
import traitsJson from '../../data/traits.json';
import unitsJson from '../../data/units.json';
import type { MonsterDef, StageDef, SwordKind, SwordOption, TraitDef, UnitDef } from './types';

export const constants = constantsJson;
export const growthData = growthJson;
export const optionsData = optionsJson as typeof optionsJson & { options: SwordOption[] };
export const swordData = swordsJson as typeof swordsJson & { kinds: SwordKind[] };
export const traitData = traitsJson as typeof traitsJson & { traits: TraitDef[] };
export const unitData = unitsJson as typeof unitsJson & { units: UnitDef[] };
export const monsterData = monstersJson as typeof monstersJson & { mobs: MonsterDef[]; giants: MonsterDef[] };
export const stageData = stagesJson as typeof stagesJson & { stages: StageDef[] };

export const byId = <T extends { id: string }>(items: readonly T[], id: string): T => {
  const found = items.find((item) => item.id === id);
  if (!found) throw new Error(`Unknown data id: ${id}`);
  return found;
};
