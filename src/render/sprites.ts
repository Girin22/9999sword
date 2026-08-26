import Phaser from 'phaser';
import { constants, monsterData, swordData, traitData, unitData } from '../data';
import type { Monster, Unit } from '../sim/types';
import { addSheetSprite, animateHolo, applyHolo, clearHolo, COLORS, HOLO_PALETTE, sizeSheetSprite, type HoloFx } from '../ui/components';

export interface UnitRig {
  root: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Graphics;
  aura: Phaser.GameObjects.Graphics;
  art: Phaser.GameObjects.Image;
  handL: Phaser.GameObjects.Arc;
  handR: Phaser.GameObjects.Arc;
  weapon: Phaser.GameObjects.Rectangle;
  weaponGlowArt: Phaser.GameObjects.Image;
  weaponHoloArt: Phaser.GameObjects.Image;
  weaponArt: Phaser.GameObjects.Image;
  hp: Phaser.GameObjects.Graphics;
  stun: Phaser.GameObjects.Container;
  stunRing: Phaser.GameObjects.Graphics;
  stunText: Phaser.GameObjects.Text;
  sparks: Phaser.GameObjects.Graphics;
  holo: HoloFx | null;
  lastTrait: string | null;
  lastState: string;
  lastKind: string;
}

export interface MonsterRig {
  root: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Graphics;
  art: Phaser.GameObjects.Image;
  hp: Phaser.GameObjects.Graphics;
  lastHp: number;
}

const unitColors: Record<string, number> = { knight: 0x6e9fd0, thrower: 0xe3a04f, mage: 0x8e70bd };

function cropSheet(image: Phaser.GameObjects.Image, key: string, index: number, columns: number, rows = 1): void {
  image.setFrame(index);
  image.setData('sheetCellWidth', image.width).setData('sheetCellHeight', image.height);
  void key;
  void columns;
  void rows;
}

export function createUnitRig(scene: Phaser.Scene, unit: Unit): UnitRig {
  const body = scene.add
    .graphics()
    .fillStyle(unitColors[unit.class], 1)
    .lineStyle(7, COLORS.ink, 1)
    .fillRoundedRect(-38, -45, 76, 90, 30)
    .strokeRoundedRect(-38, -45, 76, 90, 30)
    .setVisible(false);
  const artIndex = Math.max(0, unitData.units.findIndex((entry) => entry.id === unit.defId));
  const art = sizeSheetSprite(addSheetSprite(scene, 'units-sheet', artIndex, 7), 135, 340);
  const aura = scene.add.graphics().setDepth(620);
  const handL = scene.add.circle(-42, 8, 10, 0xf1bd89).setStrokeStyle(4, COLORS.ink);
  const handR = scene.add.circle(42, 8, 10, 0xf1bd89).setStrokeStyle(4, COLORS.ink);
  const weapon = scene.add
    .rectangle(51, -26, 15, 92, swordColor(unit.sword.kind))
    .setStrokeStyle(5, COLORS.ink)
    .setOrigin(0.5, 0.9)
    .setAngle(20)
    .setVisible(false);
  const kindIndex = Math.max(0, swordData.kinds.findIndex((kind) => kind.id === unit.sword.kind));
  const weaponGlowArt = sizeSheetSprite(addSheetSprite(scene, 'swords-sheet', kindIndex, 3, 3), 112, 116)
    .setPosition(50, -22)
    .setOrigin(0.5, 0.84)
    .setAngle(20)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setVisible(false);
  const weaponHoloArt = sizeSheetSprite(addSheetSprite(scene, 'swords-sheet', kindIndex, 3, 3), 112, 116)
    .setPosition(50, -22)
    .setOrigin(0.5, 0.84)
    .setAngle(20)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setVisible(false);
  const weaponArt = sizeSheetSprite(addSheetSprite(scene, 'swords-sheet', kindIndex, 3, 3), 100, 104)
    .setPosition(50, -22)
    .setOrigin(0.5, 0.84)
    .setAngle(20);
  const hp = scene.add.graphics();
  const sparks = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  const root = scene.add.container(unit.pos.x, unit.pos.y, [body, art, handL, handR, weaponGlowArt, weaponHoloArt, weapon, weaponArt, sparks, hp]);
  root.setDepth(1000 - unit.pos.y * 0.1);
  const stunRing = scene.add.graphics();
  const stunText = scene.add.text(0, 0, '', { fontSize: '26px', color: '#ffffff', fontStyle: 'bold', stroke: '#293442', strokeThickness: 6 }).setOrigin(0.5);
  const stun = scene.add.container(unit.pos.x, unit.pos.y, [stunRing, stunText]).setVisible(false).setDepth(1400);
  return { root, body, aura, art, handL, handR, weapon, weaponGlowArt, weaponHoloArt, weaponArt, hp, stun, stunRing, stunText, sparks, holo: null, lastTrait: null, lastState: unit.state, lastKind: unit.sword.kind };
}

const STUN_RING_RADIUS = 34;

/** Circular countdown drawn above a stunned unit so the player can read when it stands back up. */
function drawStunRing(rig: UnitRig, unit: Unit): void {
  const visible = unit.state === 'stunned' && unit.stunTotal > 0;
  rig.stun.setVisible(visible);
  if (!visible) return;
  const progress = Math.max(0, Math.min(1, 1 - unit.stunTimer / unit.stunTotal));
  rig.stun.setPosition(unit.pos.x, unit.pos.y - 118);
  const g = rig.stunRing.clear();
  g.fillStyle(0x293442, 0.72).fillCircle(0, 0, STUN_RING_RADIUS + 5);
  g.fillStyle(0x3d4a56, 1).fillCircle(0, 0, STUN_RING_RADIUS);
  if (progress > 0) {
    const start = -Math.PI / 2;
    g.fillStyle(COLORS.gold, 1).slice(0, 0, STUN_RING_RADIUS, start, start + progress * Math.PI * 2, false).fillPath();
  }
  g.lineStyle(4, 0xffffff, 0.9).strokeCircle(0, 0, STUN_RING_RADIUS);
  rig.stunText.setText(String(Math.ceil(unit.stunTimer)));
}

/** Fully saturated hue that drifts over time — the base of the holographic foil look. */
const holoColor = (time: number, offset: number, saturation = 1, value = 1): number =>
  Phaser.Display.Color.HSVToRGB(((time * 0.00045 + offset) % 1 + 1) % 1, saturation, value).color;

/**
 * Sparks riding the blade outline. Positions are sampled along the blade axis with an
 * alternating lateral offset so they trace both edges; order = drifting 4-point stars,
 * chaos = jittering embers.
 */
function drawBladeSparks(rig: UnitRig, axis: 'order' | 'chaos', length: number, thick: number, time: number, phase: number): void {
  const g = rig.sparks.clear();
  const art = rig.weaponArt;
  const rad = Phaser.Math.DegToRad(art.angle);
  const dir = { x: Math.sin(rad), y: -Math.cos(rad) };
  const side = { x: Math.cos(rad), y: Math.sin(rad) };
  const reach = art.displayHeight * 0.84;
  const halfWidth = art.displayWidth * 0.3;
  const palette = HOLO_PALETTE[axis].spark;
  const count = axis === 'order' ? 9 : 12;
  const speed = axis === 'order' ? 0.00035 : 0.0011;
  for (let i = 0; i < count; i += 1) {
    const t = ((i / count) + time * speed + phase * 0.01) % 1;
    const lateral = (i % 2 ? 1 : -1) * halfWidth * (axis === 'chaos' ? 0.8 + 0.5 * Math.sin(time * 0.03 + i * 1.7) : 1);
    const x = art.x + dir.x * reach * t + side.x * lateral;
    const y = art.y + dir.y * reach * t + side.y * lateral;
    const color = palette[i % palette.length]!;
    if (axis === 'order') {
      const size = 3 + 3 * Math.abs(Math.sin(time * 0.006 + i));
      g.fillStyle(color, 0.75 + 0.25 * Math.sin(time * 0.008 + i));
      g.fillPoints([{ x, y: y - size * 2 }, { x: x + size * 0.6, y }, { x, y: y + size * 2 }, { x: x - size * 0.6, y }], true);
      g.fillPoints([{ x: x - size * 2, y }, { x, y: y - size * 0.6 }, { x: x + size * 2, y }, { x, y: y + size * 0.6 }], true);
    } else {
      const flicker = Math.max(0.2, Math.sin(time * 0.05 + i * 2.3));
      g.fillStyle(color, flicker).fillCircle(x, y, 2.5 + 3 * flicker);
    }
  }
  g.lineStyle(2, palette[0]!, axis === 'order' ? 0.35 + 0.25 * Math.sin(time * 0.005 + phase) : 0.25 + 0.35 * Math.abs(Math.sin(time * 0.02)));
  const base = { x: art.x - dir.x * art.displayHeight * 0.1, y: art.y - dir.y * art.displayHeight * 0.1 };
  const tip = { x: art.x + dir.x * reach, y: art.y + dir.y * reach };
  g.lineBetween(base.x + side.x * halfWidth, base.y + side.y * halfWidth, tip.x, tip.y);
  g.lineBetween(base.x - side.x * halfWidth, base.y - side.y * halfWidth, tip.x, tip.y);
  void length; void thick;
}

export function syncUnitRig(rig: UnitRig, unit: Unit, time = 0): void {
  const phase = [...unit.uid].reduce((sum, char) => sum + char.charCodeAt(0), 0) * 0.17;
  const active = (unit.state === 'fight' || unit.state === 'avatar' || unit.state === 'returning') && !unit.pendingAttack;
  const bounce = active ? Math.abs(Math.sin(time * 0.009 + phase)) * 13 : 0;
  const tilt = active ? Math.sin(time * 0.009 + phase) * 3 : 0;
  const baseScale = unit.state === 'avatar' ? 1.3 : 1;
  rig.root.setVisible(unit.state !== 'mining' && unit.state !== 'resting').setPosition(unit.pos.x, unit.pos.y - bounce).setDepth(1000 - unit.pos.y * 0.1);
  rig.root
    .setAlpha(unit.state === 'stunned' ? 0.42 : 1)
    .setAngle(unit.state === 'stunned' ? 90 : tilt)
    .setScale(baseScale);
  drawStunRing(rig, unit);

  const auraVisible = unit.class === 'mage' && (unit.state === 'fight' || unit.state === 'avatar');
  const auraColor = unit.defId === 'hote' ? COLORS.red : COLORS.blue;
  rig.aura.clear().setVisible(auraVisible).setPosition(unit.pos.x, unit.pos.y).setDepth(620);
  if (auraVisible) {
    const radius = constants.classBase.mage.flagRadius;
    rig.aura.fillStyle(auraColor, 0.08).fillCircle(0, 0, radius).lineStyle(5, auraColor, 0.58).strokeCircle(0, 0, radius);
    for (let i = 0; i < 14; i += 1) {
      const angle = i * 2.399 + time * 0.00022;
      const starRadius = 36 + i / 14 * (radius - 52);
      const x = Math.cos(angle) * starRadius;
      const y = Math.sin(angle) * starRadius;
      const size = 3 + i % 3;
      rig.aura.fillStyle(i % 2 ? 0xffffff : auraColor, 0.28 + 0.16 * Math.sin(time * 0.003 + i));
      rig.aura.fillPoints([{ x, y: y - size }, { x: x + size, y }, { x, y: y + size }, { x: x - size, y }], true);
    }
  }

  const length = 92 + Math.min(76, unit.sword.n * 2.4);
  const thick = 46 + Math.min(20, unit.sword.n * 0.5);
  if (rig.lastKind !== unit.sword.kind) {
    const kindIndex = Math.max(0, swordData.kinds.findIndex((kind) => kind.id === unit.sword.kind));
    cropSheet(rig.weaponArt, 'swords-sheet', kindIndex, 3, 3);
    cropSheet(rig.weaponGlowArt, 'swords-sheet', kindIndex, 3, 3);
    cropSheet(rig.weaponHoloArt, 'swords-sheet', kindIndex, 3, 3);
    rig.lastKind = unit.sword.kind;
  }
  const swordVisible = unit.sword.isScrap !== true && unit.state !== 'mining';
  const trait = unit.sword.trait ? traitData.traits.find((entry) => entry.id === unit.sword.trait) : undefined;
  const holo = Boolean(trait) && swordVisible;
  // Holographic foil: the blade itself is tinted with a drifting pastel hue, and two
  // additive glow layers cycle through opposite hues with a hard pulse.
  const chaos = trait?.axis === 'chaos';
  const hueBase = chaos ? 0.92 : 0.55;
  sizeSheetSprite(rig.weaponArt, 88 + thick * 0.35, length).setVisible(swordVisible);
  if (holo) rig.weaponArt.setTint(holoColor(time, hueBase, 0.55, 1), holoColor(time, hueBase + 0.33, 0.55, 1), holoColor(time, hueBase + 0.66, 0.55, 1), 0xffffff);
  else rig.weaponArt.clearTint();
  const pulse = 0.5 + 0.5 * Math.sin(time * 0.012 + phase);
  const glowScale = 1.28 + pulse * 0.16;
  sizeSheetSprite(rig.weaponGlowArt, (100 + thick * 0.35) * glowScale, (length + 12) * glowScale)
    .setTint(holoColor(time, hueBase), holoColor(time, hueBase + 0.5), holoColor(time, hueBase + 0.25), holoColor(time, hueBase + 0.75))
    .setAlpha(0.85 + pulse * 0.15)
    .setVisible(holo);
  sizeSheetSprite(rig.weaponHoloArt, (100 + thick * 0.35) * (glowScale + 0.22), (length + 12) * (glowScale + 0.22))
    .setTint(holoColor(time, hueBase + 0.5), holoColor(time, hueBase), holoColor(time, hueBase + 0.75), holoColor(time, hueBase + 0.25))
    .setAlpha(0.55 + (1 - pulse) * 0.35)
    .setVisible(holo);
  // Outline holo: glow + shine follow the blade alpha; sparks trace the edges.
  const traitId = holo ? unit.sword.trait : null;
  if (traitId !== rig.lastTrait) {
    rig.lastTrait = traitId;
    if (traitId && trait) rig.holo = applyHolo(rig.weaponArt, chaos ? 'chaos' : 'order');
    else { clearHolo(rig.weaponArt); rig.holo = null; }
  }
  if (rig.holo) animateHolo(rig.holo, time, phase);
  if (holo) drawBladeSparks(rig, chaos ? 'chaos' : 'order', length, thick, time, phase);
  else rig.sparks.clear();
  rig.weapon
    .setSize(Math.max(12, thick * 0.28), length * 0.8)
    .setFillStyle(unit.sword.isScrap ? 0x7c8585 : swordColor(unit.sword.kind))
    .setVisible(unit.sword.isScrap === true && unit.state !== 'mining');
  rig.hp
    .clear()
    .fillStyle(0x263238, 0.85)
    .fillRoundedRect(-48, -82, 96, 10, 5)
    .fillStyle(unit.hp / unit.maxHp < 0.25 ? COLORS.red : COLORS.green, 1)
    .fillRoundedRect(-46, -80, 92 * Math.max(0, unit.hp / unit.maxHp), 6, 3);
  rig.lastState = unit.state;
}

const swordColor = (id: string): number => {
  const index = swordData.kinds.findIndex((kind) => kind.id === id);
  return [0xcfd6d7, 0xe0e4e4, 0xeac65b, 0x81c6d7, 0x69a57a, 0xb86f56, 0x7c75c7, 0x6fa5d8, 0xe77c46][Math.max(0, index)] ?? 0xd4d4d4;
};

export function createMonsterRig(scene: Phaser.Scene, monster: Monster, stageId = 'S1'): MonsterRig {
  const body = scene.add
    .graphics()
    .fillStyle(0xa0724a, 1)
    .lineStyle(8, COLORS.ink, 1)
    .fillRoundedRect(-42, -42, 84, 84, 30)
    .strokeRoundedRect(-42, -42, 84, 84, 30)
    .setVisible(false);
  const stageBoss = monster.giant && monster.defId === 'zeus';
  const list = monster.giant ? monsterData.giants : monsterData.mobs;
  const stageIndex = ({ S1: 0, S2: 1, S3: 2, INF: 3 } as Record<string, number>)[monster.bossStage ?? stageId] ?? 0;
  const index = stageBoss ? stageIndex : Math.max(0, list.findIndex((entry) => entry.id === monster.defId));
  const key = stageBoss ? 'stage-bosses-sheet' : monster.giant ? 'giants-sheet' : 'mobs-sheet';
  const art = sizeSheetSprite(addSheetSprite(scene, key, index, 4), stageBoss ? 190 : 122, stageBoss ? 190 : 122);
  const hp = scene.add.graphics();
  const root = scene.add.container(monster.pos.x, monster.pos.y, [body, art, hp]).setScale(monster.giant ? 2.1 : 1);
  return { root, body, art, hp, lastHp: monster.hp };
}

export function syncMonsterRig(rig: MonsterRig, monster: Monster, time = 0): void {
  const phase = [...monster.uid].reduce((sum, char) => sum + char.charCodeAt(0), 0) * 0.13;
  const bounce = Math.abs(Math.sin(time * (monster.giant ? 0.005 : 0.011) + phase)) * (monster.giant ? 8 : 12);
  rig.root.setPosition(monster.pos.x, monster.pos.y - bounce).setAngle(Math.sin(time * 0.008 + phase) * (monster.giant ? 1.2 : 3));
  rig.root.setDepth(900 - monster.pos.y * 0.1);
  rig.hp
    .clear()
    .fillStyle(0x263238, 0.8)
    .fillRoundedRect(-45, -71, 90, 9, 4)
    .fillStyle(monster.giant ? COLORS.gold : COLORS.red, 1)
    .fillRoundedRect(-43, -69, 86 * Math.max(0, monster.hp / monster.maxHp), 5, 2);
  rig.lastHp = monster.hp;
}
