import Phaser from 'phaser';

export const COLORS = { paper: 0xf5e8c8, ink: 0x293442, inkSoft: 0x53616b, blue: 0x4f8fd8, red: 0xd95d5d, gold: 0xe9b949, green: 0x7ebc78, panel: 0xfff8e7, disabled: 0x9a9a8f } as const;

export interface ButtonOptions { width?: number; height?: number; fill?: number; fontSize?: number; stroke?: number; disabled?: boolean; textColor?: string }
/** Vertical thickness of the chunky button base; the face sinks by this much when pressed. */
export const BUTTON_DEPTH = 12;

const shade = (color: number, amount: number): number => {
  const c = Phaser.Display.Color.ValueToColor(color);
  return (amount < 0 ? c.darken(-amount) : c.lighten(amount)).color;
};

/**
 * Chunky casual button: a darker base slab sits under a rounded face; pressing sinks the
 * face (and everything stacked on it) onto the base. Children added later are pressed too.
 */
export function makeButton(scene: Phaser.Scene, x: number, y: number, label: string, onTap: () => void, options: ButtonOptions = {}): Phaser.GameObjects.Container {
  const width = options.width ?? 380; const height = options.height ?? 112;
  const radius = Math.min(30, height * 0.32);
  const fill = options.disabled ? COLORS.disabled : options.fill ?? COLORS.panel;
  const stroke = options.stroke ?? COLORS.ink;
  const left = -width / 2; const top = -height / 2;
  // Ground shadow + base slab (does not move).
  const base = scene.add.graphics().setName("button-base");
  base.fillStyle(0x283442, 0.16).fillRoundedRect(left + 4, top + BUTTON_DEPTH + 8, width, height, radius);
  base.fillStyle(shade(fill, -34), 1).lineStyle(7, stroke, 1).fillRoundedRect(left, top + BUTTON_DEPTH, width, height, radius).strokeRoundedRect(left, top + BUTTON_DEPTH, width, height, radius);
  // Face: main fill, soft top highlight band, thin inner bevel.
  const face = scene.add.graphics().setName("button-face");
  face.fillStyle(fill, 1).lineStyle(7, stroke, 1).fillRoundedRect(left, top, width, height, radius).strokeRoundedRect(left, top, width, height, radius);
  face.fillStyle(shade(fill, 28), 0.55).fillRoundedRect(left + 9, top + 8, width - 18, height * 0.42, { tl: radius - 6, tr: radius - 6, bl: 6, br: 6 });
  face.lineStyle(3, 0xffffff, 0.35).strokeRoundedRect(left + 8, top + 8, width - 16, height - 16, Math.max(6, radius - 8));
  const text = scene.add.text(0, 0, label, { fontFamily: "Pretendard, Noto Sans KR, sans-serif", fontSize: `${options.fontSize ?? 42}px`, color: options.textColor ?? "#293442", fontStyle: "bold", align: "center" }).setOrigin(0.5);
  const container = scene.add.container(x, y, [base, face, text]).setSize(width, height + BUTTON_DEPTH);
  if (options.disabled) { face.setAlpha(0.92); text.setAlpha(0.7); return container; }
  // Press feel: the face sinks fast, stays down for at least PRESS_HOLD_MS so the eye
  // registers it, and the action fires on the way back up — page changes never outrun the press.
  let pressed = false;
  let pressedAt = 0;
  let releaseTimer: Phaser.Time.TimerEvent | undefined;
  let alive = true;
  const moving = (): Phaser.GameObjects.GameObject[] => container.list.filter((child) => child !== base);
  const settle = (down: boolean): void => {
    if (!alive || pressed === down) return;
    pressed = down;
    for (const child of moving()) {
      const node = child as unknown as Phaser.GameObjects.Components.Transform;
      scene.tweens.killTweensOf(node);
      scene.tweens.add({ targets: node, y: node.y + (down ? BUTTON_DEPTH : -BUTTON_DEPTH), duration: down ? PRESS_DOWN_MS : PRESS_UP_MS, ease: down ? "Quad.easeOut" : "Back.easeOut" });
    }
  };
  let releasing = false;
  const release = (fire: boolean): void => {
    // Touch input emits pointerup and then pointerout on the same lift; once a firing
    // release is scheduled, a trailing pointerout must not downgrade it to a cancel.
    if (!pressed || releasing) return;
    releasing = true;
    const wait = Math.max(0, PRESS_HOLD_MS - (scene.time.now - pressedAt));
    releaseTimer?.remove(false);
    releaseTimer = scene.time.delayedCall(wait, () => {
      releasing = false;
      settle(false);
      if (fire && alive) scene.time.delayedCall(PRESS_FIRE_DELAY_MS, () => { if (alive) onTap(); });
    });
  };
  container.setInteractive({ useHandCursor: true })
    .on("pointerdown", () => { pressedAt = scene.time.now; settle(true); })
    .on("pointerup", () => release(true))
    .on("pointerout", () => release(false));
  container.once(Phaser.GameObjects.Events.DESTROY, () => { alive = false; releaseTimer?.remove(false); });
  return container;
}

/** Face travel time going down / back up, minimum visible hold, and the gap before the action fires. */
const PRESS_DOWN_MS = 55;
const PRESS_UP_MS = 110;
const PRESS_HOLD_MS = 90;
const PRESS_FIRE_DELAY_MS = 40;

export type HoloAxis = "order" | "chaos";
export interface HoloFx { glow?: Phaser.FX.Glow; axis: HoloAxis }
export const HOLO_PALETTE: Record<HoloAxis, { glow: number; glowAlt: number; spark: number[]; }> = {
  order: { glow: 0x5ad8ff, glowAlt: 0xffffff, spark: [0xffffff, 0x8ff0ff, 0xc9b8ff] },
  chaos: { glow: 0xff3d7a, glowAlt: 0xb04dff, spark: [0xff5a5a, 0xff3dd0, 0xffb347] },
};

/**
 * Holographic treatment (WebGL only; silently no-op on Canvas).
 * Order = calm prismatic sweep with a cool outline glow. Chaos = fast, flickering
 * reversed sweep with a hot magenta/violet glow.
 */
export function applyHolo(target: { postFX?: Phaser.GameObjects.Components.FX | null }, axis: HoloAxis): HoloFx {
  const fx = target.postFX;
  if (!fx) return { axis };
  fx.clear();
  const palette = HOLO_PALETTE[axis];
  // Outer-only glow: innerStrength 0 keeps the sprite itself untouched and lights just the silhouette edge.
  const glow = axis === "order" ? fx.addGlow(palette.glow, 4, 0, false, 0.12, 16) : fx.addGlow(palette.glow, 5, 0, false, 0.12, 18);
  return { glow, axis };
}

/**
 * Sparkling outline drawn in front of a button/panel (no post-processing, the body stays opaque).
 * A coloured stroke pulses along the rounded rect and a handful of stars ride the perimeter.
 */
export interface HoloOutline { graphics: Phaser.GameObjects.Graphics; axis: HoloAxis; update(time: number): void; destroy(): void }
export function holoOutline(scene: Phaser.Scene, x: number, y: number, width: number, height: number, radius: number, axis: HoloAxis, depth = 30): HoloOutline {
  const graphics = scene.add.graphics().setDepth(depth).setBlendMode(Phaser.BlendModes.ADD);
  const palette = HOLO_PALETTE[axis];
  const rect = new Phaser.Geom.Rectangle(x, y, width, height);
  const stars = axis === "order" ? 6 : 9;
  const update = (time: number): void => {
    if (!graphics.active) return;
    const g = graphics.clear();
    const wave = axis === "order" ? 0.5 + 0.5 * Math.sin(time * 0.004) : Math.max(0.15, Math.sin(time * 0.02) * Math.sin(time * 0.0071));
    const from = Phaser.Display.Color.ValueToColor(palette.glow); const to = Phaser.Display.Color.ValueToColor(palette.glowAlt);
    const mixed = Phaser.Display.Color.Interpolate.ColorWithColor(from, to, 100, Math.round(wave * 100));
    const color = Phaser.Display.Color.GetColor(mixed.r, mixed.g, mixed.b);
    // Soft outer halo + crisp inner line.
    g.lineStyle(14, color, 0.18 + wave * 0.2).strokeRoundedRect(x - 5, y - 5, width + 10, height + 10, radius + 5);
    g.lineStyle(5, color, 0.55 + wave * 0.45).strokeRoundedRect(x, y, width, height, radius);
    // Stars travelling around the perimeter.
    const speed = axis === "order" ? 0.00012 : 0.00032;
    for (let i = 0; i < stars; i += 1) {
      const t = ((i / stars) + time * speed) % 1;
      const p = Phaser.Geom.Rectangle.GetPoint(rect, t);
      const tint = palette.spark[i % palette.spark.length]!;
      const twinkle = axis === "order" ? 0.6 + 0.4 * Math.sin(time * 0.007 + i * 1.3) : Math.max(0.25, Math.sin(time * 0.05 + i * 2.1));
      const size = (axis === "order" ? 5 : 4) + 4 * twinkle;
      g.fillStyle(tint, twinkle);
      g.fillPoints([{ x: p.x, y: p.y - size * 2 }, { x: p.x + size * 0.55, y: p.y }, { x: p.x, y: p.y + size * 2 }, { x: p.x - size * 0.55, y: p.y }], true);
      g.fillPoints([{ x: p.x - size * 2, y: p.y }, { x: p.x, y: p.y - size * 0.55 }, { x: p.x + size * 2, y: p.y }, { x: p.x, y: p.y + size * 0.55 }], true);
      g.fillStyle(0xffffff, twinkle * 0.9).fillCircle(p.x, p.y, size * 0.35);
    }
  };
  return { graphics, axis, update, destroy: () => graphics.destroy() };
}

export function clearHolo(target: { postFX?: Phaser.GameObjects.Components.FX | null }): void {
  target.postFX?.clear();
}

/** Per-frame animation for a holo: outline glow breathes (order) or flickers (chaos), and drifts between two hues. */
export function animateHolo(holo: HoloFx, time: number, phase = 0): void {
  if (!holo.glow) return;
  const palette = HOLO_PALETTE[holo.axis];
  const wave = holo.axis === "order" ? 0.5 + 0.5 * Math.sin(time * 0.004 + phase) : Math.max(0, Math.sin(time * 0.021 + phase) * Math.sin(time * 0.0073 + phase * 2)) ;
  holo.glow.outerStrength = holo.axis === "order" ? 3 + wave * 3 : 3.5 + wave * 5;
  const mix = holo.axis === "order" ? wave : 0.5 + 0.5 * Math.sin(time * 0.006 + phase);
  const from = Phaser.Display.Color.ValueToColor(palette.glow); const to = Phaser.Display.Color.ValueToColor(palette.glowAlt);
  const blended = Phaser.Display.Color.Interpolate.ColorWithColor(from, to, 100, Math.round(mix * 100));
  holo.glow.color = Phaser.Display.Color.GetColor(blended.r, blended.g, blended.b);
}

export function paperPanel(scene: Phaser.Scene, x: number, y: number, width: number, height: number, fill: number = COLORS.panel): Phaser.GameObjects.Graphics {
  return scene.add.graphics()
    .fillStyle(COLORS.ink, 0.16).fillRoundedRect(x + 10, y + 14, width, height, 34)
    .fillStyle(fill, 0.98).lineStyle(7, COLORS.ink, 1).fillRoundedRect(x, y, width, height, 32).strokeRoundedRect(x, y, width, height, 32)
    .lineStyle(3, 0xffffff, 0.45).strokeRoundedRect(x + 13, y + 13, width - 26, height - 26, 22);
}

export function addSheetSprite(scene: Phaser.Scene, key: string, index: number, columns: number, rows = 1): Phaser.GameObjects.Image {
  const image = scene.add.image(0, 0, key, index);
  image.setData('sheetCellWidth', image.width).setData('sheetCellHeight', image.height);
  void columns;
  void rows;
  return image;
}

export function sizeSheetSprite(image: Phaser.GameObjects.Image, width: number, height: number): Phaser.GameObjects.Image {
  const cellWidth = Number(image.getData('sheetCellWidth')) || image.width;
  const cellHeight = Number(image.getData('sheetCellHeight')) || image.height;
  const scale = Math.min(width / cellWidth, height / cellHeight);
  return image.setScale(scale);
}

export type IconKey = 'icon-ore' | 'icon-diamond';
export interface IconLabel { root: Phaser.GameObjects.Container; icon: Phaser.GameObjects.Image; text: Phaser.GameObjects.Text; setText(value: string): void }

/**
 * Currency-style label: an SVG icon followed by text, laid out as one group.
 * `align` sets which edge of the group sits on (x, y); the group is vertically centered.
 */
export function iconLabel(scene: Phaser.Scene, x: number, y: number, icon: IconKey, value: string, style: Phaser.Types.GameObjects.Text.TextStyle, align: 'left' | 'center' | 'right' = 'left'): IconLabel {
  const size = parseFloat(String(style.fontSize ?? '32')) || 32;
  const iconSize = size * 1.3;
  const gap = size * 0.28;
  const image = scene.add.image(0, 0, icon).setDisplaySize(iconSize, iconSize).setOrigin(0, 0.5);
  const text = scene.add.text(0, 0, value, style).setOrigin(0, 0.5);
  const root = scene.add.container(x, y, [image, text]);
  const layout = (): void => {
    const total = iconSize + gap + text.displayWidth;
    const start = align === 'left' ? 0 : align === 'center' ? -total / 2 : -total;
    image.setPosition(start, 0);
    text.setPosition(start + iconSize + gap, 0);
  };
  layout();
  return { root, icon: image, text, setText: (next: string) => { text.setText(next); layout(); } };
}

export function titleText(scene: Phaser.Scene, y: number, text: string, size = 72): Phaser.GameObjects.Text {
  return scene.add.text(540, y, text, { fontFamily: 'Pretendard, Noto Sans KR, sans-serif', fontSize: `${size}px`, fontStyle: 'bold', color: '#293442', align: 'center', stroke: '#fff4d8', strokeThickness: 10 }).setOrigin(0.5);
}
