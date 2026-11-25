import type { TemplateFitRules } from '@/types/database';

// ---------------------------------------------------------------------------
// Contract: a measurer is injected so the same fit logic works in the browser
// (Phase 3) and server-side (Phase 4 CSV merge, with pdf-lib measurement).
// ---------------------------------------------------------------------------

export interface TextMeasurer {
  measureWidth(
    text: string,
    fontFamily: string,
    fontSize: number,
    letterSpacing: number,
  ): number;
}

export interface FitInput {
  text: string;
  rules: TemplateFitRules;
  boundsWidthPx: number;
  boundsHeightPx: number;
  preferredFontSize: number;
  preferredLetterSpacing: number;
  fontFamily: string;
}

export interface FitOutput {
  fontSize: number;
  letterSpacing: number;
  /** Horizontal squeeze for `stretch` mode (1.0 = no squeeze). */
  scaleX: number;
  lineHeight: number;
  fitsOnSingleLine: boolean;
}

const LINE_HEIGHT = 1.15;

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * Applies the product's fit rules to a text placeholder so it never
 * overflows its bounds. Pure function — deterministic for a given measurer.
 */
export function fitText(input: FitInput, measurer: TextMeasurer): FitOutput {
  const {
    text,
    rules,
    boundsWidthPx,
    preferredFontSize,
    preferredLetterSpacing,
    fontFamily,
  } = input;

  let fontSize = clamp(
    preferredFontSize,
    rules.min_font_size,
    rules.max_font_size,
  );
  let letterSpacing = clamp(
    preferredLetterSpacing,
    rules.letter_spacing_min,
    rules.letter_spacing_max,
  );

  const measure = (fs: number, ls: number) =>
    measurer.measureWidth(text, fontFamily, fs, ls);

  // --- 1. Overflow-driven font shrink (all modes) -----------------------
  const naturalWidth = measure(fontSize, letterSpacing);
  if (naturalWidth > boundsWidthPx) {
    const ratio = boundsWidthPx / naturalWidth;
    fontSize = Math.max(
      rules.min_font_size,
      Math.floor(fontSize * ratio * 100) / 100,
    );
  }

  // --- 2. Mode-specific adjustments -------------------------------------
  let scaleX = 1;

  if (rules.mode === 'fit') {
    // Keep font size; tighten letter spacing until it fits, or until min.
    let candidate = letterSpacing;
    for (let i = 0; i < 20; i += 1) {
      if (measure(fontSize, candidate) <= boundsWidthPx) break;
      if (candidate <= rules.letter_spacing_min) break;
      candidate = Math.max(rules.letter_spacing_min, candidate - 0.2);
    }
    letterSpacing = candidate;

    // If still overflows at min spacing, shrink font as a final safeguard.
    if (measure(fontSize, letterSpacing) > boundsWidthPx) {
      const ratio = boundsWidthPx / measure(fontSize, letterSpacing);
      fontSize = Math.max(
        rules.min_font_size,
        Math.floor(fontSize * ratio * 100) / 100,
      );
    }
  } else if (rules.mode === 'stretch') {
    const finalWidth = measure(fontSize, letterSpacing);
    if (finalWidth > boundsWidthPx) {
      scaleX = boundsWidthPx / finalWidth;
    }
  } else {
    // 'shrink' — the font shrink above already handles it; no extra work.
  }

  const measuredFinalWidth = measure(fontSize, letterSpacing) * scaleX;

  return {
    fontSize: Math.round(fontSize * 100) / 100,
    letterSpacing: Math.round(letterSpacing * 100) / 100,
    scaleX,
    lineHeight: LINE_HEIGHT,
    fitsOnSingleLine: measuredFinalWidth <= boundsWidthPx + 0.5,
  };
}

// ---------------------------------------------------------------------------
// Browser measurer — backed by an offscreen canvas. Cached per font/size.
// ---------------------------------------------------------------------------

let _canvas: HTMLCanvasElement | null = null;
let _ctx: CanvasRenderingContext2D | null = null;

function getCtx(): CanvasRenderingContext2D {
  if (_ctx) return _ctx;
  if (typeof document === 'undefined') {
    throw new Error('browserTextMeasurer requires a document context');
  }
  _canvas = document.createElement('canvas');
  _ctx = _canvas.getContext('2d');
  if (!_ctx) throw new Error('Unable to acquire 2D canvas context');
  return _ctx;
}

export const browserTextMeasurer: TextMeasurer = {
  measureWidth(text, fontFamily, fontSize, letterSpacing) {
    const ctx = getCtx();
    ctx.font = `${fontSize}px ${fontFamily}`;
    const base = ctx.measureText(text).width;
    // Konva applies letter-spacing after every glyph including the last.
    const spacing = letterSpacing * text.length;
    return base + spacing;
  },
};