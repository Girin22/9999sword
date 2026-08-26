import { describe, expect, it } from 'vitest';
import { isOutgameScene } from '../src/audio/scope';

describe('outgame button audio scope', () => {
  it.each(['Title', 'Lobby', 'Formation', 'Result'])('enables clicks in %s', (scene) => {
    expect(isOutgameScene(scene)).toBe(true);
  });

  it.each(['Battle', 'BattleHUD', 'Boot'])('keeps clicks silent in %s', (scene) => {
    expect(isOutgameScene(scene)).toBe(false);
  });
});
