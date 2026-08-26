export const L = {
  W: 1080, H: 1920,
  hud: { speed: { x: 776, y: 40, w: 125, h: 104 }, menu: { x: 928, y: 40, w: 125, h: 104 } },
  enemyZone: { y0: 0, y1: 539 }, allyZone: { y0: 544, y1: 1229 }, wallBar: { y0: 1240, y1: 1280 },
  wall: { y0: 1280, y1: 1397, gateX: 540, gateW: 160 },
  buildings: { forge: { x: 64, y: 1323, w: 261, h: 261 }, barracks: { x: 411, y: 1323, w: 261, h: 261 }, mine: { x: 755, y: 1323, w: 261, h: 261 } },
  forgeLabel: { x: 64, y: 1397, w: 261, h: 187 },
  actionBar: { y0: 1683, y1: 1845, enhance: { x: 299, w: 474 }, slots: [{ x: 64 }, { x: 283 }, { x: 504 }], slotW: 168, right: { x: 800, w: 168 } },
} as const;
