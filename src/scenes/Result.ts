import Phaser from 'phaser';
import { addBgmToggle } from '../audio/bgm';
import { byId, stageData } from '../data';
import { session } from '../session';
import { COLORS, makeButton, paperPanel, titleText } from '../ui/components';
import { hideGuide } from '../ui/guide';

export class Result extends Phaser.Scene {
  constructor() {
    super('Result');
  }

  create(): void {
    hideGuide();
    this.cameras.main.setBackgroundColor(COLORS.paper);
    const result = session.result;
    if (!result) {
      this.scene.start('Lobby');
      return;
    }

    titleText(this, 190, result.victory ? '승리!' : '패배', 82);
    addBgmToggle(this, 'bgm-lobby', 985, 92);
    paperPanel(this, 90, 330, 900, 1190);
    const stage = byId(stageData.stages, result.stageId);
    this.add.text(540, 430, stage.name, { fontSize: '48px', color: '#293442', fontStyle: 'bold' }).setPadding(8, 16, 8, 8).setOrigin(0.5);
    const rows = [
      `도달 웨이브      ${result.wave}`,
      `최고 강화        +${result.highestSword}`,
      `질서 / 혼돈      ${result.orderRolls} / ${result.chaosRolls}`,
      `쇠한 검          ${result.scrapped}`,
      `신의 파편        +${result.shards}`,
      `레시피           ${result.recipe ?? '없음'}`,
    ];
    this.add.text(180, 560, rows.join('\n\n'), { fontSize: '38px', color: '#3f4a52', lineSpacing: 22 }).setPadding(8, 14, 8, 8);
    const summary = result.victory
      ? `병사들이 +${result.highestSword} 검과 함께 성문을 지켜냈습니다.`
      : `${result.wave}번째 웨이브까지 버텼습니다. 다음 검은 더 단단해질 겁니다.`;
    this.add.text(540, 1360, summary, { fontSize: '31px', color: '#53616b', align: 'center', wordWrap: { width: 720 }, fontStyle: 'italic' }).setPadding(12, 14, 12, 8).setOrigin(0.5);
    makeButton(this, 540, 1650, '로비로', () => this.scene.start('Lobby'), { width: 520, height: 120, fill: 0xf5c95d, fontSize: 48 });
  }
}
