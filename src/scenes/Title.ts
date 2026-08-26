import Phaser from 'phaser';
import { addBgmToggle } from '../audio/bgm';
import { COLORS, makeButton } from '../ui/components';

export class Title extends Phaser.Scene {
  constructor() { super('Title'); }
  create(): void {
    this.cameras.main.setBackgroundColor(COLORS.paper);
    const image = this.add.image(540, 960, 'title-hero');
    image.setScale(Math.max(1080 / image.width, 1920 / image.height));
    // Two-line logo: the number on top, the title below.
    this.add.text(540, 500, '9999+', { fontSize: '132px', fontStyle: '900', color: '#e9b949', align: 'center', stroke: '#293442', strokeThickness: 18 }).setOrigin(0.5);
    this.add.text(540, 640, '검키우기', { fontSize: '112px', fontStyle: '900', color: '#293442', align: 'center', stroke: '#FAFAFA', strokeThickness: 16 }).setOrigin(0.5);
    addBgmToggle(this, 'bgm-title', 985, 92);
    makeButton(this, 540, 1570, '시작', () => this.scene.start('Lobby'), { width: 500, height: 130, fill: 0xf5c95d, fontSize: 52 });
  }
}
