export type UnitClass = 'knight' | 'thrower' | 'mage';
export type TraitAxis = 'order' | 'chaos';

export interface Vec2 { x: number; y: number }
export interface SwordOption { id: string; name: string; group: string; stat: string; value: number; desc: string }
export interface SwordKind {
  id: string; name: string; weight: number; category: string; fitClass: UnitClass;
  options: Record<string, number | boolean | string>;
}
export interface TraitDef {
  id: string; name: string; axis: TraitAxis; tier: number | 'special'; form: string;
  inherit?: boolean; power?: boolean; startPool?: boolean; effect: Record<string, unknown>; desc: string;
}
export interface UnitDef {
  id: string; name: string; class: UnitClass; food: number; hp: number; def: number;
  shield: boolean; flag?: string; option: Record<string, unknown>; unlock: string; role: string;
  /** Flag mages with a damage field burn enemies inside the flag radius every second. */
  field?: { damageMultPerSec: number };
}
export interface MonsterDef {
  id: string; name: string; hp: number; atk: number; def: number; moveSpeed: number;
  attackInterval: number; range?: number; behavior?: string; target?: string; drop: number;
  wallSeconds?: number; warningSec?: number; special?: Record<string, unknown> | null; boss?: boolean;
}
export interface StageDef {
  id: string; name: string; bossName?: string; foodLimit: number; stageIndex: number; tutorial?: boolean;
  wallSecondsMult?: number; mobCountMult?: number; loopScaling?: { bossMultPerAppearance?: number };
  waves?: { mobs: Record<string, number>; giant: string; bossStage?: string; bossName?: string }[];
  recipes: string[] | 'remaining'; reward: { fixed: number; randomMax?: number; failPerWave: number; fixedPerLoop?: number };
  unlocksOnClear?: string[]; unlock?: string; repeatOf?: string; endingLine?: string;
}
