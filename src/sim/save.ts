import { optionsData, unitData } from '../data';

export const SAVE_KEY = 'fk_save_v1';
export interface GameSave {
  version: 1; shards: number;
  growth: Record<'enhancePerClick' | 'forgeLevel' | 'beds' | 'stunCooldown' | 'mineSlots' | 'wallLevel' | 'artisanMemory' | 'forgeBias', number>;
  unitUpgrades: Record<string, number>; avatars: string[]; relics: string[]; unlockedUnits: string[];
  recipes: string[]; optionRecipes: string[]; lines: number; cleared: Record<'S1' | 'S2' | 'S3', boolean>;
  infLoop: number; lastFormation: { units: string[]; miner: string | null }; sound: boolean;
}

export const freshSave = (): GameSave => ({
  version: 1, shards: 0,
  growth: { enhancePerClick: 0, forgeLevel: 0, beds: 0, stunCooldown: 0, mineSlots: 0, wallLevel: 0, artisanMemory: 0, forgeBias: 0 },
  unitUpgrades: Object.fromEntries(unitData.units.map((unit) => [unit.id, 0])), avatars: ['demigod'], relics: [],
  unlockedUnits: [...unitData.startUnlocked], recipes: [], optionRecipes: [], lines: optionsData.lines.start,
  cleared: { S1: false, S2: false, S3: false }, infLoop: 0,
  lastFormation: { units: [], miner: null }, sound: true,
});

export function loadSave(storage: Pick<Storage, 'getItem'> = localStorage): GameSave {
  try {
    const parsed = JSON.parse(storage.getItem(SAVE_KEY) ?? '') as Partial<GameSave>;
    if (parsed.version !== 1) return freshSave();
    const defaults = freshSave();
    return { ...defaults, ...parsed, growth: { ...defaults.growth, ...parsed.growth }, unitUpgrades: { ...defaults.unitUpgrades, ...parsed.unitUpgrades }, cleared: { ...defaults.cleared, ...parsed.cleared }, lastFormation: { ...defaults.lastFormation, ...parsed.lastFormation } };
  } catch { return freshSave(); }
}
export function persistSave(save: GameSave, storage: Pick<Storage, 'setItem'> = localStorage): void { storage.setItem(SAVE_KEY, JSON.stringify(save)); }
export function resetSave(storage: Pick<Storage, 'removeItem'> = localStorage): GameSave { storage.removeItem(SAVE_KEY); return freshSave(); }
