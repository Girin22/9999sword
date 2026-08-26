import Phaser from 'phaser';
import { addBgmToggle } from '../audio/bgm';
import { byId, growthData, optionsData, stageData, traitData, unitData } from '../data';
import { session } from '../session';
import { FOOD_WARNING_SLACK, foodLimitFor } from '../sim/food';
import { persistSave } from '../sim/save';
import { addSheetSprite, COLORS, iconLabel, makeButton, paperPanel, sizeSheetSprite, titleText, type IconLabel } from '../ui/components';

type LobbyTab = 'upgrade' | 'recipes';
type UpgradeCategory = 'unit' | 'util' | 'building';
const UPGRADE_TABS: { id: UpgradeCategory; label: string }[] = [
  { id: 'unit', label: '유닛' },
  { id: 'util', label: '유틸' },
  { id: 'building', label: '건물' },
];

/** Hidden developer refill on the lobby diamond chip. */
const DEV_TAP_COUNT = 5;
const DEV_TAP_WINDOW_MS = 1500;
const DEV_SHARDS = 9999;

export class Lobby extends Phaser.Scene {
  private popup!: Phaser.GameObjects.Container;
  private stageLayer!: Phaser.GameObjects.Container;
  private tab: LobbyTab | null = null;
  private shopPage = 0;
  private upgradeTab: UpgradeCategory = 'unit';
  private recipePage = 0;
  private stageIndex = 0;
  private currencyLabel!: IconLabel;

  constructor() {
    super('Lobby');
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COLORS.paper);
    this.drawBackdrop();
    titleText(this, 92, '9999+검키우기', 58);
    // Currency chip on the left, styled like the BGM toggle on the right.
    this.add.graphics()
      .fillStyle(0x283442, 0.16).fillRoundedRect(44, 55, 250, 98, 26)
      .fillStyle(0xdceff4, 1).lineStyle(7, COLORS.ink, 1).fillRoundedRect(40, 43, 250, 98, 26).strokeRoundedRect(40, 43, 250, 98, 26)
      .lineStyle(3, 0xffffff, 0.35).strokeRoundedRect(48, 51, 234, 82, 18);
    this.currencyLabel = iconLabel(this, 66, 92, 'icon-diamond', String(session.save.shards), {
      fontSize: '36px', color: '#293442', fontStyle: 'bold',
    });
    this.installDevRefill();
    addBgmToggle(this, 'bgm-lobby', 985, 92);

    const selected = stageData.stages.findIndex((stage) => stage.id === session.stageId);
    this.stageIndex = selected >= 0 ? selected : 0;
    if (!this.unlocked(stageData.stages[this.stageIndex]!.id)) {
      this.stageIndex = stageData.stages.reduce((last, stage, index) => this.unlocked(stage.id) ? index : last, 0);
    }

    this.stageLayer = this.add.container(0, 0);
    this.popup = this.add.container(0, 0).setDepth(60);
    this.renderStage();
    this.buildBottomButton(190, '출격 준비', 1, () => this.openFormation(), 0xf0c66f);
    this.buildBottomButton(540, '업그레이드', 0, () => this.openTab('upgrade'), 0xe4a779);
    this.buildBottomButton(890, '레시피', 2, () => this.openTab('recipes'), 0xa9c98e);
  }

  /**
   * Developer cheat: tap the diamond chip 5 times within 1.5 s to refill shards to 9999.
   * Invisible otherwise — no button, just the hidden hit zone over the chip.
   */
  private installDevRefill(): void {
    let taps = 0;
    let firstTapAt = 0;
    this.add.zone(165, 92, 250, 98).setInteractive().on('pointerdown', () => {
      const now = this.time.now;
      if (now - firstTapAt > DEV_TAP_WINDOW_MS) { taps = 0; firstTapAt = now; }
      taps += 1;
      if (taps < DEV_TAP_COUNT) return;
      taps = 0;
      session.save.shards = DEV_SHARDS;
      persistSave(session.save);
      this.currencyLabel.setText(String(session.save.shards));
      this.tweens.add({ targets: this.currencyLabel.root, scale: { from: 1.25, to: 1 }, duration: 260, ease: 'Back.easeOut' });
      this.cameras.main.flash(180, 120, 200, 255);
      if (this.tab) this.renderPopup();
    });
  }

  private drawBackdrop(): void {
    const lines = this.add.graphics().lineStyle(2, 0xcdbf9b, 0.2);
    for (let y = 175; y < 1840; y += 62) lines.lineBetween(0, y, 1080, y);
    this.add.graphics().fillStyle(0x8fb66c, 0.14).fillCircle(80, 1330, 255).fillCircle(1020, 1370, 285);
  }

  private buildBottomButton(x: number, label: string, artIndex: number, onTap: () => void, fill: number): void {
    const button = makeButton(this, x, 1640, label, onTap, { width: 300, height: 310, fontSize: 36, fill });
    const labelText = button.list.find((child) => child instanceof Phaser.GameObjects.Text) as Phaser.GameObjects.Text;
    labelText.setY(102);
    button.add(sizeSheetSprite(addSheetSprite(this, 'buildings-sheet', artIndex, 3), 220, 190).setY(-43));
  }

  private renderStage(): void {
    this.stageLayer.removeAll(true);
    const stage = stageData.stages[this.stageIndex]!;
    const open = this.unlocked(stage.id);
    session.stageId = stage.id;
    this.stageLayer.add(paperPanel(this, 160, 250, 760, 1010, 0xffefd2));
    this.stageLayer.add(this.add.text(540, 318, stage.bossName ?? stage.name, {
      fontSize: '48px', color: '#293442', fontStyle: 'bold', stroke: '#fafafa', strokeThickness: 7,
    }).setOrigin(0.5));
    this.stageLayer.add(this.add.text(540, 385, `${stage.id === 'INF' ? '무한 모드' : `스테이지 ${this.stageIndex + 1}`} · ${stage.name}`, {
      fontSize: '28px', color: '#53616b', fontStyle: 'bold',
    }).setOrigin(0.5));
    const portrait = this.add.graphics().fillStyle(0x8dc5aa, 0.24).lineStyle(7, COLORS.ink, 0.85)
      .fillRoundedRect(258, 435, 564, 560, 42).strokeRoundedRect(258, 435, 564, 560, 42);
    this.stageLayer.add(portrait);
    const art = sizeSheetSprite(addSheetSprite(this, 'stage-bosses-sheet', this.stageIndex, 4), 760, 760).setPosition(540, 718).setAlpha(open ? 1 : 0.28);
    this.stageLayer.add(art);
    if (!open) this.stageLayer.add(this.add.text(540, 710, '잠김', { fontSize: '72px', color: '#ffffff', fontStyle: 'bold', stroke: '#293442', strokeThickness: 12 }).setOrigin(0.5));
    this.stageLayer.add(this.add.text(540, 1040, `식량 ${foodLimitFor(stage.id, session.save)}   ·   ${stage.id === 'INF' ? '무한 웨이브' : '5 웨이브'}`, {
      fontSize: '30px', color: '#53616b', fontStyle: 'bold',
    }).setOrigin(0.5));
    this.stageLayer.add(makeButton(this, 540, 1145, open ? '시작' : '이전 스테이지 클리어 필요', () => this.startBattle(), {
      width: 520, height: 105, fill: open ? 0xf5c95d : 0xaaa69a, disabled: !open, fontSize: open ? 44 : 27,
    }));
    this.stageLayer.add(makeButton(this, 95, 720, '‹', () => {
      this.stageIndex = (this.stageIndex - 1 + stageData.stages.length) % stageData.stages.length;
      this.renderStage();
    }, { width: 105, height: 150, fill: 0xd8cbaa, fontSize: 72 }));
    this.stageLayer.add(makeButton(this, 985, 720, '›', () => {
      this.stageIndex = (this.stageIndex + 1) % stageData.stages.length;
      this.renderStage();
    }, { width: 105, height: 150, fill: 0xd8cbaa, fontSize: 72 }));
  }

  private unlocked(id: string): boolean {
    return id === 'S1' || (id === 'S2' && session.save.cleared.S1) || (id === 'S3' && session.save.cleared.S2) || (id === 'INF' && session.save.cleared.S3);
  }

  private openFormation(): void {
    session.stageId = stageData.stages[this.stageIndex]!.id;
    this.scene.start('Formation');
  }

  private startBattle(): void {
    const stage = stageData.stages[this.stageIndex]!;
    const saved = session.save.lastFormation.units.filter((id) => session.save.unlockedUnits.includes(id));
    const limit = foodLimitFor(stage.id, session.save);
    while (saved.reduce((sum, id) => sum + byId(unitData.units, id).food, 0) > limit) saved.pop();
    if (!saved.length) {
      this.openFormation();
      return;
    }
    const food = saved.reduce((sum, id) => sum + byId(unitData.units, id).food, 0);
    if (food <= limit - FOOD_WARNING_SLACK) {
      this.showFoodWarning(food, limit, () => this.enterBattle(stage.id, saved));
      return;
    }
    this.enterBattle(stage.id, saved);
  }

  private enterBattle(stageId: string, units: string[]): void {
    session.stageId = stageId;
    session.formation = [...units];
    session.miner = units.includes(session.save.lastFormation.miner ?? '') ? session.save.lastFormation.miner : units[0]!;
    this.scene.start('Battle');
  }

  private showFoodWarning(food: number, limit: number, onEnter: () => void): void {
    this.tab = null;
    this.popup.removeAll(true);
    this.popup.add(this.add.rectangle(540, 960, 1080, 1920, 0x24303a, 0.58).setInteractive().on('pointerdown', () => this.popup.removeAll(true)));
    const panel = paperPanel(this, 120, 690, 840, 540, 0xfff6dc);
    this.popup.add(panel);
    this.popup.add(this.add.rectangle(540, 960, 840, 540).setInteractive());
    this.popup.add(this.add.text(540, 780, '식량이 많이 남았어요', {
      fontSize: '46px', color: '#293442', fontStyle: 'bold',
    }).setOrigin(0.5));
    this.popup.add(this.add.text(540, 905, `현재 편성은 식량 ${food} / ${limit}만 사용합니다.\n최대 식량에 가깝게 편성하면 훨씬 안정적으로 싸울 수 있어요.\n이대로 입장할까요?`, {
      fontSize: '27px', color: '#53616b', align: 'center', lineSpacing: 12,
    }).setOrigin(0.5));
    this.popup.add(makeButton(this, 335, 1110, '출격 편성', () => this.openFormation(), { width: 340, height: 100, fill: 0xd9cbb1, fontSize: 36 }));
    this.popup.add(makeButton(this, 720, 1110, '입장', () => { this.popup.removeAll(true); onEnter(); }, { width: 340, height: 100, fill: 0xf5c95d, fontSize: 40 }));
  }

  private openTab(tab: LobbyTab): void {
    this.tab = tab;
    this.renderPopup();
  }

  private closeTab(): void {
    this.tab = null;
    this.popup.removeAll(true);
  }

  private renderPopup(): void {
    this.popup.removeAll(true);
    if (!this.tab) return;
    this.popup.add(this.add.rectangle(540, 960, 1080, 1920, 0x24303a, 0.58).setInteractive());
    this.popup.add(paperPanel(this, 45, 115, 990, 1655, 0xfff6dc));
    this.popup.add(this.add.text(540, 205, this.tab === 'upgrade' ? '업그레이드' : '검 레시피 도감', {
      fontSize: '56px', color: '#293442', fontStyle: 'bold',
    }).setOrigin(0.5));
    if (this.tab === 'upgrade') this.renderUpgrade();
    else this.renderRecipes();
    this.popup.add(makeButton(this, 540, 1665, '뒤로', () => this.closeTab(), { width: 420, height: 92, fill: 0xd9cbb1, fontSize: 36 }));
  }

  private renderUpgrade(): void {
    // Category tabs so the player can tell at a glance what kind of upgrade each entry is.
    UPGRADE_TABS.forEach((tab, index) => {
      const active = tab.id === this.upgradeTab;
      this.popup.add(makeButton(this, 260 + index * 280, 310, tab.label, () => {
        if (this.upgradeTab === tab.id) return;
        this.upgradeTab = tab.id;
        this.shopPage = 0;
        this.renderPopup();
      }, { width: 250, height: 84, fontSize: 32, fill: active ? 0xf5c95d : 0xe6dcc4, stroke: active ? COLORS.ink : 0x8e8778 }));
    });

    const unitGrowth = growthData.items.find((item) => item.id === 'unitUpgrade')!;
    const entries = this.upgradeTab === 'unit'
      ? session.save.unlockedUnits.map((unitId) => ({ item: unitGrowth, unitId: unitId as string | null, label: `${byId(unitData.units, unitId).name} 기본 능력` }))
      : growthData.items.filter((item) => item.category === this.upgradeTab).map((item) => ({ item, unitId: null as string | null, label: item.name }));
    const pageSize = 4;
    const page = entries.slice(this.shopPage * pageSize, this.shopPage * pageSize + pageSize);
    page.forEach((entry, index) => {
      const y = 445 + index * 255;
      const level = entry.unitId ? session.save.unitUpgrades[entry.unitId]! : session.save.growth[entry.item.id as keyof typeof session.save.growth];
      const current = entry.item.levels[level]!;
      const next = entry.item.levels[level + 1];
      const maxed = !next;
      const affordable = Boolean(next) && session.save.shards >= (next?.price ?? 0);
      this.popup.add(paperPanel(this, 105, y - 65, 870, 210, 0xffeed1));
      this.popup.add(this.add.text(150, y - 16, entry.label, { fontSize: '36px', color: '#293442', fontStyle: 'bold' }));
      this.popup.add(this.add.text(152, y + 45, `Lv.${level + 1}${maxed ? ' (최대)' : ''}  ·  ${String(current.value)}`, { fontSize: '27px', color: '#53616b' }));
      const buy = makeButton(this, 820, y + 40, maxed ? '완료' : '', () => {
        if (!next || session.save.shards < next.price) return;
        session.save.shards -= next.price;
        if (entry.unitId) session.save.unitUpgrades[entry.unitId] = level + 1;
        else session.save.growth[entry.item.id as keyof typeof session.save.growth] += 1;
        persistSave(session.save);
        this.currencyLabel.setText(String(session.save.shards));
        this.renderPopup();
      }, { width: 250, height: 92, fill: affordable ? 0xf5c95d : 0xb6b2a5, disabled: !affordable, fontSize: 30 });
      if (next) buy.add(iconLabel(this, 0, 0, 'icon-diamond', String(next.price), { fontSize: '30px', color: '#293442', fontStyle: 'bold' }, 'center').root);
      this.popup.add(buy);
    });
    const maxPage = Math.max(0, Math.ceil(entries.length / pageSize) - 1);
    this.popup.add(makeButton(this, 350, 1470, '이전', () => { this.shopPage = Math.max(0, this.shopPage - 1); this.renderPopup(); }, { width: 170, height: 78, disabled: this.shopPage === 0, fontSize: 28 }));
    this.popup.add(this.add.text(540, 1470, `${this.shopPage + 1} / ${maxPage + 1}`, { fontSize: '28px', color: '#53616b' }).setOrigin(0.5));
    this.popup.add(makeButton(this, 730, 1470, '다음', () => { this.shopPage = Math.min(maxPage, this.shopPage + 1); this.renderPopup(); }, { width: 170, height: 78, disabled: this.shopPage === maxPage, fontSize: 28 }));
  }

  private recipeInfo(id: string): { name: string; category: string; description: string; swordIndex: number } {
    if (id.startsWith('opt:')) {
      const optionId = id.slice(4);
      const option = optionsData.options.find((entry) => entry.id === optionId);
      return { name: option?.name ?? '부가 옵션', category: '부가 옵션 레시피', description: option?.desc ?? '검에 새로운 효과를 부여합니다.', swordIndex: Math.max(0, optionsData.options.findIndex((entry) => entry.id === optionId)) % 9 };
    }
    if (id.startsWith('anvil:')) {
      const lines = Number(id.slice(6));
      return { name: `${lines}줄 모루`, category: '대장간 레시피', description: `검에 붙는 효과를 최대 ${lines}줄까지 확장합니다.`, swordIndex: Math.max(0, lines - 1) % 9 };
    }
    const trait = traitData.traits.find((entry) => entry.id === id);
    return { name: trait ? `${trait.name}의 검` : '특성 검', category: trait?.axis === 'chaos' ? '혼돈 특성 레시피' : '질서 특성 레시피', description: trait?.desc ?? '새로운 검 특성을 해금합니다.', swordIndex: Math.max(0, traitData.traits.findIndex((entry) => entry.id === id)) % 9 };
  }

  private renderRecipes(): void {
    const ids = [...session.save.recipes, ...session.save.optionRecipes];
    if (!ids.length) {
      this.popup.add(sizeSheetSprite(addSheetSprite(this, 'buildings-sheet', 2, 3), 400, 340).setPosition(540, 760).setAlpha(0.5));
      this.popup.add(this.add.text(540, 1050, '아직 발견한 레시피가 없습니다.\n보스를 쓰러뜨리면 새로운 검을 수집할 수 있어요.', {
        fontSize: '32px', color: '#53616b', align: 'center', lineSpacing: 13,
      }).setOrigin(0.5));
      return;
    }
    const pageSize = 6;
    const maxPage = Math.max(0, Math.ceil(ids.length / pageSize) - 1);
    this.recipePage = Math.min(this.recipePage, maxPage);
    ids.slice(this.recipePage * pageSize, this.recipePage * pageSize + pageSize).forEach((id, index) => {
      const info = this.recipeInfo(id);
      const col = index % 2;
      const row = Math.floor(index / 2);
      const x = 82 + col * 475;
      const y = 300 + row * 350;
      this.popup.add(paperPanel(this, x, y, 442, 310, info.category.startsWith('혼돈') ? 0xffdce3 : 0xe2f3f8));
      this.popup.add(sizeSheetSprite(addSheetSprite(this, 'swords-sheet', info.swordIndex, 3, 3), 120, 190).setPosition(x + 83, y + 145));
      this.popup.add(this.add.text(x + 158, y + 43, info.name, { fontSize: '31px', color: '#293442', fontStyle: 'bold', wordWrap: { width: 245 } }));
      this.popup.add(this.add.text(x + 160, y + 93, info.category, { fontSize: '21px', color: info.category.startsWith('혼돈') ? '#b84c68' : '#3d84a5', fontStyle: 'bold' }));
      this.popup.add(this.add.text(x + 158, y + 137, info.description, { fontSize: '22px', color: '#53616b', lineSpacing: 7, wordWrap: { width: 245 } }));
    });
    this.popup.add(makeButton(this, 350, 1410, '이전', () => { this.recipePage = Math.max(0, this.recipePage - 1); this.renderPopup(); }, { width: 170, height: 78, disabled: this.recipePage === 0, fontSize: 28 }));
    this.popup.add(this.add.text(540, 1410, `${this.recipePage + 1} / ${maxPage + 1}`, { fontSize: '28px', color: '#53616b' }).setOrigin(0.5));
    this.popup.add(makeButton(this, 730, 1410, '다음', () => { this.recipePage = Math.min(maxPage, this.recipePage + 1); this.renderPopup(); }, { width: 170, height: 78, disabled: this.recipePage === maxPage, fontSize: 28 }));
  }
}
