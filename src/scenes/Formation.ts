import Phaser from 'phaser';
import { addBgmToggle } from '../audio/bgm';
import { byId, unitData } from '../data';
import { session } from '../session';
import { foodLimitFor } from '../sim/food';
import { persistSave } from '../sim/save';
import { showGuide } from '../ui/guide';
import { addSheetSprite, COLORS, makeButton, paperPanel, sizeSheetSprite, titleText } from '../ui/components';

const PREFERRED_MINER = 'ireukkun';
/** 광산 담당 / 편성 초기화 share one width; 취소 / 완료 share another and sit centered as a pair. */
const STACK_BUTTON_W = 560;
const BOTTOM_BUTTON_W = 430;
const BOTTOM_GAP = 40;

export class Formation extends Phaser.Scene {
  private selected: string[] = [];
  private miner: string | null = null;
  private content!: Phaser.GameObjects.Container;

  constructor() {
    super('Formation');
  }

  create(): void {
    showGuide('formation');
    this.cameras.main.setBackgroundColor(COLORS.paper);
    const limit = foodLimitFor(session.stageId, session.save);
    this.selected = session.save.lastFormation.units.filter((id) => session.save.unlockedUnits.includes(id));
    while (this.food() > limit) this.selected.pop();
    this.miner = this.pickMiner(session.save.lastFormation.miner);

    this.drawBackdrop();
    titleText(this, 104, '출격 편성', 68);
    addBgmToggle(this, 'bgm-lobby', 985, 92);
    this.add.text(540, 168, '카드를 누를 때마다 병사가 한 명씩 추가됩니다', { fontSize: '26px', color: '#53616b' }).setOrigin(0.5);
    this.content = this.add.container(0, 0);
    this.render();

    makeButton(this, 540 - (BOTTOM_BUTTON_W + BOTTOM_GAP) / 2, 1820, '취소', () => this.scene.start('Lobby'), { width: BOTTOM_BUTTON_W, height: 110, fontSize: 40, fill: 0xd9cbb1 });
    makeButton(
      this,
      540 + (BOTTOM_BUTTON_W + BOTTOM_GAP) / 2,
      1820,
      '완료',
      () => {
        if (!this.selected.length) return;
        session.formation = [...this.selected];
        session.miner = this.miner;
        session.save.lastFormation = { units: [...this.selected], miner: this.miner };
        persistSave(session.save);
        this.scene.start('Lobby');
      },
      { width: BOTTOM_BUTTON_W, height: 110, fill: 0xf5c95d, fontSize: 40 },
    );
  }

  private drawBackdrop(): void {
    const lines = this.add.graphics().lineStyle(2, 0xcdbf9b, 0.2);
    for (let y = 210; y < 1760; y += 62) lines.lineBetween(0, y, 1080, y);
  }

  /** 이르꾼 is the designated miner whenever he is in the formation; otherwise keep the previous pick or the first unit. */
  private pickMiner(previous: string | null | undefined): string | null {
    if (this.selected.includes(PREFERRED_MINER)) return PREFERRED_MINER;
    if (previous && this.selected.includes(previous)) return previous;
    return this.selected[0] ?? null;
  }

  private food(): number {
    return this.selected.reduce((sum, id) => sum + byId(unitData.units, id).food, 0);
  }

  private render(): void {
    this.content.removeAll(true);
    const limit = foodLimitFor(session.stageId, session.save);
    const currentFood = this.food();
    const foodPanel = paperPanel(this, 260, 205, 560, 82, 0xffe6a6);
    this.content.add(foodPanel);
    this.content.add(
      this.add
        .text(540, 246, `식량  ${currentFood} / ${limit}`, {
          fontSize: '38px',
          color: currentFood <= limit ? '#293442' : '#c54f4f',
          fontStyle: 'bold',
        })
        .setOrigin(0.5),
    );

    session.save.unlockedUnits.forEach((id, index) => {
      const def = byId(unitData.units, id);
      const count = this.selected.filter((unitId) => unitId === id).length;
      const col = index % 2;
      const row = Math.floor(index / 2);
      const x = 65 + col * 490;
      const y = 325 + row * 285;
      const canAdd = currentFood + def.food <= limit;
      const panel = paperPanel(this, x, y, 460, 240, count ? 0xdceecb : 0xfff4dc);
      this.content.add(panel);
      const artIndex = unitData.units.findIndex((unit) => unit.id === id);
      const art = sizeSheetSprite(addSheetSprite(this, 'units-sheet', artIndex, 7), 180, 360).setPosition(x + 112, y + 124);
      art.setAlpha(canAdd || count ? 1 : 0.46);
      this.content.add(art);
      this.content.add(this.add.text(x + 205, y + 31, def.name, { fontSize: '35px', color: '#293442', fontStyle: 'bold' }));
      this.content.add(this.add.text(x + 207, y + 87, `${unitData.classes[def.class].name} · 식량 ${def.food}\n체력 ${def.hp} · 방어 ${def.def}`, { fontSize: '23px', color: '#53616b', lineSpacing: 8 }));
      const badge = this.add.circle(x + 412, y + 45, 36, count ? 0xf3bd54 : 0xc7c0ad).setStrokeStyle(5, COLORS.ink);
      const countText = this.add.text(x + 412, y + 45, `×${count}`, { fontSize: '26px', color: '#293442', fontStyle: 'bold' }).setOrigin(0.5);
      this.content.add([badge, countText]);
      const hit = this.add
        .zone(x + 230, y + 120, 460, 240)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
          if (this.food() + def.food > limit) {
            this.cameras.main.shake(90, 0.0025);
            return;
          }
          this.selected.push(id);
          this.miner = this.pickMiner(this.miner);
          this.render();
        });
      this.content.add(hit);
    });

    const uniqueSelected = [...new Set(this.selected)];
    const minerName = this.miner ? byId(unitData.units, this.miner).name : '없음';
    this.content.add(
      makeButton(
        this,
        540,
        1520,
        `광산 담당  ·  ${minerName}`,
        () => {
          if (!uniqueSelected.length) return;
          const index = uniqueSelected.indexOf(this.miner ?? '');
          this.miner = uniqueSelected[(index + 1) % uniqueSelected.length]!;
          this.render();
        },
        { width: STACK_BUTTON_W, height: 96, fill: 0xc7dfb1, fontSize: 32, disabled: !uniqueSelected.length },
      ),
    );
    this.content.add(
      makeButton(
        this,
        540,
        1640,
        '편성 초기화',
        () => {
          this.selected = [];
          this.miner = null;
          this.render();
        },
        { width: STACK_BUTTON_W, height: 96, fill: 0xe5c1ad, fontSize: 32, disabled: !this.selected.length },
      ),
    );
  }
}
