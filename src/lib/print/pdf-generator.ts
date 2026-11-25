import 'server-only';

import { PDFDocument, rgb, degrees, type PDFImage, type PDFFont } from 'pdf-lib';
import { readFile } from 'fs/promises';
import path from 'path';
import type { ProductRow, TemplateRow } from '@/types/database';
import { fitText } from './template-fit';
import {
  createServerMeasurer,
  loadFonts,
  pickFont,
  sanitizeForWinAnsi,
} from './fonts';
import type {
  CanvasElement,
  CanvasImageElement,
  CanvasJson,
  CanvasTextElement,
} from './canvas-json';

const MM_TO_PT = 2.83465;
const MAX_IMAGE_BYTES = 25 * 1024 * 1024;

export interface GeneratePdfOptions {
  canvasJson: CanvasJson;
  product: ProductRow;
  template: TemplateRow;
  widthMm: number;
  heightMm: number;
}

interface EmbedContext {
  pdfDoc: PDFDocument;
  scaleX: number;
  scaleY: number;
  pageHeightPt: number;
  imageCache: Map<string, PDFImage>;
}

export async function generatePdf(
  opts: GeneratePdfOptions,
): Promise<Uint8Array> {
  const { canvasJson, product, template, widthMm, heightMm } = opts;
  const bleed = Number(product.bleed_mm);

  const pageWidthPt = (widthMm + 2 * bleed) * MM_TO_PT;
  const pageHeightPt = (heightMm + 2 * bleed) * MM_TO_PT;

  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle(`Digital Heroes — ${product.name}`);
  pdfDoc.setProducer('Digital Heroes Print Engine');
  pdfDoc.setCreator('digital-heroes.app');

  const page = pdfDoc.addPage([pageWidthPt, pageHeightPt]);
  page.setMediaBox(0, 0, pageWidthPt, pageHeightPt);

  const scaleX = pageWidthPt / canvasJson.canvas_width_px;
  const scaleY = pageHeightPt / canvasJson.canvas_height_px;

  if (template.background_url) {
    try {
      const img = await embedImage(pdfDoc, template.background_url);
      page.drawImage(img, {
        x: 0,
        y: 0,
        width: pageWidthPt,
        height: pageHeightPt,
      });
    } catch (err) {
      console.warn('[pdf] background embed failed:', err);
      page.drawRectangle({
        x: 0,
        y: 0,
        width: pageWidthPt,
        height: pageHeightPt,
        color: rgb(1, 1, 1),
      });
    }
  } else {
    page.drawRectangle({
      x: 0,
      y: 0,
      width: pageWidthPt,
      height: pageHeightPt,
      color: rgb(1, 1, 1),
    });
  }

  const fonts = await loadFonts();
  const measurer = createServerMeasurer(fonts);

  const ctx: EmbedContext = {
    pdfDoc,
    scaleX,
    scaleY,
    pageHeightPt,
    imageCache: new Map(),
  };

  for (const el of canvasJson.elements) {
    if (!el.visible) continue;
    if (el.type === 'text') {
      drawTextElement(page, el, product, fonts, measurer, ctx);
    } else if (el.type === 'image') {
      await drawImageElement(page, el, ctx);
    }
  }

  if (bleed > 0) {
    drawCropMarks(page, widthMm, heightMm, bleed, pageWidthPt, pageHeightPt);
  }

  return pdfDoc.save();
}

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

function drawTextElement(
  page: ReturnType<PDFDocument['addPage']>,
  el: CanvasTextElement,
  product: ProductRow,
  fonts: Awaited<ReturnType<typeof loadFonts>>,
  measurer: ReturnType<typeof createServerMeasurer>,
  ctx: EmbedContext,
): void {
  const rules = product.template_fit_rules;
  const fitted = fitText(
    {
      text: el.text,
      rules,
      boundsWidthPx: el.width,
      boundsHeightPx: el.height,
      preferredFontSize: el.fontSize,
      preferredLetterSpacing: el.letterSpacing,
      fontFamily: el.fontFamily,
    },
    measurer,
  );

  const fontSizePt = fitted.fontSize * ctx.scaleY;
  if (fontSizePt <= 0.1) return;

  const font: PDFFont = pickFont(fonts, el.fontFamily);
  const sanitized = sanitizeForWinAnsi(el.text);
  const color = hexToRgb(el.fill);

  const elementCenterXpt = el.x * ctx.scaleX;
  const elementCenterYpt = ctx.pageHeightPt - el.y * ctx.scaleY;
  const elementLeftPt = (el.x - el.width / 2) * ctx.scaleX;
  const elementRightPt = (el.x + el.width / 2) * ctx.scaleX;

  const lines = sanitized.split('\n');
  const lineHeightPt = fontSizePt * 1.15;
  const totalHeightPt = (lines.length - 1) * lineHeightPt;

  const rotationRad = (-el.rotation * Math.PI) / 180;
  const cos = Math.cos(rotationRad);
  const sin = Math.sin(rotationRad);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.length === 0) continue;

    const lineWidthPt = font.widthOfTextAtSize(line, fontSizePt);
    const lineHalfW = lineWidthPt / 2;
    const lineHalfH = fontSizePt / 2;

    const localY = totalHeightPt / 2 - i * lineHeightPt;

    let lineCenterXpt = elementCenterXpt;
    if (el.rotation === 0) {
      if (el.align === 'left') lineCenterXpt = elementLeftPt + lineHalfW;
      else if (el.align === 'right') lineCenterXpt = elementRightPt - lineHalfW;
    }

    const lineCxpt = elementCenterXpt + (lineCenterXpt - elementCenterXpt) * cos - localY * sin;
    const lineCypt = elementCenterYpt + (lineCenterXpt - elementCenterXpt) * sin + localY * cos;

    const x = lineCxpt - lineHalfW * cos + lineHalfH * sin;
    const y = lineCypt - lineHalfW * sin - lineHalfH * cos;

    page.drawText(line, {
      x,
      y,
      size: fontSizePt,
      font,
      color,
      rotate: degrees(-el.rotation),
    });
  }
}

// ---------------------------------------------------------------------------
// Image
// ---------------------------------------------------------------------------

async function drawImageElement(
  page: ReturnType<PDFDocument['addPage']>,
  el: CanvasImageElement,
  ctx: EmbedContext,
): Promise<void> {
  let img = ctx.imageCache.get(el.src);
  if (!img) {
    try {
      img = await embedImage(ctx.pdfDoc, el.src);
      ctx.imageCache.set(el.src, img);
    } catch (err) {
      console.warn('[pdf] image embed failed:', el.src, err);
      return;
    }
  }

  const wPt = el.width * ctx.scaleX;
  const hPt = el.height * ctx.scaleY;

  const centerXpt = el.x * ctx.scaleX;
  const centerYpt = ctx.pageHeightPt - el.y * ctx.scaleY;

  const rad = (-el.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  const x = centerXpt - (wPt / 2) * cos + (hPt / 2) * sin;
  const y = centerYpt - (wPt / 2) * sin - (hPt / 2) * cos;

  page.drawImage(img, {
    x,
    y,
    width: wPt,
    height: hPt,
    rotate: degrees(-el.rotation),
  });
}

async function embedImage(
  pdfDoc: PDFDocument,
  url: string,
): Promise<PDFImage> {
  let buf: Uint8Array;
  let contentType = '';

  if (url.startsWith('/')) {
    // Serverless-safe: read public assets from disk directly.
    const filePath = path.join(process.cwd(), 'public', url);
    const data = await readFile(filePath);
    buf = new Uint8Array(data);
    const ext = url.split('.').pop()?.toLowerCase() ?? '';
    if (ext === 'png') contentType = 'image/png';
    else if (ext === 'jpg' || ext === 'jpeg') contentType = 'image/jpeg';
  } else {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Image fetch ${res.status}: ${url}`);
    contentType = res.headers.get('content-type') ?? '';
    buf = new Uint8Array(await res.arrayBuffer());
  }

  if (buf.byteLength > MAX_IMAGE_BYTES) {
    throw new Error('Image exceeds 25MB limit');
  }

  const isPng =
    contentType.includes('png') || (buf[0] === 0x89 && buf[1] === 0x50);
  const isJpg =
    contentType.includes('jpeg') ||
    contentType.includes('jpg') ||
    (buf[0] === 0xff && buf[1] === 0xd8);

  if (isPng) return pdfDoc.embedPng(buf);
  if (isJpg) return pdfDoc.embedJpg(buf);

  try {
    return pdfDoc.embedPng(buf);
  } catch {
    return pdfDoc.embedJpg(buf);
  }
}

// ---------------------------------------------------------------------------
// Crop marks
// ---------------------------------------------------------------------------

function drawCropMarks(
  page: ReturnType<PDFDocument['addPage']>,
  widthMm: number,
  heightMm: number,
  bleedMm: number,
  pageWidthPt: number,
  pageHeightPt: number,
): void {
  const bleedPt = bleedMm * MM_TO_PT;
  const cropLen = Math.min(4 * MM_TO_PT, bleedPt * 0.9);
  const stroke = rgb(0, 0, 0);
  const thickness = 0.25;

  const trimLeft = bleedPt;
  const trimBottom = bleedPt;
  const trimRight = pageWidthPt - bleedPt;
  const trimTop = pageHeightPt - bleedPt;

  page.drawLine({
    start: { x: trimLeft - cropLen, y: trimBottom },
    end: { x: trimLeft, y: trimBottom },
    thickness,
    color: stroke,
  });
  page.drawLine({
    start: { x: trimLeft, y: trimBottom - cropLen },
    end: { x: trimLeft, y: trimBottom },
    thickness,
    color: stroke,
  });

  page.drawLine({
    start: { x: trimRight, y: trimBottom },
    end: { x: trimRight + cropLen, y: trimBottom },
    thickness,
    color: stroke,
  });
  page.drawLine({
    start: { x: trimRight, y: trimBottom - cropLen },
    end: { x: trimRight, y: trimBottom },
    thickness,
    color: stroke,
  });

  page.drawLine({
    start: { x: trimLeft - cropLen, y: trimTop },
    end: { x: trimLeft, y: trimTop },
    thickness,
    color: stroke,
  });
  page.drawLine({
    start: { x: trimLeft, y: trimTop },
    end: { x: trimLeft, y: trimTop + cropLen },
    thickness,
    color: stroke,
  });

  page.drawLine({
    start: { x: trimRight, y: trimTop },
    end: { x: trimRight + cropLen, y: trimTop },
    thickness,
    color: stroke,
  });
  page.drawLine({
    start: { x: trimRight, y: trimTop },
    end: { x: trimRight, y: trimTop + cropLen },
    thickness,
    color: stroke,
  });

  void widthMm;
  void heightMm;
}

function hexToRgb(hex: string) {
  const normalized = hex.replace('#', '');
  const full =
    normalized.length === 3
      ? normalized.split('').map((c) => c + c).join('')
      : normalized.padEnd(6, '0').slice(0, 6);
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  return rgb(
    Number.isFinite(r) ? r : 0,
    Number.isFinite(g) ? g : 0,
    Number.isFinite(b) ? b : 0,
  );
}