import Phaser from 'phaser';
import { addBgmToggle, toggleBgm } from '../audio/bgm';
import { SfxMixer } from '../audio/sfx';
import { constants, swordData, traitData, unitData } from '../data';
import { session } from '../session';
import { BattleSimulation, traitName } from '../sim/battle';
import { attackAtLevel, forgeCost } from '../sim/forge';
import { resetSave } from '../sim/save';
import { addSheetSprite, COLORS, holoOutline, iconLabel, makeButton, paperPanel, sizeSheetSprite, type HoloAxis, type HoloOutline, type IconLabel } from '../ui/components';
import { L } from '../ui/layout';

type Building = 'forge' | 'barracks' | 'mine';
/** How long a tapped building tooltip stays up on touch devices. */
const TOUCH_TOOLTIP_MS = 3500;

export class BattleHUD extends Phaser.Scene {
  private sim!: BattleSimulation;
  private sfx!: SfxMixer;
  private selected: Building = 'forge';
  private action!: Phaser.GameObjects.Container;
  private materialsLabel!: IconLabel;
  private values!: Phaser.GameObjects.Text;
  private wall!: Phaser.GameObjects.Graphics;
  private forgeFill!: Phaser.GameObjects.Graphics;
  private spiritLabel!: Phaser.GameObjects.Text;
  private forgeButton!: Phaser.GameObjects.Container;
  private forgeHolo: HoloOutline | null = null;
  private swordPanel?: Phaser.GameObjects.Container;
  private swordHolo: HoloOutline | null = null;
  /** While a spirit reveal is playing: the enhance button is locked and the forge sparkles. */
  private reveal: { axis: HoloAxis; until: number } | null = null;
  /** Healing progress drawn along the recover button outline (barracks tab only). */
  private recoverRing?: Phaser.GameObjects.Graphics;
  private recoverText?: Phaser.GameObjects.Text;
  private selection!: Phaser.GameObjects.Graphics;
  private speedLabel!: Phaser.GameObjects.Text;
  private tooltipLayer?: Phaser.GameObjects.Container;
  private tooltipText?: Phaser.GameObjects.Text;
  private hovered?: Building;
  private tooltipTimer?: Phaser.Time.TimerEvent;
  private menuLayer?: Phaser.GameObjects.Container;

  constructor() {
    super('BattleHUD');
  }

  init(data: { sim: BattleSimulation }): void {
    this.sim = data.sim;
  }

  create(): void {
    this.sfx = new SfxMixer(this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.sfx.destroy());
    this.add.graphics().fillStyle(0xfff4d8, 0.8).fillRoundedRect(22, 24, 570, 106, 30).lineStyle(6, COLORS.ink, 0.9).strokeRoundedRect(22, 24, 570, 106, 30);
    this.materialsLabel = iconLabel(this, 46, 76, 'icon-ore', '0', { fontSize: '34px', color: '#293442', fontStyle: 'bold' });
    this.materialsLabel.root.setDepth(10);
    this.values = this.add.text(300, 76, '', { fontSize: '34px', color: '#293442', fontStyle: 'bold' }).setOrigin(0, 0.5).setDepth(10);
    this.wall = this.add.graphics();
    this.forgeFill = this.add.graphics().setDepth(8);
    this.spiritLabel = this.add.text(L.buildings.forge.x + L.buildings.forge.w / 2, L.buildings.forge.y + L.buildings.forge.h - 56, '장인의 기운', { fontSize: '20px', color: '#ffffff', fontStyle: 'bold', stroke: '#293442', strokeThickness: 6 }).setOrigin(0.5).setDepth(9);
    this.selection = this.add.graphics().setDepth(9);
    this.action = this.add.container(0, 0);

    const speed = makeButton(this, 665, 92, '×1', () => this.sim.toggleSpeed(), { width: 115, height: L.hud.speed.h, fontSize: 31, fill: 0xf5c95d });
    this.speedLabel = speed.list.find((child) => child instanceof Phaser.GameObjects.Text) as Phaser.GameObjects.Text;
    addBgmToggle(this, 'bgm-ingame', 815, 92, 150);
    makeButton(this, 990, 92, '☰', () => this.showMenu(), { width: L.hud.menu.w, height: L.hud.menu.h, fontSize: 40 });

    this.buildBuilding('forge', '대장간', L.buildings.forge, 0);
    this.buildBuilding('barracks', '막사', L.buildings.barracks, 1);
    this.buildBuilding('mine', '광산', L.buildings.mine, 2);
    this.renderAction();
  }

  private buildBuilding(id: Building, label: string, rect: { x: number; y: number; w: number; h: number }, artIndex: number): void {
    const fills: Record<Building, number> = { forge: 0xf0b45d, barracks: 0x9db8d0, mine: 0xa8c47e };
    const button = makeButton(
      this,
      rect.x + rect.w / 2,
      rect.y + rect.h / 2,
      '',
      () => {
        this.selected = id;
        this.showTooltip(id);
        this.renderAction();
      },
      { width: rect.w, height: rect.h, fill: fills[id] },
    ).setDepth(5);
    if (id === 'forge') this.forgeButton = button;
    button.add(sizeSheetSprite(addSheetSprite(this, 'buildings-sheet', artIndex, 3), 205, 185).setY(id === 'forge' ? 4 : 18));
    button.add(this.add.text(0, -105, label, { fontSize: '34px', color: '#ffffff', fontStyle: 'bold', stroke: '#293442', strokeThickness: 9 }).setPadding(8, 10, 8, 4).setOrigin(0.5));
    button.on('pointerover', () => this.showTooltip(id));
    // Touch has no hover: a tap keeps the tooltip for a few seconds instead of hiding on the lift.
    button.on('pointerout', (pointer: Phaser.Input.Pointer) => { if (!pointer.wasTouch) this.hideTooltip(); });
  }

  private showTooltip(id: Building): void {
    this.hovered = id;
    this.tooltipLayer?.destroy(true);
    const bg = this.add.graphics().fillStyle(0x263442, 0.86).lineStyle(5, 0xffffff, 0.82).fillRoundedRect(85, 1060, 910, 190, 28).strokeRoundedRect(85, 1060, 910, 190, 28);
    this.tooltipText = this.add.text(540, 1155, '', { fontSize: '29px', color: '#ffffff', align: 'center', lineSpacing: 8, fontStyle: 'bold', wordWrap: { width: 820 } }).setPadding(10, 12, 10, 8).setOrigin(0.5);
    this.tooltipLayer = this.add.container(0, 0, [bg, this.tooltipText]).setDepth(45);
    this.refreshTooltip();
    this.tooltipTimer?.remove(false);
    if (this.input.activePointer.wasTouch) this.tooltipTimer = this.time.delayedCall(TOUCH_TOOLTIP_MS, () => this.hideTooltip());
  }

  private hideTooltip(): void {
    this.tooltipTimer?.remove(false);
    this.tooltipTimer = undefined;
    this.hovered = undefined;
    this.tooltipLayer?.destroy(true);
    this.tooltipLayer = undefined;
    this.tooltipText = undefined;
  }

  private refreshTooltip(): void {
    if (!this.hovered || !this.tooltipText) return;
    if (this.hovered === 'forge') {
      const forge = this.sim.forge;
      const kind = swordData.kinds.find((entry) => entry.id === forge.kind) ?? swordData.kinds[0]!;
      const trait = traitName(forge.trait) || '특성 없음';
      this.tooltipText.setText(`현재 검  +${forge.n}  ·  ${kind.name}\n공격력 ${Math.round(attackAtLevel(forge.n))}  ·  무게 ${kind.weight}  ·  ${trait}`);
    } else if (this.hovered === 'barracks') {
      this.tooltipText.setText('병종별로 완성된 검을 보급합니다.\n쓰러진 병사를 회복시키고 전선으로 복귀시킵니다.');
    } else {
      const assigned = this.sim.mineAssigneeUid ? this.sim.units.find((unit) => unit.uid === this.sim.mineAssigneeUid) : undefined;
      this.tooltipText.setText(`담당 병사가 재료를 자동 생산합니다.\n${assigned ? `${assigned.state === 'mining' ? '광산 작업 중' : '전투 참여 중'}  ·  기본 생산량 ${constants.mine.baseRatePerSec}/초` : '배정된 병사가 없습니다.'}`);
    }
  }

  private renderAction(): void {
    this.action.destroy(true);
    this.recoverRing = undefined;
    this.recoverText = undefined;
    this.swordPanel = undefined;
    this.swordHolo?.destroy();
    this.swordHolo = null;
    this.action = this.add.container(0, 0).setDepth(20);
    const rect = L.buildings[this.selected];
    this.selection.clear().lineStyle(12, 0xfff4be, 1).strokeRoundedRect(rect.x - 7, rect.y - 7, rect.w + 14, rect.h + 14, 34);
    this.action.add(paperPanel(this, 38, 1654, 1004, 218, 0xfff0c9));

    if (this.selected === 'forge') {
      const icon = this.sim.forge.avatarReady ? '★' : this.sim.forge.trait ? '◆' : '◇';
      this.swordPanel = this.add.container(0, 0, [
        paperPanel(this, 70, L.actionBar.y0, 210, L.actionBar.y1 - L.actionBar.y0, 0xdceff4),
        this.add.text(175, (L.actionBar.y0 + L.actionBar.y1) / 2, `${icon} +${this.sim.forge.n}`, {
          fontSize: '40px', color: '#293442', fontStyle: 'bold', stroke: '#ffffff', strokeThickness: 6,
        }).setOrigin(0.5).setName('current-forge'),
      ]);
      this.swordHolo = null;
      this.action.add(this.swordPanel);
      const buttonWidth = 700;
      const enhanceButton = makeButton(
        this,
        650,
        (L.actionBar.y0 + L.actionBar.y1) / 2,
        '',
        () => {
          if (this.reveal) return;
          const events = this.sim.enhance();
          if (events.length) this.sfx.play('enhance', events.includes('great') ? 1.15 : 1);
          if (events.includes('spirit')) this.revealSpirit(events.includes('avatar') ? 'order' : events.includes('chaos') ? 'chaos' : 'order');
          this.renderAction();
          this.refreshTooltip();
        },
        { width: buttonWidth, height: L.actionBar.y1 - L.actionBar.y0, fill: this.reveal ? 0xbdb6a6 : 0xf5c95d, disabled: Boolean(this.reveal) },
      );
      // Big label filling the button on the left, cost with the ore icon flush right.
      enhanceButton.add(this.add.text(-buttonWidth / 2 + 44, -14, '강화하기', { fontSize: '62px', color: '#293442', fontStyle: 'bold' }).setOrigin(0, 0.5));
      const chance = Math.round(this.sim.enhanceSuccessChance() * 100);
      enhanceButton.add(this.add.text(-buttonWidth / 2 + 48, 44, `성공 확률 ${chance}%`, { fontSize: '26px', color: chance >= 100 ? '#2f8a4c' : '#53616b', fontStyle: 'bold' }).setOrigin(0, 0.5));
      const cost = iconLabel(this, buttonWidth / 2 - 44, 0, 'icon-ore', String(forgeCost(this.sim.forge.n)), { fontSize: '44px', color: '#293442', fontStyle: 'bold' }, 'right');
      enhanceButton.add(cost.root);
      this.action.add(enhanceButton);
    } else if (this.selected === 'barracks') {
      const classes = [
        { id: 'knight' as const, icon: '♜', color: '#3f7fc4', fill: 0xd6e6f6 },
        { id: 'thrower' as const, icon: '➶', color: '#d2862e', fill: 0xfbe6cc },
        { id: 'mage' as const, icon: '⚑', color: '#7d5fb8', fill: 0xe6dcf5 },
      ];
      const slotH = L.actionBar.y1 - L.actionBar.y0;
      classes.forEach((entry, index) => {
        const members = this.sim.units.filter((unit) => unit.class === entry.id);
        const present = members.length > 0;
        // Show the weakest sword in the class so a scrapped (fallen) unit is visible at a glance.
        const level = present ? Math.min(...members.map((unit) => unit.sword.n)) : 0;
        const button = makeButton(this, L.actionBar.slots[index]!.x + L.actionBar.slotW / 2, (L.actionBar.y0 + L.actionBar.y1) / 2, '', () => this.sim.supply(entry.id), {
          width: L.actionBar.slotW,
          height: slotH,
          fill: present ? entry.fill : 0xb9b5ab,
          disabled: !present,
        });
        if (present) {
          button.add(this.add.text(0, -26, entry.icon, { fontSize: '54px', color: entry.color, fontStyle: 'bold', stroke: '#ffffff', strokeThickness: 6 }).setOrigin(0.5));
          button.add(this.add.text(0, 40, `+${level}`, { fontSize: '30px', color: '#293442', fontStyle: 'bold' }).setOrigin(0.5));
        } else {
          button.add(this.add.text(0, -26, entry.icon, { fontSize: '54px', color: '#8a877e', fontStyle: 'bold' }).setOrigin(0.5).setAlpha(0.55));
          button.add(this.chainLock(L.actionBar.slotW, slotH));
        }
        this.action.add(button);
      });
      const recover = makeButton(this, L.actionBar.right.x + L.actionBar.right.w / 2, (L.actionBar.y0 + L.actionBar.y1) / 2, '', () => this.sim.recover(), { width: L.actionBar.right.w, height: slotH, fill: 0xf7d9d9 });
      recover.add(this.medicalCross());
      this.recoverText = this.add.text(0, 58, '', { fontSize: '22px', color: '#293442', fontStyle: 'bold', stroke: '#ffffff', strokeThickness: 5 }).setOrigin(0.5);
      recover.add(this.recoverText);
      this.action.add(recover);
      this.recoverRing = this.add.graphics();
      this.action.add(this.recoverRing);
    } else {
      const assigned = this.sim.mineAssigneeUid ? this.sim.units.find((unit) => unit.uid === this.sim.mineAssigneeUid) : undefined;
      const mining = assigned?.state === 'mining';
      const slot = makeButton(this, L.actionBar.slots[0]!.x + L.actionBar.slotW / 2, (L.actionBar.y0 + L.actionBar.y1) / 2, '', () => {}, {
        width: L.actionBar.slotW,
        height: L.actionBar.y1 - L.actionBar.y0,
        disabled: !assigned,
        fill: 0xdcebc9,
      });
      if (assigned) {
        const unitIndex = unitData.units.findIndex((unit) => unit.id === assigned.defId);
        slot.add(sizeSheetSprite(addSheetSprite(this, 'units-sheet', unitIndex, 7), 145, 260).setAlpha(mining ? 1 : 0.5));
        slot.add(this.add.text(58, 54, `+${assigned.sword.n}`, { fontSize: '23px', color: '#293442', fontStyle: 'bold', stroke: '#ffffff', strokeThickness: 5 }).setOrigin(0.5));
      }
      this.action.add(slot);
      for (let i = 1; i < 3; i += 1) {
        this.action.add(makeButton(this, L.actionBar.slots[i]!.x + L.actionBar.slotW / 2, (L.actionBar.y0 + L.actionBar.y1) / 2, '◇', () => {}, { width: L.actionBar.slotW, height: L.actionBar.y1 - L.actionBar.y0, fontSize: 42, disabled: true }));
      }
      this.action.add(
        makeButton(
          this,
          L.actionBar.right.x + L.actionBar.right.w / 2,
          (L.actionBar.y0 + L.actionBar.y1) / 2,
          mining ? '내보내기' : '다시\n부르기',
          () => {
            this.sim.toggleMiner();
            this.renderAction();
            this.refreshTooltip();
          },
          { width: L.actionBar.right.w, height: L.actionBar.y1 - L.actionBar.y0, fontSize: mining ? 23 : 27, fill: 0xc7dfb1, disabled: !assigned },
        ),
      );
    }
  }

  update(): void {
    const state = this.sim.snapshot();
    const remaining = state.phase === 'mobs'
      ? Math.max(0, constants.wave.mobPhaseSec - state.phaseTime)
      : state.phase === 'warning'
        ? Math.max(0, constants.wave.warningSec - state.phaseTime)
        : 0;
    this.materialsLabel.setText(String(state.materials));
    this.values.setText(`◷ ${Math.ceil(remaining)}     ${'●'.repeat(state.wave)}${'○'.repeat(state.waveCount - state.wave)}`);
    this.wall.clear().fillStyle(0x293442, 0.85).fillRect(0, L.wallBar.y0, L.W, 40).fillStyle(state.wallHp / state.wallMax < 0.25 ? COLORS.red : COLORS.green, 1).fillRect(8, L.wallBar.y0 + 8, (L.W - 16) * Math.max(0, state.wallHp / state.wallMax), 24);
    this.drawSpiritGauge(state.forge.spiritCounter, state.forge.trait, state.forge.avatarReady, this.time.now);
    this.drawRecoverProgress();
    this.speedLabel.setText(`×${state.speed}`);
    const info = this.swordPanel?.getByName('current-forge') as Phaser.GameObjects.Text | null | undefined;
    if (info) info.setText(`${state.forge.avatarReady ? '★' : state.forge.trait ? '◆' : '◇'} +${state.forge.n}`);
    this.refreshTooltip();
  }

  private forgeAxis(trait: string | null, avatarReady: boolean): HoloAxis | null {
    if (avatarReady) return 'order';
    if (!trait) return null;
    return traitData.traits.find((entry) => entry.id === trait)?.axis === 'chaos' ? 'chaos' : 'order';
  }

  /**
   * "장인의 기운" — ten pips along the bottom of the forge building fill as the spirit
   * counter climbs; once a spirit has landed (the forge sword carries a trait) the building
   * and the current-sword panel go fully holographic in that spirit's colour.
   */
  private drawSpiritGauge(counter: number, trait: string | null, avatarReady: boolean, time: number): void {
    const rect = L.buildings.forge;
    const traitAxis = this.forgeAxis(trait, avatarReady);
    const axis = this.reveal?.axis ?? null;
    const pips = constants.forge.spirit.pityClicks;
    const filled = axis ? pips : Math.min(pips, counter);
    const gap = 5;
    const pipW = (rect.w - 28 - gap * (pips - 1)) / pips;
    const y = rect.y + rect.h - 30;
    const g = this.forgeFill.clear();
    g.fillStyle(0x293442, 0.55).fillRoundedRect(rect.x + 10, y - 6, rect.w - 20, 22, 8);
    for (let i = 0; i < pips; i += 1) {
      const x = rect.x + 14 + i * (pipW + gap);
      const lit = i < filled;
      const glow = lit ? 0.75 + 0.25 * Math.sin(time * 0.008 + i * 0.6) : 0.18;
      const color = axis ? Phaser.Display.Color.HSVToRGB(((time * 0.0004 + i * 0.09) % 1 + 1) % 1, axis === 'chaos' ? 0.85 : 0.55, 1).color : lit ? COLORS.gold : 0xffffff;
      g.fillStyle(color, glow).fillRoundedRect(x, y - 2, pipW, 14, 4);
    }
    this.spiritLabel.setText(axis ? (avatarReady ? '신의 강림!' : axis === 'chaos' ? '혼돈의 기운!' : '질서의 기운!') : `장인의 기운 ${Math.min(pips, counter)}/${pips}`);
    this.spiritLabel.setColor(axis === 'chaos' ? '#ffd0e0' : axis === 'order' ? '#d8f6ff' : '#ffffff');
    if ((this.forgeHolo?.axis ?? null) !== axis) {
      this.forgeHolo?.destroy();
      this.forgeHolo = axis ? holoOutline(this, rect.x, rect.y, rect.w, rect.h, 30, axis, 12) : null;
      if (axis) this.tweens.add({ targets: this.forgeButton, scale: { from: 1.06, to: 1 }, duration: 260, ease: 'Back.easeOut' });
    }
    this.forgeHolo?.update(time);
    if (this.swordPanel && (this.swordHolo?.axis ?? null) !== traitAxis) {
      this.swordHolo?.destroy();
      this.swordHolo = traitAxis ? holoOutline(this, 70, L.actionBar.y0, 210, L.actionBar.y1 - L.actionBar.y0, 32, traitAxis, 25) : null;
    }
    this.swordHolo?.update(time + 700);
  }

  /**
   * Spirit landed: flash, sparkle the forge for a moment, lock enhancing, and announce the
   * trait in the middle of the screen. Afterwards the forge returns to normal with the
   * gauge back at 0 (the forge sword keeps the trait — the sword panel stays marked).
   */
  private revealSpirit(axis: HoloAxis): void {
    const forge = this.sim.forge;
    const trait = forge.trait ? traitData.traits.find((entry) => entry.id === forge.trait) : undefined;
    const avatar = forge.avatarReady;
    const holdMs = 1900;
    this.reveal = { axis, until: this.time.now + holdMs };

    // Flash.
    const flash = this.add.rectangle(540, 960, 1080, 1920, axis === 'chaos' ? 0xffd6e4 : 0xe4f8ff, 0.85).setDepth(90);
    this.tweens.add({ targets: flash, alpha: 0, duration: 520, ease: 'Quad.easeOut', onComplete: () => flash.destroy() });
    this.cameras.main.shake(140, 0.004);

    // Centre card.
    const title = avatar ? '신의 강림!' : axis === 'chaos' ? '혼돈의 기운!' : '질서의 기운!';
    const accent = axis === 'chaos' ? 0xffdce6 : 0xdff4ff;
    const card = this.add.container(540, 900).setDepth(92).setScale(0.6).setAlpha(0);
    card.add(paperPanel(this, -420, -190, 840, 380, accent));
    card.add(this.add.text(0, -110, title, { fontSize: '58px', color: axis === 'chaos' ? '#b8325e' : '#2d78a8', fontStyle: 'bold', stroke: '#ffffff', strokeThickness: 8 }).setOrigin(0.5));
    card.add(this.add.text(0, -18, avatar ? '데미갓' : trait?.name ?? '', { fontSize: '46px', color: '#293442', fontStyle: 'bold' }).setOrigin(0.5));
    card.add(this.add.text(0, 90, avatar ? '보급 시 가장 튼튼한 병사가 신의 화신으로 강림합니다.' : trait?.desc ?? '', { fontSize: '26px', color: '#53616b', align: 'center', wordWrap: { width: 740 }, lineSpacing: 8 }).setOrigin(0.5));
    const outline = holoOutline(this, -420, -190, 840, 380, 32, axis, 0);
    card.add(outline.graphics);
    const tick = (): void => outline.update(this.time.now);
    this.events.on(Phaser.Scenes.Events.UPDATE, tick);
    this.tweens.add({ targets: card, scale: 1, alpha: 1, duration: 320, ease: 'Back.easeOut' });
    this.time.delayedCall(holdMs - 350, () => this.tweens.add({ targets: card, alpha: 0, scale: 0.9, duration: 300, ease: 'Quad.easeIn', onComplete: () => { this.events.off(Phaser.Scenes.Events.UPDATE, tick); card.destroy(true); } }));

    // Unlock: forge back to normal, gauge already at 0 from the sim.
    this.time.delayedCall(holdMs, () => {
      this.reveal = null;
      this.renderAction();
      this.refreshTooltip();
    });
  }

  /** Hospital-style "+" badge: white cross on a red rounded disc, used for the barracks recover button. */
  private medicalCross(): Phaser.GameObjects.Graphics {
    const g = this.add.graphics();
    g.fillStyle(0xd94b5d, 1).lineStyle(6, COLORS.ink, 1).fillCircle(0, 4, 50).strokeCircle(0, 4, 50);
    g.fillStyle(0xffffff, 0.35).fillEllipse(-12, -16, 34, 22);
    g.fillStyle(0xffffff, 1).fillRoundedRect(-12, -28, 24, 64, 6).fillRoundedRect(-32, -8, 64, 24, 6);
    return g;
  }

  /** Grey chains crossing the slot in an X, with a small padlock at the crossing — "no unit of this class this stage". */
  private chainLock(width: number, height: number): Phaser.GameObjects.Graphics {
    const g = this.add.graphics();
    const links = 7;
    const drawChain = (dir: 1 | -1): void => {
      for (let i = 0; i <= links; i += 1) {
        const t = i / links;
        const x = -width / 2 + 18 + (width - 36) * t;
        const y = dir * (-height / 2 + 18 + (height - 36) * t);
        const angle = Math.atan2(dir * (height - 36), width - 36);
        const cos = Math.cos(angle); const sin = Math.sin(angle);
        // Each link is a small rounded rectangle rotated along the chain direction.
        const w = 22; const h = 12;
        const corners = [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]].map(([px, py]) => ({ x: x + px! * cos - py! * sin, y: y + px! * sin + py! * cos }));
        g.fillStyle(i % 2 ? 0x8d8d86 : 0xa9a9a1, 1).lineStyle(3, 0x4b4b47, 1).fillPoints(corners, true).strokePoints(corners, true);
      }
    };
    drawChain(1);
    drawChain(-1);
    g.fillStyle(0x6e6e68, 1).lineStyle(4, 0x3d3d3a, 1).fillRoundedRect(-22, -10, 44, 36, 8).strokeRoundedRect(-22, -10, 44, 36, 8);
    g.lineStyle(6, 0x8d8d86, 1).beginPath().arc(0, -12, 13, Math.PI, 0, false).strokePath();
    g.fillStyle(0x2f2f2c, 1).fillCircle(0, 6, 5).fillRect(-2, 6, 4, 10);
    return g;
  }

  /**
   * While a unit is in the barracks bed, a green stroke grows clockwise along the recover
   * button's outline (top-centre → full loop = healed) with the seconds left under the cross.
   * A unit still running back to the wall shows a pulsing partial ring instead.
   */
  private drawRecoverProgress(): void {
    if (!this.recoverRing || !this.recoverText) return;
    const resting = this.sim.units.find((unit) => unit.state === 'resting');
    const incoming = !resting && this.sim.units.find((unit) => unit.state === 'returning' && unit.returnState === 'resting');
    const g = this.recoverRing.clear();
    if (!resting && !incoming) { this.recoverText.setText(''); return; }
    const total = constants.stun.cooldownSec / constants.stun.restSpeedMultiplier;
    const progress = resting ? Math.max(0, Math.min(1, 1 - resting.restTimer / total)) : 0.08 + 0.04 * Math.sin(this.time.now * 0.01);
    const w = L.actionBar.right.w + 10; const h = L.actionBar.y1 - L.actionBar.y0 + 10;
    const cx = L.actionBar.right.x + L.actionBar.right.w / 2; const cy = (L.actionBar.y0 + L.actionBar.y1) / 2;
    const points = roundedRectPerimeter(cx - w / 2, cy - h / 2, w, h, 34, progress);
    if (points.length > 1) {
      g.lineStyle(16, 0x293442, 0.35).strokePoints(points, false);
      g.lineStyle(9, resting ? COLORS.green : 0xf0c66f, 1).strokePoints(points, false);
      const tip = points[points.length - 1]!;
      g.fillStyle(0xffffff, 1).fillCircle(tip.x, tip.y, 7);
    }
    this.recoverText.setText(resting ? `${Math.ceil(resting.restTimer)}초` : '이동 중');
  }

  private showMenu(): void {
    if (this.menuLayer) return;
    this.scene.pause('Battle');
    const bg = paperPanel(this, 90, 390, 900, 1120, 0xfff8e7);
    this.menuLayer = this.add.container(0, 0, [bg]).setDepth(100);
    this.menuLayer.add(this.add.text(540, 515, '일시정지', { fontSize: '65px', color: '#293442', fontStyle: 'bold' }).setPadding(10, 18, 10, 8).setOrigin(0.5));
    this.menuLayer.add(makeButton(this, 540, 730, session.save.sound ? 'BGM 켜짐' : 'BGM 꺼짐', () => { toggleBgm(this, 'bgm-ingame'); this.closeMenu(); this.showMenu(); }, { width: 560 }));
    this.menuLayer.add(makeButton(this, 540, 900, '스테이지 포기', () => { this.scene.stop('Battle'); this.scene.stop(); this.scene.start('Lobby'); }, { width: 560, fill: 0xe9c48b }));
    this.menuLayer.add(makeButton(this, 540, 1070, '게임 초기화', () => { if (window.confirm('모든 진행을 초기화할까요?') && window.confirm('정말 삭제할까요? 되돌릴 수 없습니다.')) { session.save = resetSave(); window.location.reload(); } }, { width: 560, fill: 0xe6a0a0 }));
    this.menuLayer.add(makeButton(this, 540, 1320, '계속', () => this.closeMenu(), { width: 560, fill: 0x9dca8d }));
  }

  private closeMenu(): void {
    this.menuLayer?.destroy(true);
    this.menuLayer = undefined;
    this.scene.resume('Battle');
  }
}

/**
 * Points along a rounded rectangle's perimeter, starting at the top-centre and going
 * clockwise, covering `fraction` (0..1) of the total length.
 */
function roundedRectPerimeter(x: number, y: number, w: number, h: number, r: number, fraction: number): { x: number; y: number }[] {
  const radius = Math.min(r, w / 2, h / 2);
  const straightW = w - radius * 2; const straightH = h - radius * 2; const arc = (Math.PI / 2) * radius;
  const total = straightW * 2 + straightH * 2 + arc * 4;
  const target = Math.max(0, Math.min(1, fraction)) * total;
  const steps = 96;
  const points: { x: number; y: number }[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const d = (i / steps) * target;
    points.push(pointAtDistance(x, y, w, h, radius, straightW, straightH, arc, d));
  }
  return points;
}

function pointAtDistance(x: number, y: number, w: number, h: number, r: number, sw: number, sh: number, arc: number, d: number): { x: number; y: number } {
  // Segments clockwise from top-centre: top-right half, TR arc, right, BR arc, bottom, BL arc, left, TL arc, top-left half.
  let rem = d;
  const halfTop = sw / 2;
  if (rem <= halfTop) return { x: x + w / 2 + rem, y };
  rem -= halfTop;
  if (rem <= arc) { const a = -Math.PI / 2 + (rem / arc) * (Math.PI / 2); return { x: x + w - r + Math.cos(a) * r, y: y + r + Math.sin(a) * r }; }
  rem -= arc;
  if (rem <= sh) return { x: x + w, y: y + r + rem };
  rem -= sh;
  if (rem <= arc) { const a = (rem / arc) * (Math.PI / 2); return { x: x + w - r + Math.cos(a) * r, y: y + h - r + Math.sin(a) * r }; }
  rem -= arc;
  if (rem <= sw) return { x: x + w - r - rem, y: y + h };
  rem -= sw;
  if (rem <= arc) { const a = Math.PI / 2 + (rem / arc) * (Math.PI / 2); return { x: x + r + Math.cos(a) * r, y: y + h - r + Math.sin(a) * r }; }
  rem -= arc;
  if (rem <= sh) return { x, y: y + h - r - rem };
  rem -= sh;
  if (rem <= arc) { const a = Math.PI + (rem / arc) * (Math.PI / 2); return { x: x + r + Math.cos(a) * r, y: y + r + Math.sin(a) * r }; }
  rem -= arc;
  return { x: x + r + Math.min(rem, halfTop), y };
}
