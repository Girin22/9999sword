import Phaser from 'phaser';

const FONT_FAMILY = 'Pretendard, Noto Sans KR, sans-serif';

/** Phaser measures line height by pixel-scanning these Latin glyphs. */
const PHASER_PROBE = '|MÉq';
/** Tall Hangul / ideograph samples that overflow the Latin ascent. */
const HANGUL_PROBE = '뷁핥붉힣國龍';

const metricCache = new Map<string, { top: number; bottom: number }>();
let measureCtx: CanvasRenderingContext2D | null = null;

/**
 * How many extra pixels Hangul glyphs need above/below Phaser's Latin-based line box.
 * Measured once per font string via canvas text metrics.
 */
function hangulOverflow(font: string, size: number): { top: number; bottom: number } {
  const cached = metricCache.get(font);
  if (cached) return cached;
  measureCtx ??= document.createElement('canvas').getContext('2d');
  let result = { top: Math.ceil(size * 0.35), bottom: Math.ceil(size * 0.2) };
  if (measureCtx) {
    measureCtx.font = font;
    const latin = measureCtx.measureText(PHASER_PROBE);
    const hangul = measureCtx.measureText(HANGUL_PROBE);
    if (Number.isFinite(hangul.actualBoundingBoxAscent) && Number.isFinite(latin.actualBoundingBoxAscent)) {
      const top = hangul.actualBoundingBoxAscent - latin.actualBoundingBoxAscent;
      const bottom = hangul.actualBoundingBoxDescent - latin.actualBoundingBoxDescent;
      result = { top: Math.ceil(Math.max(0, top) + size * 0.12), bottom: Math.ceil(Math.max(0, bottom) + size * 0.08) };
    }
  }
  metricCache.set(font, result);
  return result;
}

/**
 * Registers a global override of `scene.add.text` so every Text object gets
 * the shared font family plus vertical padding sized to the actual font metrics.
 *
 * Phaser measures text height with Latin glyphs; Hangul glyphs (and bold weights)
 * have taller ascenders, so without padding the top of the canvas clips them.
 */
export function installTextDefaults(): void {
  // `GameObjectFactory.register` silently ignores names Phaser already registered,
  // so the built-in `text` factory must be replaced on the prototype directly.
  const factoryPrototype = Phaser.GameObjects.GameObjectFactory.prototype as unknown as Record<string, unknown>;
  factoryPrototype.text =
    function (this: Phaser.GameObjects.GameObjectFactory, x: number, y: number, content: string | string[], style: Phaser.Types.GameObjects.Text.TextStyle = {}) {
      const size = parseFloat(String(style.fontSize ?? '16')) || 16;
      const stroke = style.strokeThickness ?? 0;
      const family = style.fontFamily ?? FONT_FAMILY;
      const fontStyle = style.fontStyle ?? '';
      const overflow = hangulOverflow(`${fontStyle} ${size}px ${family}`.trim(), size);
      const padding = style.padding ?? {
        x: Math.ceil(size * 0.12 + stroke / 2),
        top: overflow.top + Math.ceil(stroke / 2),
        bottom: overflow.bottom + Math.ceil(stroke / 2),
      };
      const text = new Phaser.GameObjects.Text(this.scene, x, y, content, { fontFamily: family, ...style, padding });
      return this.displayList.add(text);
    };
}
