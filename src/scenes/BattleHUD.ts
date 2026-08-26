import Phaser from 'phaser';
import { addBgmToggle, toggleBgm } from '../audio/bgm';
import { constants, swordData, traitData, unitData } from '../data';
import { session } from '../session';
import { BattleSimulation, traitName } from '../sim/battle';
import { attackAtLevel, forgeCost } from '../sim/forge';
import { resetSave } from '../sim/save';
import { addSheetSprite, animateHolo, applyHolo, clearHolo, COLORS, iconLabel, makeButton, paperPanel, sizeSheetSprite, type HoloAxis, type HoloFx, type IconLabel } from '../ui/components';
import { L } from '../ui/layout';

type Building = 'forge' | 'barracks' | 'mine';

export class BattleHUD extends Phaser.Scene {
  private sim!: BattleSimulation;
  private selected: Building = 'forge';
  private action!: Phaser.GameObjects.Container;
  private materialsLabel!: IconLabel;
  private values!: Phaser.GameObjects.Text;
  private wall!: Phaser.GameObjects.Graphics;
  private forgeFill!: Phaser.GameObjects.Graphics;
  private spiritLabel!: Phaser.GameObjects.Text;
  private forgeButton!: Phaser.GameObjects.Container;
  private forgeHolo: HoloFx | null = null;
  private swordPanel?: Phaser.GameObjects.Container;
  private swordHolo: HoloFx | null = null;
  private selection!: Phaser.GameObjects.Graphics;
  private speedLabel!: Phaser.GameObjects.Text;
  private tooltipLayer?: Phaser.GameObjects.Container;
  private tooltipText?: Phaser.GameObjects.Text;
  private hovered?: Building;
  private menuLayer?: Phaser.GameObjects.Container;

  constructor() {
    super('BattleHUD');
  }

  init(data: { sim: BattleSimulation }): void {
    this.sim = data.sim;
  }

  create(): void {
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
    button.on('pointerout', () => this.hideTooltip());
  }

  private showTooltip(id: Building): void {
    this.hovered = id;
    this.tooltipLayer?.destroy(true);
    const bg = this.add.graphics().fillStyle(0x263442, 0.86).lineStyle(5, 0xffffff, 0.82).fillRoundedRect(85, 1060, 910, 190, 28).strokeRoundedRect(85, 1060, 910, 190, 28);
    this.tooltipText = this.add.text(540, 1155, '', { fontSize: '29px', color: '#ffffff', align: 'center', lineSpacing: 8, fontStyle: 'bold', wordWrap: { width: 820 } }).setPadding(10, 12, 10, 8).setOrigin(0.5);
    this.tooltipLayer = this.add.container(0, 0, [bg, this.tooltipText]).setDepth(45);
    this.refreshTooltip();
  }

  private hideTooltip(): void {
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
    this.swordPanel = undefined;
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
          this.sim.enhance();
          this.renderAction();
          this.refreshTooltip();
        },
        { width: buttonWidth, height: L.actionBar.y1 - L.actionBar.y0, fill: 0xf5c95d },
      );
      // Big label filling the button on the left, cost with the ore icon flush right.
      enhanceButton.add(this.add.text(-buttonWidth / 2 + 44, 0, '강화하기', { fontSize: '68px', color: '#293442', fontStyle: 'bold' }).setOrigin(0, 0.5));
      const cost = iconLabel(this, buttonWidth / 2 - 44, 0, 'icon-ore', String(forgeCost(this.sim.forge.n)), { fontSize: '44px', color: '#293442', fontStyle: 'bold' }, 'right');
      enhanceButton.add(cost.root);
      this.action.add(enhanceButton);
    } else if (this.selected === 'barracks') {
      const classes = [
        { id: 'knight' as const, icon: '♜' },
        { id: 'thrower' as const, icon: '➶' },
        { id: 'mage' as const, icon: '⚑' },
      ];
      classes.forEach((entry, index) => {
        const levels = this.sim.units.filter((unit) => unit.class === entry.id).map((unit) => unit.sword.n);
        const level = levels.length ? Math.max(...levels) : 0;
        this.action.add(
          makeButton(this, L.actionBar.slots[index]!.x + L.actionBar.slotW / 2, (L.actionBar.y0 + L.actionBar.y1) / 2, `${entry.icon}\n+${level}`, () => this.sim.supply(entry.id), {
            width: L.actionBar.slotW,
            height: L.actionBar.y1 - L.actionBar.y0,
            fontSize: 35,
            fill: 0xdce7eb,
          }),
        );
      });
      this.action.add(makeButton(this, L.actionBar.right.x + L.actionBar.right.w / 2, (L.actionBar.y0 + L.actionBar.y1) / 2, '♥', () => this.sim.recover(), { width: L.actionBar.right.w, height: L.actionBar.y1 - L.actionBar.y0, fontSize: 52, fill: 0xe5a2a2 }));
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
    const axis = this.forgeAxis(trait, avatarReady);
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
      if (axis) { this.forgeHolo = applyHolo(this.forgeButton, axis); this.tweens.add({ targets: this.forgeButton, scale: { from: 1.06, to: 1 }, duration: 260, ease: 'Back.easeOut' }); }
      else { clearHolo(this.forgeButton); this.forgeHolo = null; }
    }
    if (this.forgeHolo) animateHolo(this.forgeHolo, time);
    if (this.swordPanel && (this.swordHolo?.axis ?? null) !== axis) {
      if (axis) this.swordHolo = applyHolo(this.swordPanel, axis);
      else { clearHolo(this.swordPanel); this.swordHolo = null; }
    }
    if (this.swordHolo) animateHolo(this.swordHolo, time, 1.3);
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
