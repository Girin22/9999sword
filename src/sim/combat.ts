import { byId, constants, monsterData, optionsData, traitData, unitData } from '../data';
import type { RandomSource } from './rng';
import { scrapUnit } from './barracks';
import { swordStats } from './swordStats';
import type { Monster, Unit } from './types';

export interface CombatEvent {
  type: 'unitAttackStart' | 'mageCastStart' | 'monsterAttackStart' | 'bossAoeStart' | 'bossPatternStart' | 'bossPatternImpact' | 'unitAttack' | 'mageCast' | 'monsterAttack' | 'monsterDead' | 'unitStunned' | 'projectile' | 'special';
  source?: string; target?: string; value?: number; pattern?: string; x?: number; y?: number; radius?: number;
}
export interface CombatContext { wallHp: number; wallMax: number; materials: number; freezeEnemies: number; stunCooldown: number }
const distance = (a: { pos: { x: number; y: number } }, b: { pos: { x: number; y: number } }) => Math.hypot(a.pos.x - b.pos.x, a.pos.y - b.pos.y);
const moveUnitToward = (unit: Unit, target: { x: number; y: number }, speed: number, dt: number): void => {
  const dx = target.x - unit.pos.x;
  const dy = target.y - unit.pos.y;
  const length = Math.max(1, Math.hypot(dx, dy));
  const step = Math.min(length, speed * dt);
  unit.pos.x += dx / length * step;
  // Allies never push past the upper half of the field.
  unit.pos.y = Math.max(constants.battle.unitMinY, unit.pos.y + dy / length * step);
};
/** Point a unit in range drifts toward: it strafes around its own lane instead of standing in a line. */
const weavePoint = (unit: Unit): { x: number; y: number } => {
  const weave = constants.battle.unitWeave;
  const amp = weave.ampY[unit.class] ?? weave.ampY.knight;
  const t = unit.idleTimer * weave.frequency + unit.idlePhase;
  return {
    x: Math.max(70, Math.min(1010, unit.homePos.x + Math.sin(t * 0.63) * weave.ampX)),
    y: weave.centerY + Math.sin(t) * amp,
  };
};
const separateUnits = (units: Unit[]): void => {
  const active = units.filter((unit) => unit.state === 'fight' || unit.state === 'avatar');
  for (let leftIndex = 0; leftIndex < active.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < active.length; rightIndex += 1) {
      const left = active[leftIndex]!;
      const right = active[rightIndex]!;
      let dx = right.pos.x - left.pos.x;
      let dy = right.pos.y - left.pos.y;
      let length = Math.hypot(dx, dy);
      if (length >= constants.battle.unitSeparationRadius) continue;
      if (length < 0.01) { dx = Math.cos(left.idlePhase); dy = Math.sin(left.idlePhase); length = 1; }
      const push = (constants.battle.unitSeparationRadius - length) * constants.battle.unitSeparationStrength;
      const leftShare = left.pendingAttack ? 0 : right.pendingAttack ? 1 : 0.5;
      const rightShare = right.pendingAttack ? 0 : left.pendingAttack ? 1 : 0.5;
      left.pos.x -= dx / length * push * leftShare;
      left.pos.y -= dy / length * push * leftShare;
      right.pos.x += dx / length * push * rightShare;
      right.pos.y += dy / length * push * rightShare;
      left.pos.x = Math.max(70, Math.min(1010, left.pos.x));
      right.pos.x = Math.max(70, Math.min(1010, right.pos.x));
      left.pos.y = Math.max(constants.battle.unitMinY, left.pos.y);
      right.pos.y = Math.max(constants.battle.unitMinY, right.pos.y);
    }
  }
};
const separateBossesFromUnits = (units: Unit[], monsters: Monster[]): void => {
  const fighters = units.filter((unit) => unit.state === 'fight' || unit.state === 'avatar');
  const bosses = monsters.filter((monster) => monster.giant && !monster.dead && monster.hp > 0);
  for (const boss of bosses) {
    for (const fighter of fighters) {
      let dx = fighter.pos.x - boss.pos.x;
      let dy = fighter.pos.y - boss.pos.y;
      let length = Math.hypot(dx, dy);
      if (length >= constants.battle.bossUnitSeparationRadius) continue;
      if (length < 0.01) { dx = Math.cos(fighter.idlePhase); dy = Math.sin(fighter.idlePhase); length = 1; }
      const push = (constants.battle.bossUnitSeparationRadius - length) * constants.battle.bossUnitSeparationStrength;
      fighter.pos.x = Math.max(70, Math.min(1010, fighter.pos.x + dx / length * push));
      fighter.pos.y = Math.max(constants.battle.unitMinY, Math.min(constants.battle.wallContactY, fighter.pos.y + dy / length * push));
    }
  }
};
export const damageAfterDefense = (atk: number, defense: number, defMult = 1, defIgnore = 0, damageReduction = 0): number => atk * 100 / (100 + Math.max(0, defense * defMult * (1 - defIgnore))) * (1 - damageReduction);

const prepareAuras = (units: Unit[], monsters: Monster[]): void => {
  for (const unit of units) { unit.auraAtkMult = 1; unit.auraAttackSpeedMult = 1; unit.auraMoveSpeedMult = 1; unit.auraDefMult = 1; unit.auraRegenPct = 0; }
  for (const monster of monsters) { monster.auraAtkMult = 1; monster.auraMoveMult = 1; monster.auraDefMult = 1; monster.auraDotPct = 0; }
  const active = units.filter((unit) => unit.state === 'fight' || unit.state === 'avatar');
  for (const source of active) {
    const trait = source.sword.trait; const effect = trait ? traitData.traits.find((item) => item.id === trait)?.effect as Record<string, any> | undefined : undefined;
    if (trait === 'formation' && source.traitTimer >= Number(effect?.afterSec)) for (const ally of active.filter((unit) => distance(source, unit) <= Number(effect?.auraRadius))) ally.auraAtkMult *= 1 + Number(effect?.value);
    if (trait === 'kingsMarch' && source.traitTimer % Number(effect?.cooldown) <= Number(effect?.durationSec)) for (const ally of active) { ally.auraAttackSpeedMult *= 1 + Number(effect?.allStat.attackSpeedMult); ally.auraMoveSpeedMult *= 1 + Number(effect?.allStat.moveSpeedMult); }
    if (trait === 'tyrant') for (const ally of active.filter((unit) => unit.uid !== source.uid && distance(source, unit) <= Number(effect?.radius))) ally.auraAtkMult *= 1 + Number(effect?.allyAtkMult);
    if (trait === 'sunspot') for (const ally of active.filter((unit) => unit.uid !== source.uid && distance(source, unit) <= constants.classBase.mage.flagRadius)) ally.auraAtkMult *= 1 + Number(effect?.allyAtkMultInRange);
    if (source.class === 'mage') {
      const mageDef = byId(unitData.units, source.defId);
      if (mageDef.flag === 'buff') {
        for (const ally of active.filter((unit) => distance(source, unit) <= constants.classBase.mage.flagRadius)) ally.auraAtkMult *= 1 + constants.mageBuffPercentPerAtk;
      } else {
        for (const monster of monsters.filter((enemy) => !enemy.dead && distance(source, enemy) <= constants.classBase.mage.flagRadius)) {
          monster.auraAtkMult = (monster.auraAtkMult ?? 1) * (1 - constants.mageDebuffPercentPerAtk);
          monster.auraMoveMult = (monster.auraMoveMult ?? 1) * (1 - constants.mageDebuffPercentPerAtk);
          monster.auraDefMult = (monster.auraDefMult ?? 1) * (1 - constants.mageDebuffPercentPerAtk);
        }
      }
      for (const optionId of source.sword.options) {
        const option = byId(optionsData.options, optionId);
        if (option.group === 'buff') {
          for (const ally of active.filter((unit) => distance(source, unit) <= constants.classBase.mage.flagRadius)) {
            if (option.stat === 'atkMult') ally.auraAtkMult *= 1 + option.value;
            if (option.stat === 'attackSpeedMult') ally.auraAttackSpeedMult *= 1 + option.value;
            if (option.stat === 'moveSpeedMult') ally.auraMoveSpeedMult *= 1 + option.value;
            if (option.stat === 'defMult') ally.auraDefMult *= 1 + option.value;
            if (option.stat === 'hpRegenPct') ally.auraRegenPct += option.value;
          }
        } else if (option.group === 'debuff') {
          for (const monster of monsters.filter((enemy) => !enemy.dead && distance(source, enemy) <= constants.classBase.mage.flagRadius)) {
            if (option.stat === 'enemyMoveSpeedMult') monster.auraMoveMult = (monster.auraMoveMult ?? 1) * (1 + option.value);
            if (option.stat === 'enemyAtkMult') monster.auraAtkMult = (monster.auraAtkMult ?? 1) * (1 + option.value);
            if (option.stat === 'enemyDefMult') monster.auraDefMult = (monster.auraDefMult ?? 1) * (1 + option.value);
            if (option.stat === 'enemyDotPct') monster.auraDotPct = (monster.auraDotPct ?? 0) + option.value;
          }
        }
      }
    }
  }
};

const tickTrait = (unit: Unit, dt: number, units: Unit[], monsters: Monster[], context: CombatContext, events: CombatEvent[]): void => {
  const id = unit.sword.trait;
  if (!id) return;
  const trait = traitData.traits.find((item) => item.id === id);
  if (!trait) return;
  const effect = trait.effect as unknown as Record<string, number | boolean>;
  unit.traitTimer += dt;
  if ((id === 'tempering' || id === 'rumination') && unit.traitTimer >= Number(effect.every)) { unit.traitTimer = 0; unit.sword.stacks = Math.min(Number(effect.max), unit.sword.stacks + 1); }
  if (id === 'breather' && unit.traitTimer >= Number(effect.cooldown)) { unit.traitTimer = 0; unit.hp = Math.min(unit.maxHp, unit.hp + unit.maxHp * Number(effect.healPct)); }
  if (id === 'forgeBlessing' && unit.traitTimer >= Number(effect.everySec)) { unit.traitTimer = 0; unit.sword.n += Number(effect.swordLevelAdd); }
  if (id === 'lifespan' && unit.traitTimer >= Number(effect.expireSec)) { unit.sword = { n: 1, kind: 'basic', trait: null, options: [], stacks: 0, isScrap: true }; unit.traitTimer = 0; }
  if (id === 'judgment' && unit.traitTimer >= Number(effect.cooldown)) { unit.traitTimer = 0; const atk = swordStats(unit).atk * Number(effect.screenDamageMult); for (const monster of monsters) monster.hp -= damageAfterDefense(atk, monster.def); events.push({ type: 'special', source: unit.uid }); }
  if (id === 'clockOut' && unit.traitTimer >= Number(effect.cooldown)) { unit.traitTimer = 0; context.freezeEnemies = Number(effect.freezeEnemiesSec); events.push({ type: 'special', source: unit.uid }); }
  if (id === 'lightning' && unit.traitTimer >= Number(effect.cooldown)) { unit.traitTimer = 0; const atk = swordStats(unit).atk * Number(effect.damageMult); for (const monster of monsters.filter((m) => distance(unit, m) <= Number(effect.aoeRadius))) monster.hp -= damageAfterDefense(atk, monster.def); events.push({ type: 'special', source: unit.uid }); }
  if (id === 'offering') for (const ally of units.filter((candidate) => candidate.uid !== unit.uid && distance(unit, candidate) <= Number(effect.radius))) ally.hp -= ally.maxHp * Number(effect.allyHpDrainPerSecPct) * dt;
  if (unit.state === 'avatar') { unit.hp -= unit.maxHp * constants.avatar.hpDrainPerSec * dt; }
};

const onUnitAttack = (unit: Unit, context: CombatContext, rng: RandomSource): number => {
  const trait = unit.sword.trait;
  if (trait === 'bloodsword') unit.hp -= unit.maxHp * 0.03;
  if (trait === 'wallBlood') context.wallHp = Math.max(0, context.wallHp - 8);
  if (trait === 'kindling') { if (context.materials >= 1) context.materials -= 1; else return 0.15; }
  if (trait === 'gamble') return rng.next() < 0.5 ? 0.3 : 2.5;
  if (trait === 'preheat') unit.sword.stacks = Math.min(20, unit.sword.stacks + 1);
  return 1;
};

export function tickCombat(units: Unit[], monsters: Monster[], dt: number, rng: RandomSource, context: CombatContext): CombatEvent[] {
  const events: CombatEvent[] = [];
  context.freezeEnemies = Math.max(0, context.freezeEnemies - dt);
  prepareAuras(units, monsters);
  for (const unit of units) {
    unit.lastHitAgo += dt;
    if (unit.state !== 'fight' && unit.state !== 'avatar') continue;
    unit.idleTimer += dt;
    tickTrait(unit, dt, units, monsters, context, events);
    if (unit.hp <= 0) {
      if (unit.sword.trait === 'immortal' && unit.traitTimer >= 90 && unit.sword.stacks === 0) { unit.hp = 1; unit.sword.stacks = 1; }
      else if (scrapUnit(unit, context.stunCooldown)) events.push({ type: 'unitStunned', source: unit.uid });
      continue;
    }
    const stats = swordStats(unit);
    // Freshly supplied units sprint back to the front line.
    unit.sprintTimer = Math.max(0, unit.sprintTimer - dt);
    const sprint = unit.sprintTimer > 0 ? constants.battle.supplyRunSpeedMult : 1;
    unit.hp = Math.min(unit.maxHp, unit.hp + unit.maxHp * stats.hpRegenPct * dt);
    unit.actionTimer -= dt;
    if (unit.pendingAttack) {
      unit.pendingAttack.remaining -= dt;
      if (unit.pendingAttack.remaining > 0) continue;
      const pending = unit.pendingAttack;
      unit.pendingAttack = undefined;
      for (const hit of pending.hits) {
        const enemy = monsters.find((monster) => monster.uid === hit.uid && !monster.dead && monster.hp > 0);
        if (!enemy) continue;
        enemy.hp -= hit.damage;
        enemy.atkMult = Math.min(enemy.atkMult, pending.enemyAtkMult);
        enemy.moveMult = Math.min(enemy.moveMult, pending.enemyMoveSpeedMult);
        enemy.defMult = Math.min(enemy.defMult, pending.enemyDefMult);
        enemy.dotPct = Math.max(enemy.dotPct, pending.enemyDotPct);
        events.push({ type: pending.eventType, source: unit.uid, target: enemy.uid, value: hit.damage });
      }
      continue;
    }
    const living = monsters.filter((monster) => !monster.dead && monster.hp > 0);
    const giants = living.filter((monster) => monster.giant);
    const candidates = giants.length && unit.class !== 'mage' ? giants : living;
    candidates.sort((a, b) => distance(unit, a) - distance(unit, b));
    const target = candidates[0];
    if (!target) {
      const idleTarget = {
        x: unit.homePos.x + Math.sin(unit.idleTimer * constants.battle.idleFrequency + unit.idlePhase) * constants.battle.idleWanderRadius,
        y: constants.battle.wallContactY - constants.battle.idleWallOffset + Math.cos(unit.idleTimer * constants.battle.idleFrequency * 0.7 + unit.idlePhase) * constants.battle.idleWanderRadius * 0.22,
      };
      moveUnitToward(unit, idleTarget, stats.moveSpeed * constants.battle.idleMoveSpeedMult, dt);
      continue;
    }
    const dist = distance(unit, target);
    if (unit.class === 'mage') {
      const mageDef = byId(unitData.units, unit.defId);
      if (mageDef.field) {
        // Damage field: everything standing inside the flag radius burns continuously.
        for (const enemy of living.filter((monster) => distance(unit, monster) <= constants.classBase.mage.flagRadius)) enemy.hp -= damageAfterDefense(stats.atk * mageDef.field.damageMultPerSec * constants.battle.unitDamageMult, enemy.def, enemy.defMult * (enemy.auraDefMult ?? 1) * stats.enemyDefMult, stats.defIgnore) * dt;
      }
      if (mageDef.flag === 'debuff') {
        if (dist > constants.classBase.mage.flagRadius * 0.62) moveUnitToward(unit, target.pos, stats.moveSpeed * sprint, dt);
      } else {
        const allies = units.filter((ally) => ally.uid !== unit.uid && (ally.state === 'fight' || ally.state === 'avatar'));
        if (allies.length) {
          const center = allies.reduce((point, ally) => ({ x: point.x + ally.pos.x / allies.length, y: point.y + ally.pos.y / allies.length }), { x: 0, y: 0 });
          if (Math.hypot(unit.pos.x - center.x, unit.pos.y - center.y) > constants.classBase.mage.flagRadius * 0.45) moveUnitToward(unit, center, stats.moveSpeed * 0.75 * sprint, dt);
        }
      }
      if (unit.actionTimer <= 0) {
        unit.actionTimer = constants.battle.magePulseSec;
        const radius = constants.battle.magePulseRadius;
        unit.pendingAttack = {
          remaining: constants.battle.mageCastWindupSec,
          eventType: 'mageCast',
          hits: living.filter((monster) => distance(unit, monster) <= radius).map((enemy) => ({ uid: enemy.uid, damage: damageAfterDefense(stats.atk * 0.5, enemy.def, stats.enemyDefMult, stats.defIgnore) })),
          enemyAtkMult: stats.enemyAtkMult,
          enemyMoveSpeedMult: stats.enemyMoveSpeedMult,
          enemyDefMult: stats.enemyDefMult,
          enemyDotPct: stats.enemyDotPct,
        };
        events.push({ type: 'mageCastStart', source: unit.uid, value: constants.battle.mageCastWindupSec, radius: constants.classBase.mage.flagRadius });
      }
      continue;
    }
    const attackReach = target.giant ? Math.max(stats.range, constants.battle.bossUnitSeparationRadius) : stats.range;
    if (dist > attackReach) {
      moveUnitToward(unit, target.pos, stats.moveSpeed * sprint, dt);
      continue;
    }
    // In range: keep moving (moving shot) instead of freezing on one line.
    if (unit.class === 'knight') {
      // Melee: circle the target on its lower side, staying inside reach.
      const t = unit.idleTimer * constants.battle.unitWeave.frequency + unit.idlePhase;
      const orbit = attackReach * 0.75;
      moveUnitToward(unit, { x: target.pos.x + Math.sin(t) * orbit, y: target.pos.y + Math.abs(Math.cos(t)) * orbit }, stats.moveSpeed * constants.battle.unitWeave.speedMult, dt);
    } else {
      moveUnitToward(unit, weavePoint(unit), stats.moveSpeed * constants.battle.unitWeave.speedMult, dt);
    }
    if (unit.actionTimer <= 0) {
      unit.actionTimer = stats.attackInterval;
      let multiplier = onUnitAttack(unit, context, rng);
      if (unit.sword.trait === 'echo' && unit.traitTimer >= 8) { multiplier *= 2; unit.traitTimer = 0; }
      const condensed = unit.sword.trait === 'condense' && unit.traitTimer >= 15;
      if (condensed) { multiplier *= 3; unit.traitTimer = 0; }
      const crit = condensed || rng.next() < stats.critChance;
      if (crit) multiplier *= stats.critDamage;
      const targets = stats.pierce || stats.shape === 'cone' ? living.filter((monster) => Math.abs(monster.pos.x - target.pos.x) < 150 && Math.abs(monster.pos.y - target.pos.y) < 180).slice(0, stats.hits + 2) : [target];
      // `hits` only widens the target count now; it no longer multiplies damage.
      const classDamageMult = (constants.classBase[unit.class] as { damageMult?: number }).damageMult ?? 1;
      const eventType = unit.class === 'thrower' ? 'projectile' : 'unitAttack';
      unit.pendingAttack = {
        remaining: constants.battle.unitAttackWindupSec,
        eventType,
        hits: targets.map((enemy) => ({ uid: enemy.uid, damage: damageAfterDefense(stats.atk * stats.hitMult * multiplier * classDamageMult * constants.battle.unitDamageMult, enemy.def, enemy.defMult * (enemy.auraDefMult ?? 1) * stats.enemyDefMult, stats.defIgnore) })),
        enemyAtkMult: stats.enemyAtkMult,
        enemyMoveSpeedMult: stats.enemyMoveSpeedMult,
        enemyDefMult: stats.enemyDefMult,
        enemyDotPct: stats.enemyDotPct,
      };
      events.push({ type: 'unitAttackStart', source: unit.uid, target: target.uid, value: constants.battle.unitAttackWindupSec });
    }
  }

  separateUnits(units);

  for (const monster of monsters) {
    if (!monster.dead && monster.dotPct + (monster.auraDotPct ?? 0) > 0) monster.hp -= monster.maxHp * (monster.dotPct + (monster.auraDotPct ?? 0)) * dt;
    if (monster.dead || monster.hp <= 0) {
      if (!monster.dead) {
        monster.dead = true; context.materials += monster.drop;
        if (monster.atkMult < 1 || monster.moveMult < 1) for (const nearby of monsters.filter((candidate) => !candidate.dead && distance(monster, candidate) <= 120)) { nearby.atkMult = Math.min(nearby.atkMult, monster.atkMult); nearby.moveMult = Math.min(nearby.moveMult, monster.moveMult); }
        events.push({ type: 'monsterDead', source: monster.uid, value: monster.drop });
      }
      continue;
    }
    if (context.freezeEnemies > 0) continue;
    monster.actionTimer -= dt;
    monster.specialTimer -= dt;
    if (monster.bossPatternTimer !== undefined) monster.bossPatternTimer -= dt;
    const fighters = units.filter((unit) => unit.state === 'fight' || unit.state === 'avatar');
    if (monster.pendingAttack) {
      monster.pendingAttack.remaining -= dt;
      if (monster.pendingAttack.remaining > 0) continue;
      const pending = monster.pendingAttack;
      monster.pendingAttack = undefined;
      if (pending.pattern) {
        const point = pending.targetPos ?? monster.pos;
        const isRush = pending.pattern === 'charge' || pending.pattern === 'voidRush';
        const isTargeted = pending.pattern === 'tridentRain' || pending.pattern === 'starfall' || pending.pattern === 'lightningLanes';
        const radius = pending.radius ?? constants.battle.bossAoeRadius;
        const targets = fighters.filter((fighter) => {
          if (isRush) return Math.abs(fighter.pos.x - point.x) <= (pending.lineWidth ?? radius) && fighter.pos.y >= monster.pos.y;
          if (pending.pattern === 'tidalWave') return Math.abs(fighter.pos.x - monster.pos.x) <= (pending.lineWidth ?? radius);
          if (pending.pattern === 'lightningLanes') return Math.abs(fighter.pos.x - point.x) <= (pending.lineWidth ?? radius);
          return Math.hypot(fighter.pos.x - (isTargeted ? point.x : monster.pos.x), fighter.pos.y - (isTargeted ? point.y : monster.pos.y)) <= radius;
        });
        if (isRush) { monster.pos.x = point.x; monster.pos.y = constants.battle.wallContactY; }
        if ((pending.wallDamagePct ?? 0) > 0) {
          const wallDamage = context.wallMax * (pending.wallDamagePct ?? 0);
          context.wallHp = Math.max(0, context.wallHp - wallDamage);
          events.push({ type: 'monsterAttack', source: monster.uid, target: 'wall', value: wallDamage });
        }
        for (const fighter of targets) {
          const damage = damageAfterDefense(monster.atk * monster.atkMult * (monster.auraAtkMult ?? 1) * constants.battle.monsterDamageMult * (pending.damageMult ?? 1), fighter.def, swordStats(fighter).defMult, 0, fighter.damageReduction);
          fighter.hp -= damage;
          const knockback = pending.knockback ?? 0;
          if (knockback < 0) moveUnitToward(fighter, monster.pos, Math.abs(knockback), 1);
          else fighter.pos.y = Math.min(constants.battle.wallContactY, fighter.pos.y + knockback);
          events.push({ type: 'monsterAttack', source: monster.uid, target: fighter.uid, value: damage });
          if (fighter.hp <= 0 && scrapUnit(fighter, context.stunCooldown)) events.push({ type: 'unitStunned', source: fighter.uid });
        }
        events.push({ type: 'bossPatternImpact', source: monster.uid, pattern: pending.pattern, x: point.x, y: point.y, radius });
      } else if (pending.wall) {
        const damage = context.wallMax / Math.max(1, monster.wallSeconds) * monster.attackInterval;
        context.wallHp = Math.max(0, context.wallHp - damage);
        events.push({ type: 'monsterAttack', source: monster.uid, target: 'wall', value: damage });
      } else {
        const targets = pending.bossAoe
          ? fighters.filter((fighter) => distance(monster, fighter) <= constants.battle.bossAoeRadius)
          : fighters.filter((fighter) => fighter.uid === pending.targetUid);
        if (pending.bossAoe && monster.defId !== 'zeus' && monster.pos.y >= constants.battle.wallContactY - constants.battle.bossAoeRadius) {
          const wallDamage = context.wallMax * constants.battle.bossAoeWallDamagePct;
          context.wallHp = Math.max(0, context.wallHp - wallDamage);
          events.push({ type: 'monsterAttack', source: monster.uid, target: 'wall', value: wallDamage });
        }
        for (const fighter of targets) {
          const aoeMult = pending.bossAoe ? constants.battle.bossAoeDamageMult : 1;
          const damage = damageAfterDefense(monster.atk * monster.atkMult * (monster.auraAtkMult ?? 1) * constants.battle.monsterDamageMult * aoeMult, fighter.def, swordStats(fighter).defMult, 0, fighter.damageReduction);
          if (fighter.sword.trait === 'sentinel' && fighter.lastHitAgo >= 20) fighter.lastHitAgo = 0;
          else fighter.hp -= damage;
          if (fighter.sword.trait === 'thornblade') { monster.hp -= damage; fighter.hp -= fighter.maxHp * 0.02; }
          fighter.lastHitAgo = 0;
          events.push({ type: 'monsterAttack', source: monster.uid, target: fighter.uid, value: damage });
          if (fighter.hp <= 0 && scrapUnit(fighter, context.stunCooldown)) events.push({ type: 'unitStunned', source: fighter.uid });
        }
      }
      continue;
    }
    const candidate = monster.defId === 'harpy' ? [...fighters].sort((a, b) => b.pos.y - a.pos.y)[0] : monster.defId === 'hephaestus' ? [...fighters].sort((a, b) => b.sword.n - a.sword.n)[0] : [...fighters].sort((a, b) => distance(monster, a) - distance(monster, b))[0];
    const target = candidate;
    if (monster.defId === 'poseidon' && monster.specialTimer <= 0) {
      monster.specialTimer = 12;
      for (const fighter of fighters) { fighter.pos.y = Math.min(constants.battle.wallContactY, fighter.pos.y + 180); fighter.hp -= 10; }
      events.push({ type: 'special', source: monster.uid });
    }
    const stageBoss = monster.giant && monster.defId === 'zeus' && Boolean(monster.stageId);
    if (monster.defId === 'zeus' && !stageBoss && monster.specialTimer <= 0 && fighters.length) {
      monster.specialTimer = monster.hp / monster.maxHp <= 0.5 ? 8 : 15;
      const zeus = byId(monsterData.giants, 'zeus');
      const stunSec = Number((zeus.special as Record<string, unknown> | null)?.stunSec ?? 4);
      const struck = rng.pick(fighters); struck.state = 'stunned'; struck.stunTimer = stunSec; struck.stunTotal = stunSec; struck.divineStun = true; struck.pendingAttack = undefined;
      events.push({ type: 'special', source: monster.uid, target: struck.uid });
    }
    if (stageBoss && (monster.bossPatternTimer ?? 0) <= 0 && fighters.length) {
      const bossKey = monster.bossStage ?? monster.stageId;
      const stageKey = (bossKey === 'S1' || bossKey === 'S2' || bossKey === 'S3') ? bossKey : 'INF';
      const patterns = constants.bossPatterns[stageKey];
      const pattern = patterns[(monster.bossPatternIndex ?? 0) % patterns.length]!;
      const targetPoint = pattern.id === 'charge' || pattern.id === 'voidRush'
        ? { x: monster.pos.x, y: constants.battle.wallContactY }
        : { ...rng.pick(fighters).pos };
      monster.pendingAttack = {
        remaining: pattern.windup,
        pattern: pattern.id,
        targetPos: targetPoint,
        damageMult: pattern.damageMult,
        radius: pattern.radius,
        wallDamagePct: pattern.wallDamagePct,
        knockback: pattern.knockback,
        lineWidth: pattern.lineWidth,
      };
      monster.bossPatternTimer = pattern.cooldown;
      monster.bossPatternIndex = (monster.bossPatternIndex ?? 0) + 1;
      events.push({ type: 'bossPatternStart', source: monster.uid, pattern: pattern.id, value: pattern.windup, x: targetPoint.x, y: targetPoint.y, radius: pattern.radius });
      continue;
    }
    if (target) {
      const attackRange = monster.giant ? constants.battle.bossAoeRadius : monster.range + 36;
      if (distance(monster, target) <= attackRange) {
        if (monster.actionTimer <= 0) {
          monster.actionTimer = monster.giant ? constants.battle.bossAoeIntervalSec : monster.attackInterval;
          monster.pendingAttack = monster.giant
            ? { remaining: constants.battle.bossAoeWindupSec, bossAoe: true }
            : { remaining: constants.battle.monsterAttackWindupSec, targetUid: target.uid };
          events.push({ type: monster.giant ? 'bossAoeStart' : 'monsterAttackStart', source: monster.uid, target: target.uid, value: monster.pendingAttack.remaining });
        }
        if (monster.giant) {
          monster.pos.y = Math.min(constants.battle.wallContactY, monster.pos.y + monster.speed * monster.moveMult * (monster.auraMoveMult ?? 1) * constants.battle.monsterSpeedPixels * constants.battle.bossAdvanceWhileCastingMult * dt);
        } else if (monster.pos.y < constants.battle.unitMinY - constants.battle.mobAdvanceStopOffset) {
          // Allies hold the lower half, so mobs above the line keep closing in even while in range.
          monster.pos.y = Math.min(constants.battle.unitMinY - constants.battle.mobAdvanceStopOffset, monster.pos.y + monster.speed * monster.moveMult * (monster.auraMoveMult ?? 1) * constants.battle.monsterSpeedPixels * dt);
        }
      } else {
        const dx = target.pos.x - monster.pos.x;
        const dy = target.pos.y - monster.pos.y;
        const length = Math.max(1, Math.hypot(dx, dy));
        const step = Math.min(length, monster.speed * monster.moveMult * (monster.auraMoveMult ?? 1) * constants.battle.monsterSpeedPixels * dt);
        monster.pos.x += dx / length * step;
        monster.pos.y += dy / length * step;
      }
    } else if (monster.giant && monster.pos.y >= constants.battle.wallContactY) {
      if (monster.actionTimer <= 0) {
        monster.actionTimer = monster.attackInterval;
        monster.pendingAttack = { remaining: constants.battle.monsterAttackWindupSec, wall: true };
        events.push({ type: 'monsterAttackStart', source: monster.uid, target: 'wall', value: monster.pendingAttack.remaining });
      }
    } else {
      const stop = monster.giant ? constants.battle.wallContactY : constants.battle.mobStopY;
      monster.pos.y = Math.min(stop, monster.pos.y + monster.speed * monster.moveMult * (monster.auraMoveMult ?? 1) * constants.battle.monsterSpeedPixels * dt);
    }
  }
  separateBossesFromUnits(units, monsters);
  return events;
}
