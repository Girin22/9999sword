import type { UnitClass, Vec2 } from '../data/types';

export interface SwordInstance {
  n: number; kind: string; trait: string | null; options: string[]; stacks: number; isScrap?: boolean;
}
export interface PendingUnitAttack {
  remaining: number;
  eventType: 'unitAttack' | 'projectile' | 'mageCast';
  hits: { uid: string; damage: number }[];
  enemyAtkMult: number; enemyMoveSpeedMult: number; enemyDefMult: number; enemyDotPct: number;
}
export interface PendingMonsterAttack {
  remaining: number; targetUid?: string; wall?: boolean; bossAoe?: boolean;
  pattern?: string; targetPos?: Vec2; damageMult?: number; radius?: number; wallDamagePct?: number; knockback?: number; lineWidth?: number;
}
export interface ForgeState extends SwordInstance {
  clicksTotal: number; shapeCounter: number; spiritCounter: number; successCount: number; avatarReady: boolean;
  tutorialChaosAt: number | null; tutorialChaosGiven: boolean;
}
export type UnitStateName = 'fight' | 'stunned' | 'returning' | 'resting' | 'mining' | 'avatar';
export interface Unit {
  uid: string; defId: string; class: UnitClass; food: number; hp: number; maxHp: number; def: number;
  damageReduction: number; sword: SwordInstance; state: UnitStateName; pos: Vec2;
  homePos: Vec2; idleTimer: number; idlePhase: number;
  pendingAttack?: PendingUnitAttack;
  stunTimer: number; stunTotal: number; sprintTimer: number; actionTimer: number; returnTimer: number; restTimer: number; traitTimer: number;
  orderStacks: number; lastHitAgo: number; originalDefId?: string;
  pendingSword?: SwordInstance; returnState?: UnitStateName;
  divineStun?: boolean;
  auraAtkMult: number; auraAttackSpeedMult: number; auraMoveSpeedMult: number; auraDefMult: number; auraRegenPct: number;
}
export interface Monster {
  uid: string; defId: string; hp: number; maxHp: number; atk: number; def: number; speed: number;
  attackInterval: number; range: number; drop: number; pos: Vec2; actionTimer: number; specialTimer: number;
  giant: boolean; wallSeconds: number; dead: boolean;
  atkMult: number; moveMult: number; defMult: number; dotPct: number;
  auraAtkMult?: number; auraMoveMult?: number; auraDefMult?: number; auraDotPct?: number;
  pendingAttack?: PendingMonsterAttack;
  stageId?: string; bossStage?: string; bossPatternTimer?: number; bossPatternIndex?: number; infiniteRank?: number;
}
export interface BattleStats { highestSword: number; orderRolls: number; chaosRolls: number; scrapped: number; materialsEarned: number }
