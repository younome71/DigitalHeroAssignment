import { PDFDocument, StandardFonts, type PDFFont } from 'pdf-lib';
import type { TextMeasurer } from './template-fit';

/**
 * pdf-lib's StandardFonts use WinAnsi (CP1252) encoding. Characters outside
 * this range (macrons, emoji, CJK) throw at embed time. Sanitize by NFKD-
 * decomposing and stripping combining marks, then replacing any remaining
 * non-Latin-1 code points with '?'.
 *
 * Production note: swap StandardFonts for a bundled Inter embedded via
 * `@pdf-lib/fontkit` to preserve macrons and full Unicode.
 */
export function sanitizeForWinAnsi(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x00-\xFF]/g, '?');
}

export function resolveStandardFont(family: string): StandardFonts {
  const f = family.toLowerCase();
  if (f.includes('mono') || f.includes('courier')) return StandardFonts.Courier;
  if (f.includes('times')) return StandardFonts.TimesRoman;
  if (f.includes('serif') && !f.includes('sans')) return StandardFonts.TimesRoman;
  return StandardFonts.Helvetica;
}

interface FontTriple {
  helvetica: PDFFont;
  timesRoman: PDFFont;
  courier: PDFFont;
}

let _fonts: FontTriple | null = null;

export async function loadFonts(): Promise<FontTriple> {
  if (_fonts) return _fonts;
  const doc = await PDFDocument.create();
  _fonts = {
    helvetica: await doc.embedFont(StandardFonts.Helvetica),
    timesRoman: await doc.embedFont(StandardFonts.TimesRoman),
    courier: await doc.embedFont(StandardFonts.Courier),
  };
  return _fonts;
}

export function pickFont(fonts: FontTriple, family: string): PDFFont {
  const f = family.toLowerCase();
  if (f.includes('mono') || f.includes('courier')) return fonts.courier;
  if (f.includes('times')) return fonts.timesRoman;
  if (f.includes('serif') && !f.includes('sans')) return fonts.timesRoman;
  return fonts.helvetica;
}

/**
 * Synchronous text measurer backed by embedded StandardFonts.
 * Call `await loadFonts()` once before use.
 */
export function createServerMeasurer(fonts: FontTriple): TextMeasurer {
  return {
    measureWidth(text, fontFamily, fontSize, letterSpacing) {
      const font = pickFont(fonts, fontFamily);
      const sanitized = sanitizeForWinAnsi(text);
      const base = font.widthOfTextAtSize(sanitized, fontSize);
      // Matches Phase 3's browser measurer (spacing * length).
      return base + letterSpacing * sanitized.length;
    },
  };
}