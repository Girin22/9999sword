const OUTGAME_SCENES = new Set(['Title', 'Lobby', 'Formation', 'Result']);

export function isOutgameScene(sceneKey: string): boolean {
  return OUTGAME_SCENES.has(sceneKey);
}
