import Phaser from 'phaser';
import { SFX_FILES } from '../audio/sfx';
export class Boot extends Phaser.Scene {
  constructor() { super('Boot'); }
  preload(): void {
    this.load.image('title-hero', 'assets/title-hero.png');
    this.load.spritesheet('buildings-sheet', 'assets/buildings-sheet.png', { frameWidth: 724, frameHeight: 724 });
    this.load.spritesheet('units-sheet', 'assets/units-sheet.png', { frameWidth: 290, frameHeight: 774, endFrame: 6 });
    this.load.spritesheet('mobs-sheet', 'assets/mobs-sheet.png', { frameWidth: 543, frameHeight: 724, endFrame: 3 });
    this.load.spritesheet('giants-sheet', 'assets/giants-sheet.png', { frameWidth: 543, frameHeight: 724, endFrame: 3 });
    this.load.spritesheet('stage-bosses-sheet', 'assets/stage-bosses-sheet.png', { frameWidth: 543, frameHeight: 724, endFrame: 3 });
    this.load.spritesheet('swords-sheet', 'assets/swords-sheet.png', { frameWidth: 401, frameHeight: 435, endFrame: 8 });
    this.load.svg('icon-ore', 'assets/icon-gold-ore.svg', { width: 128, height: 128 });
    this.load.svg('icon-diamond', 'assets/icon-diamond.svg', { width: 128, height: 128 });
    this.load.audio('bgm-title', 'assets/audio/title.mp3');
    this.load.audio('bgm-lobby', 'assets/audio/lobby.mp3');
    this.load.audio('bgm-ingame', 'assets/audio/ingame.mp3');
    for (const [key, path] of Object.entries(SFX_FILES)) this.load.audio(key, path);
  }
  create(): void { this.scene.start('Title'); }
}
