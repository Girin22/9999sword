import Phaser from 'phaser';
import { constants } from './data';
import { Battle } from './scenes/Battle';
import { BattleHUD } from './scenes/BattleHUD';
import { Boot } from './scenes/Boot';
import { Formation } from './scenes/Formation';
import { Lobby } from './scenes/Lobby';
import { Result } from './scenes/Result';
import { Title } from './scenes/Title';
import { installTextDefaults } from './ui/text';

installTextDefaults();

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO, parent: 'game', width: constants.screen.width, height: constants.screen.height,
  backgroundColor: '#f3e7c9', render: { antialias: true, pixelArt: false },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: constants.screen.width, height: constants.screen.height },
  input: { activePointers: 3 }, scene: [Boot, Title, Lobby, Formation, Battle, BattleHUD, Result],
};
