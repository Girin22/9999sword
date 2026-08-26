import Phaser from 'phaser';
import { SfxMixer } from '../audio/sfx';
import { constants } from '../data';
import { createMonsterRig, createUnitRig, syncMonsterRig, syncUnitRig, type MonsterRig, type UnitRig } from '../render/sprites';
import { session } from '../session';
import { awardBattle, BattleSimulation } from '../sim/battle';
import { SeededRng } from '../sim/rng';
import { persistSave } from '../sim/save';
import { COLORS } from '../ui/components';
import { L } from '../ui/layout';

export class Battle extends Phaser.Scene {
  sim!: BattleSimulation; private unitRigs = new Map<string, UnitRig>(); private monsterRigs = new Map<string, MonsterRig>(); private finished = false; private sfx!: SfxMixer;
  constructor() { super('Battle'); }
  create(): void {
    this.drawWorld(); this.sfx = new SfxMixer(this); this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.sfx.destroy()); this.sim = new BattleSimulation(session.stageId, session.formation, session.miner, session.save);
    for (const unit of this.sim.units) this.unitRigs.set(unit.uid, createUnitRig(this, unit));
    this.scene.launch('BattleHUD', { sim: this.sim });
  }
  private drawWorld(): void {
    this.cameras.main.setBackgroundColor(0xcfe3ad); const g = this.add.graphics();
    g.fillStyle(0xe9d39c, 1).fillPoints([{ x: 390, y: 0 }, { x: 690, y: 0 }, { x: 790, y: 1240 }, { x: 290, y: 1240 }], true);
    g.lineStyle(5, 0xb49b6a, 0.35); for (let y = 130; y < 1220; y += 170) g.lineBetween(390 - y * 0.08, y, 690 + y * 0.08, y);
    g.fillStyle(0x6d7880, 1).fillRect(0, L.wall.y0, 1080, L.wall.y1 - L.wall.y0).lineStyle(7, COLORS.ink, 1).strokeRect(0, L.wall.y0, 1080, L.wall.y1 - L.wall.y0);
    for (let x = 0; x < 1080; x += 120) g.fillStyle(0x8d999c, 1).fillRect(x + 6, L.wall.y0 + 10, 105, 42);
    g.fillStyle(0x433c36, 1).fillRoundedRect(L.wall.gateX - L.wall.gateW / 2, L.wall.y0 + 25, L.wall.gateW, 92, 25);
    g.fillStyle(0xe7d7ad, 1).fillRect(0, L.wall.y1, 1080, 523);
    const dots = this.add.graphics().fillStyle(0x6ca66b, 0.5); for (let i = 0; i < 40; i += 1) dots.fillCircle((i * 173) % 1080, 120 + (i * 283) % 1050, 5 + i % 5);
  }
  update(time: number, deltaMs: number): void {
    if (this.finished) return; this.sim.tick(deltaMs / 1000);
    for (const unit of this.sim.units) { const rig = this.unitRigs.get(unit.uid); if (rig) syncUnitRig(rig, unit, time); }
    for (const monster of this.sim.monsters) {
      if (!this.monsterRigs.has(monster.uid)) this.monsterRigs.set(monster.uid, createMonsterRig(this, monster, session.stageId));
      const rig = this.monsterRigs.get(monster.uid)!; syncMonsterRig(rig, monster, time);
    }
    for (const [uid, rig] of this.monsterRigs) if (!this.sim.monsters.some((monster) => monster.uid === uid && !monster.dead)) { rig.root.destroy(); this.monsterRigs.delete(uid); }
    this.animateEvents();
    const phase = this.sim.wave.phase;
    if (phase === 'victory' || phase === 'defeat') this.finish(phase === 'victory');
  }
  private animateEvents(): void {
    for (const event of this.sim.consumeEvents()) {
      if (event.type === 'unitAttackStart') {
        const source = event.source ? this.unitRigs.get(event.source) : undefined; const target = event.target ? this.monsterRigs.get(event.target) : undefined;
        if (source && target) {
          const unit = this.sim.units.find((candidate) => candidate.uid === event.source);
          const duration = Math.max(120, (event.value ?? constants.battle.unitAttackWindupSec) * 1000 / this.sim.speed);
          if (unit?.class === 'thrower') {
            const prepare = duration * 0.46;
            const launch = duration - prepare;
            this.tweens.add({ targets: source.handR, x: 25, y: 5, duration: prepare, ease: 'Sine.easeOut', onComplete: () => {
              this.tweens.add({ targets: source.handR, x: 45, y: -62, duration: launch * 0.55, yoyo: true, ease: 'Cubic.easeOut', onComplete: () => source.handR.setPosition(42, 8) });
            } });
            this.tweens.add({ targets: [source.weapon, source.weaponArt, source.weaponGlowArt, source.weaponHoloArt], x: 24, y: -18, angle: -8, duration: prepare, ease: 'Sine.easeOut', onComplete: () => {
              this.sfx.play('shoot');
              const bolt = this.add.ellipse(source.root.x + 20, source.root.y - 68, 66, 20, 0xf8f2cf)
                .setStrokeStyle(7, COLORS.blue).setDepth(1600).setRotation(Math.atan2(target.root.y - source.root.y, target.root.x - source.root.x));
              this.tweens.add({ targets: bolt, x: target.root.x, y: target.root.y, duration: launch, ease: 'Cubic.easeIn', onComplete: () => bolt.destroy() });
              this.tweens.add({ targets: [source.weapon, source.weaponArt, source.weaponGlowArt, source.weaponHoloArt], x: 48, y: -72, duration: launch * 0.5, yoyo: true, ease: 'Cubic.easeOut', onComplete: () => {
                source.weapon.setPosition(51, -26).setAngle(20);
                source.weaponArt.setPosition(50, -22).setAngle(20);
                source.weaponGlowArt.setPosition(50, -22).setAngle(20); source.weaponHoloArt.setPosition(50, -22).setAngle(20);
              } });
            } });
          } else {
            const direction = target.root.x < source.root.x ? -1 : 1;
            const prepare = duration * 0.44;
            const swing = duration - prepare;
            this.tweens.add({ targets: source.handR, x: 22 * direction, y: -62, duration: prepare, ease: 'Sine.easeOut' });
            this.tweens.add({
              targets: [source.weapon, source.weaponArt, source.weaponGlowArt, source.weaponHoloArt],
              x: 22 * direction, y: -84, angle: -112 * direction,
              duration: prepare,
              ease: 'Sine.easeOut',
              onComplete: () => {
                this.sfx.play('swing');
                const trail = this.add.arc(source.root.x + 24 * direction, source.root.y - 36, 108, direction > 0 ? 175 : 5, direction > 0 ? 385 : 215, false)
                  .setStrokeStyle(18, 0xfff3b0, 0.92).setDepth(1650);
                this.tweens.add({ targets: trail, alpha: 0, scale: 1.18, duration: swing, ease: 'Sine.easeOut', onComplete: () => trail.destroy() });
                this.tweens.add({ targets: source.handR, x: 58 * direction, y: -8, duration: swing, ease: 'Cubic.easeInOut', onComplete: () => source.handR.setPosition(42, 8) });
                this.tweens.add({ targets: [source.weapon, source.weaponArt, source.weaponGlowArt, source.weaponHoloArt], x: 54 * direction, y: -24, angle: 96 * direction, duration: swing, ease: 'Cubic.easeInOut', onComplete: () => {
                  source.weapon.setPosition(51, -26).setAngle(20);
                  source.weaponArt.setPosition(50, -22).setAngle(20);
                  source.weaponGlowArt.setPosition(50, -22).setAngle(20); source.weaponHoloArt.setPosition(50, -22).setAngle(20);
                } });
              },
            });
          }
        }
      } else if (event.type === 'mageCastStart') {
        const source = event.source ? this.unitRigs.get(event.source) : undefined;
        if (source) {
          const duration = Math.max(300, (event.value ?? constants.battle.mageCastWindupSec) * 1000 / this.sim.speed);
          this.sfx.play('magic');
          this.tweens.add({ targets: [source.handL, source.handR], x: 0, y: -82, duration: duration * 0.55, yoyo: true, hold: duration * 0.15, ease: 'Sine.easeInOut' });
          this.tweens.add({ targets: [source.weapon, source.weaponArt, source.weaponGlowArt, source.weaponHoloArt], x: 0, y: -120, angle: 0, duration: duration * 0.55, yoyo: true, hold: duration * 0.15, ease: 'Sine.easeInOut', onComplete: () => {
            source.weapon.setPosition(51, -26).setAngle(20);
            source.weaponArt.setPosition(50, -22).setAngle(20);
            source.weaponGlowArt.setPosition(50, -22).setAngle(20); source.weaponHoloArt.setPosition(50, -22).setAngle(20);
          } });
          const shine = this.add.circle(source.root.x, source.root.y - 125, 18, 0xffffff, 0.8).setStrokeStyle(8, COLORS.blue, 0.75).setDepth(1660);
          this.tweens.add({ targets: shine, radius: 58, alpha: 0, duration, onComplete: () => shine.destroy() });
        }
      } else if (event.type === 'unitAttack' || event.type === 'projectile' || event.type === 'mageCast') {
        const target = event.target ? this.monsterRigs.get(event.target) : undefined;
        if (target) { this.tweens.add({ targets: target.art, alpha: 0.3, duration: 55, yoyo: true }); this.sfx.play('hit', event.type === 'mageCast' ? 0.7 : 1); }
      } else if (event.type === 'monsterAttackStart') {
        const source = event.source ? this.monsterRigs.get(event.source) : undefined;
        const duration = Math.max(140, (event.value ?? constants.battle.monsterAttackWindupSec) * 1000 / this.sim.speed);
        if (source) {
          this.tweens.add({ targets: source.art, angle: { from: -8, to: 11 }, duration: duration * 0.5, yoyo: true, ease: 'Sine.easeInOut' });
          if (event.target === 'wall') {
            const warning = this.add.ellipse(source.root.x, L.wall.y0 + 15, 155, 52, COLORS.red, 0.12).setStrokeStyle(9, COLORS.red, 0.72).setDepth(1500);
            this.tweens.add({ targets: warning, alpha: 0, scale: 1.3, duration, onComplete: () => warning.destroy() });
          } else {
            const target = event.target ? this.unitRigs.get(event.target) : undefined;
            if (target) {
              const slash = this.add.arc(target.root.x, target.root.y - 22, 58, 215, 330, false).setStrokeStyle(12, 0xff6f61, 0.9).setDepth(1600);
              this.tweens.add({ targets: slash, alpha: 0, scale: 1.3, duration, onComplete: () => slash.destroy() });
            }
          }
        }
      } else if (event.type === 'bossAoeStart') {
        const source = event.source ? this.monsterRigs.get(event.source) : undefined;
        if (source) {
          const duration = Math.max(260, (event.value ?? constants.battle.bossAoeWindupSec) * 1000 / this.sim.speed);
          this.time.delayedCall(duration, () => this.sfx.play('bossSmash'));
          const warning = this.add.circle(source.root.x, source.root.y, 38, 0xff684f, 0.1).setStrokeStyle(10, 0xff755b, 0.82).setDepth(700);
          this.tweens.add({ targets: warning, radius: constants.battle.bossAoeRadius, alpha: 0.42, duration: duration * 0.8, ease: 'Sine.easeOut', onComplete: () => {
            this.tweens.add({ targets: warning, alpha: 0, scale: 1.12, duration: duration * 0.2, onComplete: () => warning.destroy() });
          } });
          for (let index = 0; index < 8; index += 1) {
            const angle = index / 8 * Math.PI * 2;
            const spark = this.add.circle(source.root.x + Math.cos(angle) * 46, source.root.y + Math.sin(angle) * 46, 6, 0xffd27b, 0.82).setDepth(710);
            this.tweens.add({ targets: spark, x: source.root.x + Math.cos(angle) * constants.battle.bossAoeRadius, y: source.root.y + Math.sin(angle) * constants.battle.bossAoeRadius, alpha: 0, duration, onComplete: () => spark.destroy() });
          }
        }
      } else if (event.type === 'bossPatternStart') {
        const source = event.source ? this.monsterRigs.get(event.source) : undefined;
        if (source && event.pattern) {
          const duration = Math.max(360, (event.value ?? 1) * 1000 / this.sim.speed);
          const targetX = event.x ?? source.root.x;
          const targetY = event.y ?? source.root.y;
          const radius = event.radius ?? constants.battle.bossAoeRadius;
          const rush = event.pattern === 'charge' || event.pattern === 'voidRush';
          if (rush) this.sfx.play('bossRun');
          const water = event.pattern === 'tidalWave' || event.pattern === 'whirlpool' || event.pattern === 'tridentRain';
          const thunder = event.pattern === 'hammerSmash' || event.pattern === 'lightningLanes' || event.pattern === 'overheat';
          const color = rush ? 0xf04444 : water ? 0x39bce5 : thunder ? 0xb468ff : 0xe747a8;
          if (rush) {
            const width = event.pattern === 'voidRush' ? 170 : 135;
            const lane = this.add.graphics().fillStyle(color, 0.18).lineStyle(9, color, 0.9)
              .fillRect(targetX - width / 2, source.root.y, width, L.wall.y0 - source.root.y)
              .strokeRect(targetX - width / 2, source.root.y, width, L.wall.y0 - source.root.y).setDepth(720);
            this.tweens.add({ targets: lane, alpha: { from: 0.25, to: 1 }, duration: duration * 0.25, yoyo: true, repeat: 1, onComplete: () => lane.destroy() });
            this.tweens.add({ targets: source.art, angle: -14, duration: duration * 0.45, yoyo: true });
          } else if (event.pattern === 'lightningLanes') {
            const lane = this.add.graphics().fillStyle(color, 0.13).lineStyle(8, color, 0.86)
              .fillRect(targetX - 56, 120, 112, L.wall.y0 - 120).strokeRect(targetX - 56, 120, 112, L.wall.y0 - 120).setDepth(720);
            this.tweens.add({ targets: lane, alpha: { from: 0.2, to: 1 }, duration: duration * 0.2, yoyo: true, repeat: 2, onComplete: () => lane.destroy() });
          } else if (event.pattern === 'tidalWave') {
            const wave = this.add.graphics().fillStyle(color, 0.16).lineStyle(10, color, 0.82)
              .fillPoints([{ x: source.root.x - 70, y: source.root.y }, { x: source.root.x + 70, y: source.root.y }, { x: source.root.x + 300, y: L.wall.y0 }, { x: source.root.x - 300, y: L.wall.y0 }], true)
              .strokePoints([{ x: source.root.x - 70, y: source.root.y }, { x: source.root.x + 70, y: source.root.y }, { x: source.root.x + 300, y: L.wall.y0 }, { x: source.root.x - 300, y: L.wall.y0 }], true).setDepth(720);
            this.tweens.add({ targets: wave, alpha: { from: 0.25, to: 0.85 }, duration: duration * 0.65, yoyo: true, onComplete: () => wave.destroy() });
          } else {
            const centered = event.pattern === 'tridentRain' || event.pattern === 'lightningLanes' || event.pattern === 'starfall';
            const warning = this.add.circle(centered ? targetX : source.root.x, centered ? targetY : source.root.y, 28, color, 0.1).setStrokeStyle(10, color, 0.82).setDepth(720);
            this.tweens.add({ targets: warning, radius, alpha: 0.38, duration: duration * 0.82, ease: 'Sine.easeOut', onComplete: () => this.tweens.add({ targets: warning, alpha: 0, duration: duration * 0.18, onComplete: () => warning.destroy() }) });
            if (event.pattern === 'leap' || event.pattern === 'starfall') {
              this.tweens.add({ targets: source.art, y: -190, duration: duration * 0.5, yoyo: true, ease: 'Quad.easeInOut' });
            } else if (event.pattern === 'stomp' || event.pattern === 'hammerSmash') {
              this.tweens.add({ targets: source.art, y: 32, duration: duration * 0.62, yoyo: true, ease: 'Bounce.easeOut' });
            } else if (event.pattern === 'whirlpool' || event.pattern === 'gravityWell') {
              this.tweens.add({ targets: warning, angle: 260, scale: 0.72, duration, ease: 'Sine.easeIn' });
            }
          }
        }
      } else if (event.type === 'bossPatternImpact') {
        this.cameras.main.shake(180, 0.009);
        this.sfx.play('bossSmash');
        const burst = this.add.circle(event.x ?? 540, event.y ?? 700, 38, 0xffffff, 0.18).setStrokeStyle(16, 0xffd27b, 0.9).setDepth(1700);
        this.tweens.add({ targets: burst, radius: event.radius ?? 250, alpha: 0, duration: 360 / this.sim.speed, onComplete: () => burst.destroy() });
      } else if (event.type === 'monsterAttack' && event.target === 'wall') this.cameras.main.shake(90, 0.004);
      else if (event.type === 'monsterAttack') { const target = event.target ? this.unitRigs.get(event.target) : undefined; if (target) this.tweens.add({ targets: target.root, alpha: 0.35, duration: 45, yoyo: true }); }
    }
  }
  private finish(victory: boolean): void {
    this.finished = true; const reward = awardBattle(session.save, session.stageId, victory, this.sim.wave.waveIndex + 1, new SeededRng(Date.now())); persistSave(session.save);
    session.result = { victory, stageId: session.stageId, wave: this.sim.wave.waveIndex + 1, highestSword: this.sim.stats.highestSword, orderRolls: this.sim.stats.orderRolls, chaosRolls: this.sim.stats.chaosRolls, scrapped: this.sim.stats.scrapped, shards: reward.shards, recipe: reward.recipe };
    this.time.delayedCall(900, () => { this.scene.stop('BattleHUD'); this.scene.start('Result'); });
  }
}
