import Phaser from 'phaser';
import { session } from '../session';
import { isOutgameScene } from './scope';

export const UI_CLICK_KEY = 'sfx-ui-click';
export const UI_SFX_FILES: Record<string, string> = {
  [UI_CLICK_KEY]: 'assets/audio/sfx/ui-click.wav',
};

/**
 * Plays the soft wood-and-sparkle tap used by menus. Battle and BattleHUD are
 * deliberately absent from the allow-list, even though they share makeButton.
 */
export function playUiClick(scene: Phaser.Scene): void {
  if (!session.save.sound || !isOutgameScene(scene.sys.settings.key)) return;
  if (!scene.cache.audio.exists(UI_CLICK_KEY)) return;
  scene.sound.play(UI_CLICK_KEY, { volume: 0.42 });
}
